/**
 * Company Info Handler for Auto-Run
 * Displays snapshot of the company the user works for
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats, get } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney, formatNumber } from '../../../utils/formatters.js';

export async function companyHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // 1. Get User Job to find Company ID
        const userStats = await getCombinedStats(user.apiKey, 'job');
        if (!userStats.job || !userStats.job.company_id) return null;

        const job = userStats.job;
        const companyId = job.company_id;

        // 2. Get Company Profile
        // 'profile' selection gives basic info
        const companyRes = await get(user.apiKey, 'company', 'profile', { id: companyId });
        if (!companyRes.company) return null;

        const c = companyRes.company;

        // Display Income only if visible (typically requires permissions, but we try)
        const dailyIncome = c.daily_income !== undefined ? formatMoney(c.daily_income) : 'Hidden/N/A';
        const weeklyIncome = c.weekly_income !== undefined ? formatMoney(c.weekly_income) : 'Hidden/N/A';

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🏢 Company Overview')
            .addFields(
                { name: 'Name', value: `${c.name}`, inline: true },
                { name: 'Type', value: `${c.company_type_details?.name || job.company_type}`, inline: true },
                { name: 'Rating', value: `⭐ ${c.rating || 0}`, inline: true },

                { name: 'Director', value: `${c.director?.name || 'Unknown'} [${c.director?.id}]`, inline: false },

                { name: 'Employees', value: `${c.employees_current} / ${c.employees_capacity}`, inline: true },
                { name: 'Popularity', value: `${c.popularity || 0}%`, inline: true },

                { name: 'Efficiency', value: `${c.efficiency || 0}%`, inline: true },
                { name: 'Environment', value: `${c.environment || 0}%`, inline: true },

                { name: '\u200b', value: '\u200b', inline: true }, // Spacer

                { name: 'Daily Income', value: `\`\`\`${dailyIncome}\`\`\``, inline: true },
                { name: 'Weekly Income', value: `\`\`\`${weeklyIncome}\`\`\``, inline: true }
            )
            .setFooter({ text: `Update every 30m • ID: ${companyId}` })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Company Handler Error:', error.message);
        return null; // Registry handles null by skipping update
    }
}
