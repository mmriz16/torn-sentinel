/**
 * /travel Command
 * Personal travel analytics and insights
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getStatus, resetDailyStatsManual } from '../services/analytics/travelAnalyticsService.js';
import { formatMoney, formatTime } from '../utils/formatters.js';

export const data = new SlashCommandBuilder()
    .setName('travel')
    .setDescription('Travel analytics and history')
    .addSubcommand(subcommand =>
        subcommand
            .setName('summary')
            .setDescription('View today\'s travel stats')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('history')
            .setDescription('View recent trade history')
            .addIntegerOption(option =>
                option.setName('limit')
                    .setDescription('Number of entries to show (default 5, max 10)')
                    .setMinValue(1)
                    .setMaxValue(10)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('reset-today')
            .setDescription('Reset daily stats manually (Use with caution)')
    );

export async function execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'summary') {
        await handleSummary(interaction);
    } else if (subcommand === 'history') {
        await handleHistory(interaction);
    } else if (subcommand === 'reset-today') {
        await handleReset(interaction);
    }
}

async function handleSummary(interaction) {
    const status = getStatus();
    const { daily } = status;

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📊 Travel Summary — Today')
        .setDescription(`Date: **${daily.date}**`)
        .addFields(
            { name: '✈️ Trips', value: daily.trips.toString(), inline: true },
            { name: '💰 Total Profit', value: formatMoney(daily.totalProfit), inline: true },
            { name: '📈 Avg / Trip', value: formatMoney(daily.trips > 0 ? daily.totalProfit / daily.trips : 0), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Personal Travel Analytics' });

    if (daily.bestItem) {
        embed.addFields({ name: '🌟 Best Item', value: daily.bestItem, inline: true });
    }
    if (daily.bestCountry) {
        embed.addFields({ name: '🌍 Best Country', value: daily.bestCountry, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleHistory(interaction) {
    const limit = interaction.options.getInteger('limit') || 5;
    const status = getStatus();
    const history = status.lastTrades.slice(0, limit);

    if (history.length === 0) {
        await interaction.reply('📭 No trade history found.');
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`📦 Recent Trade History (Last ${history.length})`)
        .setTimestamp();

    const fields = history.map(entry => {
        const typeEmoji = entry.type === 'BUY' ? '💸' : '💰';
        const profitStr = entry.profit ? `\n📈 Profit: **${formatMoney(entry.profit)}**` : '';
        const timeStr = `<t:${entry.ts}:R>`;

        return {
            name: `${typeEmoji} ${entry.type} ${entry.item}`,
            value: `Qty: ${entry.qty} • Price: ${formatMoney(entry.price)} • ${formatMoney(entry.total)}\n📍 ${entry.country} • ${timeStr}${profitStr}`
        };
    });

    embed.addFields(fields);

    await interaction.reply({ embeds: [embed] });
}

async function handleReset(interaction) {
    resetDailyStatsManual();
    await interaction.reply('🔄 Daily travel stats have been reset.');
}
