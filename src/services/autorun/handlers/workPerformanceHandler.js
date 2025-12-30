/**
 * Work Performance Handler for Auto-Run
 * Analyzes job efficiency and provides recommendations
 */

import { EmbedBuilder } from 'discord.js';
import { getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';

export async function workPerformanceHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // 1. Fetch Job data (V2 API with selections)
        const jobData = await getV2(user.apiKey, 'user?selections=job');

        if (!jobData.job) return null;

        const job = jobData.job;
        const companyId = job.id;

        // 2. Fetch Company details for more info
        let companyRating = job.rating || 0;
        let jpRate = companyRating; // Company rating = JP per day

        // 3. Determine if optimal
        const isOptimal = jpRate >= 7;

        // Recommendations based on rating
        let recommendation = '';
        if (jpRate === 0) {
            recommendation = '❌ You are not earning Job Points. Find a job!';
        } else if (jpRate < 3) {
            recommendation = '⚠️ Low JP income. Consider finding a higher rated company.';
        } else if (jpRate < 7) {
            recommendation = '✔ Decent income. Look for 7*+ companies for better perks.';
        } else if (jpRate < 10) {
            recommendation = '🚀 Excellent JP income. Stay and farm points!';
        } else {
            recommendation = '🏆 Maximum JP rate! Perfect company!';
        }

        const embed = new EmbedBuilder()
            .setColor(isOptimal ? 0x2ECC71 : 0xE67E22)
            .setTitle('📈 Work Performance')
            .addFields(
                { name: 'Job Points Rate', value: `${jpRate} / day`, inline: true },
                { name: 'Company Rating', value: `${companyRating} ⭐`, inline: true },
                { name: 'Position', value: `${job.position || 'Unknown'}`, inline: true },

                { name: 'Company', value: `${job.name}`, inline: true },
                { name: 'Tenure', value: `${job.days_in_company || 0} days`, inline: true },
                { name: 'Promotion Ready', value: '❓ Check Panel', inline: true },

                { name: 'Recommendation', value: `\`\`\`${recommendation}\`\`\``, inline: false }
            )
            .setFooter({ text: 'Update every 60m' })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Work Performance Handler Error:', error.message);
        return null;
    }
}
