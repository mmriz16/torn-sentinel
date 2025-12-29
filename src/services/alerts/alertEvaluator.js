/**
 * Alert Evaluator - Compound & Derived Alert Conditions
 * Handles complex conditions that combine multiple API fields
 */

import { SEVERITY, POLL_INTERVALS, API_GROUPS } from './alertRegistry.js';

/**
 * Compound Alert Definitions
 * These alerts require evaluation of multiple conditions
 */
export const COMPOUND_ALERTS = {
    // ═══════════════════════════════════════════════════════════════════
    // 🎯 OPTIMIZATION ALERTS
    // ═══════════════════════════════════════════════════════════════════

    ENERGY_GYM_OPTIMAL: {
        key: 'ENERGY_GYM_OPTIMAL',
        emoji: '💪',
        title: 'Optimal Gym Time!',
        cooldown: 900, // 15 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,

        // Compound condition: Energy full AND happy is high (>90%)
        checkCondition: (prev, curr) => {
            const energyFull = curr.energy?.current >= curr.energy?.maximum;
            const happyHigh = curr.happy?.current >= curr.happy?.maximum * 0.9;

            // Only trigger if this combo is NEW (wasn't true before)
            const prevCombo =
                prev.energy?.current >= prev.energy?.maximum &&
                prev.happy?.current >= prev.happy?.maximum * 0.9;

            return energyFull && happyHigh && !prevCombo;
        },

        resetCondition: (prev, curr) => {
            // Reset when either condition breaks
            const energyFull = curr.energy?.current >= curr.energy?.maximum;
            const happyHigh = curr.happy?.current >= curr.happy?.maximum * 0.9;
            return !energyFull || !happyHigh;
        },

        getMessage: (state) => {
            const happyPct = Math.round((state.happy?.current / state.happy?.maximum) * 100);
            return [
                `Energy: **${state.energy?.current}/${state.energy?.maximum}** (Full)`,
                `Happy: **${happyPct}%** (Bonus active!)`,
                'Perfect time to train for maximum gains!'
            ];
        }
    },

    DRUG_HAPPY_OPTIMAL: {
        key: 'DRUG_HAPPY_OPTIMAL',
        emoji: '🎯',
        title: 'Optimal Drug Time!',
        cooldown: 600, // 10 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,

        // Compound condition: Drug ready AND happy is very high (>95%)
        checkCondition: (prev, curr) => {
            const drugReady = (curr.cooldowns?.drug || 0) === 0;
            const happyOptimal = curr.happy?.current >= curr.happy?.maximum * 0.95;

            // Only trigger if drug just became ready AND happy is optimal
            const prevDrugReady = (prev.cooldowns?.drug || 0) === 0;

            return drugReady && happyOptimal && !prevDrugReady;
        },

        resetCondition: (prev, curr) => {
            // Reset when drug used
            return (curr.cooldowns?.drug || 0) > 0;
        },

        getMessage: (state) => {
            const happyPct = Math.round((state.happy?.current / state.happy?.maximum) * 100);
            return [
                'Drug cooldown ready!',
                `Happy: **${happyPct}%** (Optimal!)`,
                'Take Xanax now for maximum energy refill.'
            ];
        }
    },

    LOW_LIFE_WARNING: {
        key: 'LOW_LIFE_WARNING',
        emoji: '⚠️',
        title: 'Low Life Warning!',
        cooldown: 300, // 5 min
        severity: SEVERITY.WARNING,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,

        // Trigger when life drops below 25%
        checkCondition: (prev, curr) => {
            const currPct = curr.life?.current / curr.life?.maximum;
            const prevPct = prev.life?.current / prev.life?.maximum;

            return currPct < 0.25 && prevPct >= 0.25;
        },

        resetCondition: (prev, curr) => {
            // Reset when life goes back above 25%
            return (curr.life?.current / curr.life?.maximum) >= 0.25;
        },

        getMessage: (state) => {
            const lifePct = Math.round((state.life?.current / state.life?.maximum) * 100);
            return [
                `Life: **${state.life?.current}/${state.life?.maximum}** (${lifePct}%)`,
                'Consider using a medical item!'
            ];
        }
    },

    NERVE_FULL: {
        key: 'NERVE_FULL',
        emoji: '🧠',
        title: 'Nerve Full!',
        cooldown: 600, // 10 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,

        checkCondition: (prev, curr) => {
            return curr.nerve?.current >= curr.nerve?.maximum &&
                (!prev.nerve || prev.nerve.current < prev.nerve.maximum);
        },

        resetCondition: (prev, curr) => {
            return curr.nerve?.current < curr.nerve?.maximum;
        },

        getMessage: (state) => [
            `Nerve: **${state.nerve?.current}/${state.nerve?.maximum}** (Full)`,
            'Time to commit some crimes!'
        ]
    },
};

/**
 * Get all compound alerts
 */
export function getCompoundAlerts() {
    return Object.values(COMPOUND_ALERTS);
}

/**
 * Evaluate a compound condition
 */
export function evaluateCompound(alert, prevState, currState, config = {}) {
    try {
        return alert.checkCondition(prevState, currState, config);
    } catch (error) {
        console.error(`Error evaluating compound alert ${alert.key}:`, error.message);
        return false;
    }
}

/**
 * Check if compound condition should reset
 */
export function shouldResetCompound(alert, prevState, currState) {
    try {
        return alert.resetCondition(prevState, currState);
    } catch (error) {
        console.error(`Error checking reset for ${alert.key}:`, error.message);
        return false;
    }
}
