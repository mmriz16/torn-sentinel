/**
 * Trade Handler for Auto-Run
 * Detects trades via inventory/wallet delta and sends Discord notifications
 */

import { EmbedBuilder } from 'discord.js';
import { get, getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import {
    getLastSnapshot,
    updateSnapshot,
    buildSnapshot
} from '../../trade/tradeSnapshotStorage.js';
import { detectTrades, getCountryFlag } from '../../trade/tradeDetectionEngine.js';
import { logTrade } from '../../analytics/travelAnalyticsService.js';
import { addIncome, addExpense, incrementStat } from '../../analytics/profitEngineStorage.js';

/**
 * Trade handler - fetches data, detects trades, sends notifications
 * @param {Client} client - Discord client
 * @returns {EmbedBuilder|null} - Returns null (uses direct channel sends instead)
 */
export async function tradeHandler(client) {
    // Read env inside function to ensure dotenv is loaded
    const tradeChannelId = process.env.TRADE_HISTORY_CHANNEL_ID;

    if (!tradeChannelId) {
        console.warn('⚠️ TRADE_HISTORY_CHANNEL_ID not configured');
        return null;
    }

    try {
        // Get first registered user's API key
        const users = getAllUsers();
        const userId = Object.keys(users)[0];

        if (!userId) {
            console.warn('⚠️ No users registered for trade handler');
            return null;
        }

        const user = users[userId];

        // Fetch user data with inventory and money (V1 and V2)
        const [v1Data, v2Data] = await Promise.all([
            get(user.apiKey, 'user', 'basic,inventory,money,travel'),
            getV2(user.apiKey, 'user?selections=itemmarket,bazaar')
        ]);

        // Combine data
        const data = { ...v1Data, ...v2Data };

        // Build current snapshot
        const currentSnapshot = buildSnapshot(data);

        // Get previous snapshot
        const prevSnapshot = getLastSnapshot(userId);

        // Detect trades (await for async YATA calls)
        const trades = await detectTrades(userId, prevSnapshot, currentSnapshot);

        // Send notifications for detected trades
        if (trades.length > 0) {
            const channel = await client.channels.fetch(tradeChannelId);

            for (const trade of trades) {
                const embed = buildTradeEmbed(trade);
                await channel.send({
                    content: `<@${userId}>`,
                    embeds: [embed]
                });
                console.log(`📦 Trade detected: ${trade.type} ${trade.qty}x ${trade.itemName}`);

                // Log trade to travel analytics for profit tracking
                logTrade(
                    trade.type,
                    trade.itemName,
                    trade.qty,
                    trade.unitPrice || 0,
                    trade.country || 'Torn'
                );

                // Log to Profit Engine
                if (trade.type === 'SELL') {
                    // Sell = income (net after tax)
                    const netRevenue = trade.netRevenue || (trade.totalCost * 0.95);
                    addIncome('travel', netRevenue);
                    addExpense('tax', trade.tax || (trade.totalCost * 0.05));
                    incrementStat('tripCount');
                } else if (trade.type === 'BUY') {
                    // Buy = expense
                    addExpense('travel_buy', trade.totalCost || 0);
                }
            }
        }

        // Update snapshot for next cycle
        updateSnapshot(userId, currentSnapshot);

        // Return null - we handle notifications directly
        return null;

    } catch (error) {
        console.error('❌ Trade handler error:', error.message);
        return null;
    }
}

/**
 * Build trade notification embed
 * @param {Object} trade - Trade data
 * @returns {EmbedBuilder}
 */
function buildTradeEmbed(trade) {
    if (trade.type === 'BUY') {
        return buildBuyEmbed(trade);
    } else {
        return buildSellEmbed(trade);
    }
}

/**
 * Build BUY notification embed
 */
function buildBuyEmbed(trade) {
    const embed = new EmbedBuilder()
        .setColor(0x3498DB) // Blue
        .setTitle('📦 Trade Logged: BUY')
        .setDescription([
            `**${trade.itemName}** ×${trade.qty}`,
            `@ ${formatMoney(trade.unitPrice)} each`,
            '',
            `**Total:** ${formatMoney(trade.totalCost)}`
        ].join('\n'))
        .addFields({
            name: 'Country',
            value: `${trade.countryFlag} ${trade.country}`,
            inline: true
        })
        .setTimestamp()
        .setFooter({ text: 'Detected via inventory & wallet delta' });

    return embed;
}

/**
 * Build SELL notification embed
 */
function buildSellEmbed(trade) {
    const profitColor = trade.profit > 0 ? 0x2ECC71 : 0xE74C3C; // Green or Red
    const profitEmoji = trade.profit > 0 ? '🟢' : '🔴';
    const profitPrefix = trade.profit > 0 ? '+' : '';

    const descriptionLines = [
        `**${trade.itemName}** ×${trade.qty}`,
        `@ ${formatMoney(trade.unitPrice)} each`,
        '',
        `**Gross:** ${formatMoney(trade.grossRevenue)}`,
        `**Tax (5%):** -${formatMoney(trade.tax)}`,
        `**Net:** ${formatMoney(trade.netRevenue)}`
    ];

    // Add profit line if not orphan
    if (!trade.isOrphan && trade.profit !== null) {
        descriptionLines.push('');
        descriptionLines.push(`**Profit:** ${profitEmoji} ${profitPrefix}${formatMoney(trade.profit)}`);
    } else if (trade.isOrphan) {
        descriptionLines.push('');
        descriptionLines.push('⚠️ *Orphan sell - no matching BUY found*');
    }

    const embed = new EmbedBuilder()
        .setColor(trade.isOrphan ? 0xF39C12 : profitColor) // Orange for orphan
        .setTitle('💰 Trade Logged: SELL')
        .setDescription(descriptionLines.join('\n'))
        .addFields({
            name: 'Location',
            value: `${trade.countryFlag} ${trade.country}`,
            inline: true
        })
        .setTimestamp()
        .setFooter({ text: 'Detected via inventory & wallet delta' });

    return embed;
}

export default tradeHandler;
