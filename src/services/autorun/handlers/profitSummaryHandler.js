/**
 * Personal Travel Profit Summary Handler
 * Displays daily travel stats and logs
 * Updates on schedule (10m) OR on Travel Event
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { getStatus, updateTravelState, updateCapacity } from '../../analytics/travelAnalyticsService.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi, getLocation, formatTimeId } from '../../../localization/index.js';

let lastEmbedUpdate = 0;
const UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes enforced for non-event updates

export async function profitSummaryHandler(client, user) {
    try {
        // Guard: Need user for API access
        if (!user || !user.apiKey) {
            console.warn('⚠️ profitSummaryHandler skipped: No user/apiKey available');
            return null;
        }

        const status = getStatus();
        let capacity = status.capacity || 0;

        // 0. Check/Update Capacity
        // Fetch 'perks' if capacity is unknown OR just base (5) - likely incomplete
        let selections = 'travel';
        if (capacity <= 5) {
            selections += ',perks';
        }

        // 1. Fetch User Data
        const data = await getCombinedStats(user.apiKey, selections);
        if (!data || !data.travel) return null;

        const travel = data.travel;
        const isTraveling = travel.time_left > 0;
        const currentCountry = travel.destination;

        // Update Capacity if fetched
        const perkKeys = ['job_perks', 'property_perks', 'stock_perks', 'faction_perks', 'education_perks', 'enhancer_perks', 'book_perks'];
        let hasPerksData = perkKeys.some(key => Array.isArray(data[key]));

        if (hasPerksData) {
            let calculatedCapacity = 5; // Base capacity
            const savedLogs = [];

            for (const key of perkKeys) {
                if (Array.isArray(data[key])) {
                    for (const perk of data[key]) {
                        // Regex 1: "+ X travel item capacity"
                        const match1 = perk.match(/\+\s*(\d+)\s*travel item capacity/i);
                        if (match1 && match1[1]) {
                            const val = parseInt(match1[1], 10);
                            calculatedCapacity += val;
                            savedLogs.push(`[${key}] +${val}: ${perk}`);
                        }

                        // Regex 2: "Access to airstrip"
                        if (perk.match(/Access to airstrip/i)) {
                            const val = 10;
                            calculatedCapacity += val;
                            savedLogs.push(`[${key}] +${val} (Airstrip): ${perk}`);
                        }

                        // Regex 3: "Increases maximum traveling items by X"
                        const match3 = perk.match(/Increases maximum traveling items by (\d+)/i);
                        if (match3 && match3[1]) {
                            const val = parseInt(match3[1], 10);
                            calculatedCapacity += val;
                            savedLogs.push(`[${key}] +${val}: ${perk}`);
                        }

                        // Regex 4: "Allows you to carry X additional items"
                        const match4 = perk.match(/Allows you to carry (\d+) additional items/i);
                        if (match4 && match4[1]) {
                            const val = parseInt(match4[1], 10);
                            calculatedCapacity += val;
                            savedLogs.push(`[${key}] +${val}: ${perk}`);
                        }
                    }
                }
            }

            capacity = calculatedCapacity;
            updateCapacity(capacity);
        }

        // 2. Update State & Check for Events
        const event = updateTravelState(isTraveling, currentCountry, travel.time_left);

        // 3. Decide whether to update Embed
        const now = Date.now();
        const timeSinceLast = now - lastEmbedUpdate;

        if (!event && timeSinceLast < UPDATE_INTERVAL) {
            return null; // Skip update
        }

        lastEmbedUpdate = now;

        // 4. Build Embed with Personal Stats
        const { daily } = status;

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // Green
            .setTitle(`📊 ${getUi('travel_summary')}`)
            .setTimestamp()
            .setFooter({ text: event ? `Update triggered by: ${event}` : 'Auto-update (10m)' });

        // Row 1: Key Stats
        embed.addFields(
            { name: `✈️ ${getUi('trips')}`, value: `\`${daily.trips}\``, inline: true },
            { name: `💰 ${getUi('profit')}`, value: `\`${formatMoney(daily.totalProfit)}\``, inline: true },
            { name: `📈 ${getUi('avg_per_trip')}`, value: `\`${formatMoney(daily.trips > 0 ? daily.totalProfit / daily.trips : 0)}\``, inline: true }
        );

        // Row 2: Capacity & Potential
        embed.addFields(
            { name: `🎒 ${getUi('capacity')}`, value: `\`${capacity} items\``, inline: true }
        );

        if (daily.bestItem) {
            embed.addFields({ name: `🌟 ${getUi('best_item')}`, value: daily.bestItem, inline: true });
        }

        // Original Row 2: Best Performers (modified)
        const bestCountry = daily.bestCountry || '—';
        embed.addFields(
            { name: `🌍 ${getUi('best_country')}`, value: getLocation(bestCountry), inline: true },
            { name: '⏱️ Update', value: `<t:${Math.floor(now / 1000)}:R>`, inline: true }
        );

        // Optional: Show last action/status
        let statusText = getUi('ready_to_travel');
        if (isTraveling) {
            statusText = `✈️ Bepergian ke **${getLocation(currentCountry)}** (${formatTimeId(travel.time_left)})`;
        } else if (currentCountry !== 'Torn') {
            statusText = `📍 Sedang di **${getLocation(currentCountry)}**`;
        }

        embed.setDescription(statusText);

        return embed;

    } catch (error) {
        console.error('❌ Profit Summary Handler Error:', error.message);
        return null;
    }
}

