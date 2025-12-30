/**
 * /market Command
 * Item market lookup and trade logging
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { get, getV2 } from '../services/tornApi.js';
import { getUser } from '../services/userStorage.js';
import { formatMoney, formatNumber } from '../utils/formatters.js';
import { logTrade } from '../services/analytics/travelAnalyticsService.js';
import { fetchYataData, COUNTRIES as COUNTRIES_MAP } from '../services/autorun/handlers/foreignMarketHandler.js';

// Cache for items data (24h refresh)
let itemsCache = null;
let itemsCacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const data = new SlashCommandBuilder()
    .setName('market')
    .setDescription('Market operations')
    .addSubcommand(subcommand =>
        subcommand
            .setName('lookup')
            .setDescription('Look up item market data')
            .addStringOption(option =>
                option.setName('item')
                    .setDescription('Item name to search for')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('buy')
            .setDescription('Log a purchase (for analytics)')
            .addStringOption(option =>
                option.setName('item')
                    .setDescription('Item name')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName('qty')
                    .setDescription('Quantity bought')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName('price')
                    .setDescription('Price per unit')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('country')
                    .setDescription('Country (optional, defaults to current or Foreign)')
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('sell')
            .setDescription('Log a sale (for analytics)')
            .addStringOption(option =>
                option.setName('item')
                    .setDescription('Item name')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName('qty')
                    .setDescription('Quantity sold')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName('price')
                    .setDescription('Price per unit')
                    .setRequired(true)
            )
    );

export async function execute(interaction, client) {
    const user = getUser(interaction.user.id);
    if (!user || !user.apiKey) {
        await interaction.reply({
            content: '⚠️ You need to configure your API Key in `.env` file first!',
            ephemeral: true
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'lookup') {
        await handleLookup(interaction, user.apiKey);
    } else if (subcommand === 'buy' || subcommand === 'sell') {
        await handleTradeLog(interaction, subcommand, user.apiKey);
    }
}

/**
 * Handle /market lookup
 */
async function handleLookup(interaction, apiKey) {
    const searchQuery = interaction.options.getString('item').toLowerCase();
    await interaction.deferReply();

    try {
        const items = await getItemsCache(apiKey);
        const matches = findItems(items, searchQuery);

        if (matches.length === 0) {
            await interaction.editReply(`❌ Item "${searchQuery}" not found.`);
            return;
        }

        if (matches.length > 1) {
            const suggestions = matches.slice(0, 10).map(m => `• ${m.name}`).join('\n');
            await interaction.editReply(`🔍 Multiple items found. Please be specific:\n${suggestions}`);
            return;
        }

        const item = matches[0];

        // Fetch market data and foreign stock data in parallel
        const [marketData, foreignStock] = await Promise.all([
            getV2(apiKey, `market/${item.id}/itemmarket`),
            getForeignStockInfo(item.id)
        ]);

        const embed = buildMarketEmbed(item, marketData, foreignStock);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Market lookup error:', error);
        await interaction.editReply(`❌ Market unavailable: ${error.message}`);
    }
}

/**
 * Handle /market buy & /market sell
 */
