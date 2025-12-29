/**
 * Alert State Storage - Persistence Layer
 * Stores user states, flags, and last alert times for edge detection
 * Uses JSON file for persistence across restarts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const STATE_FILE = './data/alert-state.json';

// In-memory cache
let stateCache = {};
let lastSaveTime = 0;
const SAVE_DEBOUNCE = 5000; // 5 seconds debounce for saves

/**
 * Initialize state storage
 */
export function initAlertState() {
    try {
        // Ensure data directory exists
        const dir = dirname(STATE_FILE);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        // Load existing state
        if (existsSync(STATE_FILE)) {
            const data = readFileSync(STATE_FILE, 'utf8');
            stateCache = JSON.parse(data);
            console.log(`📊 Alert state loaded: ${Object.keys(stateCache).length} users`);
        } else {
            stateCache = {};
            saveState();
            console.log('📊 Alert state initialized (empty)');
        }
    } catch (error) {
        console.error('❌ Failed to load alert state:', error.message);
        stateCache = {};
    }
}

/**
 * Save state to file (with debounce)
 */
function saveState(force = false) {
    const now = Date.now();

    // Debounce saves unless forced
    if (!force && now - lastSaveTime < SAVE_DEBOUNCE) {
        return;
    }

    try {
        writeFileSync(STATE_FILE, JSON.stringify(stateCache, null, 2));
        lastSaveTime = now;
    } catch (error) {
        console.error('❌ Failed to save alert state:', error.message);
    }
}

/**
 * Force save (for shutdown)
 */
export function forceSaveState() {
    saveState(true);
    console.log('💾 Alert state saved');
}

/**
 * Get or create user state entry
 */
function getUserEntry(userId) {
    if (!stateCache[userId]) {
        stateCache[userId] = {
            state: {},           // Current API state
            flags: {},           // Alert flags (has alert been sent?)
            lastAlert: {},       // Timestamp of last alert per type
            updatedAt: Date.now()
        };
    }
    return stateCache[userId];
}

// ═══════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Get previous state for a user
 */
export function getPreviousState(userId) {
    const entry = getUserEntry(userId);
    return entry.state || {};
}

/**
 * Update current state for a user
 */
export function updateState(userId, newState) {
    const entry = getUserEntry(userId);

    // Merge new state into existing
    entry.state = {
        ...entry.state,
        ...newState
    };
    entry.updatedAt = Date.now();

    saveState();
}

/**
 * Replace entire state for a user (for specific API group)
 */
export function replaceStateGroup(userId, apiGroup, newState) {
    const entry = getUserEntry(userId);

    // Store with API group prefix to avoid conflicts
    entry.state = {
        ...entry.state,
        ...newState
    };
    entry.updatedAt = Date.now();

    saveState();
}

// ═══════════════════════════════════════════════════════════════════
// FLAG MANAGEMENT (for edge detection)
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if alert flag is set (alert already sent)
 */
export function getFlag(userId, alertKey) {
    const entry = getUserEntry(userId);
    return entry.flags[alertKey] || false;
}

/**
 * Set alert flag
 */
export function setFlag(userId, alertKey, value) {
    const entry = getUserEntry(userId);
    entry.flags[alertKey] = value;
    saveState();
}

/**
 * Reset all flags for a user
 */
export function resetFlags(userId) {
    const entry = getUserEntry(userId);
    entry.flags = {};
    saveState();
}

// ═══════════════════════════════════════════════════════════════════
// COOLDOWN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Get last alert time for a specific alert
 */
export function getLastAlertTime(userId, alertKey) {
    const entry = getUserEntry(userId);
    return entry.lastAlert[alertKey] || 0;
}

/**
 * Set last alert time (current timestamp)
 */
export function setLastAlertTime(userId, alertKey) {
    const entry = getUserEntry(userId);
    entry.lastAlert[alertKey] = Date.now();
    saveState();
}

/**
 * Check if alert is on cooldown
 * @param {string} userId 
 * @param {string} alertKey 
 * @param {number} cooldownSeconds 
 * @returns {boolean} true if on cooldown
 */
export function isOnCooldown(userId, alertKey, cooldownSeconds) {
    const lastTime = getLastAlertTime(userId, alertKey);
    if (lastTime === 0) return false;

    const cooldownMs = cooldownSeconds * 1000;
    const elapsed = Date.now() - lastTime;

    return elapsed < cooldownMs;
}

/**
 * Get remaining cooldown time in seconds
 */
export function getRemainingCooldown(userId, alertKey, cooldownSeconds) {
    const lastTime = getLastAlertTime(userId, alertKey);
    if (lastTime === 0) return 0;

    const cooldownMs = cooldownSeconds * 1000;
    const elapsed = Date.now() - lastTime;
    const remaining = cooldownMs - elapsed;

    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

// ═══════════════════════════════════════════════════════════════════
// ANTI-SPAM: Rate Limiting
// ═══════════════════════════════════════════════════════════════════

// Track alerts in last 10 minutes per user
const recentAlerts = new Map(); // userId -> [timestamps]

/**
 * Check if user has exceeded alert rate limit
 * @param {string} userId 
 * @param {number} maxAlerts - max alerts per 10 minutes
 * @returns {boolean} true if limit exceeded
 */
export function isRateLimited(userId, maxAlerts = 3) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes

    // Get recent alerts for user
    let alerts = recentAlerts.get(userId) || [];

    // Filter to only last 10 minutes
    alerts = alerts.filter(t => now - t < windowMs);

    // Update cache
    recentAlerts.set(userId, alerts);

    return alerts.length >= maxAlerts;
}

/**
 * Record that an alert was sent (for rate limiting)
 */
export function recordAlertSent(userId) {
    const alerts = recentAlerts.get(userId) || [];
    alerts.push(Date.now());
    recentAlerts.set(userId, alerts);
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all tracked user IDs
 */
export function getTrackedUsers() {
    return Object.keys(stateCache);
}

/**
 * Remove user from tracking
 */
export function removeUser(userId) {
    delete stateCache[userId];
    recentAlerts.delete(userId);
    saveState();
}

/**
 * Clear all state (for testing)
 */
export function clearAllState() {
    stateCache = {};
    recentAlerts.clear();
    saveState(true);
}
