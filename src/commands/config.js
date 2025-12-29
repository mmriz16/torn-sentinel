/**
 * /config Command
 * Show API configuration (Owner only)
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../services/userStorage.js';

export const data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Show API configuration (Owner only)')
    .addBooleanOption(option =>
        option
            .setName('show_full')
            .setDescription('Show full API key and token (unsafe)')
            .setRequired(false)
    );

export async function execute(interaction) {
    // Check if user is owner
    const ownerId = process.env.OWNER_ID;
    if (ownerId && interaction.user.id !== ownerId) {
        await interaction.reply({
            content: '❌ This command is only available for the bot owner.',
            ephemeral: true
        });
        return;
    }

    const showFull = interaction.options.getBoolean('show_full') || false;
    const user = getUser(interaction.user.id);
    const apiKey = user?.apiKey || 'Not registered';
    const discordToken = process.env.DISCORD_TOKEN || 'Not set';

    // Mask or show full based on option
    let displayApiKey, displayToken;

    if (showFull) {
        displayApiKey = apiKey;
        displayToken = discordToken;
    } else {
        displayApiKey = apiKey.length > 8
            ? apiKey.substring(0, 8) + '...'
            : apiKey;
        displayToken = discordToken.length > 20
            ? discordToken.substring(0, 20) + '...'
            : discordToken;
    }

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF)
        .setTitle('🔐｜API Config')
        .addFields(
            {
                name: 'API Key',
                value: `\`\`\`${displayApiKey}\`\`\``,
                inline: false
            },
            {
                name: 'User ID',
                value: `\`\`\`${interaction.user.id}\`\`\``,
                inline: true
            },
            {
                name: 'Server ID',
                value: `\`\`\`${interaction.guild?.id || 'DM'}\`\`\``,
                inline: true
            },
            {
                name: 'Discord Token',
                value: `\`\`\`${displayToken}\`\`\``,
                inline: false
            }
        );

    if (showFull) {
        embed.setFooter({ text: '⚠️ Full credentials shown - do not share!' });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}
