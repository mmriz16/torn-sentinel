/**
 * /daily-test Command
 * Manual trigger for daily summary (owner only)
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { triggerDailySummary } from '../services/dailySummary.js';

export const data = new SlashCommandBuilder()
    .setName('daily-test')
    .setDescription('Manually trigger daily summary (owner only)');

export async function execute(interaction, client) {
    // Check if user is the owner
    const ownerId = process.env.OWNER_ID;

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: '❌ This command is only available to the bot owner.',
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        await triggerDailySummary(client);

        await interaction.editReply({
            content: '✅ Daily summary triggered successfully! Check the configured channel.',
            ephemeral: true
        });
    } catch (error) {
        console.error('Daily test error:', error);

        await interaction.editReply({
            content: `❌ Error triggering daily summary: ${error.message}`,
            ephemeral: true
        });
    }
}
