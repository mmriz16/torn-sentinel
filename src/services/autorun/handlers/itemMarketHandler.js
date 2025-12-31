/**
 * Item Market Listings Handler
 * Displays user's active item market listings with pricing and value tracking
 */

import { EmbedBuilder } from 'discord.js';
import { getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';

export async function itemMarketHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Fetch item market listings
        const data = await getV2(user.apiKey, 'user?selections=itemmarket');
        if (!data || !data.itemmarket) return null;

        const listings = Array.isArray(data.itemmarket) ? data.itemmarket : [];

        if (listings.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x95A5A6)
                .setTitle('🏪 Item Market Listings')
                .setDescription('```No active listings```')
                .setFooter({ text: 'Torn Sentinel • Auto update every 5min' })
                .setTimestamp();
            return embed;
        }

        // Calculate totals
        const totalValue = listings.reduce((sum, item) => sum + (item.price * item.amount), 0);
        const totalItems = listings.reduce((sum, item) => sum + item.amount, 0);

        // Group by item name for better display
        const grouped = {};
        for (const listing of listings) {
            const key = listing.name || `Item #${listing.ID}`;
            if (!grouped[key]) {
                grouped[key] = {
                    name: key,
                    totalQty: 0,
                    totalValue: 0,
                    listings: []
                };
            }
            grouped[key].totalQty += listing.amount;
            grouped[key].totalValue += listing.price * listing.amount;
            grouped[key].listings.push(listing);
        }

        // Sort by total value (highest first)
        const sortedItems = Object.values(grouped)
            .sort((a, b) => b.totalValue - a.totalValue);

        // Build listing text (max 10 items to avoid hitting embed limits)
        const listingText = sortedItems.slice(0, 10).map(item => {
            const avgPrice = Math.round(item.totalValue / item.totalQty);
            return `• **${item.name}** x${item.totalQty} @ ${formatMoney(avgPrice)} = \`${formatMoney(item.totalValue)}\``;
        }).join('\n');

        const moreItems = sortedItems.length > 10 ? `\n... and ${sortedItems.length - 10} more items` : '';

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // Green - active
            .setTitle('🏪 Item Market Listings')
            .addFields(
                { name: 'Active Listings', value: `\`\`\`${listings.length} listings\`\`\``, inline: true },
                { name: 'Total Items', value: `\`\`\`${totalItems.toLocaleString()}\`\`\``, inline: true },
                { name: 'Total Value', value: `\`\`\`${formatMoney(totalValue)}\`\`\``, inline: true },
                { name: '📦 Items', value: listingText + moreItems, inline: false }
            )
            .setFooter({ text: 'Torn Sentinel • Auto update every 5min' })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Item Market Handler Error:', error.message);
        return null;
    }
}
