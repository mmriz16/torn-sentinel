/**
 * Auto-Run Registry
 * Central registry for all auto-run channels
 */

// Runner intervals in milliseconds
export const INTERVALS = {
    REALTIME: 30 * 1000,    // 30 seconds
    FAST: 60 * 1000,        // 60 seconds
    MEDIUM: 5 * 60 * 1000,  // 5 minutes
    SLOW: 10 * 60 * 1000,   // 10 minutes
};

/**
 * Auto-Run Channel Definitions
 * Each entry defines a channel that auto-updates on startup
 */
export const AUTO_RUNNERS = {
    // ═══════════════════════════════════════════════════════════════════
    // 💰 USER DATA CHANNELS (Edit Mode)
    // ═══════════════════════════════════════════════════════════════════

    wallet: {
        key: 'wallet',
        name: 'Wallet',
        emoji: '💰',
        interval: INTERVALS.FAST,
        channelEnvKey: 'WALLET_CHANNEL_ID',
        handler: 'walletHandler',
        enabled: true
    },

    personalStats: {
        key: 'personalStats',
        name: 'Personal Stats',
        emoji: '📊',
        interval: INTERVALS.MEDIUM,
        channelEnvKey: 'PERSONAL_STATS_CHANNEL_ID',
        handler: 'statsHandler',
        enabled: true
    },

    gym: {
        key: 'gym',
        name: 'Gym Progress',
        emoji: '🏋️',
        interval: INTERVALS.FAST,
        channelEnvKey: 'GYM_CHANNEL_ID',
        handler: 'gymHandler',
        enabled: true
    },

    work: {
        key: 'work',
        name: 'Work Stats',
        emoji: '👔',
        interval: INTERVALS.SLOW,
        channelEnvKey: 'WORK_CHANNEL_ID',
        handler: 'workHandler',
        enabled: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // ✈️ FOREIGN MARKETS (Per Country - 1 min interval)
    // ═══════════════════════════════════════════════════════════════════

    'foreignMarket.argentina': {
        key: 'foreignMarket.argentina',
        name: 'Argentina Market',
        emoji: '🇦🇷',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_ARGENTINA_CHANNEL_ID',
        handler: 'foreignMarket.argentina',
        countryKey: 'argentina',
        enabled: true
    },

    'foreignMarket.canada': {
        key: 'foreignMarket.canada',
        name: 'Canada Market',
        emoji: '🇨🇦',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_CANADA_CHANNEL_ID',
        handler: 'foreignMarket.canada',
        countryKey: 'canada',
        enabled: true
    },

    'foreignMarket.cayman': {
        key: 'foreignMarket.cayman',
        name: 'Cayman Islands Market',
        emoji: '🇰🇾',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_CAYMAN_CHANNEL_ID',
        handler: 'foreignMarket.cayman',
        countryKey: 'cayman',
        enabled: true
    },

    'foreignMarket.china': {
        key: 'foreignMarket.china',
        name: 'China Market',
        emoji: '🇨🇳',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_CHINA_CHANNEL_ID',
        handler: 'foreignMarket.china',
        countryKey: 'china',
        enabled: true
    },

    'foreignMarket.hawaii': {
        key: 'foreignMarket.hawaii',
        name: 'Hawaii Market',
        emoji: '🇺🇸',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_HAWAII_CHANNEL_ID',
        handler: 'foreignMarket.hawaii',
        countryKey: 'hawaii',
        enabled: true
    },

    'foreignMarket.japan': {
        key: 'foreignMarket.japan',
        name: 'Japan Market',
        emoji: '🇯🇵',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_JAPAN_CHANNEL_ID',
        handler: 'foreignMarket.japan',
        countryKey: 'japan',
        enabled: true
    },

    'foreignMarket.mexico': {
        key: 'foreignMarket.mexico',
        name: 'Mexico Market',
        emoji: '🇲🇽',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_MEXICO_CHANNEL_ID',
        handler: 'foreignMarket.mexico',
        countryKey: 'mexico',
        enabled: true
    },

    'foreignMarket.southafrica': {
        key: 'foreignMarket.southafrica',
        name: 'South Africa Market',
        emoji: '🇿🇦',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_SOUTHAFRICA_CHANNEL_ID',
        handler: 'foreignMarket.southafrica',
        countryKey: 'southafrica',
        enabled: true
    },

    'foreignMarket.switzerland': {
        key: 'foreignMarket.switzerland',
        name: 'Switzerland Market',
        emoji: '🇨🇭',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_SWITZERLAND_CHANNEL_ID',
        handler: 'foreignMarket.switzerland',
        countryKey: 'switzerland',
        enabled: true
    },

    'foreignMarket.uk': {
        key: 'foreignMarket.uk',
        name: 'UK Market',
        emoji: '🇬🇧',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_UK_CHANNEL_ID',
        handler: 'foreignMarket.uk',
        countryKey: 'uk',
        enabled: true
    },

    'foreignMarket.uae': {
        key: 'foreignMarket.uae',
        name: 'UAE Market',
        emoji: '🇦🇪',
        interval: INTERVALS.REALTIME,
        channelEnvKey: 'FM_UAE_CHANNEL_ID',
        handler: 'foreignMarket.uae',
        countryKey: 'uae',
        enabled: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // 🌍 GLOBAL TRAVEL SUMMARY
    // ═══════════════════════════════════════════════════════════════════

    bestTravelRoute: {
        key: 'bestTravelRoute',
        name: 'Best Travel Route',
        emoji: '🗺️',
        interval: INTERVALS.REALTIME, // 30s as requested
        channelEnvKey: 'BEST_ROUTE_CHANNEL_ID',
        handler: 'bestRouteHandler',
        enabled: true
    },

    travelProfitSummary: {
        key: 'travelProfitSummary',
        name: 'Travel Profit Summary',
        emoji: '💹',
        interval: INTERVALS.REALTIME, // 60s (internal throttle 10m)
        channelEnvKey: 'PROFIT_SUMMARY_CHANNEL_ID',
        handler: 'profitSummaryHandler',
        enabled: true
    },

    cooldownCheck: {
        key: 'cooldownCheck',
        name: 'Travel Cooldown Check',
        emoji: '⏱️',
        interval: INTERVALS.REALTIME, // 60s
        channelEnvKey: 'COOLDOWN_CHECK_CHANNEL_ID',
        handler: 'cooldownHandler',
        enabled: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // 📦 TRADE DETECTION
    // ═══════════════════════════════════════════════════════════════════

    tradeDetection: {
        key: 'tradeDetection',
        name: 'Trade Detection',
        emoji: '📦',
        interval: INTERVALS.REALTIME, // 60s
        channelEnvKey: 'TRADE_HISTORY_CHANNEL_ID',
        handler: 'tradeHandler',
        enabled: true
    },

    marketAlerts: {
        key: 'marketAlerts', // Matches autoRunRegistry key
        name: 'Market Alerts',
        emoji: '🔔',
        interval: 30 * 1000, // 30s (match cache update)
        channelEnvKey: null, // User specific channels, logic handled in engine
        handler: 'marketAlertHandler',
        enabled: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // 📟 SYSTEM MONITORING
    // ═══════════════════════════════════════════════════════════════════

    botStatus: {
        key: 'botStatus',
        name: 'Bot Status',
        emoji: '📟',
        interval: INTERVALS.REALTIME, // 60s
        channelEnvKey: 'BOT_STATUS_CHANNEL_ID',
        handler: 'botStatusHandler',
        enabled: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // 🏢 WORK & COMPANY
    // ═══════════════════════════════════════════════════════════════════

    companyInfo: {
        key: 'companyInfo',
        name: 'Company Info',
        emoji: '🏢',
        interval: 30 * 60 * 1000, // 30m
        channelEnvKey: 'COMPANY_INFO_CHANNEL_ID',
        handler: 'companyHandler',
        enabled: true
    },

    jobOverview: {
        key: 'jobOverview',
        name: 'Job Overview',
        emoji: '📄',
        interval: 15 * 60 * 1000, // 15m
        channelEnvKey: 'JOB_OVERVIEW_CHANNEL_ID',
        handler: 'jobHandler',
        enabled: true
    },

    workPerformance: {
        key: 'workPerformance',
        name: 'Work Performance',
        emoji: '📈',
        interval: 60 * 60 * 1000, // 60m
        channelEnvKey: 'WORK_PERFORMANCE_CHANNEL_ID',
        handler: 'workPerformanceHandler',
        enabled: true
    },

    bazaarCheck: {
        key: 'bazaarCheck',
        name: 'Bazaar Check',
        emoji: '🛒',
        interval: 5 * 60 * 1000, // 5m
        channelEnvKey: 'BAZAAR_CHECK_CHANNEL_ID',
        handler: 'bazaarHandler',
        enabled: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // 📊 MARKET & ECONOMY (NETWORTH ANALYZER)
    // ═══════════════════════════════════════════════════════════════════

    networthTrend: {
        key: 'networthTrend',
        name: 'Networth Trend',
        emoji: '📈',
        interval: 24 * 60 * 60 * 1000, // 24h
        channelEnvKey: 'NETWORTH_TREND_CHANNEL_ID',
        handler: 'networthTrendHandler',
        enabled: true
    },

    networthDelta: {
        key: 'networthDelta',
        name: 'Networth Delta',
        emoji: '📉',
        interval: 24 * 60 * 60 * 1000, // 24h
        channelEnvKey: 'NETWORTH_DELTA_CHANNEL_ID',
        handler: 'networthDeltaHandler',
        enabled: true
    },

    assetDistribution: {
        key: 'assetDistribution',
        name: 'Asset Distribution',
        emoji: '📊',
        interval: 24 * 60 * 60 * 1000, // 24h
        channelEnvKey: 'ASSET_DISTRIBUTION_CHANNEL_ID',
        handler: 'assetDistributionHandler',
        enabled: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // 🧠 SYSTEM / INTELLIGENCE
    // ═══════════════════════════════════════════════════════════════════

    activityLog: {
        key: 'activityLog',
        name: 'Activity Log',
        emoji: '📜',
        interval: 60 * 1000, // 1m - fast polling for activity detection
        channelEnvKey: 'ACTIVITY_LOG_CHANNEL_ID',
        handler: 'activityLogHandler',
        enabled: true
    },

    profitEngine: {
        key: 'profitEngine',
        name: 'Profit Engine',
        emoji: '🧮',
        interval: 5 * 60 * 1000, // 5m - aggregate view
        channelEnvKey: 'PROFIT_ENGINE_CHANNEL_ID',
        handler: 'profitEngineHandler',
        enabled: true
    },

    financialLogs: {
        key: 'financialLogs',
        name: 'Financial Logs',
        emoji: '🧾',
        interval: 60 * 1000, // 1m - fast polling
        channelEnvKey: null, // No specific channel needed
        handler: 'financialLogHandler',
        enabled: true
    },
};

/**
 * Get runner by key
 */
export function getRunner(key) {
    return AUTO_RUNNERS[key] || null;
}

/**
 * Get all enabled runners
 */
export function getEnabledRunners() {
    return Object.values(AUTO_RUNNERS).filter(r => r.enabled);
}

/**
 * Get runners that have channel ID configured in env
 */
export function getConfiguredRunners() {
    return Object.values(AUTO_RUNNERS).filter(r => {
        const channelId = process.env[r.channelEnvKey];
        return r.enabled && channelId;
    });
}

/**
 * Check if runner is a foreign market runner
 */
export function isForeignMarketRunner(key) {
    return key.startsWith('foreignMarket.');
}
