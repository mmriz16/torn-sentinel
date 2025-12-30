/**
 * Job Overview Handler for Auto-Run
 * Displays user's job statistics and progression
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatNumber } from '../../../utils/formatters.js';

export async function jobHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Fetch Job, JobPoints (sometimes redundant), Perks
        const data = await getCombinedStats(user.apiKey, 'job,perks');

        if (!data.job) return null;

        const job = data.job;
        const jobPerks = data.job_perks || []; // Array of strings? or objects?
        // API 'perks' selection returns: { job_perks: ["+5% Strength", ...], ... } usually strings.

        // Stats
        const position = job.position;
        const companyName = job.company_name;
        const jobPoints = job.jobpoints || 0;
        const tenure = job.days_in_company || 0;

        // Active Perks List
        // Limit to 5-10 to avoid huge embed
        const activePerksList = jobPerks.length > 0
            ? jobPerks.slice(0, 8).map(p => `• ${p}`).join('\n')
            : '• None active';

        // Next Perk (Placeholder as we lack the full tree data)
        // Ideally we'd look up company_type -> position -> next_promotion or next_special
        const nextPerkText = '• Check Company Panel for next unlock';

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('📄 Job Overview')
            .addFields(
                { name: 'Position', value: `${position}`, inline: true },
                { name: 'Company', value: `${companyName}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: false },

                { name: 'Job Points', value: `\`\`\`${formatNumber(jobPoints)}\`\`\``, inline: true },
                { name: 'Tenure', value: `\`\`\`${formatNumber(tenure)} days\`\`\``, inline: true },

                { name: 'Active Perks', value: activePerksList, inline: false },

                { name: 'Next Perk', value: nextPerkText, inline: false }
            )
            .setFooter({ text: 'Update every 15m' })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Job Handler Error:', error.message);
        return null;
    }
}
