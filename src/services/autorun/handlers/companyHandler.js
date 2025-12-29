/**
 * Company Handler for Auto-Run
 * Builds company info embed
 */

import { EmbedBuilder } from 'discord.js';
import { get } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatNumber } from '../../../utils/formatters.js';

/**
 * Company handler - fetches company data and returns embed
 */
export async function companyHandler(client) {
    try {
        const users = getAllUsers();
        const userId = Object.keys(users)[0];

        if (!userId) return null;

        const user = users[userId];
        const data = await get(user.apiKey, 'user', 'jobpoints,workstats');

        return buildCompanyEmbed(data);

    } catch (error) {
        console.error('❌ Company handler error:', error.message);
        return null;
    }
}

/**
 * Build company embed
 */
function buildCompanyEmbed(data) {
    const embed = new EmbedBuilder()
        .setColor(0x607D8B)
        .setTitle('🏢｜Company Info')
        .setDescription('────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Auto-Run (10 min)' });

    // Work stats
    embed.addFields({
        name: '📊｜Work Stats',
        value: `\`\`\`\n` +
            `Manual: ${formatNumber(data.manual_labor || 0)}\n` +
            `Intel:  ${formatNumber(data.intelligence || 0)}\n` +
            `Endur:  ${formatNumber(data.endurance || 0)}\n` +
            `\`\`\``,
        inline: true
    });

    // Job points
    const jobPoints = data.jobpoints || {};
    const pointsList = Object.entries(jobPoints)
        .map(([company, points]) => `${company}: ${points}`)
        .join('\n') || 'None';

    embed.addFields({
        name: '💼｜Job Points',
        value: `\`\`\`${pointsList}\`\`\``,
        inline: true
    });

    return embed;
}
