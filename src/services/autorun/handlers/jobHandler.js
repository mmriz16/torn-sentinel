/**
 * Job Overview Handler for Auto-Run
 * Displays user's job statistics and progression
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats, getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatNumber, formatTimeShort } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';


export async function jobHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Fetch in parallel:
        // - v2 for job (rating, days_in_company only available in v2)
        // - v1 for jobpoints and perks
        const [v2JobData, v1Data] = await Promise.all([
            getV2(user.apiKey, 'user?selections=job'),
            getCombinedStats(user.apiKey, 'jobpoints,perks')
        ]);

        const job = v2JobData.job || {};
        const companyPoints = v1Data.jobpoints?.companies || {};
        const jobPerks = v1Data.job_perks || [];

        if (!job.id) return null; // Not employed

        // Current company JP - companies is keyed by company TYPE (type_id), not company ID!
        const companyJP = companyPoints[job.type_id];
        const currentCompanyJP = companyJP?.jobpoints || 0;

        // Active Perks List
        const activePerksList = jobPerks.length > 0
            ? jobPerks.slice(0, 8).map(p => `• ${p}`).join('\n')
            : `• ${getUi('none_active')}`;

        // Next Perk (Placeholder)
        const nextPerkText = `• ${getUi('check_panel')}`;

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`📄 ${getUi('job_overview')}`)
            .addFields(
                { name: getUi('position'), value: `${job.position || 'Unknown'}`, inline: true },
                { name: getUi('company'), value: `${job.name || 'Unknown'}`, inline: true },
                { name: getUi('rating'), value: `⭐ ${job.rating || 0}`, inline: true },

                { name: getUi('company_jp'), value: `\`\`\`${formatNumber(currentCompanyJP)}\`\`\``, inline: true },
                { name: getUi('tenure'), value: `\`\`\`${job.days_in_company || 0} ${getUi('days')}\`\`\``, inline: true },
                { name: getUi('jp_per_day'), value: `\`\`\`${job.rating || 0}\`\`\``, inline: true },

                { name: getUi('active_perks'), value: activePerksList, inline: false },

                { name: getUi('next_perk'), value: nextPerkText, inline: false }
            )
        const interval = formatTimeShort(AUTO_RUNNERS.jobOverview.interval);
        embed.setFooter({ text: `Update every ${interval}` })

            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Job Handler Error:', error.message);
        return null;
    }
}
