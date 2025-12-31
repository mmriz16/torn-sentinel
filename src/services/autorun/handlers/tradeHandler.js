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
import { getUi } from '../../../localization/index.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';
import { formatTimeShort } from '../../../utils/formatters.js';


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
                try {
                    const embed = buildTradeEmbed(trade);
                    await channel.send({
                        content: `<@${userId}>`,
                        embeds: [embed]
                    });
                    console.log(`📦 Trade detected: ${trade.type} ${trade.qty}x ${trade.itemName}`);

                    // Log trade to travel analytics for profit tracking
                    try {
                        logTrade(
                            trade.type,
                            trade.itemName,
                            trade.qty,
                            trade.unitPrice || 0,
                            trade.country || 'Torn'
                        );
                    } catch (logErr) {
                        console.error('❌ Error logging trade to analytics:', logErr);
                    }

                    // Log to Profit Engine
                    /* 
                    // PROFIT LOGGING HANDLED BY financialLogHandler NOW
                    // Preserving logic for reference or fallback if needed
                    try {
                        if (trade.type === 'SELL') {
                            const netRevenue = trade.netRevenue || (trade.totalCost * 0.95);
                            addIncome('travel', netRevenue);
                            addExpense('tax', trade.tax || (trade.totalCost * 0.05));
                            incrementStat('tripCount');
                        } else if (trade.type === 'BUY') {
                            addExpense('travel_buy', trade.totalCost || 0);
                        }
                    } catch (profitErr) {
                        console.error('❌ Error updating profit engine:', profitErr);
                    }
                    */

                } catch (sendErr) {
                    console.error('❌ Error sending trade notification:', sendErr);
                }
            }
        }

        // Update snapshot for next cycle (CRITICAL: Must run to prevent duplicates)
        updateSnapshot(userId, currentSnapshot);
    } catch (error) {
        console.error('❌ Trade Handler Fatal Error:', error);
    } // No finally needed for updateSnapshot because it's inside the try block now, but we want it to run if `detectTrades` succeeds. 
    // Wait, if detectTrades fails, we probably shouldn't update snapshot?
    // Correct. But if processing trades fails, we MUST update.
    // The previous structure had updateSnapshot at the end of try block.
    // If the loop throws, it skips updateSnapshot.
    // My new structure catches errors INSIDE the loop. So the loop continues and updateSnapshot is reached!
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
        .setTitle(`📦 ${getUi('trade_logged')}: BUY`)
        .setDescription([
            `**${trade.itemName}** ×${trade.qty}`,
            `@ ${formatMoney(trade.unitPrice)} each`,
            '',
            `**Total:** ${formatMoney(trade.totalCost)}`
        ].join('\n'))
        .addFields({
            name: getUi('country'),
            value: `${trade.countryFlag} ${trade.country}`,
            inline: true
        })
        .setTimestamp()
        .setTimestamp();
    const interval = formatTimeShort(AUTO_RUNNERS.tradeDetection.interval);
    embed.setFooter({ text: `${getUi('detected_via')} • Updated every ${interval}` });


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
        `**Gross:** ${formatMoney(trade.grossRevenue)}`, // Gross/Net/Tax difficult to localize short. Prefer keeping technical terms or simple translation.
        `**Tax (5%):** -${formatMoney(trade.tax)}`,
        `**Net:** ${formatMoney(trade.netRevenue)}`
    ];

    // Add profit line if not orphan
    if (!trade.isOrphan && trade.profit !== null) {
        descriptionLines.push('');
        descriptionLines.push(`**${getUi('profit')}:** ${profitEmoji} ${profitPrefix}${formatMoney(trade.profit)}`);
    } else if (trade.isOrphan) {
        descriptionLines.push('');
        descriptionLines.push(`⚠️ *${getUi('orphan_sell')}*`);
    }

    const embed = new EmbedBuilder()
        .setColor(trade.isOrphan ? 0xF39C12 : profitColor) // Orange for orphan
        .setTitle(`💰 ${getUi('trade_logged')}: SELL`)
        .setDescription(descriptionLines.join('\n'))
        .addFields({
            name: getUi('location'),
            value: `${trade.countryFlag} ${trade.country}`,
            inline: true
        })
        .setTimestamp()
        .setTimestamp();
    const interval = formatTimeShort(AUTO_RUNNERS.tradeDetection.interval);
    embed.setFooter({ text: `${getUi('detected_via')} • Updated every ${interval}` });


    return embed;
}

export default tradeHandler;
