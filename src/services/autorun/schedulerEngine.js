/**
 * Scheduler Engine
 * Manages isolated intervals for each auto-runner
 */

import {
    getRunnerState,
    setRunnerState,
    getMessageId,
    setMessageId,
    isRunnerEnabled
} from './runtimeStateManager.js';
import { getRunner, INTERVALS } from './autoRunRegistry.js';
import { getAllUsers } from '../userStorage.js';
import { hasReportedToday, markReportSent } from './dailyReportStateManager.js';

// Active schedulers (key -> intervalId)
const activeSchedulers = new Map();

// Daily interval threshold (anything >= 12 hours is considered daily)
const DAILY_INTERVAL_THRESHOLD = 12 * 60 * 60 * 1000;

// Handler functions (loaded dynamically)
const handlers = new Map();

// Discord client reference
let discordClient = null;

// Error tracking for consecutive failures
const errorCounts = new Map();
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Set Discord client reference
 */
export function setSchedulerClient(client) {
    discordClient = client;
}

/**
 * Register a handler function
 */
export function registerHandler(key, handlerFn) {
    handlers.set(key, handlerFn);
}

/**
 * Start a scheduler for a runner
 */
export async function startScheduler(runnerKey, channelId) {
    // Guard: Don't start if already running
    if (activeSchedulers.has(runnerKey)) {
        console.log(`⚠️ Scheduler already running: ${runnerKey}`);
        return;
    }

    const runner = getRunner(runnerKey);
    if (!runner) {
        console.error(`❌ Unknown runner: ${runnerKey}`);
        return;
    }

    const handler = handlers.get(runner.handler);
    if (!handler) {
        console.error(`❌ No handler registered for: ${runner.handler}`);
        return;
    }

    console.log(`▶️ Starting scheduler: ${runner.emoji} ${runner.name} (${runner.interval / 1000}s)`);

    // Run immediately
    await runTick(runnerKey, runner, handler, channelId);

    // Then schedule recurring
    const intervalId = setInterval(async () => {
        await runTick(runnerKey, runner, handler, channelId);
    }, runner.interval);

    activeSchedulers.set(runnerKey, intervalId);
}

/**
 * Run a single tick for a runner
 */
async function runTick(runnerKey, runner, handler, channelId) {
    try {
        // Check if still enabled
        if (!isRunnerEnabled(runnerKey)) {
            stopScheduler(runnerKey);
            return;
        }

        // Get channel
        const channel = await discordClient.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            console.error(`❌ Channel not found for ${runnerKey}: ${channelId}`);
            setRunnerState(runnerKey, { enabled: false, error: 'Channel not found' });
            stopScheduler(runnerKey);
            return;
        }

        // Check if this is a daily runner that has already reported today
        const isDailyRunner = runner.interval >= DAILY_INTERVAL_THRESHOLD;
        if (isDailyRunner && hasReportedToday(runnerKey)) {
            // Skip - already reported today
            return;
        }

        // Get existing message ID
        let messageId = getMessageId(runnerKey);
        let message = null;

        // Try to fetch existing message
        if (messageId) {
            try {
                message = await channel.messages.fetch(messageId);
            } catch (fetchError) {
                // Message deleted or invalid - clear the stored ID
                console.log(`📝 Message not found for ${runnerKey}, will create new`);
                setMessageId(runnerKey, null);
                message = null;
            }
        }

        // Fetch primary user (assuming single user for now, or use first registered)
        // We need to import getUser or getAllUsers from userStorage
        // But we can't easily import from inside this function without moving imports up.
        // Let's modify the file to import getAllUsers at top.

        // For now, I will rewrite the whole file to include the import and logic.
        // ... Wait, I can't just inject here without the import.
        // I will use `replace_file_content` to add import at top and logic here.

        // This tool call is purely for the logic part. I will assume I add the import in a separate chunk or same call if possible.
        // `replace_file_content` supports only contiguous block.
        // I'll make this TWO chunks. One for import, one for logic. 
        // Oh wait, `replace_file_content` is single block. `multi_replace_file_content` is what I need.

        // Actually, let's just use `multi_replace_file_content` to adding import and modifying runTick.
        // Get primary user
        const users = getAllUsers(); // Returns Object { id: user }
        const userList = Object.values(users);
        const user = userList.length > 0 ? userList[0] : null;

        // Call handler to get embed content
        const result = await handler(discordClient, user);

        if (!result) {
            // Handler returned nothing - it may handle its own messages (e.g., tradeHandler)
            // Still update lastRun to track that it executed successfully
            setRunnerState(runnerKey, { lastRun: Date.now() });
            return;
        }

        // Handle different return formats:
        // 1. New format: { embeds: [...], components: [...] }
        // 2. Old format: single EmbedBuilder or array of EmbedBuilder
        let embeds, components = [];

        if (result.embeds && Array.isArray(result.embeds)) {
            // New format with components
            embeds = result.embeds;
            components = result.components || [];
        } else {
            // Old format - single embed or array
            embeds = Array.isArray(result) ? result : [result];
        }

        if (message) {
            // Edit existing message
            await message.edit({ embeds, components });
        } else {
            // Create new message
            const newMessage = await channel.send({ embeds, components });
            setMessageId(runnerKey, newMessage.id);
            console.log(`✅ Created new message for ${runnerKey} (${embeds.length} embeds)`);
        }

        // Update state
        setRunnerState(runnerKey, { lastRun: Date.now() });

        // Mark daily reports as sent to prevent duplicates on restart
        if (isDailyRunner) {
            markReportSent(runnerKey);
        }

    } catch (error) {
        // Track consecutive errors
        const errorCount = (errorCounts.get(runnerKey) || 0) + 1;
        errorCounts.set(runnerKey, errorCount);

        console.error(`❌ Error in ${runnerKey} tick (${errorCount}/${MAX_CONSECUTIVE_ERRORS}):`, error.message);

        // Update state with error info
        setRunnerState(runnerKey, {
            lastError: error.message,
            lastErrorTime: Date.now(),
            errorCount
        });

        // If too many consecutive errors, log warning but keep trying
        if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
            console.warn(`⚠️ ${runnerKey} has failed ${errorCount} times consecutively`);
        }
    }
}

