/**
 * /stats Command
 * Player bars with auto-refresh and threshold indicators
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { get } from '../services/tornApi.js';
import { getUser } from '../services/userStorage.js';
import { COLORS, EMOJI, REFRESH_INTERVALS } from '../utils/constants.js';
import { formatNumber, createProgressBar, getThresholdColor, discordTimestamp } from '../utils/formatters.js';

export const data = new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your player bars with auto-refresh');

export async function execute(interaction, client) {
    const user = getUser(interaction.user.id);

    if (!user || !user.apiKey) {
        await interaction.reply({
            content: `${EMOJI.WARNING} You need to configure your API Key in \`.env\` file first!`,
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    // Stop any existing refresh interval for this user
    const intervalKey = `stats:${interaction.user.id}`;
    if (client.activeIntervals.has(intervalKey)) {
        clearInterval(client.activeIntervals.get(intervalKey));
        client.activeIntervals.delete(intervalKey);
    }

    // Send initial message
    const message = await sendStatsEmbed(interaction, user.apiKey, null);

    if (!message) return; // Error occurred

    // Set up auto-refresh interval (60 seconds for stats)
    const interval = setInterval(async () => {
        try {
            await sendStatsEmbed(interaction, user.apiKey, message);
        } catch (error) {
            console.error('Stats refresh error:', error);
        }
    }, REFRESH_INTERVALS.STATS);

    // Store interval reference for cleanup
    client.activeIntervals.set(intervalKey, interval);
}



/**
 * Send or update stats embed
 */
