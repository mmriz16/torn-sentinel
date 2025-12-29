/**
 * /gym Command
 * Display battle stats with auto-refresh
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { get } from '../services/tornApi.js';
import { getUser } from '../services/userStorage.js';
import { REFRESH_INTERVALS } from '../utils/constants.js';
import { formatNumber, discordTimestamp } from '../utils/formatters.js';

// Gym names by ID (from Torn wiki)
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
            content: '⚠️ You need to register first! Use `/register key` with your Torn API key.',
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
        const data = await get(apiKey, 'user', 'gym,battlestats,bars');
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
 * Build the gym embed
 */
function buildGymEmbed(data) {
    const gymName = GYM_NAMES[data.active_gym] || `Gym ${data.active_gym}`;
    const total = data.total || 0;

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF) // Light blue to match other embeds
        .setTitle('🏋️｜Battle Stats')
        .setDescription('─────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Auto refresh every 60 seconds' });

    // Active Gym (not inline - full width)
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

    // Blank spacer (not inline - forces new row)
    embed.addFields({
        name: '** **',
        value: '** **',
        inline: false
    });

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

    // Total Stats (not inline - full width at bottom)
    embed.addFields({
        name: '📊｜Total Stats',
        value: `\`\`\`${formatNumber(total)}\`\`\``,
        inline: false
    });

    // Dynamic Training Estimate based on current energy
    const currentEnergy = data.energy?.current || 0;

    // Calculate total clicks based on energy (5 energy = 1 click)
    const totalClicks = Math.floor(currentEnergy / 5);

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
