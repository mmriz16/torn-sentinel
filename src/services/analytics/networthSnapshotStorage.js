/**
 * Networth Snapshot Storage
 * Persistent storage for networth snapshots with history
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../../data');
const SNAPSHOT_FILE = join(DATA_DIR, 'networth_snapshots.json');

// Maximum snapshots to keep (90 days)
const MAX_SNAPSHOTS = 90;

/**
 * Ensure data directory and file exist
 */
function ensureDataFile() {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!existsSync(SNAPSHOT_FILE)) {
        writeFileSync(SNAPSHOT_FILE, JSON.stringify({ snapshots: [] }, null, 2));
    }
}

/**
 * Load all snapshots
 * @returns {Array} Array of snapshots sorted by timestamp (newest first)
 */
export function loadSnapshots() {
    ensureDataFile();

    try {
        const data = readFileSync(SNAPSHOT_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.snapshots || [];
    } catch (error) {
        console.error('❌ Error loading networth snapshots:', error);
        return [];
    }
}

/**
 * Save snapshot to storage
 * @param {Object} snapshot - Snapshot data
 */
export function saveSnapshot(snapshot) {
    ensureDataFile();

    try {
        const snapshots = loadSnapshots();

        // Add new snapshot at the beginning
        snapshots.unshift({
            ...snapshot,
            timestamp: Date.now()
        });

        // Trim to max size
        const trimmed = snapshots.slice(0, MAX_SNAPSHOTS);

        writeFileSync(SNAPSHOT_FILE, JSON.stringify({ snapshots: trimmed }, null, 2));
        console.log('💾 Networth snapshot saved');
    } catch (error) {
        console.error('❌ Error saving networth snapshot:', error);
    }
}

/**
 * Get latest snapshot
 * @returns {Object|null} Latest snapshot or null
 */
export function getLatestSnapshot() {
    const snapshots = loadSnapshots();
    return snapshots[0] || null;
}

/**
 * Get snapshot from X days ago
 * @param {number} daysAgo - Number of days ago
 * @returns {Object|null} Snapshot or null
 */
export function getSnapshotDaysAgo(daysAgo) {
    const snapshots = loadSnapshots();
    const targetTime = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);

    // Find closest snapshot to target time
    let closest = null;
    let closestDiff = Infinity;

    for (const snapshot of snapshots) {
        const diff = Math.abs(snapshot.timestamp - targetTime);
        if (diff < closestDiff) {
            closestDiff = diff;
            closest = snapshot;
        }
    }

    // Only return if within 12 hours of target
    if (closestDiff > 12 * 60 * 60 * 1000) {
        return null;
    }

    return closest;
}

/**
 * Calculate delta between two snapshots
 * @param {Object} current - Current snapshot
 * @param {Object} previous - Previous snapshot
 * @returns {Object} Delta breakdown
 */
export function calculateDelta(current, previous) {
    if (!current || !previous) return null;

    const delta = {
        total: current.total - previous.total,
        breakdown: {}
    };

    // Calculate breakdown deltas
    if (current.breakdown && previous.breakdown) {
        for (const key of Object.keys(current.breakdown)) {
            const currentVal = current.breakdown[key] || 0;
            const previousVal = previous.breakdown[key] || 0;
            const diff = currentVal - previousVal;

            // Only include non-zero deltas
            if (diff !== 0) {
                delta.breakdown[key] = diff;
            }
        }
    }

    return delta;
}

/**
 * Calculate trend indicator
 * @param {number} delta24h - 24h delta
 * @param {number} delta7d - 7d delta
 * @returns {Object} Trend info
 */
export function calculateTrend(delta24h, delta7d) {
    let icon = '▬';
    let label = 'Stable';
    let color = 0x95A5A6; // Gray

    const daily = delta24h || 0;
    const weekly = delta7d || 0;

    if (weekly > 1000000) {
        icon = '▲▲';
        label = 'Strong Growth';
        color = 0x2ECC71;
    } else if (weekly > 100000) {
        icon = '▲';
        label = 'Mild Growth';
        color = 0x27AE60;
    } else if (weekly < -1000000) {
        icon = '▼▼';
        label = 'Sharp Decline';
        color = 0xE74C3C;
    } else if (weekly < -100000) {
        icon = '▼';
        label = 'Mild Decline';
        color = 0xE67E22;
    }

    return { icon, label, color };
}

/**
 * Check if we should take a new snapshot (once per day)
 * @returns {boolean} True if should snapshot
 */
export function shouldTakeSnapshot() {
    const latest = getLatestSnapshot();
    if (!latest) return true;

    const hoursSinceLastSnapshot = (Date.now() - latest.timestamp) / (1000 * 60 * 60);
    return hoursSinceLastSnapshot >= 23; // At least 23 hours between snapshots
}

export default {
    loadSnapshots,
    saveSnapshot,
    getLatestSnapshot,
    getSnapshotDaysAgo,
    calculateDelta,
    calculateTrend,
    shouldTakeSnapshot
};
