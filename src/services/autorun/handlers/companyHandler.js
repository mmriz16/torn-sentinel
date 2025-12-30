/**
 * Company Info Handler for Auto-Run
 * Displays snapshot of the company the user works for
 */

import { EmbedBuilder } from 'discord.js';
import { getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';

export async function companyHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // 1. Get User Job to find Company ID (V2 API with selections)
        const jobData = await getV2(user.apiKey, 'user?selections=job');
        if (!jobData.job || !jobData.job.id) return null;

        const job = jobData.job;
        const companyId = job.id;

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
            .setTitle('🏢 Company Overview')
            .addFields(
                { name: 'Name', value: `${c.name}`, inline: true },
                { name: 'Type', value: `${companyTypeName}`, inline: true },
                { name: 'Rating', value: `⭐ ${c.rating || 0}`, inline: true },

                { name: 'Employees', value: `${c.employees_hired} / ${c.employees_capacity}`, inline: true },
                { name: 'Days Old', value: `${c.days_old} days`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },

                { name: 'Daily Income', value: `\`\`\`${dailyIncome}\`\`\``, inline: true },
                { name: 'Weekly Income', value: `\`\`\`${weeklyIncome}\`\`\``, inline: true },
                { name: 'Daily Customers', value: `\`\`\`${c.daily_customers?.toLocaleString() || 'N/A'}\`\`\``, inline: true }
            )
            .setFooter({ text: `Update every 30m • ID: ${companyId}` })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Company Handler Error:', error.message);
        return null;
    }
}
