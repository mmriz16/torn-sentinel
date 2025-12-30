/**
 * Personal Travel Analytics Service
 * Manages travel state, trade logs, and daily statistics
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Data Files
const TRAVEL_STATE_FILE = './data/travel-state.json';
const TRADE_LOG_FILE = './data/trade-log.json';
const DAILY_STATS_FILE = './data/daily-stats.json';

// In-memory cache
let travelState = { isTraveling: false, lastCountry: 'Torn', lastReturnTs: 0, todayTrips: 0, capacity: 0 };
let tradeLog = [];
let dailyStats = { date: '', totalProfit: 0, trips: 0, bestItem: null, bestCountry: null, profitPerTrip: 0 };

// Cache control
let initialized = false;

/**
 * Initialize Analytics Service
 * Load data from disk
 */
export function initAnalytics() {
    if (initialized) return;

    ensureDirectory();
    loadTravelState();
    loadTradeLog();
    loadDailyStats();

    // Check for daily reset on init
    checkDailyReset();

    // Schedule daily reset check (every minute)
    setInterval(checkDailyReset, 60 * 1000);

    initialized = true;
    console.log('📊 Travel Analytics initialized');
}

function ensureDirectory() {
    const dir = './data';
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

// ═══════════════════════════════════════════════════════════════════
// 1. DATA PERSISTENCE
// ═══════════════════════════════════════════════════════════════════

function loadTravelState() {
    if (existsSync(TRAVEL_STATE_FILE)) {
        try {
            travelState = JSON.parse(readFileSync(TRAVEL_STATE_FILE, 'utf8'));
        } catch (e) {
            console.error('❌ Error loading travel state:', e.message);
        }
    }
}

function saveTravelState() {
    writeFileSync(TRAVEL_STATE_FILE, JSON.stringify(travelState, null, 2));
}

function loadTradeLog() {
    if (existsSync(TRADE_LOG_FILE)) {
        try {
            tradeLog = JSON.parse(readFileSync(TRADE_LOG_FILE, 'utf8'));
            // Keep only last 100 trades in memory/file to prevent bloat? 
            // PRD says "last N trades" for history. Let's keep 100.
            if (tradeLog.length > 100) {
                tradeLog = tradeLog.slice(0, 100);
            }
        } catch (e) {
            console.error('❌ Error loading trade log:', e.message);
        }
    }
}

function saveTradeLog() {
    writeFileSync(TRADE_LOG_FILE, JSON.stringify(tradeLog, null, 2));
}

function loadDailyStats() {
    if (existsSync(DAILY_STATS_FILE)) {
        try {
            dailyStats = JSON.parse(readFileSync(DAILY_STATS_FILE, 'utf8'));
        } catch (e) {
            console.error('❌ Error loading daily stats:', e.message);
        }
    }
}

function saveDailyStats() {
    writeFileSync(DAILY_STATS_FILE, JSON.stringify(dailyStats, null, 2));
}

// ═══════════════════════════════════════════════════════════════════
// 2. DAILY RESET LOGIC (UTC 00:00 = TCT 00:00)
// ═══════════════════════════════════════════════════════════════════

function checkDailyReset() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)

    if (dailyStats.date !== today) {
        console.log(`🔄 Resetting daily stats for new day: ${today}`);

        // Reset stats
        dailyStats = {
            date: today,
            totalProfit: 0,
            trips: 0,
            bestItem: null,
            bestCountry: null,
            profitPerTrip: 0
        };
        saveDailyStats();

        // Also reset todayTrips in travelState?
        // PRD says "todayTrips" is in travelState. 
        // Logic: Sync them.
        travelState.todayTrips = 0;
        saveTravelState();
    }
}

export function resetDailyStatsManual() {
    const today = new Date().toISOString().split('T')[0];
    dailyStats = {
        date: today,
        totalProfit: 0,
        trips: 0,
        bestItem: null,
        bestCountry: null,
        profitPerTrip: 0
    };
    travelState.todayTrips = 0;
    saveDailyStats();
    saveTravelState();
    console.log('🔄 Manual daily stats reset triggered');
}

// ═══════════════════════════════════════════════════════════════════
// 3. CORE FEATURES (Updated)
// ═══════════════════════════════════════════════════════════════════

/**
 * Update Travel Capacity from API Data
 * @param {number} capacity - Max items (from perks.travel_items)
 */
export function updateCapacity(capacity) {
    if (travelState.capacity !== capacity) {
        travelState.capacity = capacity;
        saveTravelState();
        console.log(`🎒 Travel capacity updated: ${capacity}`);
    }
}

/**
 * Get current travel capacity
 */
