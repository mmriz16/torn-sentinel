/**
 * Item Market Listings Handler
 * Displays user's active item market listings with pricing and value tracking
 */

import { EmbedBuilder } from 'discord.js';
import { get, getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';

// Cache for items data (24h refresh)
let itemsCache = null;
let itemsCacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function getItemsCache(apiKey) {
    const now = Date.now();
    if (itemsCache && (now - itemsCacheTime) < CACHE_DURATION) return itemsCache;
    const data = await get(apiKey, 'torn', 'items');
    itemsCache = data.items;
    itemsCacheTime = now;
    return itemsCache;
}

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
        const totalValue = listings.reduce((sum, listing) => sum + (listing.price * listing.amount), 0);
        const totalItems = listings.reduce((sum, listing) => sum + listing.amount, 0);

        // Group by item name for better display
        const grouped = {};
        for (const listing of listings) {
            // Get item data from listing (V2 API includes item object)
            const itemId = listing.item?.id || listing.id;
            const itemName = listing.item?.name || `Item #${itemId}`;

            if (!grouped[itemName]) {
                grouped[itemName] = {
                    name: itemName,
                    itemId: itemId,
                    totalQty: 0,
                    totalValue: 0,
                    listings: []
                };
            }
            grouped[itemName].totalQty += listing.amount;
            grouped[itemName].totalValue += listing.price * listing.amount;
            grouped[itemName].listings.push(listing);
        }

        // Sort by total value (highest first)
        const sortedItems = Object.values(grouped)
            .sort((a, b) => b.totalValue - a.totalValue);

        // Build listing table (max 15 items, use fixed width like foreign market)
        const displayItems = sortedItems.slice(0, 15);

        // Fixed column widths (similar to foreign market)
        const nameWidth = 25;
        const qtyWidth = 8;
        const priceWidth = 12;

        // Build table header
        const header = 'Nama Item'.padEnd(nameWidth) + 'Stock'.padStart(qtyWidth) + 'Harga'.padStart(priceWidth);
        const separator = '─'.repeat(nameWidth + qtyWidth + priceWidth);

        // Build table rows
        const rows = displayItems.map(item => {
            // Truncate name if too long
            let name = item.name;
            if (name.length > nameWidth - 1) {
                name = name.substring(0, nameWidth - 3) + '..';
            }
            const namePadded = name.padEnd(nameWidth);

            // Format quantity
            const qty = item.totalQty >= 1000
                ? (item.totalQty / 1000).toFixed(1) + 'k'
                : String(item.totalQty);
            const qtyPadded = qty.padStart(qtyWidth);

            // Format price
            const avgPrice = Math.round(item.totalValue / item.totalQty);
            const pricePadded = formatMoney(avgPrice).padStart(priceWidth);

            return namePadded + qtyPadded + pricePadded;
        });

        const tableText = [header, separator, ...rows].join('\n');
        const moreItems = sortedItems.length > 15 ? `\n... and ${sortedItems.length - 15} more items` : '';

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // Green - active
            .setTitle('🏪 Item Market Listings')
            .addFields(
                { name: 'Active Listings', value: `\`\`\`${listings.length} listings\`\`\``, inline: true },
                { name: 'Total Items', value: `\`\`\`${totalItems.toLocaleString()}\`\`\``, inline: true },
                { name: 'Total Value', value: `\`\`\`${formatMoney(totalValue)}\`\`\``, inline: true },
                { name: '📦 Items', value: `\`\`\`\n${tableText}\`\`\`${moreItems}`, inline: false }
            )
            .setFooter({ text: 'Torn Sentinel • Auto update every 5min' })
            .setTimestamp();

        return embed;

    } catch (error) {
        console.error('❌ Item Market Handler Error:', error.message);
        return null;
    }
}