/**
 * Stop a scheduler
 */
export function stopScheduler(runnerKey) {
    const intervalId = activeSchedulers.get(runnerKey);
    if (intervalId) {
        clearInterval(intervalId);
        activeSchedulers.delete(runnerKey);
        console.log(`⏹️ Stopped scheduler: ${runnerKey}`);
    }
}

/**
 * Stop all schedulers
 */
export function stopAllSchedulers() {
    for (const [key, intervalId] of activeSchedulers) {
        clearInterval(intervalId);
        console.log(`⏹️ Stopped scheduler: ${key}`);
    }
    activeSchedulers.clear();
}

/**
 * Get list of active schedulers
 */
export function getActiveSchedulers() {
    return Array.from(activeSchedulers.keys());
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(runnerKey) {
    return activeSchedulers.has(runnerKey);
}

// Health Monitoring State
let healthMonitorInterval = null;
let maxActiveRunners = 0;

/**
 * Start the health monitoring service
 */
export function startHealthMonitor(client) {
    if (healthMonitorInterval) return;

    console.log('🏥 Health Monitor Service started (30s cycle)');

    // Initial check
    checkRunnerHealth(client);

    healthMonitorInterval = setInterval(() => {
        checkRunnerHealth(client);
    }, 30000); // Check every 30s
}

/**
 * Stop health monitor
 */
export function stopHealthMonitor() {
    if (healthMonitorInterval) {
        clearInterval(healthMonitorInterval);
        healthMonitorInterval = null;
    }
}

/**
 * Core Health Check Logic
 */
async function checkRunnerHealth(client) {
    const activeCount = activeSchedulers.size;

    // 1. High-Water Mark Tracking
    if (activeCount > maxActiveRunners) {
        maxActiveRunners = activeCount;
        console.log(`📈 New Runner Peak: ${maxActiveRunners} active runners`);
    }

    // 2. Staleness Check
    const now = Date.now();
    const TOLERANCE = 30000; // 30s tolerance

    for (const runnerKey of activeSchedulers.keys()) {
        const state = getRunnerState(runnerKey);
        const runner = getRunner(runnerKey);

        if (!runner) continue; // Should not happen if in activeSchedulers

        const lastRun = state?.lastRun || 0;

        // If never run, skip (it's starting up)
        if (lastRun === 0) continue;

        // Check if dead
        const expectedNextRun = lastRun + runner.interval;
        const deadThreshold = expectedNextRun + TOLERANCE;

        if (now > deadThreshold) {
            const lateMs = now - expectedNextRun;
            const lateSec = Math.floor(lateMs / 1000);

            console.warn(`🔴 DEAD RUNNER DETECTED: ${runnerKey} (Late by ${lateSec}s)`);

            // Send Alert
            await sendDeadRunnerAlert(client, runner, lateSec);
        }
    }
}

/**
 * Send Dead Runner Alert
 */
async function sendDeadRunnerAlert(client, runner, lateSec) {
    // Prevent spamming alerts (simple debounce could be added here if needed)
    // For now, we alert every 30s if it stays dead, which is annoying but effective request.
    // Better: Check if we recently alerted for this runner.

    // We can reuse errorCounts for alert throttling or add a new state
    const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || process.env.BOT_LOGS_CHANNEL_ID;
    if (!LOG_CHANNEL_ID) return;

    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const embed = {
            color: 0xE74C3C, // Red
            title: '🔴 DEAD RUNNER DETECTED',
            description: `**${runner.name}** has stopped updating!`,
            fields: [
                { name: 'Func ID', value: `\`${runner.key}\``, inline: true },
                { name: 'Interval', value: `${runner.interval / 1000}s`, inline: true },
                { name: 'Late By', value: `**${lateSec}s**`, inline: true },
                { name: 'Status', value: '❌ Stalled / Hanging', inline: false }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'Torn Sentinel Health Monitor' }
        };

        await channel.send({ embeds: [embed] });

    } catch (e) {
        console.error('Failed to send dead runner alert:', e.message);
    }
}

/**
 * Get health status of all schedulers (Updated for Health Monitor)
 */
export function getSchedulerHealth() {
    const health = {};
    for (const key of activeSchedulers.keys()) {
        health[key] = {
            running: true,
            errorCount: errorCounts.get(key) || 0,
            healthy: (errorCounts.get(key) || 0) < MAX_CONSECUTIVE_ERRORS
        };
    }
    // Inject maxActiveRunners info if needed externally?
    // Using a property on the object or return separate stats
    return health;
}

export function getHealthStats() {
    return {
        activeRunners: activeSchedulers.size,
        maxActiveRunners: maxActiveRunners
    };
}
