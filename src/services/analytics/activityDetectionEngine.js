/**
 * Activity Detection Engine
 * Delta-based detection for Torn activities
 * This is the "event backbone" for Torn Sentinel
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../../data');
const SNAPSHOT_FILE = join(DATA_DIR, 'activity_snapshot.json');
const EVENTS_FILE = join(DATA_DIR, 'activity_events.json');

// Anti-spam cooldowns per event type (ms)
const EVENT_COOLDOWNS = {
    'energy_used': 30000,      // 30s
    'energy_full': 300000,     // 5m
    'nerve_used': 30000,       // 30s
    'crime_reward': 30000,     // 30s
    'travel_depart': 60000,    // 1m
    'travel_arrive': 60000,    // 1m
    'travel_buy': 60000,       // 1m
    'travel_sell': 60000,      // 1m
    'trade_buy': 30000,        // 30s
    'trade_sell': 30000,       // 30s
    'wallet_change': 60000,    // 1m
    'job_points': 300000,      // 5m
    'job_change': 60000,       // 1m
};

// Thresholds for significance
const THRESHOLDS = {
    ENERGY_CHANGE: 5,        // Minimum energy delta to log
    NERVE_CHANGE: 2,         // Minimum nerve delta to log
    CASH_CHANGE: 10000,      // $10k minimum cash change
    INVENTORY_CHANGE: 1,     // Any inventory change
};

// In-memory state
let lastSnapshot = null;
let eventLog = [];
let lastEventTimes = {}; // Track last event time per type

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Load last snapshot from disk
 */
export function loadSnapshot() {
    ensureDataDir();
    if (existsSync(SNAPSHOT_FILE)) {
        try {
            lastSnapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
        } catch (e) {
            console.error('❌ Error loading activity snapshot:', e.message);
            lastSnapshot = null;
        }
    }
    return lastSnapshot;
}

/**
 * Save snapshot to disk
 */
function saveSnapshot(snapshot) {
    ensureDataDir();
    writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));
    lastSnapshot = snapshot;
}

/**
 * Load event log from disk
 */
export function loadEventLog() {
    ensureDataDir();
    if (existsSync(EVENTS_FILE)) {
        try {
            eventLog = JSON.parse(readFileSync(EVENTS_FILE, 'utf8'));
            // Trim to last 72 hours
            const cutoff = Date.now() - (72 * 60 * 60 * 1000);
            eventLog = eventLog.filter(e => e.timestamp > cutoff);
        } catch (e) {
            console.error('❌ Error loading activity events:', e.message);
            eventLog = [];
        }
    }
    return eventLog;
}

/**
 * Save event log to disk
 */
function saveEventLog() {
    ensureDataDir();
    // Keep max 500 events
    if (eventLog.length > 500) {
        eventLog = eventLog.slice(0, 500);
    }
    writeFileSync(EVENTS_FILE, JSON.stringify(eventLog, null, 2));
}

/**
 * Check if event type is on cooldown
 */
function isOnCooldown(eventType) {
    const lastTime = lastEventTimes[eventType] || 0;
    const cooldown = EVENT_COOLDOWNS[eventType] || 30000;
    return (Date.now() - lastTime) < cooldown;
}

/**
 * Record event and update cooldown
 */
function recordEvent(event) {
    event.timestamp = Date.now();
    eventLog.unshift(event);
    lastEventTimes[event.type] = Date.now();
    saveEventLog();
    return event;
}

/**
 * Build activity snapshot from API data
 */
export function buildActivitySnapshot(data) {
    const travel = data.travel || {};
    const job = data.job || {};

    // Build inventory count map
    const inventoryCounts = {};
    if (Array.isArray(data.inventory)) {
        for (const item of data.inventory) {
            const key = `${item.ID || item.id}`;
            inventoryCounts[key] = (inventoryCounts[key] || 0) + (item.quantity || 1);
        }
    }

    return {
        timestamp: Date.now(),
        // Bars
        energy: data.energy?.current || 0,
        energyMax: data.energy?.maximum || 100,
        nerve: data.nerve?.current || 0,
        nerveMax: data.nerve?.maximum || 0,
        happy: data.happy?.current || 0,
        // Money
        cash: data.money_onhand || 0,
        points: data.points || 0,
        // Location
        location: travel.destination || 'Torn',
        isTraveling: (travel.time_left || 0) > 0,
        // Job
        jobPoints: job.jobpoints || 0,
        jobPosition: job.position || '',
        companyId: job.company_id || 0,
        // Inventory (simplified)
        inventoryCounts,
        inventoryTotal: Object.values(inventoryCounts).reduce((a, b) => a + b, 0),
        // Stats for crime detection
        criminalOffenses: data.personalstats?.criminaloffenses || 0,
    };
}

/**
 * Detect all activity changes
 * Returns array of detected events
 */
