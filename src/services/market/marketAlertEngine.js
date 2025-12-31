
import { EmbedBuilder } from 'discord.js';
import { getAllAlerts, saveAlertState } from './marketAlertStorage.js';
import { getAllUsers } from '../userStorage.js';
import { get } from '../tornApi.js';
import { getCountryData, getAllCountriesData } from '../yataGlobalCache.js';
import { formatMoney } from '../../utils/formatters.js';

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
            updateAlertState(alert, travelStatus, countriesData);

            // 3. Trigger Logic
            if (alert.state === 'TRIGGERED' && prevState !== 'TRIGGERED') {
                await sendAlertNotification(client, userId, alert);
                alert.state = 'COOLDOWN';
                alert.cooldownUntil = Date.now() + (15 * 60 * 1000); // 15m Cooldown
                dirty = true;
            } else if (alert.state !== prevState) {
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
        // { destination: "Japan", method: "Standard", time_left: 123, ... }
        // Or if in Torn: { destination: "Torn", ... }

        // Normalize
        // If 'time_left' exists, user is traveling.
        // If 'time_left' is 0, user is landed.

        travelCache[userId] = { ts: now, data: status };
        return status;
    } catch (e) {
        console.error(`Error fetching travel for ${userId}:`, e.message);
        return null;
    }
}

/**
 * State Update Logic
 */
function updateAlertState(alert, travel, countriesData) {
    const now = Date.now();

    // Cooldown Check
    if (alert.state === 'COOLDOWN') {
        if (now > alert.cooldownUntil) {
            alert.state = 'IDLE';
        }
        // Early exit cooldown if user leaves country?
        // If destination != alert.country and time_left > 0 -> user left?
        if (travel.destination !== alert.country && travel.time_left > 0) {
            alert.state = 'IDLE';
            alert.cooldownUntil = 0;
        }
        return;
    }

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
            }
            break;

        case 'ARMED':
            // Move to MONITORING if landed
            if (travel.destination === alert.country && travel.time_left === 0) {
                alert.state = 'MONITORING';
            }
            // Move back to IDLE if changed destination?? (Rare redirect)
            if (travel.destination !== alert.country) {
                alert.state = 'IDLE';
            }
            break;

        case 'MONITORING':
            // Trigger if Restock Detected
            // stock_prev == 0 AND current > 0
            if (alert.lastStock === 0 && currentQty > 0) {
                alert.state = 'TRIGGERED';
                alert.triggerData = stockData; // Store for notification
            }

            // Exit if user leaves
            if (travel.destination !== alert.country && travel.time_left > 0) {
                alert.state = 'IDLE';
            }
            break;
    }
}

function getStock(allData, countryName, itemId) {
    // countryName must match YATA keys? 
    // YATA keys are 'mexico', 'japan' (lowercase).
    // Alert country might be 'Mexico', 'Japan'.
    // Need mapping or normalization.

    // Simple search in all values?
    const countryKey = Object.keys(allData).find(k => k.toLowerCase() === countryName.toLowerCase());
    if (!countryKey) return null;

    const countryData = allData[countryKey];
    if (!countryData || !countryData.stocks) return null;

    const item = countryData.stocks.find(i => i.id === itemId);
    return item || { quantity: 0, cost: 0 };
}

async function sendAlertNotification(client, userId, alert) {
    try {
        const user = getAllUsers()[userId];
        const channelId = process.env.FOREIGN_MARKET_ALERTS_CHANNEL_ID || user.channels?.foreignMarketAlerts;

        // If generic channel not set, try DM? Or skip.
        // PRD says: #foreign-market-alerts
        // We need a specific channel ID ENV or user config.
        // I'll check if user has a configured channel or use a global one.
        // For now, I'll log to console if no channel.
        if (!channelId) return;

        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const data = alert.triggerData;
        const embed = new EmbedBuilder()
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

        await channel.send({ content: `<@${userId}>`, embeds: [embed] });

    } catch (e) {
        console.error('Failed to send market alert:', e);
    }
}
