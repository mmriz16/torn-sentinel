/**
 * Daily Report State Manager
 * Tracks which daily reports have been sent today to prevent duplicates on restart
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const STATE_FILE = './data/daily-report-state.json';

// In-memory cache
let dailyState = {
    date: '',        // YYYY-MM-DD format (WIB timezone)
    reports: {}      // { reportKey: timestamp }
};

/**
 * Get today's date in WIB timezone (YYYY-MM-DD)
 */
function getTodayWIB() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/**
 * Initialize state from disk
 */
export function initDailyReportState() {
    const dir = dirname(STATE_FILE);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    if (existsSync(STATE_FILE)) {
        try {
            dailyState = JSON.parse(readFileSync(STATE_FILE, 'utf8'));

            // Check if it's a new day - reset if so
            const today = getTodayWIB();
            if (dailyState.date !== today) {
                console.log(`📅 New day detected (${today}), resetting daily report state`);
                dailyState = { date: today, reports: {} };
                saveState();
            } else {
                console.log(`📅 Daily report state loaded: ${Object.keys(dailyState.reports).length} reports sent today`);
            }
        } catch (e) {
            console.error('❌ Error loading daily report state:', e.message);
            dailyState = { date: getTodayWIB(), reports: {} };
        }
    } else {
        dailyState = { date: getTodayWIB(), reports: {} };
        saveState();
    }
}

/**
 * Save state to disk
 */
function saveState() {
    try {
        writeFileSync(STATE_FILE, JSON.stringify(dailyState, null, 2));
    } catch (e) {
        console.error('❌ Error saving daily report state:', e.message);
    }
}

/**
 * Check if a daily report has already been sent today
 * @param {string} reportKey - e.g., 'networthTrend', 'assetDistribution'
 * @returns {boolean} true if already sent today
 */
export function hasReportedToday(reportKey) {
    const today = getTodayWIB();

    // Check for day rollover
    if (dailyState.date !== today) {
        dailyState = { date: today, reports: {} };
        saveState();
        return false;
    }

    return !!dailyState.reports[reportKey];
}

/**
 * Mark a daily report as sent
 * @param {string} reportKey - e.g., 'networthTrend', 'assetDistribution'
 */
export function markReportSent(reportKey) {
    const today = getTodayWIB();

    // Check for day rollover
    if (dailyState.date !== today) {
        dailyState = { date: today, reports: {} };
    }

    dailyState.reports[reportKey] = Date.now();
    saveState();
    console.log(`📅 Marked daily report as sent: ${reportKey}`);
}

/**
 * Get status of all daily reports
 */
export function getDailyReportStatus() {
    return {
        date: dailyState.date,
        reports: { ...dailyState.reports }
    };
}

/**
 * Reset all reports (for testing)
 */
export function resetDailyReports() {
    dailyState = { date: getTodayWIB(), reports: {} };
    saveState();
}

export default {
    initDailyReportState,
    hasReportedToday,
    markReportSent,
    getDailyReportStatus,
    resetDailyReports
};