export function detectActivities(currentSnapshot) {
    const events = [];

    // Load previous snapshot if not in memory
    if (!lastSnapshot) {
        loadSnapshot();
    }

    // First run - just save snapshot
    if (!lastSnapshot) {
        saveSnapshot(currentSnapshot);
        return events;
    }

    const prev = lastSnapshot;
    const curr = currentSnapshot;

    // 1. Energy Events
    const energyDelta = curr.energy - prev.energy;
    if (energyDelta < -THRESHOLDS.ENERGY_CHANGE && !isOnCooldown('energy_used')) {
        // Energy decreased significantly
        let source = 'Unknown';
        if (energyDelta <= -100) source = 'Xanax (inferred)';
        else if (energyDelta <= -50) source = 'Gym (inferred)';
        else source = 'Activity';

        events.push(recordEvent({
            type: 'energy_used',
            icon: '⚡',
            title: 'Energy Used',
            delta: energyDelta,
            source,
            current: curr.energy,
        }));
    }

    if (curr.energy >= curr.energyMax && prev.energy < prev.energyMax && !isOnCooldown('energy_full')) {
        events.push(recordEvent({
            type: 'energy_full',
            icon: '⚡',
            title: 'Energy Full',
            current: curr.energy,
            max: curr.energyMax,
        }));
    }

    // 2. Nerve Events (Crime Detection)
    const nerveDelta = curr.nerve - prev.nerve;
    const crimeDelta = curr.criminalOffenses - prev.criminalOffenses;

    if (nerveDelta < -THRESHOLDS.NERVE_CHANGE && !isOnCooldown('nerve_used')) {
        events.push(recordEvent({
            type: 'nerve_used',
            icon: '🧠',
            title: 'Nerve Used',
            delta: nerveDelta,
            current: curr.nerve,
        }));
    }

    if (crimeDelta > 0 && !isOnCooldown('crime_reward')) {
        events.push(recordEvent({
            type: 'crime_reward',
            icon: '🧠',
            title: 'Crime Detected',
            crimesCompleted: crimeDelta,
            nerveUsed: Math.abs(nerveDelta),
        }));
    }

    // 3. Travel Events
    if (curr.isTraveling && !prev.isTraveling && !isOnCooldown('travel_depart')) {
        events.push(recordEvent({
            type: 'travel_depart',
            icon: '✈️',
            title: 'Travel Started',
            destination: curr.location,
        }));
    }

    if (!curr.isTraveling && prev.isTraveling && !isOnCooldown('travel_arrive')) {
        const arrivedAt = curr.location;
        events.push(recordEvent({
            type: 'travel_arrive',
            icon: arrivedAt === 'Torn' ? '🏠' : '📍',
            title: arrivedAt === 'Torn' ? 'Returned Home' : 'Arrived Abroad',
            location: arrivedAt,
        }));
    }

    // 4. Inventory Changes (Trade Detection)
    const invDelta = curr.inventoryTotal - prev.inventoryTotal;
    if (Math.abs(invDelta) >= THRESHOLDS.INVENTORY_CHANGE) {
        // Find what changed
        const changes = [];
        const allKeys = new Set([...Object.keys(prev.inventoryCounts), ...Object.keys(curr.inventoryCounts)]);

        for (const key of allKeys) {
            const prevQty = prev.inventoryCounts[key] || 0;
            const currQty = curr.inventoryCounts[key] || 0;
            const diff = currQty - prevQty;
            if (diff !== 0) {
                changes.push({ itemId: key, delta: diff });
            }
        }

        if (invDelta > 0 && !isOnCooldown('trade_buy')) {
            events.push(recordEvent({
                type: 'trade_buy',
                icon: '📦',
                title: 'Items Acquired',
                itemsAdded: invDelta,
                changes: changes.filter(c => c.delta > 0).slice(0, 3),
            }));
        }

        if (invDelta < 0 && !isOnCooldown('trade_sell')) {
            events.push(recordEvent({
                type: 'trade_sell',
                icon: '💰',
                title: 'Items Sold/Used',
                itemsRemoved: Math.abs(invDelta),
                changes: changes.filter(c => c.delta < 0).slice(0, 3),
            }));
        }
    }

    // 5. Wallet Changes
    const cashDelta = curr.cash - prev.cash;
    if (Math.abs(cashDelta) >= THRESHOLDS.CASH_CHANGE && !isOnCooldown('wallet_change')) {
        events.push(recordEvent({
            type: 'wallet_change',
            icon: cashDelta > 0 ? '💰' : '💸',
            title: cashDelta > 0 ? 'Cash Received' : 'Cash Spent',
            delta: cashDelta,
            current: curr.cash,
        }));
    }

    // 6. Job Events
    const jobPointsDelta = curr.jobPoints - prev.jobPoints;
    if (jobPointsDelta > 0 && !isOnCooldown('job_points')) {
        events.push(recordEvent({
            type: 'job_points',
            icon: '📄',
            title: 'Job Points Gained',
            delta: jobPointsDelta,
            current: curr.jobPoints,
            position: curr.jobPosition,
        }));
    }

    if (curr.jobPosition !== prev.jobPosition && prev.jobPosition && !isOnCooldown('job_change')) {
        events.push(recordEvent({
            type: 'job_change',
            icon: '📄',
            title: 'Job Position Changed',
            from: prev.jobPosition,
            to: curr.jobPosition,
        }));
    }

    // Save updated snapshot
    saveSnapshot(currentSnapshot);

    return events;
}

/**
 * Get recent events
 */
export function getRecentEvents(limit = 10) {
    return eventLog.slice(0, limit);
}

/**
 * Initialize the detection engine
 */
export function initActivityDetection() {
    loadSnapshot();
    loadEventLog();
    console.log('📜 Activity Detection Engine initialized');
}
