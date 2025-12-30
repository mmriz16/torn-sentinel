/**
 * Trade Snapshot Storage
 * Manages per-user inventory/wallet snapshots for trade detection
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const STORAGE_PATH = './data/trade-snapshots.json';

/**
 * Initialize storage file if not exists
 */
function initStorage() {
    const dir = dirname(STORAGE_PATH);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(STORAGE_PATH)) {
        writeFileSync(STORAGE_PATH, JSON.stringify({}, null, 2));
    }
}

/**
 * Load all snapshots from storage
 * @returns {Object} All user snapshots
 */
function loadSnapshots() {
    initStorage();
    try {
        const data = readFileSync(STORAGE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading trade snapshots:', error);
        return {};
    }
}

/**
 * Save all snapshots to storage
 * @param {Object} snapshots - All user snapshots
 */
function saveSnapshots(snapshots) {
    writeFileSync(STORAGE_PATH, JSON.stringify(snapshots, null, 2));
}

/**
 * Get user's last snapshot
 * @param {string} userId - Discord user ID
 * @returns {Object|null} Last snapshot or null
 */
export function getLastSnapshot(userId) {
    const snapshots = loadSnapshots();
    return snapshots[userId]?.lastSnapshot || null;
}

/**
 * Get user's current snapshot
 * @param {string} userId - Discord user ID
 * @returns {Object|null} Current snapshot or null
 */
export function getCurrentSnapshot(userId) {
    const snapshots = loadSnapshots();
    return snapshots[userId]?.currentSnapshot || null;
}

/**
 * Update user's snapshots (rotate current -> last, set new current)
 * @param {string} userId - Discord user ID
 * @param {Object} newSnapshot - New snapshot data
 */
export function updateSnapshot(userId, newSnapshot) {
    const snapshots = loadSnapshots();

    if (!snapshots[userId]) {
        snapshots[userId] = {
            lastSnapshot: null,
            currentSnapshot: null
        };
    }

    // Rotate: current becomes last
    snapshots[userId].lastSnapshot = snapshots[userId].currentSnapshot;
    snapshots[userId].currentSnapshot = {
        ...newSnapshot,
        timestamp: Math.floor(Date.now() / 1000)
    };

    saveSnapshots(snapshots);
}

/**
 * Build snapshot from API data
 * @param {Object} apiData - Raw API response
 * @returns {Object} Normalized snapshot
 */
export function buildSnapshot(apiData) {
    // Build inventory map: itemId -> quantity
    const inventory = {};

    if (apiData.inventory && Array.isArray(apiData.inventory)) {
        for (const item of apiData.inventory) {
            const itemId = item.ID || item.id;
            const qty = item.quantity || 1;

            if (itemId) {
                inventory[itemId] = (inventory[itemId] || 0) + qty;
            }
        }
    }

    // Determine location (Torn or abroad)
    let location = 'Torn';
    if (apiData.travel?.destination) {
        location = apiData.travel.destination;
    } else if (apiData.status?.state === 'Traveling') {
        location = apiData.status.description?.match(/to (.+?)$/)?.[1] || 'Abroad';
    } else if (apiData.status?.state === 'Abroad') {
        location = apiData.status.description || 'Abroad';
    }

    return {
        timestamp: Math.floor(Date.now() / 1000),
        location,
        cash: apiData.money_onhand || 0,
        inventory
    };
}

/**
 * Clear user's snapshots (for reset)
 * @param {string} userId - Discord user ID
 */
export function clearSnapshots(userId) {
    const snapshots = loadSnapshots();
    delete snapshots[userId];
    saveSnapshots(snapshots);
}

export default {
    getLastSnapshot,
    getCurrentSnapshot,
    updateSnapshot,
    buildSnapshot,
    clearSnapshots
};
