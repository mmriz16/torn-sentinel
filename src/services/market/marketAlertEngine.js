
import { EmbedBuilder } from 'discord.js';
import { getAllAlerts, saveAlertState } from './marketAlertStorage.js';
import { getAllUsers } from '../userStorage.js';
import { get } from '../tornApi.js';
import { getCountryData, getAllCountriesData } from '../yataGlobalCache.js';
import { formatMoney } from '../../utils/formatters.js';
import { getRecentTrades } from '../trade/tradeHistoryStorage.js';

// Travel Cache to avoid spamming API if we have many alerts per user
const travelCache = {};

/**
 * Process all market alerts
 * Run frequency: 30s (matches YATA update)
 */
export async function processAlerts(client) {
    const allAlerts = getAllAlerts(); // { userId: { alerts: [] } }
    const users = getAllUsers();
    const countriesData = getAllCountriesData();

    if (!countriesData || Object.keys(countriesData).length === 0) return;

    for (const [userId, userData] of Object.entries(allAlerts)) {
        const user = users[userId];
        if (!user || !user.apiKey || userData.alerts.length === 0) continue;

        // 1. Get Travel Status (Cached 30s)
        const travelStatus = await getTravelStatus(user.apiKey, userId);
        if (!travelStatus) continue;

        let dirty = false;

        for (const alert of userData.alerts) {
            const prevState = alert.state;

            // 2. State Machine Transition
            await updateAlertState(alert, travelStatus, countriesData, userId);

            // 3. Trigger Logic - Restock Detection
            if (alert.state === 'TRIGGERED' && prevState !== 'TRIGGERED') {
                await sendAlertNotification(client, userId, alert, 'RESTOCK');
                // Return to MONITORING immediately (no cooldown)
                alert.state = 'MONITORING';
                alert.lastRestockTime = Date.now();
                dirty = true;
            }
            // 4. Low Stock Warning
            else if (alert.state === 'LOW_STOCK_WARNING' && prevState !== 'LOW_STOCK_WARNING') {
                await sendAlertNotification(client, userId, alert, 'LOW_STOCK');
                dirty = true;
            }
            // 5. Purchase Confirmed
            else if (alert.state === 'MONITORING_PURCHASED' && prevState !== 'MONITORING_PURCHASED') {
                await sendAlertNotification(client, userId, alert, 'PURCHASE_CONFIRMED');
                dirty = true;
            }
            else if (alert.state !== prevState) {
                dirty = true;
            }

            // Update last stock observation for next cycle
            const stock = getStock(countriesData, alert.country, alert.itemId);
            if (stock !== null) alert.lastStock = stock.quantity;
        }

        if (dirty) saveAlertState();
    }
}

/**
 * Fetch and cache travel status
 */
async function getTravelStatus(apiKey, userId) {
    const now = Date.now();
    if (travelCache[userId] && now - travelCache[userId].ts < 30000) {
        return travelCache[userId].data;
    }

    try {
        const data = await get(apiKey, 'user', 'travel');
        const status = data.travel;

        travelCache[userId] = { ts: now, data: status };
        return status;
    } catch (e) {
        console.error(`Error fetching travel for ${userId}:`, e.message);
        return null;
    }
}

/**
 * State Update Logic (Enhanced)
 */
