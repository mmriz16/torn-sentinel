/**
 * Asset Distribution Handler
 * Shows WHERE the wealth is distributed
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';

// Category groupings for cleaner display
const ASSET_GROUPS = {
    'liquid': {
        label: '💵 Liquid Cash',
        color: '🟢',
        keys: ['wallet', 'piggybank', 'vault'] // Removed bank/cayman (not instant)
    },
    'savings': {
        label: '🏦 Bank & Savings',
        color: '🔵', // Blue for bank
        keys: ['bank', 'cayman']
    },
    'points': {
        label: '💎 Points',
        color: '🟣',
        keys: ['points']
    },
    'inventory': {
        label: '🎒 Inventory',
        color: '🎒',
        keys: ['items', 'displaycase']
    },
    'market_items': {
        label: '🏪 Market Listings',
        color: '📦',
        keys: ['bazaar', 'itemmarket', 'auctionhouse', 'trade']
    },
    'properties': {
        label: '🏠 Properties',
        color: '🟨',
        keys: ['properties']
    },
    'investments': {
        label: '📊 Investments',
        color: '🟧',
        keys: ['stockmarket', 'company', 'bookie']
    },
    'liabilities': {
        label: '⚠️ Liabilities',
        color: '🔴',
        keys: ['unpaidfees', 'loan']
    }
};

// Friendly names for individual keys
const KEY_LABELS = {
    wallet: 'Wallet', bank: 'Bank', piggybank: 'Piggy Bank', vault: 'Vault', cayman: 'Cayman Islands',
    points: 'Points', items: 'Inventory Items', displaycase: 'Display Case',
    bazaar: 'Bazaar', itemmarket: 'Item Market', auctionhouse: 'Auction House', trade: 'Trades',
    properties: 'Properties', stockmarket: 'Stocks', company: 'Company Funds', bookie: 'Bookie',
    unpaidfees: 'Unpaid Fees', loan: 'Bank Loan'
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
            // Liquid
            'bank', 'piggybank', 'vault', 'cayman',
            // Inventory
            'displaycase',
            // Market
            'bazaar', 'auctionhouse', 'trade',
            // Investments
            'stockmarket', 'company', 'bookie',
            // Properties
            'properties'
        ];

        for (const key of allKeysToCheck) {
            if (!assetValues[key] || assetValues[key] === 0) {
                if (KEY_LABELS[key]) zeroItemLabels.push(KEY_LABELS[key]);
            }
        }

        // Calculate Gross/Liability Totals for percentage base
        const liabilityTotal = groupTotals['liabilities'] || 0;
        // Total Networth = Assets + Liabilities (where Liabilities is negative)
        // Gross Assets = Total - Liabilities
        const grossTotal = total - liabilityTotal;

        // Sort positives by value desc
        positiveGroups.sort((a, b) => b.value - a.value);

        // Build Positive Assets Display
        const assetLines = [];
        for (const { key, value } of positiveGroups) {
            const group = ASSET_GROUPS[key];
            // Use grossTotal as base for asset percentage
            const percent = grossTotal > 0 ? ((value / grossTotal) * 100).toFixed(1) : 0;
            const percentStr = `${percent}%`.padStart(6);
            // Label only, no double icon
            assetLines.push(`${group.label.padEnd(18)} ${percentStr}  (${formatMoney(value)})`);
        }

        // Build Liabilities Display
        const liabilityLines = [];
        for (const { key, value } of negativeGroups) {
            const group = ASSET_GROUPS[key];
            // Liability % relative to Gross Assets shows scale of debt
            const percent = grossTotal > 0 ? ((value / grossTotal) * 100).toFixed(1) : 0;
            const percentStr = `${percent}%`.padStart(6);
            liabilityLines.push(`${group.label.padEnd(18)} ${percentStr}  (${formatMoney(value)})`);
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
            .setTitle('📊 Asset Distribution')

            // 1. Assets Block
            .addFields({
                name: '📈 Assets',
                value: '```\n' + (assetLines.length ? assetLines.join('\n') : 'No assets') + '\n```',
                inline: false
            });

        // 2. Liabilities Block (if any)
        if (liabilityLines.length > 0) {
            embed.addFields({
                name: '📉 Liabilities',
                value: '```diff\n' + liabilityLines.join('\n') + '\n```', // diff naming for red text logic if simple formatting used? or just standard code block
                inline: false
            });
        }

        // 3. Zero Assets (if any)
        if (zeroItemLabels.length > 0) {
            embed.addFields({
                name: '🚫 Empty Assets',
                value: '```' + zeroString + '```',
                inline: false
            });
        }

        // 4. Totals
        embed.addFields(
            {
                name: 'Total Networth',
                value: `\`\`\`${formatMoney(total)}\`\`\``,
                inline: true
            },
            {
                name: 'Liquidity Ratio',
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
