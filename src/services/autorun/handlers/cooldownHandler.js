/**
 * Cooldown Check Handler for Auto-Run
 * Provides live travel status and cooldown countdowns
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { formatTime } from '../../../utils/formatters.js';
import { getAllUsers } from '../../userStorage.js';

export async function cooldownHandler(client) {
    try {
        // Get the first configured user (usually owner)
        // Since auto-run is global for the bot instance, we target the primary user
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];

        if (!user.apiKey) return null;

        // Fetch FRESH data: travel, cooldowns
        // Using 'bars' to get verify energy/nerve too? 
        // PRD says: User status (travel, cooldown)
        const stats = await getCombinedStats(user.apiKey, 'travel,cooldowns,basic');

        if (!stats) return null;

        // Status Logic
        const travel = stats.travel || {};
        const cooldowns = stats.cooldowns || {};
        const status = stats.status || {};

        let state = 'READY';
        let color = 0x00FF00; // Green
        let title = '✅ Ready to Travel';
        let description = 'No active cooldowns. You are in Torn.';
        let fields = [];

        // 1. Check if Traveling
        if (travel.time_left > 0) {
            state = 'TRAVELING';
            color = 0x3498DB; // Blue
            const destination = travel.destination || 'Unknown';
            const returning = travel.destination === 'Torn'; // Wait, API destination is "Torn" if returning?
            // Actually usually destination is the target city, need another way to check return?
            // Usually if method is 'Travel', check detailed status.
            // For now, simplify: if time_left > 0, we are moving.

            title = `✈️ Traveling to ${destination}`;
            description = `Arriving in **${formatTime(travel.time_left)}**`;

            // Add ETA timestamp
            const arrivalTime = Math.floor((Date.now() / 1000) + travel.time_left);
            description += `\nETA: <t:${arrivalTime}:R>`;
        }
        // 2. Check Hospital/Jail
        else if (status.state === 'Hospital' || status.state === 'Jail') {
            state = 'BLOCKED';
            color = 0xE74C3C; // Red
            title = `⛔ ${status.state}`;
            description = `${status.details || 'Unable to travel'}`;
            if (status.until > 0) {
                description += `\nFree in: <t:${status.until}:R>`;
            }
        }
        // 3. Check Cooldowns (Drug/Medical/Booster doesn't stop travel, but good to know)
        // Wait, "Travel Cooldown" is not explicit in API unless we track it?
        // Actually, you can fly immediately after landing if you don't have rehab/mug/etc blocks.
        // PRD says: "Cooldown active | Remaining cooldown".
        // This usually refers to "Rehab" or "Mug" cooldowns if relevant?
        // OR simply "Flight delay" (return trip).

        // If we are in foreign country, time_left=0. We are "Abroad".
        else if (travel.destination !== 'Torn') {
            state = 'ABROAD';
            color = 0xF1C40F; // Yellow
            title = `📍 In ${travel.destination}`;
            description = 'You are currently abroad.';
            // Check if flight back is ready? API doesn't give separate "flight cooldown".
            // Usually you can fly back immediately.
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: 'Auto update every 60s' });

        return embed;

    } catch (error) {
        console.error('❌ Cooldown Handler Error:', error.message);
        return null;
    }
}
