/**
 * /work Command
 * Display working stats with auto-refresh
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { get, getV2 } from '../services/tornApi.js';
import { getUser } from '../services/userStorage.js';
import { REFRESH_INTERVALS } from '../utils/constants.js';
import { formatNumber } from '../utils/formatters.js';
import { getUi, getStat, fromDictionary } from '../localization/index.js';

// Company type names by ID
const COMPANY_TYPES = {
    1: 'Hair Salon',
    2: 'Law Firm',
    3: 'Flower Shop',
    4: 'Car Dealership',
    5: 'Clothing Store',
    6: 'Gun Shop',
    7: 'Game Shop',
    8: 'Candle Shop',
    9: 'Toy Shop',
    10: 'Adult Novelties',
    11: 'Cyber Cafe',
    12: 'Grocery Store',
    13: 'Theater',
    14: 'Sweet Shop',
    15: 'Cruise Line',
    16: 'Television Network',
    17: 'Zoo',
    18: 'Firework Stand',
    19: 'Property Broker',
    20: 'Furniture Store',
    21: 'Gas Station',
    22: 'Music Store',
    23: 'Nightclub',
    24: 'Pub',
    25: 'Gents Strip Club',
    26: 'Restaurant',
    27: 'Oil Rig',
    28: 'Fitness Center',
    29: 'Mechanic Shop',
    30: 'Amusement Park',
    31: 'Lingerie Store',
    32: 'Meat Warehouse',
    33: 'Farm',
    34: 'Software Corporation',
    35: 'Ladies Strip Club',
    36: 'Private Security Firm',
    37: 'Mining Corporation',
    38: 'Detective Agency',
    39: 'Logistics Management',
    40: 'Resort'
};

export const data = new SlashCommandBuilder()
    .setName('work')
    .setDescription('View your working stats with auto-refresh');

export async function execute(interaction, client) {
    const user = getUser(interaction.user.id);

    if (!user || !user.apiKey) {
        await interaction.reply({
            content: '⚠️ You need to configure your API Key in `.env` file first!',
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    // Stop any existing refresh interval for this user
    const intervalKey = `work:${interaction.user.id}`;
    if (client.activeIntervals.has(intervalKey)) {
        clearInterval(client.activeIntervals.get(intervalKey));
        client.activeIntervals.delete(intervalKey);
    }

    // Send initial message
    const message = await sendWorkEmbed(interaction, user.apiKey, user.tornId, null);

    if (!message) return;

    // Set up auto-refresh interval (60 seconds)
    const interval = setInterval(async () => {
        try {
            await sendWorkEmbed(interaction, user.apiKey, user.tornId, message);
        } catch (error) {
            console.error('Work refresh error:', error);
        }
    }, REFRESH_INTERVALS.WALLET); // 60 seconds

    // Store interval reference for cleanup
    client.activeIntervals.set(intervalKey, interval);
}

/**
 * Send or update work embed
 */
async function sendWorkEmbed(interaction, apiKey, tornId, existingMessage) {
    try {
        // Fetch from API v1 (company) and v2 (workstats, jobpoints)
        const [companyData, workstatsData, jobpointsData] = await Promise.all([
            get(apiKey, 'company', 'employees,profile'),
            getV2(apiKey, 'user/workstats'),
            getV2(apiKey, 'user/jobpoints')
        ]);

        const embed = buildWorkEmbed(companyData, workstatsData, jobpointsData, tornId);

        if (existingMessage) {
            await existingMessage.edit({ embeds: [embed] });
            return existingMessage;
        } else {
            return await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Work fetch error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Failed to fetch work data')
            .setDescription(error.userMessage || error.message)
            .setTimestamp();

        if (existingMessage) {
            await existingMessage.edit({ embeds: [errorEmbed] });
            return existingMessage;
        } else {
            await interaction.editReply({ embeds: [errorEmbed] });
            return null;
        }
    }
}

/**
 * Helper to capitalize first letter
 */
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Create star rating display (out of 5 stars)
 * Torn rating is 1-10, we convert to 5 stars
 */
function createStarRating(rating) {
    const stars = Math.round(rating / 2); // Convert 10-scale to 5-scale
    const filled = '⭐'.repeat(stars);
    const empty = '☆'.repeat(5 - stars);
    return filled + empty;
}

/**
 * Build the work embed
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

    // Job points for current company
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
        .setFooter({ text: 'Torn Sentinel • Auto refresh every 60 seconds' });

    // Total Stats (full width)
    embed.addFields({
        name: `📊｜${totName}`,
        value: `\`\`\`${formatNumber(totalStats)}\`\`\``,
        inline: false
    });

    // Row 1: Intelligence | Endurance | Manual Labor (3 columns)
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

    // Company (full width)
    embed.addFields({
        name: `🏢｜${getUi('company')}`,
        value: `\`\`\`${companyName}\`\`\``,
        inline: false
    });

    // Row 2: Type | Position | Days (3 columns)
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

    // Row 3: Wage | Rating | Job Points (3 columns)
    embed.addFields({
        name: `💵｜${getUi('wage')}`,
        value: `\`\`\`$${formatNumber(wage)}/${getUi('days').toLowerCase().replace(/s$/, '')}\`\`\``,
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
