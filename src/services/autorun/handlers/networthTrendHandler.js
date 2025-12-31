/**
 * Networth Trend Handler
 * Shows networth trend over time (24h, 7d, 30d)
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';
import {
    saveSnapshot,
    getLatestSnapshot,
    getSnapshotDaysAgo,
    calculateDelta,
    calculateTrend,
    shouldTakeSnapshot
} from '../../analytics/networthSnapshotStorage.js';

export async function networthTrendHandler(client) {
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

        const nw = data.networth;

        // Build current snapshot with correct field names from API
        const currentSnapshot = {
            total: nw.total || 0,
            breakdown: {
                wallet: nw.wallet || 0,
                bank: nw.bank || 0,
                points: nw.points || 0,
                items: nw.items || 0,
                bazaar: nw.bazaar || 0,
                displaycase: nw.displaycase || 0,
                properties: nw.properties || 0,
                stockmarket: nw.stockmarket || 0,
                itemmarket: nw.itemmarket || 0,
                auctionhouse: nw.auctionhouse || 0,
                company: nw.company || 0,
                bookie: nw.bookie || 0,
                loan: nw.loan || 0,
                unpaidfees: nw.unpaidfees || 0,
                piggybank: nw.piggybank || 0,
                cayman: nw.cayman || 0,
                vault: nw.vault || 0,
                trade: nw.trade || 0
            }
        };

        // Save snapshot if needed (once per day)
        if (shouldTakeSnapshot()) {
            saveSnapshot(currentSnapshot);
        }

        // Get historical snapshots
        const snapshot24h = getSnapshotDaysAgo(1);
        const snapshot7d = getSnapshotDaysAgo(7);
        const snapshot30d = getSnapshotDaysAgo(30);

        // Calculate deltas
        const delta24h = snapshot24h ? currentSnapshot.total - snapshot24h.total : null;
        const delta7d = snapshot7d ? currentSnapshot.total - snapshot7d.total : null;
        const delta30d = snapshot30d ? currentSnapshot.total - snapshot30d.total : null;

        // Calculate trend
        const trend = calculateTrend(delta24h, delta7d);

        // Format delta display
        const formatDelta = (value) => {
            if (value === null) return `\`${getUi('no_data')}\``;
            const sign = value >= 0 ? '+' : '';
            const icon = value >= 0 ? '📈' : '📉';
            return `${sign}${formatMoney(value)} ${icon}`;
        };

        const embed = new EmbedBuilder()
            .setColor(trend.color)
            .setTitle(`📈 ${getUi('networth_trend_title')}`)
            .addFields(
                { name: getUi('current_networth'), value: `\`\`\`${formatMoney(currentSnapshot.total)}\`\`\``, inline: false },
                { name: '24h', value: formatDelta(delta24h), inline: true },
                { name: '7d', value: formatDelta(delta7d), inline: true },
                { name: '30d', value: formatDelta(delta30d), inline: true },
                { name: getUi('trend_label'), value: `\`\`\`${trend.icon} ${trend.label}\`\`\``, inline: false }
            )
            .setFooter({ text: `Torn Sentinel • ${getUi('updated_daily')}` })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Networth Trend Handler Error:', error.message);
        return null;
    }
}
