/**
 * Company Info Handler for Auto-Run
 * Displays snapshot of the company the user works for
 */

import { EmbedBuilder } from 'discord.js';
import { get, getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney, formatTimeShort } from '../../../utils/formatters.js';
import { getUi, applyTemplate } from '../../../localization/index.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';


export async function companyHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // 1. Get User Job to find Company ID (v1 API - profile contains job info)
        const jobData = await get(user.apiKey, 'user', 'profile');
        const job = jobData.job || {};
        if (!job.company_id) return null; // Not employed at a company

        const companyId = job.company_id;

        // 2. Get Company Profile (V2 API - direct endpoint)
        const companyRes = await getV2(user.apiKey, `company/${companyId}`);
        if (!companyRes.company) return null;

        const c = companyRes.company;

        // Get company type name from type ID
        const companyTypes = {
            1: 'Hair Salon', 2: 'Law Firm', 3: 'Flower Shop', 4: 'Car Dealership',
            5: 'Clothing Store', 6: 'Gun Shop', 7: 'Gym', 8: 'Candle Shop',
            9: 'Toy Shop', 10: 'Adult Novelties', 11: 'Lingerie Store', 12: 'Grocery Store',
            13: 'Game Shop', 14: 'Jewellery Store', 15: 'Sweet Shop', 16: 'Music Store',
            17: 'Furniture Store', 18: 'Farm', 19: 'Restaurant', 20: 'Property Broker',
            21: 'Amusement Park', 22: 'Zoo', 23: 'Movie Theatre', 24: 'Cruise Line',
            25: 'Television Network', 26: 'Mining Corporation', 27: 'Fireworks Stand',
            28: 'Meat Warehouse', 29: 'Pub', 30: 'Cake Shop', 31: 'Print Shop',
            32: 'Theatre', 33: 'Detective Agency', 34: 'Logistics', 35: 'Oil Rig'
        };
        const companyTypeName = companyTypes[c.company_type] || `Type ${c.company_type}`;

        // Display Income
        const dailyIncome = c.daily_income ? formatMoney(c.daily_income) : 'N/A';
        const weeklyIncome = c.weekly_income ? formatMoney(c.weekly_income) : 'N/A';

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🏢 ${getUi('company_overview')}`)
            .addFields(
                { name: 'Nama', value: `${c.name}`, inline: true },
                { name: getUi('type'), value: `${companyTypeName}`, inline: true },
                { name: getUi('rating'), value: `⭐ ${c.rating || 0}`, inline: true },

                { name: getUi('employees'), value: `${c.employees_hired} / ${c.employees_capacity}`, inline: true },
                { name: getUi('days_old'), value: `${c.days_old} ${getUi('days')}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },

                { name: getUi('daily_income'), value: `\`\`\`${dailyIncome}\`\`\``, inline: true },
                { name: getUi('weekly_income'), value: `\`\`\`${weeklyIncome}\`\`\``, inline: true },
                { name: getUi('daily_customers'), value: `\`\`\`${c.daily_customers?.toLocaleString() || 'N/A'}\`\`\``, inline: true }
            )
        const interval = formatTimeShort(AUTO_RUNNERS.companyInfo.interval);
        embed.setFooter({ text: `${applyTemplate('update_every_xm', { m: interval })} • ID: ${companyId}` })
            .setTimestamp();


        return embed;

    } catch (error) {
        console.error('❌ Company Handler Error:', error.message);
        return null;
    }
}
