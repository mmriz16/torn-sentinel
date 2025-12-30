/**
 * Activity Log Handler
 * Shows activity events in Discord channel
 * Delta-based detection for all Torn activities
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import {
    buildActivitySnapshot,
    detectActivities,
    initActivityDetection,
    getRecentEvents
} from '../../analytics/activityDetectionEngine.js';

// Track initialization
let initialized = false;

/**
 * Format event for Discord embed field
 */
function formatEventLine(event) {
    const time = `<t:${Math.floor(event.timestamp / 1000)}:R>`;

    switch (event.type) {
        case 'energy_used':
            return `${event.icon} **${event.title}** — Δ${event.delta} (${event.source}) ${time}`;

        case 'energy_full':
            return `${event.icon} **${event.title}** — ${event.current}/${event.max} ${time}`;

        case 'nerve_used':
            return `${event.icon} **Nerve Used** — Δ${event.delta} (${event.current} left) ${time}`;

        case 'crime_reward':
            return `${event.icon} **Crime Detected** — ${event.crimesCompleted} crime(s) ${time}`;

        case 'travel_depart':
            return `${event.icon} **Departed** → ${event.destination} ${time}`;

        case 'travel_arrive':
            return `${event.icon} **${event.title}** — ${event.location} ${time}`;

        case 'trade_buy':
            return `${event.icon} **Items Acquired** — +${event.itemsAdded} item(s) ${time}`;

        case 'trade_sell':
            return `${event.icon} **Items Sold/Used** — -${event.itemsRemoved} item(s) ${time}`;

        case 'wallet_change':
            const sign = event.delta >= 0 ? '+' : '';
            return `${event.icon} **${event.title}** — ${sign}${formatMoney(event.delta)} ${time}`;

        case 'job_points':
            return `${event.icon} **Job Points** — +${event.delta} JP (${event.current} total) ${time}`;

        case 'job_change':
            return `${event.icon} **Position Changed** — ${event.from} → ${event.to} ${time}`;

        default:
            return `${event.icon || '📌'} **${event.title || event.type}** ${time}`;
    }
}

/**
 * Activity Log Handler
 * @param {Client} client - Discord client
 * @returns {EmbedBuilder|null}
 */
export async function activityLogHandler(client) {
    try {
        // Initialize on first run
        if (!initialized) {
            initActivityDetection();
            initialized = true;
        }

        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Fetch user data - use V1 compatible selections
        // Note: 'job' selection is V2 only, skip for activity detection
        const data = await getCombinedStats(user.apiKey, 'money,bars,travel,inventory,personalstats');
        if (!data) return null;

        // Build snapshot and detect activities
        const snapshot = buildActivitySnapshot(data);
        const newEvents = detectActivities(snapshot);

        // Send individual notifications for NEW events
        if (newEvents.length > 0) {
            const channelId = process.env.ACTIVITY_LOG_CHANNEL_ID;
            if (channelId) {
                try {
                    const channel = await client.channels.fetch(channelId);

                    for (const event of newEvents) {
                        const miniEmbed = new EmbedBuilder()
                            .setColor(getEventColor(event.type))
                            .setDescription(formatEventLine(event))
                            .setTimestamp();

                        await channel.send({ embeds: [miniEmbed] });
                    }
                } catch (e) {
                    console.error('❌ Failed to send activity notification:', e.message);
                }
            }
        }

        // Build summary embed with recent events
        const recentEvents = getRecentEvents(15);

        if (recentEvents.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x95A5A6)
                .setTitle('📜 Activity Log')
                .setDescription('```No recent activities detected```')
                .setFooter({ text: 'Torn Sentinel • Delta Detection' })
                .setTimestamp();
            return embed;
        }

        // Format recent events
        const eventLines = recentEvents.slice(0, 10).map(formatEventLine);

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📜 Activity Log')
            .setDescription(eventLines.join('\n'))
            .setFooter({ text: `Torn Sentinel • ${recentEvents.length} recent events` })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Activity Log Handler Error:', error.message);
        return null;
    }
}

/**
 * Get color based on event type
 */
function getEventColor(type) {
    const colors = {
        'energy_used': 0xF39C12,     // Orange
        'energy_full': 0x2ECC71,     // Green
        'nerve_used': 0x9B59B6,      // Purple
        'crime_reward': 0x9B59B6,    // Purple
        'travel_depart': 0x3498DB,   // Blue
        'travel_arrive': 0x2ECC71,   // Green
        'trade_buy': 0x3498DB,       // Blue
        'trade_sell': 0x2ECC71,      // Green
        'wallet_change': 0xF1C40F,   // Gold
        'job_points': 0x1ABC9C,      // Teal
        'job_change': 0xE67E22,      // Dark Orange
    };
    return colors[type] || 0x95A5A6;
}