async function updateAlertState(alert, travel, countriesData, userId) {
    const now = Date.now();

    // Get Stock
    const stockData = getStock(countriesData, alert.country, alert.itemId);
    const currentQty = stockData ? stockData.quantity : 0;

    // Transition Logic
    switch (alert.state) {
        case 'IDLE':
            // Move to ARMED if traveling to target and close
            if (travel.destination === alert.country && travel.time_left > 0 && travel.time_left <= 180) { // 3 mins
                alert.state = 'ARMED';
            }
            // Or if already there (landed)
            if (travel.destination === alert.country && travel.time_left === 0) {
                alert.state = 'MONITORING';
                alert.hasPurchased = false; // Reset purchase flag
            }
            break;

        case 'ARMED':
            // Move to MONITORING if landed
            if (travel.destination === alert.country && travel.time_left === 0) {
                alert.state = 'MONITORING';
                alert.hasPurchased = false; // Reset purchase flag
            }
            // Move back to IDLE if changed destination
            if (travel.destination !== alert.country) {
                alert.state = 'IDLE';
            }
            break;

        case 'MONITORING':
            // Check for purchases (via trade log)
            if (!alert.hasPurchased) {
                const purchased = await checkPurchase(alert, userId);
                if (purchased) {
                    alert.hasPurchased = true;
                    alert.state = 'MONITORING_PURCHASED';
                    break; // Exit state machine
                }
            }

            // Trigger if Restock Detected (0 → >0)
            if (alert.lastStock === 0 && currentQty > 0) {
                alert.state = 'TRIGGERED';
                alert.triggerData = stockData;
                break;
            }

            // Low Stock Warning (stock < 50 and not purchased)
            if (!alert.hasPurchased && currentQty > 0 && currentQty < 50) {
                // Throttle: only send if not sent in last 5 min
                if (!alert.lastLowStockWarning || now - alert.lastLowStockWarning > 5 * 60 * 1000) {
                    alert.state = 'LOW_STOCK_WARNING';
                    alert.lowStockData = stockData;
                    alert.lastLowStockWarning = now;
                    // Will return to MONITORING after notification sent
                }
            }

            // Exit if user leaves
            if (travel.destination !== alert.country && travel.time_left > 0) {
                alert.state = 'IDLE';
            }
            break;

        case 'TRIGGERED':
            // This state is transient, handled in processAlerts
            // Will immediately move to MONITORING
            break;

        case 'LOW_STOCK_WARNING':
            // Transient state, return to MONITORING
            alert.state = 'MONITORING';
            break;

        case 'MONITORING_PURCHASED':
            // User purchased, stay in this state until leaving country
            if (travel.destination !== alert.country && travel.time_left > 0) {
                alert.state = 'IDLE';
                alert.hasPurchased = false; // Reset for next trip
            }
            break;
    }
}

/**
 * Check if user purchased the alerted item recently
 */
async function checkPurchase(alert, userId) {
    try {
        // Get trades in last 5 minutes
        const recentTrades = getRecentTrades(userId, 5 * 60 * 1000);

        // Check if user bought the alerted item in target country
        const matchingTrade = recentTrades.find(trade =>
            trade.type === 'BUY' &&
            trade.itemId === alert.itemId &&
            trade.country === alert.country
        );

        return matchingTrade !== null;
    } catch (e) {
        console.error('Error checking purchase:', e);
        return false;
    }
}

function getStock(allData, countryName, itemId) {
    const countryKey = Object.keys(allData).find(k => k.toLowerCase() === countryName.toLowerCase());
    if (!countryKey) return null;

    const countryData = allData[countryKey];
    if (!countryData || !countryData.stocks) return null;

    const item = countryData.stocks.find(i => i.id === itemId);
    return item || { quantity: 0, cost: 0 };
}

async function sendAlertNotification(client, userId, alert, type) {
    try {
        const user = getAllUsers()[userId];
        const channelId = process.env.FOREIGN_MARKET_ALERTS_CHANNEL_ID || user.channels?.foreignMarketAlerts;

        if (!channelId) return;

        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        let embed;

        switch (type) {
            case 'RESTOCK':
                const data = alert.triggerData;
                embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle('🟢 FOREIGN MARKET RESTOCK')
                    .addFields(
                        { name: 'Item', value: alert.itemName, inline: true },
                        { name: 'Country', value: alert.country, inline: true },
                        { name: 'Stock', value: `${data.quantity}`, inline: true },
                        { name: 'Price', value: `$${formatMoney(data.cost)}`, inline: true },
                        { name: 'Detected', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
                    )
                    .setTimestamp();
                break;

            case 'LOW_STOCK':
                const lowData = alert.lowStockData;
                embed = new EmbedBuilder()
                    .setColor(0xF39C12) // Orange
                    .setTitle('⚠️ LOW STOCK WARNING')
                    .setDescription('Stock is running low and you haven\'t purchased yet!')
                    .addFields(
                        { name: 'Item', value: alert.itemName, inline: true },
                        { name: 'Country', value: alert.country, inline: true },
                        { name: 'Stock', value: `**${lowData.quantity}** (< 50!)`, inline: true },
                        { name: 'Price', value: `$${formatMoney(lowData.cost)}`, inline: true }
                    )
                    .setTimestamp();
                break;

            case 'PURCHASE_CONFIRMED':
                embed = new EmbedBuilder()
                    .setColor(0x3498DB) // Blue
                    .setTitle('✅ PURCHASE DETECTED')
                    .setDescription('Your purchase has been detected via trade log!')
                    .addFields(
                        { name: 'Item', value: alert.itemName, inline: true },
                        { name: 'Country', value: alert.country, inline: true },
                        { name: 'Status', value: 'Alert paused until you leave ' + alert.country, inline: false }
                    )
                    .setTimestamp();
                break;
        }

        if (embed) {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        }

    } catch (e) {
        console.error('Failed to send market alert:', e);
    }
}
