/**
 * Constants
 * Refresh intervals, colors, and configuration values
 */

// Refresh intervals in milliseconds
export const REFRESH_INTERVALS = {
    WALLET: 60 * 1000,      // 60 seconds
    STATS: 60 * 1000,       // 60 seconds (changed from 30s)
    MARKET: 120 * 1000,     // 120 seconds
    STOCKS: 120 * 1000,     // 120 seconds
};

// Discord embed colors
export const COLORS = {
    SUCCESS: 0x00FF00,      // Green
    ERROR: 0xFF0000,        // Red
    WARNING: 0xFFA500,      // Orange
    INFO: 0x5865F2,         // Discord Blurple
    NETWORTH: 0xFFD700,     // Gold
    MONEY: 0x2ECC71,        // Emerald
    STATS: 0x3498DB,        // Blue
};

// Torn API configuration
export const TORN_API = {
    BASE_URL: 'https://api.torn.com',
    TIMEOUT: 10000,         // 10 seconds
};

// Emoji mappings
export const EMOJI = {
    // Financial
    WALLET: '💰',
    BANK: '🏦',
    NETWORTH: '💼',
    POINTS: '🎫',

    // Assets
    ITEMS: '📦',
    PROPERTIES: '🏠',
    STOCK_MARKET: '📈',
    ITEM_MARKET: '🏪',

    // Liabilities
    LOAN: '💳',
    FEES: '⚠️',

    // Bars
    ENERGY: '⚡',
    NERVE: '🧠',
    HAPPY: '😊',
    LIFE: '❤️',

    // Status
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    REFRESH: '🔄',
    STOP: '⏹️',

    // Indicators
    UP: '▲',
    DOWN: '▼',
    LOADING: '⏳',
};

// Permission levels
export const PERMISSIONS = {
    OWNER: 'owner',
    ADMIN: 'admin',
    USER: 'user',
};

export default {
    REFRESH_INTERVALS,
    COLORS,
    TORN_API,
    EMOJI,
    PERMISSIONS,
};
