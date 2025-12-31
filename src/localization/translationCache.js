/**
 * Translation Cache Service
 * Tier 2 - Stores AI/manual translations for reuse
 * 
 * Priority: Dictionary > Cache > AI > Fallback EN
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import crypto from 'crypto';

const CACHE_FILE = './data/translation-cache.json';
const MAX_CACHE_SIZE = 1000;
const TTL_DAYS = 90;

// In-memory cache
let cache = {};
let stats = {
    hits: 0,
    misses: 0,
    aiCalls: 0
};

/**
 * Initialize cache
 */
function initCache() {
    const dir = dirname(CACHE_FILE);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    if (existsSync(CACHE_FILE)) {
        try {
            const data = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
            cache = data.entries || {};
            stats = data.stats || stats;

            // Cleanup expired entries
            cleanupExpired();

            console.log(`🌐 Translation cache loaded: ${Object.keys(cache).length} entries`);
        } catch (e) {
            console.error('❌ Error loading translation cache:', e.message);
            cache = {};
        }
    }
}

/**
 * Save cache to disk
 */
function saveCache() {
    try {
        const data = {
            version: '1.0.0',
            lastSaved: Date.now(),
            stats,
            entries: cache
        };
        writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('❌ Error saving translation cache:', e.message);
    }
}

/**
 * Generate cache key from source text and language
 */
function generateKey(sourceText, lang = 'id') {
    const hash = crypto.createHash('sha256')
        .update(sourceText + lang)
        .digest('hex')
        .substring(0, 16);
    return hash;
}

/**
 * Get cached translation
 * @param {string} sourceText - Original text
 * @param {string} lang - Target language
 * @returns {Object|null} Cached entry or null
 */
export function getCached(sourceText, lang = 'id') {
    const key = generateKey(sourceText, lang);
    const entry = cache[key];

    if (entry) {
        // Update last used
        entry.lastUsed = Date.now();
        stats.hits++;
        return entry;
    }

    stats.misses++;
    return null;
}

/**
 * Store translation in cache
 * @param {string} sourceText - Original text
 * @param {string} translatedText - Translated text
 * @param {string} lang - Target language
 * @param {string} confidence - 'ai' | 'manual'
 */
export function setCached(sourceText, translatedText, lang = 'id', confidence = 'ai') {
    const key = generateKey(sourceText, lang);

    cache[key] = {
        sourceText,
        translatedText,
        lang,
        confidence,
        createdAt: Date.now(),
        lastUsed: Date.now()
    };

    // Enforce max size with LRU eviction
    enforceSizeLimit();

    // Save to disk
    saveCache();
}

/**
 * Cleanup expired entries
 */
function cleanupExpired() {
    const now = Date.now();
    const ttlMs = TTL_DAYS * 24 * 60 * 60 * 1000;

    let cleaned = 0;
    for (const [key, entry] of Object.entries(cache)) {
        if (now - entry.lastUsed > ttlMs) {
            delete cache[key];
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired translation entries`);
        saveCache();
    }
}

/**
 * Enforce max cache size using LRU
 */
function enforceSizeLimit() {
    const entries = Object.entries(cache);

    if (entries.length <= MAX_CACHE_SIZE) return;

    // Sort by lastUsed (oldest first)
    entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    // Remove oldest entries
    const toRemove = entries.length - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
        delete cache[entries[i][0]];
    }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    const hitRate = stats.hits + stats.misses > 0
        ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)
        : 0;

    return {
        entries: Object.keys(cache).length,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: `${hitRate}%`,
        aiCalls: stats.aiCalls
    };
}

/**
 * Increment AI call counter
 */
export function recordAiCall() {
    stats.aiCalls++;
    saveCache();
}

/**
 * Clear cache (for testing/reset)
 */
export function clearCache() {
    cache = {};
    saveCache();
}

// Initialize on import
initCache();

export default {
    getCached,
    setCached,
    getCacheStats,
    recordAiCall,
    clearCache
};
