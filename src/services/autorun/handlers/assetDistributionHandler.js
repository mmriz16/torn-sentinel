/**
 * Asset Distribution Handler
 * Shows WHERE the wealth is distributed
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';

// Category groupings for cleaner display
// Labels updated to use UI keys for localization
const ASSET_GROUPS = {
    'liquid': {
        uiKey: 'liquidity', // maps to "Likuiditas"
        color: '🟢',
        keys: ['wallet', 'piggybank', 'vault']
    },
    'savings': {
        uiKey: 'bank_investment', // maps to "Investasi Bank"
        color: '🔵',
        keys: ['bank', 'cayman']
    },
    'points': {
        uiKey: 'points', // maps to "Poin"
        color: '🟣',
        keys: ['points']
    },
    'inventory': {
        uiKey: 'inventory', // maps to "Inventaris"
        color: '🎒',
        keys: ['items', 'displaycase']
    },
    'market_items': {
        uiKey: 'market_assets', // maps to "Aset Pasar"
        color: '📦',
        keys: ['bazaar', 'itemmarket', 'auctionhouse', 'trade']
    },
    'properties': {
        uiKey: 'properties', // maps to "Properti"
        color: '🟨',
        keys: ['properties']
    },
    'investments': {
        uiKey: 'investments', // maps to "Investasi"
        color: '🟧',
        keys: ['stockmarket', 'company', 'bookie']
    },
    'liabilities': {
        uiKey: 'liabilities', // maps to "Kewajiban"
        color: '🔴',
        keys: ['unpaidfees', 'loan']
    }
};

export async function assetDistributionHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Fetch current networth data (V1 API)
        const data = await getCombinedStats(user.apiKey, 'networth');
        if (!data.networth) return null;

        const networth = data.networth;
        const total = networth.total || 0;

        // Map API data to our structure
        const assetValues = { ...networth };

        // Calculate group totals
        const groupTotals = {};
        for (const [groupKey, group] of Object.entries(ASSET_GROUPS)) {
            let groupTotal = 0;
            for (const key of group.keys) {
                groupTotal += assetValues[key] || 0;
            }
            groupTotals[groupKey] = groupTotal;
        }

        // Separate groups
        const positiveGroups = [];
        const negativeGroups = [];

        for (const [groupKey, value] of Object.entries(groupTotals)) {
            if (value > 0) positiveGroups.push({ key: groupKey, value });
            else if (value < 0) negativeGroups.push({ key: groupKey, value });
        }

        // Identify Zero Items (Individual keys)
        const zeroItemLabels = [];
        const allKeysToCheck = [
            'bank', 'piggybank', 'vault', 'cayman', // Liquid/Savings
            'displaycase', // Inventory
            'bazaar', 'auctionhouse', 'trade', // Market
            'stockmarket', 'company', 'bookie', // Investments
            'properties' // Properties
        ];

        for (const key of allKeysToCheck) {
            if (!assetValues[key] || assetValues[key] === 0) {
                // Try to get localized name from UI (if matches key), fallback to key
                // For keys like 'stockmarket', 'company', etc. we added them to dictionary
                const label = getUi(key) || key;
                zeroItemLabels.push(label);
            }
        }

        // Calculate Gross/Liability Totals
        const liabilityTotal = groupTotals['liabilities'] || 0;
        const grossTotal = total - liabilityTotal;

        // Sort positives by value desc
        positiveGroups.sort((a, b) => b.value - a.value);

        // Build Positive Assets Display
        const assetLines = [];
        for (const { key, value } of positiveGroups) {
            const group = ASSET_GROUPS[key];
            const label = getUi(group.uiKey) || key; // Localized Label
            const combinedLabel = `${group.color} ${label}`;

            const percent = grossTotal > 0 ? ((value / grossTotal) * 100).toFixed(1) : 0;
            const percentStr = `${percent}%`.padStart(6);

            assetLines.push(`${combinedLabel.padEnd(20)} ${percentStr}  (${formatMoney(value)})`);
        }

        // Build Liabilities Display
        const liabilityLines = [];
        for (const { key, value } of negativeGroups) {
            const group = ASSET_GROUPS[key];
            const label = getUi(group.uiKey) || key; // Localized Label
            const combinedLabel = `${group.color} ${label}`;

            const percent = grossTotal > 0 ? ((value / grossTotal) * 100).toFixed(1) : 0;
            const percentStr = `${percent}%`.padStart(6);
            liabilityLines.push(`${combinedLabel.padEnd(20)} ${percentStr}  (${formatMoney(value)})`);
        }

        // Build Zero Assets String
        const zeroString = zeroItemLabels.join(', ');

        // Calculate liquidity ratio
        const liquidTotal = groupTotals.liquid + groupTotals.points;
        const liquidityRatio = total > 0 ? ((liquidTotal / total) * 100).toFixed(0) : 0;

        // Embed Color
        let color = 0x3498DB;
        if (liabilityTotal < -1000000) color = 0xE74C3C;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`📊 ${getUi('asset_distribution')}`)

            // 1. Assets Block
            .addFields({
                name: `📈 ${getUi('assets')}`,
                value: '```\n' + (assetLines.length ? assetLines.join('\n') : getUi('empty_assets')) + '\n```',
                inline: false
            });

        // 2. Liabilities Block (if any)
        if (liabilityLines.length > 0) {
            embed.addFields({
                name: `📉 ${getUi('liabilities')}`,
                value: '```diff\n' + liabilityLines.join('\n') + '\n```',
                inline: false
            });
        }

        // 3. Zero Assets (if any)
        if (zeroItemLabels.length > 0) {
            embed.addFields({
                name: `🚫 ${getUi('empty_assets')}`,
                value: '```' + zeroString + '```',
                inline: false
            });
        }

        // 4. Totals
        embed.addFields(
            {
                name: getUi('networth'), // "Kekayaan Bersih"
                value: `\`\`\`${formatMoney(total)}\`\`\``,
                inline: true
            },
            {
                name: getUi('liquidity_ratio'), // "Rasio Likuiditas"
                value: `\`\`\`${liquidityRatio}%\`\`\``,
                inline: true
            }
        )
            .setFooter({ text: 'Torn Sentinel • Updated daily' })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Asset Distribution Handler Error:', error.message);
        return null;
    }
}
