/**
 * Work Performance Handler for Auto-Run
 * Analyzes job efficiency and provides recommendations
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats, get } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';

export async function workPerformanceHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // 1. Fetch Job & Stats
        const data = await getCombinedStats(user.apiKey, 'job,personalstats');

        if (!data.job) return null;

        const job = data.job;
        const companyId = job.company_id;

        // 2. Fetch Company Rating for JP Rate
        // If companyId is 0 (unemployed/starter), handle gracefully
        let companyRating = 0;
        let jpRate = 0;

        if (companyId) {
            const companyRes = await get(user.apiKey, 'company', 'profile', { id: companyId });
            if (companyRes.company) {
                // Torn Company Rating (0-10) = Daily Job Points for 10* companies?
                // Actually: 1 star = 1 JP/day per employee? 
                // Wiki: "Employees receive 1 job point for every star the company has reached."
                // So Rating (rounded) = JP/Day.
                companyRating = Math.floor(companyRes.company.rating || 0);
                jpRate = companyRating;
            }
        }

        // 3. Trends (Stub - requires snapshots)
        // For now, we compare against "ideal"
        const isOptimal = jpRate >= 7; // Arbitrary threshold for "good" company

        // Recommendations
        let recommendation = '';
        if (jpRate === 0) {
            recommendation = '❌ You are not earning Job Points. Find a job!';
        } else if (jpRate < 3) {
            recommendation = '⚠️ Low JP income. Consider finding a higher rated company.';
        } else if (jpRate < 7) {
            recommendation = '✔ Decent income. Look for 7*+ companies for better perks.';
        } else {
            recommendation = '🚀 Excellent JP income. Stay and farm points!';
        }

        // 4. Activity
        // Use personalstats to show total work stats?
        const manualLabor = data.personalstats?.manual_labor || 0;
        // 'user_activity' isn't exposed directly as 'attendance'.

        const embed = new EmbedBuilder()
            .setColor(isOptimal ? 0x2ECC71 : 0xE67E22)
            .setTitle('📈 Work Performance')
            .addFields(
                { name: 'Job Points Rate', value: `${jpRate} / day`, inline: true },
                { name: 'Company Rating', value: `${companyRating} ⭐`, inline: true },
                { name: 'Promotion Ready', value: '❓ Check Panel', inline: true }, // Logic too complex for API only

                { name: 'Recommendation', value: `\`\`\`${recommendation}\`\`\``, inline: false },

                { name: 'Career Stats', value: `Total Manual Labor: ${manualLabor}`, inline: false }
            )
            .setFooter({ text: 'Update every 60m' })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Work Performance Handler Error:', error.message);
        return null;
    }
}
