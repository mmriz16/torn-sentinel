/**
 * System Logger Service
 * Centralized logging for bot operations with Discord channel output
 */

import { EmbedBuilder } from 'discord.js';

// Discord client reference
let discordClient = null;
let logsChannelId = null;

// Log buffer (ring buffer, max 1000 entries)
const LOG_BUFFER_MAX = 1000;
const logBuffer = [];

// Anti-spam throttling
const lastLogTime = new Map(); // key -> timestamp
const THROTTLE_MS = 60000; // 1 minute per key

// Log categories with colors and emojis
const LOG_CATEGORIES = {
    SYSTEM: { emoji: '🟢', color: 0x2ECC71, label: 'SYSTEM' },
    SCHEDULER: { emoji: '🔁', color: 0x3498DB, label: 'SCHEDULER' },
    ALERT: { emoji: '🚨', color: 0xE74C3C, label: 'ALERT' },
    TRADE: { emoji: '💰', color: 0xF39C12, label: 'TRADE' },
    ERROR: { emoji: '❌', color: 0xE74C3C, label: 'ERROR' }
};

/**
 * Initialize logger with Discord client
 * @param {Client} client - Discord client
 */
export function initLogger(client) {
    discordClient = client;
    logsChannelId = process.env.BOT_LOGS_CHANNEL_ID;

    if (logsChannelId) {
        console.log('📜 System logger initialized');
    }
}

/**
 * Log a system event
 * @param {string} type - Log category (SYSTEM, SCHEDULER, ALERT, TRADE, ERROR)
 * @param {Object} payload - Log data
 * @param {string} payload.module - Source module name
 * @param {string} payload.action - What happened
 * @param {string} [payload.details] - Additional details
 * @param {boolean} [payload.force] - Force log (bypass throttle)
 */
export async function logSystem(type, payload) {
    const category = LOG_CATEGORIES[type] || LOG_CATEGORIES.SYSTEM;
    const now = Date.now();

    // Create log entry
    const logEntry = {
        type,
        timestamp: now,
        ...payload
    };

    // Add to buffer (ring buffer)
    logBuffer.push(logEntry);
    if (logBuffer.length > LOG_BUFFER_MAX) {
        logBuffer.shift();
    }

    // Console log
    console.log(`${category.emoji} [${category.label}] ${payload.module}: ${payload.action}`);

    // Check if we should send to Discord
    if (!logsChannelId || !discordClient) return;

    // Anti-spam throttle (unless force)
    const throttleKey = `${type}:${payload.module}:${payload.action}`;
    if (!payload.force) {
        const lastTime = lastLogTime.get(throttleKey);
        if (lastTime && (now - lastTime) < THROTTLE_MS) {
            return; // Throttled
        }
    }
    lastLogTime.set(throttleKey, now);

    // Send to Discord
    try {
        const channel = await discordClient.channels.fetch(logsChannelId).catch(() => null);
        if (!channel) return;

        const embed = buildLogEmbed(category, payload);
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Failed to send log to Discord:', error.message);
    }
}

/**
 * Build log embed
 */
function buildLogEmbed(category, payload) {
    const timestamp = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
        .setColor(category.color)
        .setTitle(`${category.emoji} [${category.label}]`)
        .setDescription([
            `**Module:** ${payload.module}`,
            `**Action:** ${payload.action}`,
            payload.details ? `**Details:** ${payload.details}` : null
        ].filter(Boolean).join('\n'))
        .setTimestamp()
        .setFooter({ text: `<t:${timestamp}:T>` });

    return embed;
}

/**
 * Get recent logs from buffer
 * @param {number} count - Number of logs to retrieve
 * @returns {Array} Recent log entries
 */
export function getRecentLogs(count = 50) {
    return logBuffer.slice(-count);
}

/**
 * Get logs by type
 * @param {string} type - Log category
 * @param {number} count - Number of logs
 * @returns {Array} Filtered log entries
 */
export function getLogsByType(type, count = 50) {
    return logBuffer
        .filter(log => log.type === type)
        .slice(-count);
}

/**
 * Clear log buffer
 */
export function clearLogs() {
    logBuffer.length = 0;
    lastLogTime.clear();
}

/**
 * Get log stats
 */
export function getLogStats() {
    const stats = {
        total: logBuffer.length,
        byType: {}
    };

    for (const type of Object.keys(LOG_CATEGORIES)) {
        stats.byType[type] = logBuffer.filter(log => log.type === type).length;
    }

    return stats;
}

export default {
    initLogger,
    logSystem,
    getRecentLogs,
    getLogsByType,
    clearLogs,
    getLogStats,
    LOG_CATEGORIES
};
