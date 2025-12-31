/**
 * Gym Training Storage
 * Tracks energy-per-click for each gym based on observed training patterns
 * 
 * Since Torn API log selection requires higher access level,
 * we use energy delta detection to infer energy-per-click.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const STORAGE_FILE = './data/gym-training-profiles.json';

// Known gym energy costs - Default to 10E per click
// Will be overridden by actual training log data when available
const DEFAULT_GYM_ENERGY = {
    // All gyms default to 10E per click
    // Actual values will be learned from training logs
    1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10, 9: 10, 10: 10, 11: 10, 12: 10,
    13: 10, 14: 10, 15: 10, 16: 10, 17: 10, 18: 10, 19: 10, 20: 10, 21: 10, 22: 10, 23: 10, 24: 10,
    25: 10, 26: 10, 27: 10, 28: 10, 29: 10, 30: 10, 31: 10, 32: 10
};

// In-memory cache
let gymProfiles = {};
let lastTrainedStat = null;

// Stat mapping (English/Indonesian to normalized key)
const STAT_KEYWORDS = {
    'strength': 'str', 'kekuatan': 'str',
    'defense': 'def', 'pertahanan': 'def',
    'speed': 'spd', 'kecepatan': 'spd',
    'dexterity': 'dex', 'ketangkasan': 'dex'
};

/**
 * Initialize storage
 */
function initStorage() {
    const dir = dirname(STORAGE_FILE);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    if (existsSync(STORAGE_FILE)) {
        try {
            const data = JSON.parse(readFileSync(STORAGE_FILE, 'utf8'));
            if (data.profiles) {
                gymProfiles = data.profiles;
                lastTrainedStat = data.lastTrainedStat || null;
            } else {
                // Migration from old format
                gymProfiles = data;
                lastTrainedStat = null;
            }
            console.log(`🏋️ Gym profiles loaded: ${Object.keys(gymProfiles).length} gyms tracked`);
        } catch (e) {
            console.error('❌ Error loading gym profiles:', e.message);
            gymProfiles = {};
        }
    }
}

/**
 * Save profiles to disk
 */
function saveProfiles() {
    const dir = dirname(STORAGE_FILE);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(STORAGE_FILE, JSON.stringify({
        profiles: gymProfiles,
        lastTrainedStat
    }, null, 2));
}

/**
 * Get energy per click for a gym
 * @param {number} gymId - Gym ID
 * @returns {Object} { energyPerClick, confidence, source }
 */
export function getEnergyPerClick(gymId) {
    // Check if we have a learned/confirmed value
    if (gymProfiles[gymId] && gymProfiles[gymId].energyPerClick) {
        return {
            energyPerClick: gymProfiles[gymId].energyPerClick,
            confidence: gymProfiles[gymId].confidence || 'confirmed',
            source: gymProfiles[gymId].source || 'learned',
            lastUpdated: gymProfiles[gymId].lastUpdated
        };
    }

    // Use known defaults from Torn community data
    const defaultEnergy = DEFAULT_GYM_ENERGY[gymId] || 10;

    return {
        energyPerClick: defaultEnergy,
        confidence: 'default',
        source: 'torn-wiki',
        lastUpdated: null
    };
}

/**
 * Update gym profile from observed training
 * Called when we detect energy usage that matches gym training pattern
 * @param {number} gymId - Gym ID
 * @param {number} energyUsed - Total energy used
 * @param {number} clicks - Number of training clicks (if known)
 */
export function updateGymProfile(gymId, energyUsed, clicks = null) {
    if (!gymProfiles[gymId]) {
        gymProfiles[gymId] = {};
    }

    if (clicks && clicks > 0) {
        // We know exact clicks - calculate precise energy per click
        const energyPerClick = Math.round(energyUsed / clicks);

        gymProfiles[gymId] = {
            energyPerClick,
            confidence: 'confirmed',
            source: 'training-log',
            lastUpdated: Date.now(),
            lastTraining: { energyUsed, clicks }
        };

        console.log(`🏋️ Gym ${gymId} profile updated: ${energyPerClick}E/click (confirmed)`);
        saveProfiles();
    } else {
        // We only know energy used, try to infer
        // Common patterns: 5E, 10E per click
        // If energyUsed is divisible by 10, likely 10E gym
        // If divisible by 5 but not 10, likely 5E gym
        let inferredEnergy = 10; // default

        if (energyUsed % 5 === 0 && energyUsed % 10 !== 0) {
            inferredEnergy = 5;
        } else if (energyUsed % 10 === 0) {
            inferredEnergy = 10;
        }

        // Only update if we don't have a confirmed value
        if (gymProfiles[gymId].confidence !== 'confirmed') {
            gymProfiles[gymId] = {
                energyPerClick: inferredEnergy,
                confidence: 'inferred',
                source: 'energy-pattern',
                lastUpdated: Date.now(),
                lastTraining: { energyUsed }
            };

            console.log(`🏋️ Gym ${gymId} profile inferred: ${inferredEnergy}E/click`);
            saveProfiles();
        }
    }
}

