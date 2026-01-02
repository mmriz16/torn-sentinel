/**
 * Footer Helper
 * Standardizes footer formatting across all auto-run embeds
 */

import { formatTimeShort } from './formatters.js';
import { AUTO_RUNNERS } from '../services/autorun/autoRunRegistry.js';

/**
 * Get standard footer object for an embed
 * @param {string} runnerKey - Key of the auto-runner (e.g. 'flightStatus')
 * @returns {Object} Footer object { text: string }
 */
export function getRunnerFooter(runnerKey) {
    const runner = AUTO_RUNNERS[runnerKey];

    // Default info if runner not found (shouldn't happen)
    let intervalText = 'Unknown interval';
    let name = 'Torn Sentinel';

    if (runner) {
        intervalText = `Updated every ${formatTimeShort(runner.interval)}`;
        // For foreign markets, maybe simplify? No, show configured interval.
    }

    // Dynamic timestamp is handled by Discord's setTimestamp(), 
    // but the text part is what we care about here.
    return {
        text: `${name} • ${intervalText}`
    };
}
