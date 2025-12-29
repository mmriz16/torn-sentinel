/**
 * Alert Engine - Core Logic
 * Edge detection, cooldown enforcement, and alert sending
 */

import { EmbedBuilder } from 'discord.js';
import { ALERTS } from './alertRegistry.js';
import { COMPOUND_ALERTS } from './alertEvaluator.js';
import {
    getPreviousState,
    updateState,
    getFlag,
    setFlag,
    isOnCooldown,
    setLastAlertTime,
    isRateLimited,
    recordAlertSent
} from './alertState.js';
import { discordTimestamp } from '../../utils/formatters.js';

// Alert channel ID (from env)
const ALERT_CHANNEL_ID = process.env.ALERT_CHANNEL_ID || '1455105643206676567';

// Config defaults
const CONFIG = {
    CASH_DROP_THRESHOLD: parseInt(process.env.ALERT_CASH_DROP_THRESHOLD) || 500000,
    UNPAID_FEES_DELTA_MIN: parseInt(process.env.ALERT_UNPAID_FEES_DELTA_MIN) || 100000,
    MAX_ALERTS_PER_10MIN: parseInt(process.env.ALERT_MAX_PER_10MIN) || 3,
    ENABLED: process.env.ALERT_ENABLED !== 'false',
};

// Discord client reference (set by scheduler)
let discordClient = null;

/**
 * Set Discord client reference
 */
export function setClient(client) {
    discordClient = client;
}

/**
 * Process all alerts for a user with fresh API data
 * @param {string} userId - Discord user ID
 * @param {object} currentState - Fresh data from API
 * @param {string} apiGroup - Which API group this data is from
 */
export async function processAlerts(userId, currentState, apiGroup) {
    if (!CONFIG.ENABLED) return;

    try {
        const prevState = getPreviousState(userId);

        // Combine all alerts (regular + compound)
        const allAlerts = [
            ...Object.values(ALERTS),
            ...Object.values(COMPOUND_ALERTS)
        ];

        // Filter to alerts that match this API group
        const relevantAlerts = allAlerts.filter(a => a.apiGroup === apiGroup);

        for (const alert of relevantAlerts) {
            await processAlert(userId, alert, prevState, currentState);
        }

        // Update stored state
        updateState(userId, currentState);

    } catch (error) {
        console.error(`Alert processing error for user ${userId}:`, error.message);
        // Don't crash - just skip this tick
    }
}

/**
 * Process a single alert
 */
async function processAlert(userId, alert, prevState, currentState) {
    try {
        // 1. Check if condition is met
        const conditionMet = alert.checkCondition(prevState, currentState, CONFIG);

        // 2. Check if flag is already set (alert was sent)
        const flagSet = getFlag(userId, alert.key);

        // 3. Check reset condition
        if (flagSet) {
            const shouldReset = alert.resetCondition(prevState, currentState, CONFIG);
            if (shouldReset) {
                setFlag(userId, alert.key, false);
                // Continue to check if we should re-trigger
            }
        }

        // 4. Edge detection: only alert if NEW trigger
        const currentFlagSet = getFlag(userId, alert.key);

        if (conditionMet && !currentFlagSet) {
            // 5. Check cooldown
            if (isOnCooldown(userId, alert.key, alert.cooldown)) {
                return; // Still on cooldown, skip
            }

            // 6. Check rate limit
            if (isRateLimited(userId, CONFIG.MAX_ALERTS_PER_10MIN)) {
                console.log(`⚠️ Rate limited: ${alert.key} for user ${userId}`);
                return;
            }

            // 7. Send alert!
            await sendAlert(userId, alert, currentState, prevState);

            // 8. Set flag and record
            setFlag(userId, alert.key, true);
            setLastAlertTime(userId, alert.key);
            recordAlertSent(userId);
        }

    } catch (error) {
        console.error(`Error processing alert ${alert.key}:`, error.message);
        // Don't crash - continue with other alerts
    }
}

/**
 * Send alert to channel
 */
async function sendAlert(userId, alert, currentState, prevState) {
    if (!discordClient) {
        console.error('Discord client not set');
        return;
    }

    try {
        const channel = await discordClient.channels.fetch(ALERT_CHANNEL_ID);
        if (!channel) {
            console.error(`Alert channel not found: ${ALERT_CHANNEL_ID}`);
            return;
        }

        // Build embed
        const embed = buildAlertEmbed(userId, alert, currentState, prevState);

        // Send message
        await channel.send({
            content: `<@${userId}>`, // Mention user
            embeds: [embed]
        });

        console.log(`🔔 Alert sent: ${alert.key} for user ${userId}`);

    } catch (error) {
        console.error(`Failed to send alert ${alert.key}:`, error.message);
        // Permission error, channel missing, etc - don't crash
    }
}

/**
 * Build alert embed
 */
function buildAlertEmbed(userId, alert, currentState, prevState) {
    const now = Math.floor(Date.now() / 1000);

    // Get color based on severity
    const colors = {
        action: 0x00FF00,   // Green
        info: 0x5865F2,     // Discord blue
        warning: 0xFF9900,  // Orange
    };
    const color = colors[alert.severity] || colors.info;

    // Get message bullets
    const messages = alert.getMessage(currentState, prevState, CONFIG);
    const bulletPoints = messages.map(m => `• ${m}`).join('\n');

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${alert.emoji} ${alert.title}`)
        .setDescription(bulletPoints)
        .setTimestamp()
        .setFooter({ text: `Torn Sentinel • ${discordTimestamp(now, 'R')}` });

    return embed;
}

/**
 * Test alert (for /alert-test command)
 */
export async function sendTestAlert(userId, alertKey) {
    if (!discordClient) return { success: false, error: 'Client not set' };

    const alert = ALERTS[alertKey] || COMPOUND_ALERTS[alertKey];
    if (!alert) return { success: false, error: 'Alert not found' };

    try {
        const channel = await discordClient.channels.fetch(ALERT_CHANNEL_ID);
        if (!channel) return { success: false, error: 'Channel not found' };

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`${alert.emoji} [TEST] ${alert.title}`)
            .setDescription('• This is a test alert\n• No action required')
            .setTimestamp()
            .setFooter({ text: 'Torn Sentinel • Test Mode' });

        await channel.send({
            content: `<@${userId}> (Test Alert)`,
            embeds: [embed]
        });

        return { success: true };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get all alert keys for autocomplete
 */
export function getAllAlertKeys() {
    return [
        ...Object.keys(ALERTS),
        ...Object.keys(COMPOUND_ALERTS)
    ];
}
