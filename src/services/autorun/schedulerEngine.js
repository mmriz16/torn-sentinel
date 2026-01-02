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

/**
 * Get health status of all schedulers
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
    return health;
}
