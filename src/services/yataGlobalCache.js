/**
 * YATA Global Market Cache Service
 * Single source of truth for foreign market data
 * 
 * Features:
 * - 1 API call per minute (global)
 * - In-memory cache with file backup
 * - Distribution to all country channels
 * - Graceful degradation on errors
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../data');
const CACHE_FILE = join(DATA_DIR, 'yata_market_cache.json');

// YATA API Configuration
const YATA_API_URL = 'https://yata.yt/api/v1/travel/export/';
const FETCH_INTERVAL = (parseInt(process.env.YATA_FETCH_INTERVAL) || 30) * 1000;  // Default 30 seconds
const HARD_TTL = 10 * 60 * 1000;   // 10 minutes - mark as stale after this
const SOFT_TTL = (parseInt(process.env.FOREIGN_MARKET_RENDER_INTERVAL) || 30) * 1000; // 30s default

// Country code mappings
export const COUNTRY_CODES = {
    argentina: 'arg',
    canada: 'can',
    cayman: 'cay',
    china: 'chi',
    hawaii: 'haw',
    japan: 'jap',
    mexico: 'mex',
    southafrica: 'sou',
    switzerland: 'swi',
    uk: 'uni',
    uae: 'uae'
};

// In-memory cache
let globalCache = {
    updatedAt: 0,
    lastSuccessAt: 0,
    isStale: true,
    error: null,
    countries: {}
};

// Fetch scheduler state
let schedulerRunning = false;
let schedulerInterval = null;
let lastFetchAttempt = 0;

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Load cache from disk (on startup)
 */
export function loadCacheFromDisk() {
    ensureDataDir();
    if (existsSync(CACHE_FILE)) {
        try {
            const data = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
            globalCache = data;
            globalCache.isStale = (Date.now() - globalCache.updatedAt) > HARD_TTL;
            console.log(`📡 YATA cache loaded from disk (${Object.keys(globalCache.countries).length} countries)`);
        } catch (e) {
            console.error('❌ Error loading YATA cache:', e.message);
        }
    }
}

/**
 * Save cache to disk
 */
function saveCacheToDisk() {
    ensureDataDir();
    try {
        writeFileSync(CACHE_FILE, JSON.stringify(globalCache, null, 2));
    } catch (e) {
        console.error('❌ Error saving YATA cache:', e.message);
    }
}

/**
 * Fetch data from YATA API
 * Called ONLY by the global scheduler
 */
async function fetchFromYATA() {
    const now = Date.now();

    // Enforce cooldown
    if (now - lastFetchAttempt < FETCH_INTERVAL) {
        return false;
    }

    lastFetchAttempt = now;
    const startTime = Date.now();

    try {
        const response = await fetch(YATA_API_URL, {
            headers: {
                'User-Agent': 'TornSentinel/2.0'
            },
            signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const rawData = await response.json();
        const latency = Date.now() - startTime;

        // Normalize and store
        normalizeAndStore(rawData);

        globalCache.updatedAt = now;
        globalCache.lastSuccessAt = now;
        globalCache.isStale = false;
        globalCache.error = null;

        saveCacheToDisk();

        console.log(`📡 YATA global market refreshed (${Object.keys(globalCache.countries).length} countries, ${latency}ms)`);
        return true;

    } catch (error) {
        globalCache.error = error.message;
        globalCache.isStale = true;

        console.error(`❌ YATA fetch failed: ${error.message} (using cached data)`);
        return false;
    }
}

/**
 * Normalize YATA data and store in cache
 */
function normalizeAndStore(rawData) {
    if (!rawData?.stocks) return;

    for (const [countryCode, countryData] of Object.entries(rawData.stocks)) {
        const items = countryData.stocks || [];

        globalCache.countries[countryCode] = items.map(item => ({
            id: item.id,
            name: item.name,
            cost: item.cost,
            quantity: item.quantity,
            // Pre-calculate for easy access
            // Market sell price will be fetched separately or estimated
        }));
    }
}

/**
 * Get country data from cache
 * @param {string} countryKey - e.g., 'japan', 'uae'
 * @returns {Object} { items: [], updatedAt, isStale }
 */
export function getCountryData(countryKey) {
    const countryCode = COUNTRY_CODES[countryKey] || countryKey;

    return {
        items: globalCache.countries[countryCode] || [],
        updatedAt: globalCache.updatedAt,
        lastSuccessAt: globalCache.lastSuccessAt,
        isStale: globalCache.isStale || (Date.now() - globalCache.updatedAt > SOFT_TTL),
        error: globalCache.error
    };
}

/**
 * Get all countries data
 */
export function getAllCountriesData() {
    return {
        countries: globalCache.countries,
        updatedAt: globalCache.updatedAt,
        lastSuccessAt: globalCache.lastSuccessAt,
        isStale: globalCache.isStale,
        error: globalCache.error
    };
}

/**
 * Get cache metadata
 */
export function getCacheStatus() {
    const now = Date.now();
    return {
        updatedAt: globalCache.updatedAt,
        lastSuccessAt: globalCache.lastSuccessAt,
        ageSeconds: Math.floor((now - globalCache.updatedAt) / 1000),
        isStale: globalCache.isStale,
        countryCount: Object.keys(globalCache.countries).length,
        error: globalCache.error
    };
}

/**
 * Start the global fetch scheduler
 * Should be called ONCE on bot startup
 */
export function startGlobalFetchScheduler() {
    if (schedulerRunning) {
        console.warn('⚠️ YATA scheduler already running');
        return;
    }

    // Load cache from disk first
    loadCacheFromDisk();

    // Initial fetch
    fetchFromYATA();

    // Schedule periodic fetches
    schedulerInterval = setInterval(() => {
        fetchFromYATA();
    }, FETCH_INTERVAL);

    schedulerRunning = true;
    console.log('🌐 YATA Global Fetch Scheduler started (60s interval)');
}

/**
 * Stop the scheduler (for graceful shutdown)
 */
export function stopGlobalFetchScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        schedulerRunning = false;
        console.log('🌐 YATA Global Fetch Scheduler stopped');
    }
}

/**
 * Force refresh (manual trigger, respects cooldown)
 */
export async function forceRefresh() {
    return await fetchFromYATA();
}

export default {
    startGlobalFetchScheduler,
    stopGlobalFetchScheduler,
    getCountryData,
    getAllCountriesData,
    getCacheStatus,
    forceRefresh,
    COUNTRY_CODES
};
