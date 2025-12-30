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
 * @param {Object} apiData - Raw API response (V1 + V2 combined)
 * @returns {Object} Normalized snapshot
 */
export function buildSnapshot(apiData) {
    // Inventory (V1 is broken, but we keep logic just in case)
    const inventory = {};
    const inventoryData = apiData.inventory || apiData.items || [];

    if (Array.isArray(inventoryData)) {
        for (const item of inventoryData) {
            const itemId = item.ID || item.id;
            const qty = item.quantity || 1;
            if (itemId) inventory[itemId] = (inventory[itemId] || 0) + qty;
        }
    }

    // Listings (V2 itemmarket + bazaar)
    // We normalize them to { uid, id, name, price, amount }
    const listings = [];

    if (apiData.itemmarket && Array.isArray(apiData.itemmarket)) {
        for (const item of apiData.itemmarket) {
            listings.push({
                source: 'market',
                uid: item.item.uid, // V2 structure
                id: item.item.id,
                name: item.item.name,
                price: item.price,
                amount: item.amount
            });
        }
    }

    if (apiData.bazaar && Array.isArray(apiData.bazaar)) {
        for (const item of apiData.bazaar) {
            listings.push({
                source: 'bazaar',
                uid: item.uid || item.item?.uid,
                id: item.id || item.item?.id,
                name: item.name || item.item?.name,
                price: item.price,
                amount: item.quantity || item.amount
            });
        }
    }

    // Determine location
    let location = 'Torn';
    if (apiData.travel?.time_left > 0) {
        // traveling
        location = apiData.travel.destination || 'Traveling';
    } else if (apiData.travel?.destination && apiData.travel.destination !== 'Torn') {
        location = apiData.travel.destination;
    } else if (apiData.status?.state === 'Traveling') {
        // "Returning to Torn from UAE" -> Extract UAE
        const match = apiData.status.description.match(/from (.+)$/);
        if (match) {
            // If returning, we are effectively still associated with that country for trade logic?
            // No, if returning, we are detecting potential BUYs that happened right before.
            // But logic says: Abroad + Cash Drop.
            // If we are "Returning", we are technically "Abroad" (or in transit).
            // But `active travel` usually shows destination = Torn.
        }
        location = apiData.status.description?.match(/to (.+?)$/)?.[1] || 'Abroad';
    } else if (apiData.status?.state === 'Abroad') {
        location = apiData.status.description || 'Abroad';
    } else if (apiData.status?.description?.includes('Returning to Torn from')) {
        // Special case: Returning
        // "Returning to Torn from UAE"
        const origin = apiData.status.description.split('from ')[1];
        if (origin) location = origin; // Treat as if we are still 'at' origin for buy detection delay?
    }

    // Cash
    const cash = apiData.money_onhand || apiData.money?.onhand || apiData.cash || 0;

    return {
        timestamp: Math.floor(Date.now() / 1000),
        location,
        cash,
        inventory,
        listings // New field for SELL detection
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
