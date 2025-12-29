/**
 * Personal Travel Profit Summary Handler
 * Displays daily travel stats and logs
 * Updates on schedule (10m) OR on Travel Event
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { getStatus, updateTravelState, updateCapacity } from '../../analytics/travelAnalyticsService.js'; // Imported updateCapacity
import { formatMoney, formatTime } from '../../../utils/formatters.js';

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

        // 0. Check/Update Capacity (On Startup or if 0)
        // Only fetch 'perks' if we don't know capacity yet
        let selections = 'travel';
        if (capacity === 0) {
            selections += ',perks';
        }

        // 1. Fetch User Data
        const data = await getCombinedStats(user.apiKey, selections);
        if (!data || !data.travel) return null;

        const travel = data.travel;
        // travel = { destination: "Japan", time_left: 123, timestamp: ... }
        // API v1 'travel' doesn't have 'status' field directly in simple selection sometimes?
        // Actually 'travel' selection returns: { destination, method, time_left, ... }

        const isTraveling = travel.time_left > 0;
        const currentCountry = travel.destination;

        // Update Capacity if fetched
        if (data.travel_items) {
            capacity = data.travel_items; // API field is 'travel_items' inside perks? 
            // Wait, getCombinedStats puts 'perks' fields at root if using 'user' endpoint?
            // No, 'perks' selection usually returns 'perks' object or flattened?
            // Checking Torn API docs: 'user' -> 'perks' returns object.
            // But my getCombinedStats might not flatten it.
            // Let's be safe.
            if (data.perks && data.perks.travel_items) {
                capacity = data.perks.travel_items;
                updateCapacity(capacity);
            }
        }

        // 2. Update State & Check for Events
        const event = updateTravelState(isTraveling, currentCountry, travel.time_left);

        // 3. Decide whether to update Embed
        const now = Date.now();
        const timeSinceLast = now - lastEmbedUpdate;

        // Update if: Event occurred (Landed/Returned) OR Time elapsed > 10m
        if (!event && timeSinceLast < UPDATE_INTERVAL) {
            return null; // Skip update
        }

        lastEmbedUpdate = now;

        // 4. Build Embed with Personal Stats
        const { daily } = status;

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // Green
            .setTitle('📊 Travel Summary — Today')
            .setTimestamp()
            .setFooter({ text: event ? `Update triggered by: ${event}` : 'Auto-update (10m)' });

        // Row 1: Key Stats
        embed.addFields(
            { name: '✈️ Trips', value: `\`${daily.trips}\``, inline: true },
            { name: '💰 Profit', value: `\`${formatMoney(daily.totalProfit)}\``, inline: true },
            { name: '📈 Avg/Trip', value: `\`${formatMoney(daily.trips > 0 ? daily.totalProfit / daily.trips : 0)}\``, inline: true }
        );

        // Row 2: Capacity & Potential
        // Calculate "Potential Profit" (e.g. 50k profit/item * capacity) - wait, we don't know profit/item here easily.
        // Actually, we can just show the Capacity.
        // "Max Carry: 29"
        embed.addFields(
            { name: '🎒 Capacity', value: `\`${capacity} items\``, inline: true }
        );

        if (daily.bestItem) {
            embed.addFields({ name: '🌟 Best Item', value: daily.bestItem, inline: true });
        }

        // Original Row 2: Best Performers (modified)
        const bestCountry = daily.bestCountry || '—';
        embed.addFields(
            { name: '🌍 Best Country', value: bestCountry, inline: true },
            { name: '⏱️ Update', value: `<t:${Math.floor(now / 1000)}:R>`, inline: true }
        );

        // Optional: Show last action/status
        let statusText = "Ready to travel";
        if (isTraveling) {
            statusText = `✈️ Traveling to **${currentCountry}** (${formatTime(travel.time_left)})`;
        } else if (currentCountry !== 'Torn') {
            statusText = `📍 Currently in **${currentCountry}**`;
        }

        embed.setDescription(statusText);

        return embed;

    } catch (error) {
        console.error('❌ Profit Summary Handler Error:', error.message);
        return null;
    }
}

