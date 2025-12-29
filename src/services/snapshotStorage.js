/**
 * Snapshot Storage Service
 * Handles persistence of daily snapshots to JSON file
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const STORAGE_PATH = './data/daily-summary.json';
const RETENTION_DAYS = 30;

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
 * @returns {Object} All snapshots keyed by date (YYYY-MM-DD)
 */
export function loadSnapshots() {
    initStorage();
    try {
        const data = readFileSync(STORAGE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading snapshots:', error);
        return {};
    }
}

/**
 * Get snapshot for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object|null} Snapshot or null if not found
 */
export function getSnapshot(date) {
    const snapshots = loadSnapshots();
    return snapshots[date] || null;
}

/**
 * Get yesterday's snapshot
 * @returns {Object|null} Yesterday's snapshot or null
 */
export function getYesterdaySnapshot() {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    return getSnapshot(dateStr);
}

/**
 * Save a snapshot for today
 * @param {Object} snapshot - Snapshot data to save
 */
export function saveSnapshot(snapshot) {
    const snapshots = loadSnapshots();
    const today = new Date().toISOString().split('T')[0];

    snapshots[today] = {
        ...snapshot,
        date: today,
        timestamp: Math.floor(Date.now() / 1000)
    };

    // Prune old snapshots
    const pruned = pruneSnapshots(snapshots);

    writeFileSync(STORAGE_PATH, JSON.stringify(pruned, null, 2));
    console.log(`📸 Saved snapshot for ${today}`);
}

/**
 * Prune snapshots older than retention period
 * @param {Object} snapshots - All snapshots
 * @returns {Object} Pruned snapshots
 */
function pruneSnapshots(snapshots) {
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - RETENTION_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const pruned = {};
    for (const [date, snapshot] of Object.entries(snapshots)) {
        if (date >= cutoffStr) {
            pruned[date] = snapshot;
        } else {
            console.log(`🗑️ Pruned old snapshot: ${date}`);
        }
    }

    return pruned;
}

/**
 * Get the latest snapshot (most recent date)
 * @returns {Object|null} Latest snapshot or null
 */
export function getLatestSnapshot() {
    const snapshots = loadSnapshots();
    const dates = Object.keys(snapshots).sort().reverse();
    return dates.length > 0 ? snapshots[dates[0]] : null;
}

export default {
    loadSnapshots,
    getSnapshot,
    getYesterdaySnapshot,
    saveSnapshot,
    getLatestSnapshot
};