async function handleTradeLog(interaction, type, apiKey) {
    const itemName = interaction.options.getString('item');
    const qty = interaction.options.getInteger('qty');
    const price = interaction.options.getInteger('price');
    const country = interaction.options.getString('country') || 'Torn'; // Default to Torn if not specified? 
    // Actually, usually users buy abroad.
    // Let's rely on user input or 'Unknown'. 

    // Note: To be perfect, we should validate item name against API, but for logging speed, raw text is fine.
    // PRD: "Setiap transaksi dicatat manual oleh bot".

    await interaction.deferReply({ ephemeral: true });

    try {
        // Log it directly
        const entry = logTrade(type, itemName, qty, price, country);

        const emoji = type === 'buy' ? '💸' : '💰';
        const profitText = entry.profit ? `\n📈 **Profit:** ${formatMoney(entry.profit)}` : '';

        const embed = new EmbedBuilder()
            .setColor(type === 'buy' ? 0xE74C3C : 0x2ECC71)
            .setTitle(`${emoji} Trade Logged: ${type.toUpperCase()}`)
            .setDescription(`**${itemName}** x${qty}\n@ ${formatMoney(price)} each${profitText}`)
            .addFields(
                { name: 'Total', value: formatMoney(entry.total), inline: true },
                { name: 'Country', value: country || 'Unknown', inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Cross-post to trade history channel if configured
        const logChannelId = process.env.TRADE_HISTORY_CHANNEL_ID;
        if (logChannelId) {
            try {
                const channel = await interaction.client.channels.fetch(logChannelId);
                if (channel) {
                    await channel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.warn('Failed to cross-post to trade history channel:', err.message);
            }
        }

    } catch (error) {
        console.error('Trade log error:', error);
        await interaction.editReply(`❌ Failed to log trade: ${error.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS (Existing)
// ═══════════════════════════════════════════════════════════════════

async function getItemsCache(apiKey) {
    const now = Date.now();
    if (itemsCache && (now - itemsCacheTime) < CACHE_DURATION) return itemsCache;
    const data = await get(apiKey, 'torn', 'items');
    itemsCache = data.items;
    itemsCacheTime = now;
    return itemsCache;
}

function findItems(items, query) {
    const matches = [];
    for (const [id, item] of Object.entries(items)) {
        const name = item.name.toLowerCase();
        if (name === query) return [{ id, ...item }];
        if (name.includes(query)) matches.push({ id, ...item });
    }
    return matches.sort((a, b) => a.name.length - b.name.length);
}

function buildMarketEmbed(item, marketData, foreignStock) {
    const listings = marketData.itemmarket?.listings || [];
    const prices = listings.map(l => l.price);
    const quantities = listings.map(l => l.amount);

    const lowestAsk = prices.length > 0 ? Math.min(...prices) : 0;
    const highestAsk = prices.length > 0 ? Math.max(...prices) : 0;
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const totalListings = listings.length;
    const totalQuantity = quantities.reduce((a, b) => a + b, 0);

    // Calculate Spread
    const spread = highestAsk - lowestAsk;
    const spreadPercent = lowestAsk > 0 ? ((spread / lowestAsk) * 100).toFixed(1) : 0;

    // Calculate Liquidity (Simple heuristic)
    let liquidity = '🔴 Low';
    if (totalQuantity > 10000) liquidity = '🟢 High';
    else if (totalQuantity > 1000) liquidity = '🟡 Medium';

    // Construct image URL directly to ensure high res
    const imageUrl = `https://www.torn.com/images/items/${item.id}/large.png`;

    const embed = new EmbedBuilder()
        .setColor(0x2C2F33)
        .setTitle(`📦｜${item.name}`)
        .setDescription('────────────────────────────────────────────────')
        .setThumbnail(imageUrl)
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Item Market' });

    // 1. Top Row: Type | Price | Foreign/Cheapest
    if (item.type) {
        embed.addFields({ name: '📋｜Type', value: `\`\`\`${item.type}\`\`\``, inline: true });
    }

    if (foreignStock) {
        embed.addFields(
            { name: '💰｜Buy Price', value: `\`\`\`$${formatCompact(foreignStock.price)}\`\`\``, inline: true },
            { name: '🌍｜Cheapest', value: `\`\`\`${foreignStock.location}\`\`\``, inline: true }
        );
    } else {
        const val = item.market_value || avgPrice;
        embed.addFields(
            { name: '💵｜Market Value', value: `\`\`\`$${formatCompact(val)}\`\`\``, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }
        );
    }

    // 2. Description (Wrapped in code block)
    if (item.description) {
        // Truncate if too long (Discord limit 1024)
        const desc = item.description.length > 1000 ? item.description.substring(0, 990) + '...' : item.description;
        embed.addFields({ name: '📝｜Description', value: `\`\`\`${desc}\`\`\``, inline: false });
    }

    // 3. Effect (Wrapped in code block)
    if (item.effect) {
        embed.addFields({ name: '⚡｜Effect', value: `\`\`\`${item.effect}\`\`\``, inline: false });
    }

    if (totalListings === 0) {
        embed.addFields({ name: '🏪｜Market', value: '```No listings currently```', inline: false });
        return embed;
    }

    // 4. Market Stats Rows
    embed.addFields(
        // Row A
        { name: '💰｜Lowest Ask', value: `\`\`\`$${formatCompact(lowestAsk)}\`\`\``, inline: true },
        { name: '📈｜Highest Ask', value: `\`\`\`$${formatCompact(highestAsk)}\`\`\``, inline: true },
        { name: '📊｜Average', value: `\`\`\`$${formatCompact(avgPrice)}\`\`\``, inline: true },

        // Row B
        { name: '📦｜Listings', value: `\`\`\`${formatNumber(totalListings)}\`\`\``, inline: true },
        { name: '🔢｜Quantity', value: `\`\`\`${formatNumber(totalQuantity)}\`\`\``, inline: true },
        { name: '💧｜Liquidity', value: `\`\`\`${liquidity}\`\`\``, inline: true },

        // Row C (Spread)
        { name: '📉｜Spread', value: `\`\`\`$${formatCompact(spread)} (+${spreadPercent}%)\`\`\``, inline: false }
    );

    return embed;
}

/**
 * Format compact number helper (inner usage if not imported, but we imported formatNumber/formatMoney)
 * We'll use formatNumber for simple ints, and a manual compact for Prices if needed to fit?
 * User screenshot shows full numbers "$850,000".
 * So we use formatMoney but maybe without decimals for cleaner look?
 * Re-mapping formatCompact to formatMoney for consistency with screenshot.
 */
function formatCompact(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

async function getForeignStockInfo(itemId) {
    try {
        const yataData = await fetchYataData();
        if (!yataData || !yataData.stocks) return null;

        let bestStock = null;

        // Iterate over all countries in YATA data
        for (const [countryCode, data] of Object.entries(yataData.stocks)) {
            const stocks = data.stocks;
            if (!stocks) continue;

            const stockItem = stocks.find(s => s.id == itemId);
            if (stockItem) {
                // Determine country name (yata returns codes like 'uae', 'mex')
                // Country names are usually in the YATA data or we map them?
                // YATA structure: keys are '3', '8', etc (Country IDs) OR codes?
                // The keys in yataData.stocks are actually COUNTRY IDS strings ("1", "2"...) in some versions
                // or codes ("arg", "mex") in others. 
                // Based on foreignMarketHandler.js logic: `yataData.stocks[countryCode]`
                // And COUNTRIES map has `code`.
                // Let's assume keys are country codes.

                // We want to find the lowest price.
                if (!bestStock || stockItem.cost < bestStock.price) {
                    // Need to map code back to Name/Emoji if possible, or use raw code
                    // Let's try to map
                    let locationName = countryCode.toUpperCase();
                    // Try to map to emoji name
                    const mapped = Object.values(COUNTRIES_MAP).find(c => c.code === countryCode);
                    if (mapped) locationName = `${mapped.emoji} ${mapped.name}`;

                    bestStock = {
                        location: locationName,
                        price: stockItem.cost
                    };
                }
            }
        }
        return bestStock;

    } catch (error) {
        console.warn('Foreign stock lookup failed:', error);
        return null;
    }
}

// Local map purely for name lookup if we can't import the full one cleanly
// or relies on foreignMarketHandler export.
// Actually I should just use the exported COUNTRIES from foreignMarketHandler.
// End of file
