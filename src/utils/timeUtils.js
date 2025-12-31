/**
 * Format milliseconds to short compact string (e.g. "5m", "30s")
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Compact formatted string
 */
export function formatTimeShort(ms) {
    if (!ms) return '0s';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}
