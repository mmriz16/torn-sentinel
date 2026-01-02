/**
 * Torn API Service
 * Wrapper for Torn City API requests
 */

const TORN_API_BASE = 'https://api.torn.com';
const TORN_API_V2_BASE = 'https://api.torn.com/v2';
const REQUEST_TIMEOUT = 10000; // 10 seconds

// ═══════════════════════════════════════════════════════════════════
// 📊 API REQUEST RATE MONITOR
// ═══════════════════════════════════════════════════════════════════

const requestLog = [];
const RATE_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_WARNING = 80; // Warn at 80 requests/minute
const RATE_LIMIT_MAX = 100; // Torn's limit is ~100/minute

/**
 * Track a new API request
 */
function trackRequest(endpoint) {
    const now = Date.now();
    requestLog.push({ timestamp: now, endpoint });

    // Cleanup old entries (older than 1 minute)
    while (requestLog.length > 0 && requestLog[0].timestamp < now - RATE_WINDOW_MS) {
        requestLog.shift();
    }

    // Log warning if approaching limit
    if (requestLog.length >= RATE_LIMIT_WARNING && requestLog.length % 10 === 0) {
        console.warn(`⚠️ API Rate Warning: ${requestLog.length}/${RATE_LIMIT_MAX} requests/min`);
    }
}

/**
 * Get current API request stats
 * @returns {Object} Stats object with current request count and rate
 */
export function getApiStats() {
    const now = Date.now();

    // Filter to only requests within last minute
    const recentRequests = requestLog.filter(r => r.timestamp > now - RATE_WINDOW_MS);

    // Group by endpoint
    const byEndpoint = {};
    for (const req of recentRequests) {
        const key = req.endpoint || 'unknown';
        byEndpoint[key] = (byEndpoint[key] || 0) + 1;
    }

    return {
        requestsPerMinute: recentRequests.length,
        limit: RATE_LIMIT_MAX,
        usage: `${recentRequests.length}/${RATE_LIMIT_MAX}`,
        usagePercent: Math.round((recentRequests.length / RATE_LIMIT_MAX) * 100),
        byEndpoint,
        status: recentRequests.length >= RATE_LIMIT_WARNING ? '⚠️ HIGH' :
            recentRequests.length >= RATE_LIMIT_MAX * 0.5 ? '🟡 MEDIUM' : '🟢 LOW'
    };
}


/**
 * Make a request to Torn API v1
 * @param {string} apiKey - User's Torn API key
 * @param {string} endpoint - API endpoint (user, torn, market, etc.)
 * @param {string} selections - Comma-separated selections
 * @param {object} options - Additional options
 * @returns {Promise<object>} API response data
 */
export async function get(apiKey, endpoint, selections, options = {}) {
    // Track this request for rate monitoring
    trackRequest(`v1/${endpoint}/${selections}`);

    const url = new URL(`${TORN_API_BASE}/${endpoint}`);
    url.searchParams.set('selections', selections);
    url.searchParams.set('key', apiKey);

    // Add any additional parameters
    if (options) {
        Object.keys(options).forEach(key => {
            if (key === 'id') {
                url.pathname = `/${endpoint}/${options.id}`;
            } else {
                url.searchParams.set(key, options[key]);
            }
        });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                'User-Agent': 'TornSentinel/1.0'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new TornApiError(`HTTP ${response.status}: ${response.statusText}`, response.status);
        }

        const data = await response.json();

        // Check for Torn API errors
        if (data.error) {
            throw new TornApiError(data.error.error, data.error.code);
        }

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new TornApiError('Request timed out', 0);
        }

        if (error instanceof TornApiError) {
            throw error;
        }

        throw new TornApiError(`Network error: ${error.message}`, 0);
    }
}

/**
 * Make a request to Torn API v2
 * @param {string} apiKey - User's Torn API key
 * @param {string} endpoint - API v2 endpoint path (e.g., 'user/jobpoints', 'user/workstats')
 * @returns {Promise<object>} API response data
 */
export async function getV2(apiKey, endpoint) {
    // Track this request for rate monitoring
    trackRequest(`v2/${endpoint}`);

    const url = new URL(`${TORN_API_V2_BASE}/${endpoint}`);
    url.searchParams.set('key', apiKey);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                'User-Agent': 'TornSentinel/1.0'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new TornApiError(`HTTP ${response.status}: ${response.statusText}`, response.status);
        }

        const data = await response.json();

        // Check for Torn API errors
        if (data.error) {
            throw new TornApiError(data.error.error, data.error.code);
        }

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new TornApiError('Request timed out', 0);
        }

        if (error instanceof TornApiError) {
            throw error;
        }

        throw new TornApiError(`Network error: ${error.message}`, 0);
    }
}

/**
 * Custom error class for Torn API errors
 */
export class TornApiError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'TornApiError';
        this.code = code;

        // Map common error codes to user-friendly messages
        this.userMessage = this.getUserMessage(code);
    }

    getUserMessage(code) {
        const errorMessages = {
            0: 'Could not connect to Torn API. Please try again later.',
            1: 'Empty API key. Please register with /register.',
            2: 'Invalid API key. Please check your key and try again.',
            5: 'Too many requests. Please wait a moment.',
            8: 'IP temporarily blocked. Please try again in a few minutes.',
            9: 'API system disabled. Please try again later.',
            10: 'Player is in federal jail.',
            13: 'This action is not available while traveling.',
            16: 'Too many requests. Rate limited.',
            17: 'Backend error. Please try again later.',
        };

        return errorMessages[code] || this.message;
    }
}

/**
 * Verify an API key is valid
 * @param {string} apiKey - API key to verify
 * @returns {Promise<object>} User basic info if valid
 */
export async function verifyApiKey(apiKey) {
    return await get(apiKey, 'user', 'basic');
}

/**
 * Get combined stats from user endpoint
 * @param {string} apiKey - API key
 * @param {string} selections - Comma separated selections (e.g. 'bars,cooldowns')
 * @returns {Promise<object>} Combined stats object
 */
export async function getCombinedStats(apiKey, selections) {
    return await get(apiKey, 'user', selections);
}

export default {
    get,
    getV2,
    verifyApiKey,
    getApiStats,
    TornApiError
};
