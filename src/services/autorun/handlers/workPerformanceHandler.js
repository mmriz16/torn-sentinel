/**
 * Work Performance Handler for Auto-Run
 * Analyzes job efficiency and provides recommendations
 */

import { EmbedBuilder } from 'discord.js';
import { getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { getUi } from '../../../localization/index.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';
import { formatTimeShort } from '../../../utils/formatters.js';


export async function workPerformanceHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // v2 for job data (rating, days_in_company only available in v2)
        const jobData = await getV2(user.apiKey, 'user?selections=job');

        if (!jobData.job) return null;

        const job = jobData.job;

        // Company rating = JP per day
        let companyRating = job.rating || 0;
        let jpRate = companyRating;

        // 3. Determine if optimal
        const isOptimal = jpRate >= 7;

        // Recommendations based on rating
        let recommendation = '';
        if (jpRate === 0) {
            recommendation = getUi('rec_no_jp');
        } else if (jpRate < 3) {
            recommendation = getUi('rec_low_jp');
        } else if (jpRate < 7) {
            recommendation = getUi('rec_decent_jp');
        } else if (jpRate < 10) {
            recommendation = getUi('rec_high_jp');
        } else {
            recommendation = getUi('rec_max_jp');
        }

        const embed = new EmbedBuilder()
            .setColor(isOptimal ? 0x2ECC71 : 0xE67E22)
            .setTitle(`📈 ${getUi('work_performance')}`)
            .addFields(
                { name: 'Job Points Rate', value: `${jpRate} / ${getUi('days')}`, inline: true },
                { name: getUi('rating'), value: `${companyRating} ⭐`, inline: true },
                { name: getUi('position'), value: `${job.position || 'Unknown'}`, inline: true },

                { name: getUi('company'), value: `${job.name}`, inline: true },
                { name: getUi('tenure'), value: `${job.days_in_company || 0} ${getUi('days')}`, inline: true },
                { name: getUi('promotion_ready'), value: `❓ ${getUi('check_panel')}`, inline: true },

                { name: getUi('recommendation'), value: `\`\`\`${recommendation}\`\`\``, inline: false }
            )
        const interval = formatTimeShort(AUTO_RUNNERS.workPerformance.interval);
        embed.setFooter({ text: `Update every ${interval}` })

            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Work Performance Handler Error:', error.message);
        return null;
    }
}
