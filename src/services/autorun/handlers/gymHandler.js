/**
 * Gym Handler for Auto-Run
 * Builds gym/battle stats embed - MATCHES /gym command exactly
 */

import { EmbedBuilder } from 'discord.js';
import { get } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatNumber } from '../../../utils/formatters.js';

// Gym names by ID (same as /gym command)
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
        const data = await get(user.apiKey, 'user', 'gym,battlestats,bars');

        return buildGymEmbed(data);
    } catch (error) {
        console.error('❌ Gym handler error:', error.message);
        return null;
    }
}

/**
 * Build gym embed - EXACT COPY from /gym command
 */
function buildGymEmbed(data) {
    const gymName = GYM_NAMES[data.active_gym] || `Gym ${data.active_gym}`;
    const total = data.total || 0;

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF)
        .setTitle('🏋️｜Battle Stats')
        .setDescription('─────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Auto refresh every 60 seconds' });

    // Active Gym
    embed.addFields({
        name: '🏢｜Active Gym',
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

    // Row 1: Strength | Defense
    embed.addFields({
        name: '💪｜Strength',
        value: `\`\`\`${formatStat(data.strength, data.strength_modifier)}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: '🛡️｜Defense',
        value: `\`\`\`${formatStat(data.defense, data.defense_modifier)}\`\`\``,
        inline: true
    });

    // Spacer
    embed.addFields({ name: '** **', value: '** **', inline: false });

    // Row 2: Speed | Dexterity
    embed.addFields({
        name: '⚡｜Speed',
        value: `\`\`\`${formatStat(data.speed, data.speed_modifier)}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: '🎯｜Dexterity',
        value: `\`\`\`${formatStat(data.dexterity, data.dexterity_modifier)}\`\`\``,
        inline: true
    });

    // Total Stats
    embed.addFields({
        name: '📊｜Total Stats',
        value: `\`\`\`${formatNumber(total)}\`\`\``,
        inline: false
    });

    // Training Estimate
    const currentEnergy = data.energy?.current || 0;
    const totalClicks = Math.floor(currentEnergy / 5);

    const porsi = { str: 0.70, def: 0.20, spd: 0.10, dex: 0.00 };
    const strClicks = Math.floor(totalClicks * porsi.str);
    const defClicks = Math.floor(totalClicks * porsi.def);
    const spdClicks = Math.floor(totalClicks * porsi.spd);
    const dexClicks = Math.floor(totalClicks * porsi.dex);

    const trainingEstimate = [
        `⚡ Energy: ${currentEnergy}E → ${totalClicks} clicks`,
        '─────────────────────────────────',
        `💪 Strength  : ${strClicks} clicks (70%)`,
        `🛡️ Defense   : ${defClicks} clicks (20%)`,
        `⚡ Speed     : ${spdClicks} clicks (10%)`,
        `🎯 Dexterity : ${dexClicks} clicks (0%)`
    ].join('\n');

    embed.addFields({
        name: '🏋️｜Training Estimate',
        value: `\`\`\`${trainingEstimate}\`\`\``,
        inline: false
    });

    return embed;
}
