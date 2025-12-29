/**
 * /alert-test Command
 * Test alert system (owner only)
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { sendTestAlert, getAllAlertKeys, getSchedulerStatus } from '../services/alerts/index.js';
import { EMOJI, COLORS } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
    .setName('alert-test')
    .setDescription('Test alert system (owner only)')
    .addStringOption(option =>
        option.setName('alert')
            .setDescription('Alert type to test')
            .setRequired(false)
            .addChoices(
                { name: 'Energy Full', value: 'ENERGY_FULL' },
                { name: 'Drug Ready', value: 'DRUG_READY' },
                { name: 'Booster Ready', value: 'BOOSTER_READY' },
                { name: 'Travel Completed', value: 'TRAVEL_COMPLETED' },
                { name: 'Education Done', value: 'EDUCATION_COMPLETED' },
                { name: 'Optimal Gym', value: 'ENERGY_GYM_OPTIMAL' }
            ));

export async function execute(interaction) {
    // Owner only
    if (interaction.user.id !== process.env.OWNER_ID) {
        await interaction.reply({
            content: `${EMOJI.ERROR} This command is for the bot owner only.`,
            ephemeral: true
        });
        return;
    }

    const alertKey = interaction.options.getString('alert');

    if (alertKey) {
        // Test specific alert
        await interaction.deferReply({ ephemeral: true });

        const result = await sendTestAlert(interaction.user.id, alertKey);

        if (result.success) {
            await interaction.editReply({
                content: `${EMOJI.SUCCESS} Test alert **${alertKey}** sent to alerts channel!`
            });
        } else {
            await interaction.editReply({
                content: `${EMOJI.ERROR} Failed to send test alert: ${result.error}`
            });
        }
    } else {
        // Show status
        const status = getSchedulerStatus();
        const allAlerts = getAllAlertKeys();

        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('🔔 Alert System Status')
            .addFields(
                {
                    name: '📊 Status',
                    value: status.enabled ? '✅ Enabled' : '❌ Disabled',
                    inline: true
                },
                {
                    name: '⏱️ Intervals',
                    value: status.activeIntervals.join(', ') || 'None',
                    inline: true
                },
                {
                    name: '📋 Available Alerts',
                    value: `\`\`\`${allAlerts.join('\n')}\`\`\``,
                    inline: false
                }
            )
            .setFooter({ text: 'Use /alert-test alert:<type> to send a test alert' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}
