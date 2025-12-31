/**
 * Gym Handler for Auto-Run
 * Builds gym/battle stats embed - MATCHES /gym command exactly
 */

import { EmbedBuilder } from 'discord.js';
import { get } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatNumber, formatTimeShort } from '../../../utils/formatters.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';

import { getEnergyPerClick, updateFromApiLogs, getLastTrainedStat } from '../../analytics/gymTrainingStorage.js';
import { getUi, getStat, fromDictionary, applyTemplate } from '../../../localization/index.js';

// Gym names by ID (English names are fine as they are proper nouns)
const GYM_NAMES = {
    1: 'Premier Fitness', 2: 'Average Joes', 3: 'Woody\'s Workout', 4: 'Beach Bods',
    5: 'Silver Gym', 6: 'Pour Femme', 7: 'Davies Den', 8: 'Global Gym',
    9: 'Knuckle Heads', 10: 'Pioneer Fitness', 11: 'Anabolic Anomalies', 12: 'Core',
    13: 'Racing Fitness', 14: 'Complete Cardio', 15: 'Legs Bums and Tums', 16: 'Deep Burn',
    17: 'Apollo Gym', 18: 'Gun Shop', 19: 'Force Training', 20: 'Cha Cha\'s',
    21: 'Atlas', 22: 'Last Round', 23: 'The Edge', 24: 'George\'s',
    25: 'Balboas Gym', 26: 'Frontline Fitness', 27: 'Gym 3000', 28: 'Mr. Miyagi\'s',
    29: 'Total Rebound', 30: 'Elites', 31: 'Sports Science Lab', 32: 'Crims Gym'
};

/**
 * Gym handler - fetches data and returns embed
 */
export async function gymHandler(client) {
    try {
        const users = getAllUsers();
        const userId = Object.keys(users)[0];
        if (!userId) return null;

        const user = users[userId];

        // Fetch gym data AND logs to learn energy per click
        const data = await get(user.apiKey, 'user', 'gym,battlestats,bars,log');

        // Try to learn energy per click from logs
        if (data.log) {
            updateFromApiLogs(data.log);
        }

        return buildGymEmbed(data);
    } catch (error) {
        console.error('❌ Gym handler error:', error.message);
        return null;
    }
}

/**
 * Helper to capitalize first letter
 */
function capitalize(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Build gym embed - EXACT COPY from /gym command
 */
function buildGymEmbed(data) {
    const gymName = GYM_NAMES[data.active_gym] || `Gym ${data.active_gym}`;
    const total = data.total || 0;

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF)
        .setTitle(`🏋️｜${getUi('battle_stats')}`)
        .setDescription('─────────────────────────────────────────────────')
        .setTimestamp()
        .setTimestamp();
    const interval = formatTimeShort(AUTO_RUNNERS.gym.interval);
    embed.setFooter({ text: `Torn Sentinel • Auto refresh every ${interval}` });


    // Active Gym
    embed.addFields({
        name: `🏢｜${getUi('activity_log').replace('Log Aktivitas', 'Gym')}`, // Fallback or use specific key if added
        value: `\`\`\`${gymName}\`\`\``,
        inline: false
    });

    // Format stat with modifier
    const formatStat = (value, modifier) => {
        let text = formatNumber(value);
        if (modifier !== 0) {
            text += ` (${modifier > 0 ? '+' : ''}${modifier}%)`;
        }
        return text;
    };

    // Statically map UI keys to localized names (capitalized)
    const strName = capitalize(getStat('strength'));
    const defName = capitalize(getStat('defense'));
    const spdName = capitalize(getStat('speed'));
    const dexName = capitalize(getStat('dexterity'));
    const totalName = capitalize(fromDictionary('stats', 'total') || 'Total Stats');

    // Row 1: Strength | Defense
    embed.addFields({
        name: `💪｜${strName}`,
        value: `\`\`\`${formatStat(data.strength, data.strength_modifier)}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: `🛡️｜${defName}`,
        value: `\`\`\`${formatStat(data.defense, data.defense_modifier)}\`\`\``,
        inline: true
    });

    // Spacer
    embed.addFields({ name: '** **', value: '** **', inline: false });

    // Row 2: Speed | Dexterity
    embed.addFields({
        name: `⚡｜${spdName}`,
        value: `\`\`\`${formatStat(data.speed, data.speed_modifier)}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: `🎯｜${dexName}`,
        value: `\`\`\`${formatStat(data.dexterity, data.dexterity_modifier)}\`\`\``,
        inline: true
    });

    // Total Stats
    embed.addFields({
        name: `📊｜${totalName}`,
        value: `\`\`\`${formatNumber(total)}\`\`\``,
        inline: false
    });

    // Training Estimate - Now using learned energy-per-click!
    const currentEnergy = data.energy?.current || 0;
    const gymId = data.active_gym || 1;

    // Get energy per click from storage (learned or default)
    const { energyPerClick, confidence, source } = getEnergyPerClick(gymId);
    const totalClicks = Math.floor(currentEnergy / energyPerClick);

    // Confidence indicators localized
    const confidenceIcon = confidence === 'confirmed' ? '🟢' :
        confidence === 'manual' ? '🔵' :
            confidence === 'inferred' ? '🟡' : '⚪';

    const confidenceLabel = capitalize(fromDictionary('confidence', confidence) || confidence);
    const energyLabel = capitalize(fromDictionary('stats', 'energy') || 'Energy');

    // Determine distribution based on last gym action
    const lastStat = getLastTrainedStat(); // str, def, spd, dex
    let porsi = { str: 0.70, def: 0.20, spd: 0.10, dex: 0.00 }; // Default

    if (lastStat) {
        // Set 100% to last trained stat
        porsi = { str: 0.00, def: 0.00, spd: 0.00, dex: 0.00 };
        if (porsi.hasOwnProperty(lastStat)) {
            porsi[lastStat] = 1.00;
        } else {
            // Fallback if stat key invalid
            porsi = { str: 0.70, def: 0.20, spd: 0.10, dex: 0.00 };
        }
    }

    const strClicks = Math.floor(totalClicks * porsi.str);
    const defClicks = Math.floor(totalClicks * porsi.def);
    const spdClicks = Math.floor(totalClicks * porsi.spd);
    const dexClicks = Math.floor(totalClicks * porsi.dex);

    // Using some hardcoded structure but localized terms
    const trainingEstimate = [
        `⚡ ${energyLabel}: ${currentEnergy}E → ${totalClicks} clicks`,
        `💡 Cost: ${energyPerClick}E/click ${confidenceIcon} ${confidenceLabel}`,
        '─────────────────────────────────',
        `💪 ${strName.padEnd(9)} : ${strClicks} clicks (70%)`,
        `🛡️ ${defName.padEnd(9)} : ${defClicks} clicks (20%)`,
        `⚡ ${spdName.padEnd(9)} : ${spdClicks} clicks (10%)`,
        `🎯 ${dexName.padEnd(9)} : ${dexClicks} clicks (0%)`
    ].join('\n');

    embed.addFields({
        name: `🏋️｜${getUi('training_estimate')}`,
        value: `\`\`\`${trainingEstimate}\`\`\``,
        inline: false
    });

    return embed;
}
