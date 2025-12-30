/**
 * Profit Engine Storage
 * Daily profit/loss aggregation and persistence
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../../data');
const DAILY_STATE_FILE = join(DATA_DIR, 'profit_engine_state.json');

// Default daily state structure
function createEmptyDayState(date) {
    return {
        date,
        income: {
            travel: 0,
            crime: 0,
            job: 0,
            other: 0
        },
        expense: {
            property: 0,
            xanax: 0,
            travel_buy: 0,
            tax: 0,
            other: 0
        },
        stats: {
            tripCount: 0,
            crimeCount: 0,
            xanaxUsed: 0,
            hoursActive: 0
        },
        lastUpdate: Date.now()
    };
}

// In-memory state
let dailyState = null;

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Get today's date string (WIB timezone)
 */
function getTodayDate() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
}

/**
 * Load daily state from disk
 */
export function loadProfitState() {
    ensureDataDir();
    const today = getTodayDate();

    if (existsSync(DAILY_STATE_FILE)) {
        try {
            dailyState = JSON.parse(readFileSync(DAILY_STATE_FILE, 'utf8'));

            // Check if it's a new day
            if (dailyState.date !== today) {
                console.log(`🧮 New day detected, resetting profit engine state`);
                dailyState = createEmptyDayState(today);
                saveProfitState();
            }
        } catch (e) {
            console.error('❌ Error loading profit state:', e.message);
            dailyState = createEmptyDayState(today);
        }
    } else {
        dailyState = createEmptyDayState(today);
        saveProfitState();
    }

    return dailyState;
}

/**
 * Save daily state to disk
 */
export function saveProfitState() {
    ensureDataDir();
    if (dailyState) {
        dailyState.lastUpdate = Date.now();
        writeFileSync(DAILY_STATE_FILE, JSON.stringify(dailyState, null, 2));
    }
}

/**
 * Get current daily state
 */
export function getProfitState() {
    if (!dailyState) {
        loadProfitState();
    }

    // Check for day rollover
    const today = getTodayDate();
    if (dailyState.date !== today) {
        dailyState = createEmptyDayState(today);
        saveProfitState();
    }

    return dailyState;
}

/**
 * Add income to daily state
 * @param {string} category - 'travel', 'crime', 'job', 'other'
 * @param {number} amount - Amount in dollars
 */
export function addIncome(category, amount) {
    const state = getProfitState();
    if (state.income[category] !== undefined) {
        state.income[category] += amount;
    } else {
        state.income.other += amount;
    }
    saveProfitState();
    console.log(`🧮 Income added: ${category} +$${amount.toLocaleString()}`);
}

/**
 * Add expense to daily state
 * @param {string} category - 'property', 'xanax', 'travel_buy', 'tax', 'other'
 * @param {number} amount - Amount in dollars (positive)
 */
export function addExpense(category, amount) {
    const state = getProfitState();
    if (state.expense[category] !== undefined) {
        state.expense[category] += Math.abs(amount);
    } else {
        state.expense.other += Math.abs(amount);
    }
    saveProfitState();
    console.log(`🧮 Expense added: ${category} -$${Math.abs(amount).toLocaleString()}`);
}

/**
 * Increment stats counter
 */
export function incrementStat(statKey, amount = 1) {
    const state = getProfitState();
    if (state.stats[statKey] !== undefined) {
        state.stats[statKey] += amount;
        saveProfitState();
    }
}

/**
 * Calculate totals
 */
export function calculateTotals() {
    const state = getProfitState();

    const totalIncome = Object.values(state.income).reduce((a, b) => a + b, 0);
    const totalExpense = Object.values(state.expense).reduce((a, b) => a + b, 0);
    const netProfit = totalIncome - totalExpense;

    // Calculate hours active since start of day (WIB)
    const now = new Date();
    const startOfDay = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) + 'T00:00:00+07:00');
    const hoursActive = Math.max(1, (now - startOfDay) / (1000 * 60 * 60));

    return {
        totalIncome,
        totalExpense,
        netProfit,
        profitPerHour: netProfit / hoursActive,
        hoursActive
    };
}

/**
 * Initialize profit engine
 */
export function initProfitEngine() {
    loadProfitState();
    console.log('🧮 Profit Engine initialized');
}

export default {
    loadProfitState,
    saveProfitState,
    getProfitState,
    addIncome,
    addExpense,
    incrementStat,
    calculateTotals,
    initProfitEngine
};
