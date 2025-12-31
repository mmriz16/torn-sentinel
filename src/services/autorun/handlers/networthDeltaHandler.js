/**
 * Networth Delta Handler
 * Explains WHY networth changed (breakdown by source)
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';
import {
    getLatestSnapshot,
    getSnapshotDaysAgo,
    calculateDelta
} from '../../analytics/networthSnapshotStorage.js';

// Human-readable labels for breakdown categories
const CATEGORY_LABELS = {
    wallet: '💵 Wallet',
    bank: '🏦 Bank',
    points: '💎 Points',
    items: '📦 Items (Inventory)',
    bazaar: '🛒 Bazaar',
    displaycase: '🖼️ Display Case',
    properties: '🏠 Properties',
    stockmarket: '📊 Stock Market',
    itemmarket: '🏪 Item Market Listings',
    auctionhouse: '🔨 Auction House',
    company: '🏢 Company',
    bookie: '🎰 Bookie',
    loan: '💳 Loan',
    unpaidfees: '⚠️ Unpaid Fees',
    piggybank: '🐷 ' + getUi('piggybank')
}; // Note: Will use getUi dynamic lookup if not found in map, but explicit here for icons

export async function networthDeltaHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Get current and yesterday's snapshot
        const current = getLatestSnapshot();
        const yesterday = getSnapshotDaysAgo(1);

        if (!current) {
            // No snapshots yet
            const embed = new EmbedBuilder()
                .setColor(0x95A5A6)
                .setTitle(`📉 ${getUi('networth_delta_title')}`)
                .setDescription(`\`\`\`${getUi('no_snapshot_data')}\`\`\``)
                .setFooter({ text: `Torn Sentinel • ${getUi('snapshots_collected_daily')}` })
                .setTimestamp();
            return embed;
        }

        if (!yesterday) {
            // Only one snapshot
            const embed = new EmbedBuilder()
                .setColor(0x95A5A6)
                .setTitle(`📉 ${getUi('networth_delta_title')}`)
                .setDescription(`\`\`\`${getUi('need_more_data')}\`\`\``)
                .addFields({
                    name: getUi('current_networth'),
                    value: `\`\`\`${formatMoney(current.total)}\`\`\``,
                    inline: false
                })
                .setFooter({ text: `Torn Sentinel • ${getUi('snapshots_collected_daily')}` })
                .setTimestamp();
            return embed;
        }

        // Calculate delta
        const delta = calculateDelta(current, yesterday);

        // Sort breakdown by absolute impact (biggest first)
        const sortedBreakdown = Object.entries(delta.breakdown)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .filter(([key, value]) => Math.abs(value) >= 1000); // Filter noise < $1k

        // Build breakdown text
        let breakdownText = '';
        if (sortedBreakdown.length === 0) {
            breakdownText = `\`\`\`${getUi('no_significant_changes')}\`\`\``;
        } else {
            const lines = sortedBreakdown.slice(0, 8).map(([key, value]) => {
                // Try to get from label map (with icons) or use getUi direct
                const iconMap = {
                    wallet: '💵', bank: '🏦', points: '💎', items: '📦', bazaar: '🛒',
                    displaycase: '🖼️', properties: '🏠', stockmarket: '📊', itemmarket: '🏪',
                    auctionhouse: '🔨', company: '🏢', bookie: '🎰', loan: '💳',
                    unpaidfees: '⚠️', piggybank: '🐷', vault: '🔐', cayman: '🏝️'
                };
                const icon = iconMap[key] || '';
                const label = `${icon} ${getUi(key)}`;
                const sign = value >= 0 ? '+' : '';
                return `${sign}${formatMoney(value).padStart(12)}  ${label}`;
            });
            breakdownText = '```\n' + lines.join('\n') + '\n```';
        }

        // Determine color based on net change
        let color = 0x95A5A6; // Gray
        if (delta.total > 100000) color = 0x2ECC71; // Green
        else if (delta.total < -100000) color = 0xE74C3C; // Red

        const netChangeSign = delta.total >= 0 ? '+' : '';
        const netChangeIcon = delta.total >= 0 ? '📈' : '📉';

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('📉 Networth Delta (24h)')
            .addFields(
                { name: 'Changes by Source', value: breakdownText, inline: false },
                { name: 'Net Change', value: `\`\`\`${netChangeSign}${formatMoney(delta.total)} ${netChangeIcon}\`\`\``, inline: false }
            )
            .setFooter({ text: 'Torn Sentinel • Updated daily' })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Networth Delta Handler Error:', error.message);
        return null;
    }
}