/**
 * Manually set energy per click for a gym
 * @param {number} gymId - Gym ID
 * @param {number} energyPerClick - Energy per click
 */
export function setEnergyPerClick(gymId, energyPerClick) {
    gymProfiles[gymId] = {
        energyPerClick,
        confidence: 'manual',
        source: 'user-config',
        lastUpdated: Date.now()
    };
    saveProfiles();
    console.log(`🏋️ Gym ${gymId} manually set to ${energyPerClick}E/click`);
}

/**
 * Get all gym profiles
 */
export function getAllProfiles() {
    return { ...gymProfiles };
}

/**
 * Reset gym profile
 */
export function resetGymProfile(gymId) {
    delete gymProfiles[gymId];
    saveProfiles();
}

// Initialize on import
initStorage();

/**
 * Parse gym training logs from API response
 * Log type 5300 = Gym training
 * @param {Object} logData - Log data from API (user?selections=log)
 * @returns {Object|null} Latest gym training info or null
 */
export function parseGymTrainingLogs(logData) {
    if (!logData || typeof logData !== 'object') {
        return null;
    }

    const entries = Object.entries(logData);

    // Find gym training logs (log type 5300, category "Gym")
    const gymLogs = entries
        .map(([id, entry]) => ({ id, ...entry }))
        .filter(entry => entry.log === 5300 || entry.category === 'Gym')
        .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

    if (gymLogs.length === 0) {
        return null;
    }

    // Get the most recent gym training
    const latest = gymLogs[0];

    if (!latest.data || !latest.data.trains || !latest.data.energy_used) {
        return null;
    }

    const trains = latest.data.trains;
    const energyUsed = latest.data.energy_used;
    const gymId = latest.data.gym;
    const energyPerClick = Math.round(energyUsed / trains);

    const title = latest.title?.toLowerCase() || '';
    let stat = 'unknown';

    for (const [keyword, key] of Object.entries(STAT_KEYWORDS)) {
        if (title.includes(keyword)) {
            stat = key;
            break;
        }
    }

    return {
        gymId,
        trains,
        energyUsed,
        energyPerClick,
        stat: stat, // str, def, spd, dex, or unknown
        timestamp: latest.timestamp,
        happyUsed: latest.data.happy_used || 0
    };
}

/**
 * Update gym profile from parsed API logs
 * Call this with log data from API to learn energy per click
 * @param {Object} logData - Log data from API
 * @returns {Object|null} Updated profile info or null
 */
export function updateFromApiLogs(logData) {
    const trainingInfo = parseGymTrainingLogs(logData);

    if (!trainingInfo) {
        return null;
    }

    const { gymId, energyUsed, trains, energyPerClick } = trainingInfo;

    // Update gym profile with confirmed data from actual log
    if (!gymProfiles[gymId]) {
        gymProfiles[gymId] = {};
    }

    gymProfiles[gymId] = {
        energyPerClick,
        confidence: 'confirmed',
        source: 'api-log',
        lastUpdated: Date.now(),
        lastTraining: {
            energyUsed,
            trains,
            timestamp: trainingInfo.timestamp
        }
    };

    // Update global last trained stat
    if (trainingInfo.stat !== 'unknown') {
        lastTrainedStat = trainingInfo.stat;
    }

    console.log(`🏋️ Gym ${gymId} profile CONFIRMED from API log: ${energyPerClick}E/click (${trains} trains, ${energyUsed}E) - Stat: ${trainingInfo.stat}`);
    saveProfiles();

    return trainingInfo;
}

export function getLastTrainedStat() {
    return lastTrainedStat;
}

export default {
    getEnergyPerClick,
    updateGymProfile,
    setEnergyPerClick,
    getAllProfiles,
    resetGymProfile,
    parseGymTrainingLogs,
    updateFromApiLogs,
    getLastTrainedStat
};