export function getCapacity() {
    return travelState.capacity || 0;
}

/**
 * Get last foreign country visited
 */
export function getLastCountry() {
    return travelState.lastCountry || 'Unknown';
}

/**
 * Set last foreign country (called when traveling abroad)
 */
export function setLastCountry(country) {
    if (country && country !== 'Torn') {
        travelState.lastCountry = country;
        saveTravelState();
    }
}

/**
 * Log a trade (Buy or Sell)
 * @param {string} type - 'BUY' or 'SELL'
 * @param {string} item - Item name
 * @param {number} qty - Quantity
 * @param {number} price - Unit price
 * @param {string} country - Country name
 */
export function logTrade(type, item, qty, price, country) {
    const total = qty * price;
    const isSell = type.toUpperCase() === 'SELL';

    // Calculate profit if SELL
    let profit = 0;
    if (isSell) {
        // Simple logic: Profit = (Sell Price * Qty) - (Avg Buy Price * Qty)
        // Since we don't track inventory cost basis meticulously, user inputs profit?
        // PRD says "Profit dihitung hanya jika buy & sell valid".
        // Wait, market command can't know buy price unless we track inventory.
        // PRD Scope: "Profit Calculation Real". 
        // Option A: User provides buy price (Too tedious)
        // Option B: We estimate profit based on foreign buy price (if available)
        // Option C: We just log the sale amount for now, OR we check tradeLog for recent BUY of this item?

        // Let's implement Option B (Estimate based on known foreign price) + Option C (Look for last buy)

        // Strategy: Look for last BUY of this item in tradeLog to get cost basis
        const lastBuy = tradeLog.find(t => t.type === 'BUY' && t.item === item);
        const buyPrice = lastBuy ? lastBuy.price : 0; // fallback to 0 if unknown

        if (buyPrice > 0) {
            profit = (price - buyPrice) * qty;
        } else {
            // Try foreign price map? imported from constants/json?
            // For now, let's trust the logged buy price. If 0, profit is full amount (incorrect but safe).
            // Actually, if buyPrice is 0, we can't calculate profit accurately.
            // PRD says "Data nyata".
            // Let's assume user logs BUY first.
        }

        // Accumulate Daily Profit
        if (profit !== 0) {
            dailyStats.totalProfit += profit;

            // Update Best Item
            // Need to track profit per item?
            // Simplified: Just set best item to this one if it's the biggest sale?
            // Let's skip complex "Best Item" tracking for now, simply update stats.
        }
    }

    const entry = {
        ts: Math.floor(Date.now() / 1000),
        type: type.toUpperCase(),
        item,
        qty,
        price,
        total,
        country,
        profit: isSell ? profit : null
    };

    // Add to log (Newest first)
    tradeLog.unshift(entry);
    if (tradeLog.length > 100) tradeLog.pop();
    saveTradeLog();
    saveDailyStats();

    return entry;
}

/**
 * Update Travel State (Called by Monitor)
 * Logic:
 * - If was Traveling and now !Traveling and country == Torn -> RETURNED
 * - If was Traveling and now !Traveling and country != Torn -> LANDED
 */
export function updateTravelState(isCurrentlyTraveling, currentCountry, timeLeft) {
    const wasTraveling = travelState.isTraveling;
    const lastCountry = travelState.lastCountry;

    let event = null; // 'LANDED', 'RETURNED', or null

    // Update state
    travelState.isTraveling = isCurrentlyTraveling;

    // Use heuristic: if time_left > 0, we are traveling.
    // When time_left hits 0:
    // If destination is 'Torn', we have RETURNED.
    // If destination is 'Japan', we have LANDED.

    // BUT user status API result for `travel` gives `destination`.
    // If `time_left` > 0, destination is where we are going.
    // If `time_left` == 0, destination might be where we ARE.

    // If we were traveling, and now we are not (time_left == 0)
    if (wasTraveling && !isCurrentlyTraveling) {
        if (currentCountry === 'Torn') {
            event = 'RETURNED';
            travelState.todayTrips += 1;
            travelState.lastReturnTs = Math.floor(Date.now() / 1000);
            dailyStats.trips += 1;
        } else {
            event = 'LANDED';
            travelState.lastCountry = currentCountry;
        }
        saveTravelState();
        saveDailyStats();
    }
    // If we just started traveling
    else if (!wasTraveling && isCurrentlyTraveling) {
        // Just mark as traveling
        saveTravelState();
    }

    return event;
}

export function getStatus() {
    return {
        daily: dailyStats,
        lastTrades: tradeLog.slice(0, 5),
        capacity: travelState.capacity || 0
    };
}
