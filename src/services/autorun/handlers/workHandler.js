/**
 * Work Handler for Auto-Run
 * Builds work stats embed - MATCHES /work command exactly
 */

import { EmbedBuilder } from 'discord.js';
import { get } from '../../tornApi.js';
import { getAllUsers, getUser } from '../../userStorage.js';
import { formatNumber, formatTimeShort } from '../../../utils/formatters.js';
import { getUi, getStat, fromDictionary } from '../../../localization/index.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';


// Company type names by ID (same as /work command)
const COMPANY_TYPES = {
    1: 'Hair Salon', 2: 'Law Firm', 3: 'Flower Shop', 4: 'Car Dealership',
    5: 'Clothing Store', 6: 'Gun Shop', 7: 'Game Shop', 8: 'Candle Shop',
    9: 'Toy Shop', 10: 'Adult Novelties', 11: 'Cyber Cafe', 12: 'Grocery Store',
    13: 'Theater', 14: 'Sweet Shop', 15: 'Cruise Line', 16: 'Television Network',
    17: 'Zoo', 18: 'Firework Stand', 19: 'Property Broker', 20: 'Furniture Store',
    21: 'Gas Station', 22: 'Music Store', 23: 'Nightclub', 24: 'Pub',
    25: 'Gents Strip Club', 26: 'Restaurant', 27: 'Oil Rig', 28: 'Fitness Center',
    29: 'Mechanic Shop', 30: 'Amusement Park', 31: 'Lingerie Store', 32: 'Meat Warehouse',
    33: 'Farm', 34: 'Software Corporation', 35: 'Ladies Strip Club', 36: 'Private Security Firm',
    37: 'Mining Corporation', 38: 'Detective Agency', 39: 'Logistics Management', 40: 'Resort'
};

/**
 * Helper to capitalize first letter
 */
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Create star rating display (out of 5 stars)
 */
function createStarRating(rating) {
    const stars = Math.round(rating / 2);
    const filled = '⭐'.repeat(stars);
    const empty = '☆'.repeat(5 - stars);
    return filled + empty;
}

/**
 * Work handler - fetches data and returns embed
 */
export async function workHandler(client) {
    try {
        const users = getAllUsers();
        const discordUserId = Object.keys(users)[0];
        if (!discordUserId) return null;

        const user = users[discordUserId];
        const tornId = user.tornId;

        // OPTIMIZED: Reduced from 3 calls to 2
        // - Company data (v1) - separate endpoint
        // - User data (v1) - workstats + jobpoints combined
        const [companyData, userData] = await Promise.all([
            get(user.apiKey, 'company', 'employees,profile'),
            get(user.apiKey, 'user', 'workstats,jobpoints')
        ]);

        // Map v1 response structure to expected format
        // v1 returns workstats fields at root level: manual_labor, intelligence, endurance
        const workstatsData = {
            workstats: {
                manual_labor: userData.manual_labor || 0,
                intelligence: userData.intelligence || 0,
                endurance: userData.endurance || 0,
                total: (userData.manual_labor || 0) + (userData.intelligence || 0) + (userData.endurance || 0)
            }
        };
        const jobpointsData = { jobpoints: userData.jobpoints || {} };

        return buildWorkEmbed(companyData, workstatsData, jobpointsData, tornId);
    } catch (error) {
        console.error('❌ Work handler error:', error.message);
        return null;
    }
}

/**
 * Build work embed - EXACT COPY from /work command
 */
function buildWorkEmbed(companyData, workstatsData, jobpointsData, tornId) {
    const company = companyData.company || {};
    const employees = companyData.company_employees || {};
    const workstats = workstatsData.workstats || {};
    const jobpoints = jobpointsData.jobpoints || {};

    // Find current user in employees
    const myEmployee = employees[tornId] || Object.values(employees).find(e => e.name);

    // Company info
    const companyName = company.name || 'None';
    const companyType = COMPANY_TYPES[company.company_type] || 'Unknown';
    const companyRating = company.rating || 0;
    const position = myEmployee?.position || 'Unknown';
    const daysInCompany = myEmployee?.days_in_company || 0;
    const wage = myEmployee?.wage || 0;

    // Job points
    const companyPoints = jobpoints.companies?.[0]?.points || 0;

    // Work stats
    const manualLabor = workstats.manual_labor || 0;
    const intelligence = workstats.intelligence || 0;
    const endurance = workstats.endurance || 0;
    const totalStats = workstats.total || 0;

    // Localized Headers (Dictionary lookup)
    const workingStatsTitle = fromDictionary('company', 'working_stats') || 'Working Stats'; // "Statistik Kerja"
    const jobPointsLabel = fromDictionary('company', 'job_points') || 'Job Points'; // "Poin Kerja"

    // Localized Stats names
    const intName = capitalize(getStat('intelligence'));
    const endName = capitalize(getStat('endurance'));
    const manName = capitalize(getStat('manual_labor'));
    const totName = capitalize(getUi('total_stats'));

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF)
        .setTitle(`💼｜${capitalize(workingStatsTitle)}`)
        .setDescription('─────────────────────────────────────────────────')
        .setTimestamp()
        .setTimestamp();
    const interval = formatTimeShort(AUTO_RUNNERS.work.interval);
    embed.setFooter({ text: `Torn Sentinel • Auto refresh every ${interval}` });


    // Total Stats
    embed.addFields({
        name: `📊｜${totName}`,
        value: `\`\`\`${formatNumber(totalStats)}\`\`\``,
        inline: false
    });

    // Row 1: Intelligence | Endurance | Manual Labor
    embed.addFields({
        name: `🧠｜${intName}`,
        value: `\`\`\`${formatNumber(intelligence)}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: `💪｜${endName}`,
        value: `\`\`\`${formatNumber(endurance)}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: `🔧｜${manName}`,
        value: `\`\`\`${formatNumber(manualLabor)}\`\`\``,
        inline: true
    });

    // Company
    embed.addFields({
        name: `🏢｜${getUi('company')}`,
        value: `\`\`\`${companyName}\`\`\``,
        inline: false
    });

    // Row 2: Type | Position | Days
    embed.addFields({
        name: `🏭｜${getUi('company_type')}`,
        value: `\`\`\`${companyType}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: `👷｜${getUi('position')}`,
        value: `\`\`\`${position}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: `📅｜${getUi('days')}`,
        value: `\`\`\`${daysInCompany}\`\`\``,
        inline: true
    });

    // Row 3: Wage | Rating | Job Points
    embed.addFields({
        name: `💵｜${getUi('wage')}`,
        value: `\`\`\`$${formatNumber(wage)}/${getUi('days').toLowerCase().replace(/s$/, '')}\`\`\``, // simplistic day logic
        inline: true
    });

    embed.addFields({
        name: `⭐｜${getUi('rating')}`,
        value: `\`\`\`${createStarRating(companyRating)}\`\`\``,
        inline: true
    });

    embed.addFields({
        name: `💰｜${capitalize(jobPointsLabel)}`,
        value: `\`\`\`${formatNumber(companyPoints)}\`\`\``,
        inline: true
    });

    return embed;
}
