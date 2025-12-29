/**
 * Runtime State Manager
 * Persistent storage for message IDs, channel IDs, and runner state
 * Survives bot restarts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const STATE_FILE = './data/runtime-state.json';

// In-memory cache
let stateCache = {};

/**
 * Initialize runtime state
 */
export function initRuntimeState() {
    try {
        const dir = dirname(STATE_FILE);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        if (existsSync(STATE_FILE)) {
            const data = readFileSync(STATE_FILE, 'utf8');
            stateCache = JSON.parse(data);
            console.log(`📁 Runtime state loaded: ${Object.keys(stateCache).length} runners`);
        } else {
            stateCache = {};
            saveState();
            console.log('📁 Runtime state initialized (empty)');
        }
    } catch (error) {
        console.error('❌ Failed to load runtime state:', error.message);
        stateCache = {};
    }
}

/**
 * Save state to file
 */
function saveState() {
    try {
        writeFileSync(STATE_FILE, JSON.stringify(stateCache, null, 2));
    } catch (error) {
        console.error('❌ Failed to save runtime state:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════════
// RUNNER STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Get runner state
 */
export function getRunnerState(key) {
    return stateCache[key] || null;
}

/**
 * Set runner state
 */
export function setRunnerState(key, state) {
    stateCache[key] = {
        ...stateCache[key],
        ...state,
        updatedAt: Date.now()
    };
    saveState();
}

/**
 * Get all runner states
 */
export function getAllRunnerStates() {
    return { ...stateCache };
}

/**
 * Check if runner is enabled
 */
export function isRunnerEnabled(key) {
    return stateCache[key]?.enabled === true;
}

/**
 * Enable/disable runner
 */
export function setRunnerEnabled(key, enabled) {
    if (!stateCache[key]) {
        stateCache[key] = {};
    }
    stateCache[key].enabled = enabled;
    saveState();
}

// ═══════════════════════════════════════════════════════════════════
// MESSAGE ID MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Get stored message ID for a runner
 */
export function getMessageId(key) {
    return stateCache[key]?.messageId || null;
}

/**
 * Set message ID for a runner
 */
export function setMessageId(key, messageId) {
    if (!stateCache[key]) {
        stateCache[key] = { enabled: true };
    }
    stateCache[key].messageId = messageId;
    saveState();
}

/**
 * Get channel ID for a runner
 */
export function getChannelId(key) {
    return stateCache[key]?.channelId || null;
}

/**
 * Set channel ID for a runner
 */
export function setChannelId(key, channelId) {
    if (!stateCache[key]) {
        stateCache[key] = { enabled: true };
    }
    stateCache[key].channelId = channelId;
    saveState();
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Initialize a runner with channel ID
 */
export function initRunner(key, channelId) {
    stateCache[key] = {
        enabled: true,
        channelId,
        messageId: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    saveState();
}

/**
 * Remove a runner
 */
export function removeRunner(key) {
    delete stateCache[key];
    saveState();
}

/**
 * Clear all state (for testing)
 */
export function clearAllState() {
    stateCache = {};
    saveState();
}

/**
 * Force save (for shutdown)
 */
export function forceSaveRuntimeState() {
    saveState();
    console.log('💾 Runtime state saved');
}
