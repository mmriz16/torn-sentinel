/**
 * Bot Status Handler for Auto-Run
 * Displays real-time health overview of bot systems
 * Includes per-runner health check with failure alerts
 */

import { EmbedBuilder } from 'discord.js';
import { getActiveSchedulers, getSchedulerHealth } from '../schedulerEngine.js';
import { getAllRunnerStates } from '../runtimeStateManager.js';
import { getAllUsers } from '../../userStorage.js';
import { getLogStats } from '../../system/systemLogger.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';
import { getRunnerFooter } from '../../../utils/footerHelper.js';

// Track bot start time
const BOT_START_TIME = Date.now();

// API health tracking
let apiStats = {
    lastResponseTime: 0,
    avgResponseTime: 0,
    requestCount: 0,
    errorCount: 0
};

// Track last alert time to prevent spam
let lastAlertTime = 0;
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes between alerts

// Store client reference for alerts
let discordClient = null;

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
 * Check runner health and send alert if needed
 */
async function checkAndAlertHealth(client, runnerStates, activeSchedulers) {
    const now = Date.now();
    const problems = [];

    // Check each active runner for staleness
    for (const key of activeSchedulers) {
        const state = runnerStates[key];
        const runner = AUTO_RUNNERS[key];

        if (!state || !runner) continue;

        // Skip if lastRun is missing (not an error, just not tracked)
        if (!state.lastRun) continue;

        // Check if stale (10x the expected interval)
        const maxAge = runner.interval * 10;
        const age = now - state.lastRun;

        if (age > maxAge) {
            const agoMins = Math.floor(age / 60000);
            problems.push({
                name: runner.name || key,
                emoji: runner.emoji || '❓',
                age: `${agoMins}m ago`,
                error: state.lastError || null
            });
        }

        // Check consecutive errors
        if (state.errorCount && state.errorCount >= 5) {
            if (!problems.find(p => p.name === (runner.name || key))) {
                problems.push({
                    name: runner.name || key,
                    emoji: runner.emoji || '❓',
                    age: 'Error',
                    error: state.lastError || 'Multiple consecutive failures'
                });
            }
        }
    }

    // Send alert if problems found and cooldown passed
    if (problems.length > 0 && (now - lastAlertTime) > ALERT_COOLDOWN) {
        await sendHealthAlert(client, problems);
        lastAlertTime = now;
    }

    return problems;
}

/**
 * Send health alert to notification channel
 */