async function sendStatsEmbed(interaction, apiKey, existingMessage) {
    try {
        // Fetch bars data
        const data = await get(apiKey, 'user', 'bars,cooldowns,education');

        const embed = buildStatsEmbed(data);

        if (existingMessage) {
            await existingMessage.edit({ embeds: [embed] });
            return existingMessage;
        } else {
            return await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Stats fetch error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle(`${EMOJI.ERROR} Failed to fetch stats`)
            .setDescription(error.userMessage || error.message)
            .setTimestamp();

        if (existingMessage) {
            await existingMessage.edit({ embeds: [errorEmbed], components: [] });
            return existingMessage;
        } else {
            await interaction.editReply({ embeds: [errorEmbed] });
            return null;
        }
    }
}

/**
 * Build the stats embed
 */
function buildStatsEmbed(data) {
    const { energy, nerve, happy, life } = data;

    // Determine embed color based on lowest bar percentage
    const percentages = [
        energy.current / energy.maximum,
        nerve.current / nerve.maximum,
        life.current / life.maximum
    ];
    const lowestPercentage = Math.min(...percentages);
    const embedColor = getThresholdColor(lowestPercentage, 1);

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('⚡ Player Stats')
        .setDescription('────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Auto refresh every 60 seconds' });

    // Row 1: Energy | Nerve
    const energyBar = createProgressBar(energy.current, energy.maximum, 8, 'orange');
    const energyTitle = energy.fulltime > 0
        ? `⚡ Energy · ${discordTimestamp(Math.floor(Date.now() / 1000) + energy.fulltime, 'R')}`
        : '⚡ Energy';
    embed.addFields({
        name: energyTitle,
        value: `${energyBar}\n**${formatNumber(energy.current)}**/${formatNumber(energy.maximum)}`,
        inline: true
    });

    const nerveBar = createProgressBar(nerve.current, nerve.maximum, 8, 'green');
    const nerveTitle = nerve.fulltime > 0
        ? `🧠 Nerve · ${discordTimestamp(Math.floor(Date.now() / 1000) + nerve.fulltime, 'R')}`
        : '🧠 Nerve';
    embed.addFields({
        name: nerveTitle,
        value: `${nerveBar}\n**${formatNumber(nerve.current)}**/${formatNumber(nerve.maximum)}`,
        inline: true
    });

    // Force new row
    embed.addFields({ name: '** **', value: '** **', inline: false });

    // Row 2: Happy | Life
    const happyBar = createProgressBar(happy.current, happy.maximum, 8, 'blue');
    const happyTitle = happy.fulltime > 0
        ? `😊 Happy · ${discordTimestamp(Math.floor(Date.now() / 1000) + happy.fulltime, 'R')}`
        : '😊 Happy';
    embed.addFields({
        name: happyTitle,
        value: `${happyBar}\n**${formatNumber(happy.current)}**/${formatNumber(happy.maximum)}`,
        inline: true
    });

    const lifeBar = createProgressBar(life.current, life.maximum, 8, 'red');
    const lifeTitle = life.fulltime > 0
        ? `❤️ Life · ${discordTimestamp(Math.floor(Date.now() / 1000) + life.fulltime, 'R')}`
        : '❤️ Life';
    embed.addFields({
        name: lifeTitle,
        value: `${lifeBar}\n**${formatNumber(life.current)}**/${formatNumber(life.maximum)}`,
        inline: true
    });
    // Cooldowns section header
    embed.addFields({ name: '** **', value: '** **', inline: false });
    embed.addFields({ name: '⏱️｜Cooldowns', value: '** **', inline: false });

    const cooldowns = data.cooldowns || {};
    const now = Math.floor(Date.now() / 1000);

    // Get education name
    const educationName = getEducationName(data.education_current);

    // Drug cooldown (Row 1, Col 1)
    if (cooldowns.drug > 0) {
        embed.addFields({
            name: '💊｜Drug',
            value: `\`\`\`Xanax\`\`\`${discordTimestamp(now + cooldowns.drug, 'R')}`,
            inline: true
        });
    } else {
        embed.addFields({
            name: '💊｜Drug',
            value: '```✅ Ready```',
            inline: true
        });
    }

    // Booster cooldown (Row 1, Col 2)
    if (cooldowns.booster > 0) {
        embed.addFields({
            name: '💉｜Booster',
            value: `\`\`\`Active\`\`\`${discordTimestamp(now + cooldowns.booster, 'R')}`,
            inline: true
        });
    } else {
        embed.addFields({
            name: '💉｜Booster',
            value: '```✅ Ready```',
            inline: true
        });
    }

    // Force new row
    embed.addFields({ name: '** **', value: '** **', inline: false });

    // Medical cooldown (Row 2, Col 1)
    if (cooldowns.medical > 0) {
        embed.addFields({
            name: '🏥｜Medical',
            value: `\`\`\`Active\`\`\`${discordTimestamp(now + cooldowns.medical, 'R')}`,
            inline: true
        });
    } else {
        embed.addFields({
            name: '🏥｜Medical',
            value: '```✅ Ready```',
            inline: true
        });
    }

    // Education cooldown (Row 2, Col 2)
    if (data.education_timeleft > 0) {
        embed.addFields({
            name: '📚｜Education',
            value: `\`\`\`${educationName}\`\`\`${discordTimestamp(now + data.education_timeleft, 'R')}`,
            inline: true
        });
    } else {
        embed.addFields({
            name: '📚｜Education',
            value: '```✅ Ready```',
            inline: true
        });
    }

    return embed;
}

/**
 * Get education name by ID
 */
function getEducationName(educationId) {
    const educations = {
        // General Education
        1: 'General Studies',
        2: 'Biology',
        3: 'Business Studies',
        4: 'Combat Training',
        5: 'Psychology',
        // Sport Science
        41: 'Introduction to Sport',
        42: 'Sports Science',
        43: 'Sport Science',
        44: 'Sports Management',
        // Biology
        11: 'Introduction to Biology',
        12: 'General Science',
        13: 'Health & Fitness',
        // Computer Science
        21: 'Introduction to Computer',
        22: 'Networking',
        23: 'Programming',
        // Law
        31: 'Introduction to Law',
        32: 'Criminal Justice',
        33: 'Law Degree',
        // Other
        51: 'Mathematics',
        52: 'Stock Market Studies',
        // ... more can be added
    };
    return educations[educationId] || 'Studying';
}

/**
 * Get bar status indicator
 */
function getBarStatus(current, max) {
    const percentage = current / max;

    if (percentage >= 1) return '🟢';      // Full
    if (percentage >= 0.8) return '🟡';    // >80%
    if (percentage >= 0.5) return '🟠';    // >50%
    return '🔴';                            // <50%
}

