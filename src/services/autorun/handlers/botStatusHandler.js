/**
 * Bot Status Handler for Auto-Run
 * Displays real-time health overview of bot systems
 */

import { EmbedBuilder } from 'discord.js';
import { getActiveSchedulers } from '../schedulerEngine.js';
import { getAllRunnerStates } from '../runtimeStateManager.js';
import { getAllUsers } from '../../userStorage.js';
import { getLogStats } from '../../system/systemLogger.js';
import { getUi } from '../../../localization/index.js';

// Track bot start time
const BOT_START_TIME = Date.now();

// API health tracking
let apiStats = {
    lastResponseTime: 0,
    avgResponseTime: 0,
    requestCount: 0,
    errorCount: 0
};

/**
 * Update API stats (called from API wrapper)
 */
export function updateApiStats(responseTimeMs, isError = false) {
    apiStats.requestCount++;
    if (isError) {
        apiStats.errorCount++;
    } else {
        apiStats.lastResponseTime = responseTimeMs;
        // Running average
        apiStats.avgResponseTime = Math.round(
            (apiStats.avgResponseTime * (apiStats.requestCount - 1) + responseTimeMs) / apiStats.requestCount
        );
    }
}

/**
 * Get API stats
 */
export function getApiStats() {
    return { ...apiStats };
}

/**
 * Bot status handler - builds health overview embed
 * @param {Client} client - Discord client
 * @returns {EmbedBuilder}
 */
export async function botStatusHandler(client) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const uptimeMs = Date.now() - BOT_START_TIME;

        // Calculate uptime
        const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const uptimeMins = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeStr = `${uptimeHours}h ${uptimeMins}m`;

        // Get system data
        const activeSchedulers = getActiveSchedulers();
        const runnerStates = getAllRunnerStates();
        const users = getAllUsers();
        const userCount = Object.keys(users).length;
        const logStats = getLogStats();

        // Count runner types
        const foreignMarketRunners = activeSchedulers.filter(k => k.startsWith('foreignMarket.')).length;
        const globalRunners = activeSchedulers.filter(k => !k.startsWith('foreignMarket.') && !k.includes(':')).length;
        const personalRunners = activeSchedulers.filter(k => k.includes(':')).length;

        // Build embed
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // Green = healthy
            .setTitle(`🤖 Torn Sentinel — ${getUi('system_status')}`)
            .setDescription('────────────────────────────────────────────────');

        // Bot Status section
        embed.addFields({
            name: `🟢 ${getUi('bot_status')}`,
            value: [
                `• ${getUi('online_since')}: <t:${Math.floor(BOT_START_TIME / 1000)}:f>`,
                `• ${getUi('uptime')}: \`${uptimeStr}\``,
                `• ${getUi('version')}: \`v1.4.0\``,
                `• ${getUi('environment')}: \`${process.env.RENDER_SERVICE_NAME || 'Local'}\``
            ].join('\n'),
            inline: false
        });

        // Core Systems section
        const schedulerStatus = activeSchedulers.length > 0 ? '✅ Running' : '⚠️ Idle';
        const alertStatus = process.env.ALERT_ENABLED !== 'false' ? '✅ Active' : '❌ Disabled';
        const tradeStatus = process.env.TRADE_HISTORY_CHANNEL_ID ? '✅ Active' : '⚠️ Not configured';

        embed.addFields({
            name: `⚙️ ${getUi('core_systems')}`,
            value: [
                `• Scheduler Engine: ${schedulerStatus}`,
                `• Auto-Run Bootstrap: ✅ Loaded`,
                `• Alert Engine: ${alertStatus}`,
                `• Trade Detection: ${tradeStatus}`
            ].join('\n'),
            inline: false
        });

        // API Health section
        const apiHealth = apiStats.errorCount === 0 ? '🟢 OK' : '🟡 Degraded';
        const avgMs = apiStats.avgResponseTime || 'N/A';

        embed.addFields({
            name: `📡 ${getUi('api_health')}`,
            value: [
                `• Torn API: ${apiHealth} (avg ${avgMs}ms)`,
                `• ${getUi('requests')}: \`${apiStats.requestCount}\``,
                `• ${getUi('errors')}: \`${apiStats.errorCount}\``
            ].join('\n'),
            inline: true
        });

        // Runners section
        embed.addFields({
            name: '🧠 Runners',
            value: [
                `• Global: \`${globalRunners}\` active`,
                `• Personal: \`${personalRunners}\` users`,
                `• Foreign Markets: \`${foreignMarketRunners}\` countries`
            ].join('\n'),
            inline: true
        });

        // Storage section
        const lastRunnerUpdate = Object.values(runnerStates)
            .map(r => r.lastRun || 0)
            .sort((a, b) => b - a)[0];
        const lastUpdateAgo = lastRunnerUpdate ? Math.floor((Date.now() - lastRunnerUpdate) / 1000) : 0;

        embed.addFields({
            name: `💾 ${getUi('storage')}`,
            value: [
                `• Users loaded: \`${userCount}\``,
                `• Runners tracked: \`${Object.keys(runnerStates).length}\``,
                `• Log entries: \`${logStats.total}\``,
                `• Last update: \`${lastUpdateAgo}s ago\``
            ].join('\n'),
            inline: false
        });

        // Footer with last update timestamp
        embed.setTimestamp()
            .setFooter({ text: `Last Update: <t:${now}:R>` });

        return embed;

    } catch (error) {
        console.error('❌ Bot status handler error:', error.message);

        // Return error embed
        return new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🤖 Torn Sentinel — System Status')
            .setDescription('❌ Error generating status')
            .addFields({ name: 'Error', value: error.message })
            .setTimestamp();
    }
}

export default botStatusHandler;
