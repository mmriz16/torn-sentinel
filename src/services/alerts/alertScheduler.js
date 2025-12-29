/**
 * Alert Scheduler - Polling Loop
 * Manages multi-interval polling for different data types
 */

import { get } from '../tornApi.js';
import { getAllUsers } from '../userStorage.js';
import { initAlertState, forceSaveState } from './alertState.js';
import { processAlerts, setClient } from './alertEngine.js';
import { API_GROUPS, POLL_INTERVALS } from './alertRegistry.js';

// Active interval references
const activeIntervals = new Map();

// Track last poll time per API group
const lastPollTime = new Map();

// Error backoff tracking
const errorBackoff = new Map();
const MAX_BACKOFF = 5 * 60 * 1000; // 5 minutes max backoff

/**
 * Start the alert scheduler
 * @param {Client} client - Discord.js client
 */
export function startAlertScheduler(client) {
    // Check if alerts are enabled
    if (process.env.ALERT_ENABLED === 'false') {
        console.log('⚠️ Alert scheduler disabled (ALERT_ENABLED=false)');
        return;
    }

    // Set client reference for sending alerts
    setClient(client);

    // Initialize state storage
    initAlertState();

    // Start polling intervals
    startPolling(POLL_INTERVALS.FAST, 'FAST');
    startPolling(POLL_INTERVALS.MEDIUM, 'MEDIUM');
    startPolling(POLL_INTERVALS.SLOW, 'SLOW');

    console.log('🔔 Alert scheduler started');
    console.log(`   • Fast polling: ${POLL_INTERVALS.FAST / 1000}s (bars, travel)`);
    console.log(`   • Medium polling: ${POLL_INTERVALS.MEDIUM / 1000}s (education, financial)`);
    console.log(`   • Slow polling: ${POLL_INTERVALS.SLOW / 1000}s (job)`);
}

/**
 * Stop the alert scheduler
 */
export function stopAlertScheduler() {
    for (const [name, interval] of activeIntervals) {
        clearInterval(interval);
        console.log(`⏹️ Stopped alert interval: ${name}`);
    }
    activeIntervals.clear();

    // Save state before shutdown
    forceSaveState();
}

/**
 * Start a polling interval
 */
function startPolling(intervalMs, name) {
    // Run immediately
    runPollCycle(intervalMs, name);

    // Then schedule recurring
    const interval = setInterval(() => {
        runPollCycle(intervalMs, name);
    }, intervalMs);

    activeIntervals.set(name, interval);
}

/**
 * Run a single poll cycle for all users
 */
async function runPollCycle(intervalMs, name) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);

        if (userIds.length === 0) return;

        // Determine which API groups to poll based on interval
        const apiGroups = getApiGroupsForInterval(intervalMs);

        for (const userId of userIds) {
            const user = users[userId];
            if (!user.apiKey) continue;

            // Check if we should skip due to backoff
            const backoffKey = `${userId}:${name}`;
            const backoffUntil = errorBackoff.get(backoffKey) || 0;
            if (Date.now() < backoffUntil) continue;

            // Poll each API group
            for (const apiGroup of apiGroups) {
                await pollApiGroup(userId, user.apiKey, apiGroup);
            }
        }

    } catch (error) {
        console.error(`Alert poll cycle error (${name}):`, error.message);
    }
}

/**
 * Poll a specific API group for a user
 */
async function pollApiGroup(userId, apiKey, apiGroup) {
    try {
        // Fetch data from API
        const data = await get(apiKey, 'user', apiGroup);

        if (!data) {
            console.warn(`Empty data from API for user ${userId}, group ${apiGroup}`);
            return;
        }

        // Process alerts with this data
        await processAlerts(userId, data, apiGroup);

        // Clear any backoff on success
        errorBackoff.delete(`${userId}:${apiGroup}`);

    } catch (error) {
        handleApiError(userId, apiGroup, error);
    }
}

/**
 * Get API groups that should be polled at this interval
 */
function getApiGroupsForInterval(intervalMs) {
    const groups = [];

    if (intervalMs === POLL_INTERVALS.FAST) {
        groups.push(API_GROUPS.BARS);
        groups.push(API_GROUPS.TRAVEL);
        groups.push(API_GROUPS.PROFILE);
        groups.push(API_GROUPS.MESSAGES);
        groups.push(API_GROUPS.EVENTS);
    }

    if (intervalMs === POLL_INTERVALS.MEDIUM) {
        groups.push(API_GROUPS.EDUCATION);
        groups.push(API_GROUPS.FINANCIAL);
    }

    if (intervalMs === POLL_INTERVALS.SLOW) {
        groups.push(API_GROUPS.JOB);
    }

    return groups;
}

/**
 * Handle API errors with backoff
 */
function handleApiError(userId, apiGroup, error) {
    const backoffKey = `${userId}:${apiGroup}`;

    // Log error
    if (error.code === 429) {
        console.warn(`⚠️ Rate limited for user ${userId}, group ${apiGroup}`);
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        console.warn(`⚠️ Timeout for user ${userId}, group ${apiGroup}`);
    } else {
        console.error(`❌ API error for user ${userId}:`, error.message);
    }

    // Calculate backoff time
    const currentBackoff = errorBackoff.get(backoffKey) || 0;
    const elapsed = Date.now() - currentBackoff;
    let newBackoff;

    if (elapsed > MAX_BACKOFF) {
        // Reset backoff
        newBackoff = 30 * 1000; // Start with 30 seconds
    } else {
        // Double backoff (exponential)
        newBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF);
    }

    errorBackoff.set(backoffKey, Date.now() + newBackoff);
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
    return {
        enabled: process.env.ALERT_ENABLED !== 'false',
        activeIntervals: Array.from(activeIntervals.keys()),
        errorBackoffs: Object.fromEntries(errorBackoff),
    };
}
