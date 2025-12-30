/**
 * Job Overview Handler for Auto-Run
 * Displays user's job statistics and progression
 */

import { EmbedBuilder } from 'discord.js';
import { getV2, getCombinedStats } from '../../tornApi.js';
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

        // Fetch Job data (V2 API with selections)
        const jobData = await getV2(user.apiKey, 'user?selections=job');

        if (!jobData.job) return null;

        const job = jobData.job;

        // Fetch Job Points (V2 API with selections)
        const jpData = await getV2(user.apiKey, 'user?selections=jobpoints').catch(() => ({ jobpoints: {} }));

        // Calculate total job points from all sources
        const jobPoints = jpData.jobpoints?.jobs || {};
        const companyPoints = jpData.jobpoints?.companies || [];

        // Current company JP
        const currentCompanyJP = companyPoints.find(c => c.company?.id === job.type_id)?.points || 0;

        // Perks from V1 API (still works!)
        const perksData = await getCombinedStats(user.apiKey, 'perks').catch(() => ({ job_perks: [] }));
        const jobPerks = perksData.job_perks || [];

        // Active Perks List
        const activePerksList = jobPerks.length > 0
            ? jobPerks.slice(0, 8).map(p => `• ${p}`).join('\n')
            : '• None active';

        // Next Perk (Placeholder)
        const nextPerkText = '• Check Company Panel for next unlock';

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('📄 Job Overview')
            .addFields(
                { name: 'Position', value: `${job.position || 'Unknown'}`, inline: true },
                { name: 'Company', value: `${job.name || 'Unknown'}`, inline: true },
                { name: 'Rating', value: `⭐ ${job.rating || 0}`, inline: true },

                { name: 'Company JP', value: `\`\`\`${formatNumber(currentCompanyJP)}\`\`\``, inline: true },
                { name: 'Tenure', value: `\`\`\`${job.days_in_company || 0} days\`\`\``, inline: true },
                { name: 'JP/Day', value: `\`\`\`${job.rating || 0}\`\`\``, inline: true },

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
