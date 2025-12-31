/**
 * /gym Command
 * Display battle stats with auto-refresh
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { get } from '../services/tornApi.js';
import { getUser } from '../services/userStorage.js';
import { REFRESH_INTERVALS } from '../utils/constants.js';
import { formatNumber, discordTimestamp } from '../utils/formatters.js';
import { getEnergyPerClick, updateFromApiLogs } from '../services/analytics/gymTrainingStorage.js';
import { getUi, getStat, fromDictionary, applyTemplate } from '../localization/index.js';

// Gym names by ID (English names are fine as they are proper nouns)
const GYM_NAMES = {
    // Lightweight
    1: 'Premier Fitness',
    2: 'Average Joes',
    3: 'Woody\'s Workout',
    4: 'Beach Bods',
    5: 'Silver Gym',
    6: 'Pour Femme',
    7: 'Davies Den',
    8: 'Global Gym',
    // Middleweight
    9: 'Knuckle Heads',
    10: 'Pioneer Fitness',
    11: 'Anabolic Anomalies',
    12: 'Core',
    13: 'Racing Fitness',
    14: 'Complete Cardio',
    15: 'Legs Bums and Tums',
    16: 'Deep Burn',
    // Heavyweight
    17: 'Apollo Gym',
    18: 'Gun Shop',
    19: 'Force Training',
    20: 'Cha Cha\'s',
    21: 'Atlas',
    22: 'Last Round',
    23: 'The Edge',
    24: 'George\'s',
    // Specialist
    25: 'Balboas Gym',
    26: 'Frontline Fitness',
    27: 'Gym 3000',
    28: 'Mr. Miyagi\'s',
    29: 'Total Rebound',
    30: 'Elites',
    31: 'Sports Science Lab',
    // Jail
    32: 'Crims Gym'
};

export const data = new SlashCommandBuilder()
    .setName('gym')
    .setDescription('View your battle stats with auto-refresh');

export async function execute(interaction, client) {
    const user = getUser(interaction.user.id);

    if (!user || !user.apiKey) {
        await interaction.reply({
            content: '⚠️ You need to configure your API Key in `.env` file first!',
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    // Stop any existing refresh interval for this user
    const intervalKey = `gym:${interaction.user.id}`;
    if (client.activeIntervals.has(intervalKey)) {
        clearInterval(client.activeIntervals.get(intervalKey));
        client.activeIntervals.delete(intervalKey);
    }

    // Send initial message
    const message = await sendGymEmbed(interaction, user.apiKey, null);

    if (!message) return;

    // Set up auto-refresh interval (60 seconds)
    const interval = setInterval(async () => {
        try {
            await sendGymEmbed(interaction, user.apiKey, message);
        } catch (error) {
            console.error('Gym refresh error:', error);
        }
    }, REFRESH_INTERVALS.WALLET); // 60 seconds

    // Store interval reference for cleanup
    client.activeIntervals.set(intervalKey, interval);
}

/**
 * Send or update gym embed
 */
async function sendGymEmbed(interaction, apiKey, existingMessage) {
    try {
        // Fetch gym data AND logs to learn energy per click
        const data = await get(apiKey, 'user', 'gym,battlestats,bars,log');

        // Try to learn energy per click from logs
        if (data.log) {
            updateFromApiLogs(data.log);
        }

        const embed = buildGymEmbed(data);

        if (existingMessage) {
            await existingMessage.edit({ embeds: [embed] });
            return existingMessage;
        } else {
            return await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Gym fetch error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Failed to fetch gym data')
            .setDescription(error.userMessage || error.message)
            .setTimestamp();

        if (existingMessage) {
            await existingMessage.edit({ embeds: [errorEmbed] });
            return existingMessage;
        } else {
            await interaction.editReply({ embeds: [errorEmbed] });
            return null;
        }
    }
}

/**
 * Helper to capitalize first letter
 */
function capitalize(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Build the gym embed
 */
function buildGymEmbed(data) {
    const gymName = GYM_NAMES[data.active_gym] || `Gym ${data.active_gym}`;
    const total = data.total || 0;

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF) // Light blue to match other embeds
        .setTitle(`🏋️｜${getUi('battle_stats')}`)
        .setDescription('─────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Auto refresh every 60 seconds' });

    // Active Gym (not inline - full width)
    embed.addFields({
        name: `🏢｜${getUi('activity_log').replace('Log Aktivitas', 'Gym')}`, // Fallback
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

    // Blank spacer (not inline - forces new row)
    embed.addFields({
        name: '** **',
        value: '** **',
        inline: false
    });

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

    // Total Stats (not inline - full width at bottom)
    embed.addFields({
        name: `📊｜${totalName}`,
        value: `\`\`\`${formatNumber(total)}\`\`\``,
        inline: false
    });

    // Dynamic Training Estimate based on current energy and learned gym data
    const currentEnergy = data.energy?.current || 0;
    const gymId = data.active_gym || 1;

    // Get energy per click from storage (learned or default)
    const { energyPerClick, confidence } = getEnergyPerClick(gymId);
    const totalClicks = Math.floor(currentEnergy / energyPerClick);

    // Confidence indicators localized
    const confidenceIcon = confidence === 'confirmed' ? '🟢' :
        confidence === 'manual' ? '🔵' :
            confidence === 'inferred' ? '🟡' : '⚪';

    const confidenceLabel = capitalize(fromDictionary('confidence', confidence) || confidence);
    const energyLabel = capitalize(fromDictionary('stats', 'energy') || 'Energy');

    // Stat distribution porsi
    const porsi = {
        str: 0.70,  // 70%
        def: 0.20,  // 20%
        spd: 0.10,  // 10%
        dex: 0.00   // 0%
    };

    // Calculate clicks per stat
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