async function sendHealthAlert(client, problems) {
    const alertChannelId = process.env.ALERT_CHANNEL_ID;
    if (!alertChannelId) return;

    try {
        const channel = await client.channels.fetch(alertChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C) // Red
            .setTitle('🚨 System Health Alert')
            .setDescription(`**${problems.length}** runner(s) are experiencing issues!`)
            .setTimestamp();

        // List problems
        const problemList = problems.slice(0, 10).map(p =>
            `${p.emoji} **${p.name}**: ${p.age}${p.error ? ` - \`${p.error.substring(0, 50)}\`` : ''}`
        ).join('\n');

        embed.addFields({
            name: '⚠️ Affected Runners',
            value: problemList || 'Unknown issues',
            inline: false
        });

        embed.addFields({
            name: '💡 Suggested Action',
            value: 'Check Render logs or restart the bot if issues persist.',
            inline: false
        });

        await channel.send({ embeds: [embed] });
        console.log(`🚨 Sent health alert for ${problems.length} runners`);

    } catch (error) {
        console.error('❌ Failed to send health alert:', error.message);
    }
}

/**
 * Bot status handler - builds health overview embeds (multi-embed format)
 * @param {Client} client - Discord client
 * @returns {EmbedBuilder[]} Array of embeds
 */
export async function botStatusHandler(client) {
    try {
        discordClient = client;
        const uptimeMs = Date.now() - BOT_START_TIME;

        // Calculate uptime
        const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const uptimeMins = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeStr = `${uptimeHours}h ${uptimeMins}m`;

        // Format online since date
        const onlineSince = new Date(BOT_START_TIME);
        const onlineSinceStr = onlineSince.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }) + ' ' + onlineSince.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // Get system data
        const activeSchedulers = getActiveSchedulers();
        const runnerStates = getAllRunnerStates();
        const users = getAllUsers();
        const userCount = Object.keys(users).length;
        const logStats = getLogStats();
        const schedulerHealth = getSchedulerHealth();

        // Check health and send alerts if needed
        const problems = await checkAndAlertHealth(client, runnerStates, activeSchedulers);

        // Count runner types
        const foreignMarketRunners = activeSchedulers.filter(k => k.startsWith('foreignMarket.')).length;
        const globalRunners = activeSchedulers.filter(k => !k.startsWith('foreignMarket.') && !k.includes(':')).length;
        const personalRunners = activeSchedulers.filter(k => k.includes(':')).length;

        // Count healthy runners
        const healthyCount = Object.values(schedulerHealth).filter(h => h.healthy).length;
        const totalCount = Object.keys(schedulerHealth).length;

        // Determine overall status color
        const statusColor = problems.length === 0 ? 0x2ECC71 : (problems.length < 3 ? 0xF39C12 : 0xE74C3C);

        const separator = '─────────────────────────────────────────────────────────────';

        // Build multiple embeds
        const embeds = [];

        // 1. Bot Status embed
        const botStatusEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('📊｜Status Bot')
            .setDescription(separator)
            .addFields(
                { name: 'Online Sejak', value: `\`\`\`${onlineSinceStr}\`\`\``, inline: true },
                { name: 'Uptime', value: `\`\`\`${uptimeStr}\`\`\``, inline: true },
                { name: 'Versi', value: '```v1.50.0```', inline: true },
                { name: 'Lingkungan', value: `\`\`\`${process.env.RENDER_SERVICE_NAME || 'Local'}\`\`\``, inline: true },
                { name: 'Memory', value: `\`\`\`${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\`\`\``, inline: true }
            );
        embeds.push(botStatusEmbed);

        // 2. Runner Health embed
        const runnerHealthEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('🏥｜Runner Health')
            .setDescription(separator)
            .addFields(
                { name: 'Healthy', value: `\`\`\`${healthyCount} / ${totalCount}\`\`\``, inline: true },
                { name: 'Stale/Error', value: `\`\`\`${problems.length}\`\`\``, inline: true }
            );
        embeds.push(runnerHealthEmbed);

        // 3. Active Runners embed
        const activeRunnersEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('🧠｜Active Runners')
            .setDescription(separator)
            .addFields(
                { name: 'Global', value: `\`\`\`${globalRunners}\`\`\``, inline: true },
                { name: 'Personal', value: `\`\`\`${personalRunners}\`\`\``, inline: true },
                { name: 'Foreign Markets', value: `\`\`\`${foreignMarketRunners}\`\`\``, inline: true }
            );
        embeds.push(activeRunnersEmbed);

        // 4. API Health embed
        // Get rate stats from tornApi
        const { getApiStats: getTornApiStats } = await import('../../tornApi.js');
        const rateStats = getTornApiStats();

        const apiHealth = apiStats.errorCount === 0 ? '🟢 OK' : '🟡 Degraded';
        const avgMs = apiStats.avgResponseTime || 0;
        const rateStatus = rateStats.status;

        const apiHealthEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('📡｜Kesehatan API')
            .setDescription(separator)
            .addFields(
                { name: 'Torn API', value: `\`\`\`${apiHealth}\`\`\``, inline: true },
                { name: 'Rate/Min', value: `\`\`\`${rateStats.usage} ${rateStatus}\`\`\``, inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, // spacer
                { name: 'Avg Response', value: `\`\`\`${avgMs}ms\`\`\``, inline: true },
                { name: 'Requests', value: `\`\`\`${apiStats.requestCount}\`\`\``, inline: true },
                { name: 'Errors', value: `\`\`\`${apiStats.errorCount}\`\`\``, inline: true }
            );
        embeds.push(apiHealthEmbed);

        // 5. Storage embed
        const lastRunnerUpdate = Object.values(runnerStates)
            .map(r => r.lastRun || 0)
            .sort((a, b) => b - a)[0];
        const lastUpdateAgo = lastRunnerUpdate ? Math.floor((Date.now() - lastRunnerUpdate) / 1000) : 0;

        const storageEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('💾｜Penyimpanan')
            .setDescription(separator)
            .addFields(
                { name: 'Users', value: `\`\`\`${userCount}\`\`\``, inline: true },
                { name: 'Running Tracked', value: `\`\`\`${Object.keys(runnerStates).length}\`\`\``, inline: true },
                { name: 'Logs', value: `\`\`\`${logStats.total}\`\`\``, inline: true },
                { name: 'Last Update', value: `\`\`\`${lastUpdateAgo}s\`\`\``, inline: false }
            )
            .setFooter(getRunnerFooter('botStatus'))
            .setTimestamp();
        embeds.push(storageEmbed);

        return embeds;

    } catch (error) {
        console.error('❌ Bot status handler error:', error.message);

        // Return error embed as array
        return [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🤖 Torn Sentinel — System Status')
            .setDescription('❌ Error generating status')
            .addFields({ name: 'Error', value: error.message })
            .setTimestamp()];
    }
}

export default botStatusHandler;
