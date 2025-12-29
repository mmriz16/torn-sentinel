/**
 * Formatting Utilities
 * Number formatting, embed builders, and display helpers
 */

/**
 * Format number as currency with $ and commas
 * @param {number} num - Number to format
 * @returns {string} Formatted currency string
 */
export function formatMoney(num) {
    if (num === null || num === undefined) return '$0';

    const absNum = Math.abs(num);
    const formatted = absNum.toLocaleString('en-US');

    if (num < 0) {
        return `-$${formatted}`;
    }

    return `$${formatted}`;
}

/**
 * Format number with commas only
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('en-US');
}

/**
 * Format large numbers with suffixes (K, M, B)
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string with suffix
 */
export function formatCompact(num, decimals = 1) {
    if (num === null || num === undefined) return '0';

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum >= 1_000_000_000) {
        return `${sign}${(absNum / 1_000_000_000).toFixed(decimals)}B`;
    }
    if (absNum >= 1_000_000) {
        return `${sign}${(absNum / 1_000_000).toFixed(decimals)}M`;
    }
    if (absNum >= 1_000) {
        return `${sign}${(absNum / 1_000).toFixed(decimals)}K`;
    }

    return `${sign}${absNum}`;
}

/**
 * Get change indicator arrow
 * @param {number} value - Value to check
 * @returns {string} ▲ for positive, ▼ for negative, empty for zero
 */
export function getChangeIndicator(value) {
    if (value > 0) return '▲';
    if (value < 0) return '▼';
    return '';
}

/**
 * Format value with change indicator
 * @param {number} value - Value to format
 * @param {boolean} isMoney - Format as money
 * @returns {string} Formatted string with indicator
 */
export function formatWithChange(value, isMoney = true) {
    const indicator = getChangeIndicator(value);
    const formatted = isMoney ? formatMoney(value) : formatNumber(value);

    if (value < 0) {
        return `${indicator} **${formatted}**`;
    }

    return indicator ? `${indicator} ${formatted}` : formatted;
}

/**
 * Create a progress bar string with colored squares
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @param {number} length - Bar length in characters
 * @param {string} color - Bar color: 'orange', 'green', 'blue', 'red'
 * @returns {string} Progress bar string
 */
export function createProgressBar(current, max, length = 10, color = 'green') {
    const percentage = Math.min(current / max, 1);
    const filled = Math.round(percentage * length);
    const empty = length - filled;

    // Color mapping
    const colors = {
        orange: '🟧',
        yellow: '🟨',
        green: '🟩',
        blue: '🟦',
        red: '🟥',
        purple: '🟪'
    };

    const filledChar = colors[color] || '🟩';
    const emptyChar = '⬛';

    // Join with thin space for visual separation
    const filledPart = Array(filled).fill(filledChar).join(' ');
    const emptyPart = Array(empty).fill(emptyChar).join(' ');

    return filledPart + (filled > 0 && empty > 0 ? ' ' : '') + emptyPart;
}

/**
 * Get color based on percentage threshold
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @returns {number} Discord color code
 */
export function getThresholdColor(current, max) {
    const percentage = current / max;

    if (percentage >= 1) return 0x00FF00;      // Green - Full
    if (percentage >= 0.8) return 0xFFFF00;    // Yellow - >80%
    if (percentage >= 0.5) return 0xFFA500;    // Orange - >50%
    return 0xFF0000;                            // Red - <50%
}

/**
 * Create Discord timestamp
 * @param {Date|number} date - Date or unix timestamp
 * @param {string} style - Timestamp style (t, T, d, D, f, F, R)
 * @returns {string} Discord timestamp string
 */
export function discordTimestamp(date, style = 'R') {
    const unix = date instanceof Date
        ? Math.floor(date.getTime() / 1000)
        : date;

    return `<t:${unix}:${style}>`;
}

/**
 * Format timestamp to relative time string (e.g. "2h 30m")
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export function formatTime(seconds) {
    if (!seconds) return '0s';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 && h === 0) parts.push(`${s}s`);

    return parts.join(' ') || '0s';
}

export default {
    formatMoney,
    formatNumber,
    formatCompact,
    getChangeIndicator,
    formatWithChange,
    createProgressBar,
    getThresholdColor,
    discordTimestamp
};
