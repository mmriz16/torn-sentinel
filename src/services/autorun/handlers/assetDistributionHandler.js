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
        keys: ['wallet', 'bank', 'piggybank']
    },
    'points': {
        label: '💎 Points',
        color: '🟣',
        keys: ['points']
    },
    'items': {
        label: '📦 Items',
        color: '🟦',
        keys: ['items', 'bazaar', 'displaycase', 'itemmarket', 'auctionhouse', 'trade']
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

        // Map API data to our structure (correct field names from API)
        const assetValues = {
            wallet: networth.wallet || 0,
            bank: networth.bank || 0,
            piggybank: networth.piggybank || 0,
            cayman: networth.cayman || 0,
            vault: networth.vault || 0,
            points: networth.points || 0,
            items: networth.items || 0,
            bazaar: networth.bazaar || 0,
            displaycase: networth.displaycase || 0,
            itemmarket: networth.itemmarket || 0,
            auctionhouse: networth.auctionhouse || 0,
            trade: networth.trade || 0,
            properties: networth.properties || 0,
            stockmarket: networth.stockmarket || 0,
            company: networth.company || 0,
            bookie: networth.bookie || 0,
            unpaidfees: networth.unpaidfees || 0,
            loan: networth.loan || 0
        };

        // Calculate group totals
        const groupTotals = {};
        for (const [groupKey, group] of Object.entries(ASSET_GROUPS)) {
            let groupTotal = 0;
            for (const key of group.keys) {
                groupTotal += assetValues[key] || 0;
            }
            groupTotals[groupKey] = groupTotal;
        }

        // Calculate percentages and build display
        const displayLines = [];
        const sortedGroups = Object.entries(groupTotals)
            .filter(([key, value]) => value !== 0)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

        for (const [groupKey, value] of sortedGroups) {
            const group = ASSET_GROUPS[groupKey];
            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            const percentStr = `${percent}%`.padStart(6);
            displayLines.push(`${group.color} ${group.label.padEnd(18)} ${percentStr}  (${formatMoney(value)})`);
        }

        // Calculate liquidity ratio (liquid assets / total)
        const liquidTotal = groupTotals.liquid + groupTotals.points;
        const liquidityRatio = total > 0 ? ((liquidTotal / total) * 100).toFixed(0) : 0;

        // Determine embed color based on diversification
        let color = 0x3498DB; // Blue - balanced
        const topGroupPercent = sortedGroups.length > 0
            ? Math.abs(sortedGroups[0][1] / total) * 100
            : 0;

        if (topGroupPercent > 80) color = 0xE67E22; // Orange - concentrated
        if (groupTotals.liabilities < -500000) color = 0xE74C3C; // Red - high liabilities

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('📊 Asset Distribution')
            .addFields(
                {
                    name: 'Breakdown',
                    value: '```\n' + displayLines.join('\n') + '\n```',
                    inline: false
                },
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
