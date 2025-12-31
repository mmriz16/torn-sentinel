
/**
 * /market Command
 * Item market lookup, trade logging, and foreign market alerts
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { get, getV2 } from '../services/tornApi.js';
import { getUser } from '../services/userStorage.js';
import { formatMoney, formatNumber } from '../utils/formatters.js';
import { logTrade } from '../services/analytics/travelAnalyticsService.js';
import { COUNTRIES as COUNTRIES_MAP } from '../services/autorun/handlers/foreignMarketHandler.js';
import { getAllCountriesData } from '../services/yataGlobalCache.js';
import { getUi, translate } from '../localization/index.js';
import { addAlert, removeAlert, getUserAlerts } from '../services/market/marketAlertStorage.js';

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
                    .setAutocomplete(true)
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
                    .setAutocomplete(true)
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
                    .setAutocomplete(true)
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
                    .setAutocomplete(true)
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
    )
    .addSubcommandGroup(group =>
        group
            .setName('alert')
            .setDescription('Manage foreign market restock alerts')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Add a new restock alert')
                    .addStringOption(option =>
                        option.setName('item')
                            .setDescription('Item name')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option.setName('country')
                            .setDescription('Country')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a restock alert')
                    .addStringOption(option =>
                        option.setName('item')
                            .setDescription('Item name')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option.setName('country')
                            .setDescription('Country')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List your active alerts')
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
    const group = interaction.options.getSubcommandGroup(false);

    if (group === 'alert') {
        if (subcommand === 'add') await handleAlertAdd(interaction, user);
        else if (subcommand === 'remove') await handleAlertRemove(interaction, user);
        else if (subcommand === 'list') await handleAlertList(interaction, user);
    } else {
        if (subcommand === 'lookup') {
            await handleLookup(interaction, user.apiKey);
        } else if (subcommand === 'buy' || subcommand === 'sell') {
            await handleTradeLog(interaction, subcommand, user.apiKey);
        }
    }
}

/**
 * Handle Autocomplete
 */
export async function autocomplete(interaction, client) {
    const user = getUser(interaction.user.id);
    const apiKey = user ? user.apiKey : process.env.TORN_API_KEY;

    const focusedOption = interaction.options.getFocused(true);

    // Get subcommand safely
    let subcommand = null;
    let group = null;
    try {
        subcommand = interaction.options.getSubcommand(false);
        group = interaction.options.getSubcommandGroup(false);
    } catch (e) {
        // Not in subcommand context
    }

    if (focusedOption.name === 'item') {
        const query = focusedOption.value.toLowerCase();

        // For alert remove: only show user's active alerts (item names only)
        if (group === 'alert' && subcommand === 'remove') {
            try {
                const alerts = getUserAlerts(interaction.user.id);

                // Get unique item names from user's alerts
                const uniqueItems = [...new Set(alerts.map(a => a.itemName))];

                // Filter by query
                const matches = uniqueItems.filter(itemName =>
                    itemName.toLowerCase().includes(query)
                );

                const choices = matches.slice(0, 25).map(itemName => ({
                    name: itemName,
                    value: itemName
                }));

                return await interaction.respond(choices);
            } catch (e) {
                console.error('Autocomplete alert remove error:', e);
                return await interaction.respond([]);
            }
        }

        // For other commands: show all items
        if (!apiKey) {
            return await interaction.respond([]);
        }

        try {
            const items = await getItemsCache(apiKey);
            const matches = findItems(items, query);

            const choices = matches.slice(0, 25).map(item => ({
                name: item.name,
                value: item.name
            }));
            return await interaction.respond(choices);
        } catch (e) {
            console.error('Autocomplete item error:', e);
            return await interaction.respond([]);
        }
    }

    if (focusedOption.name === 'country') {
        const query = focusedOption.value.toLowerCase();

        // For alert remove: only show countries with active alerts
        if (group === 'alert' && subcommand === 'remove') {
            try {
                const alerts = getUserAlerts(interaction.user.id);
                const countries = [...new Set(alerts.map(a => a.country))];

                const matches = countries.filter(c => c.toLowerCase().includes(query));
                const choices = matches.slice(0, 25).map(c => ({ name: c, value: c }));
                return await interaction.respond(choices);
            } catch (e) {
                console.error('Autocomplete country remove error:', e);
                return await interaction.respond([]);
            }
        }

        // Default: all countries
        const countries = Object.values(COUNTRIES_MAP).map(c => c.name);
        const matches = countries.filter(c => c.toLowerCase().includes(query));
        const choices = matches.slice(0, 25).map(c => ({ name: c, value: c }));
        return await interaction.respond(choices);
    }
}

/**
 * Alert Handlers
 */
async function handleAlertAdd(interaction, user) {
    const itemName = interaction.options.getString('item');
    const country = interaction.options.getString('country');

    // Validate Item Exists (fetch cache)
    const items = await getItemsCache(user.apiKey);
    const itemMatch = findItems(items, itemName.toLowerCase()).find(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (!itemMatch) {
        return interaction.reply({ content: `❌ Invalid item: **${itemName}**. Please choose from the list.`, ephemeral: true });
    }

    // Validate Country
    const validCountry = Object.values(COUNTRIES_MAP).find(c => c.name.toLowerCase() === country.toLowerCase());
    if (!validCountry) {
        return interaction.reply({ content: `❌ Invalid country: **${country}**.`, ephemeral: true });
    }

    // Add Alert
    addAlert(interaction.user.id, {
        itemId: parseInt(itemMatch.id),
        itemName: itemMatch.name,
        country: validCountry.name
    });

    await interaction.reply({
        content: `✅ **Market Alert Added**\nItem: ${itemMatch.name}\nCountry: ${validCountry.name}\nStatus: Idle (Active when traveling)`
    });
}

async function handleAlertRemove(interaction, user) {
    const itemName = interaction.options.getString('item');
    const country = interaction.options.getString('country');

    // Need Item ID to match storage
    // We could iterate user alerts and match by Name? Storage stores Name too.
    // Let's use name match or ID if resolved.

    // Resolve Item ID to be safe
    const items = await getItemsCache(user.apiKey);
    const itemMatch = findItems(items, itemName.toLowerCase()).find(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (!itemMatch) {
        return interaction.reply({ content: `❌ Item not found. Ensure exact name.`, ephemeral: true });
    }

    const removed = removeAlert(interaction.user.id, parseInt(itemMatch.id), country);

    if (removed) {
        await interaction.reply({ content: `🗑️ **Alert Removed**: ${itemMatch.name} - ${country}` });
    } else {
        await interaction.reply({ content: `⚠️ Alert not found.` });
    }
}

async function handleAlertList(interaction, user) {
    const alerts = getUserAlerts(interaction.user.id);

    if (!alerts || alerts.length === 0) {
        return interaction.reply({ content: '📋 You have no active market alerts.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📋 Your Market Alerts')
        .setDescription('Alerts activate when you travel to the target country.')
        .setTimestamp();

    const fields = alerts.map(a => {
        let status = a.state;
        if (status === 'IDLE') status = '⚪ Idle';
        else if (status === 'ARMED') status = '🟠 Armed (Near Landing)';
        else if (status === 'MONITORING') status = '🟢 Monitoring';
        else if (status === 'TRIGGERED') status = '🔴 Triggered';
        else if (status === 'COOLDOWN') status = `⏳ Cooldown (<t:${Math.floor(a.cooldownUntil / 1000)}:R>)`;

        return `**${a.itemName}** — ${a.country}\nStatus: \`${status}\``;
    });

    embed.setDescription(fields.join('\n\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
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
            // Check for exact match
            const exact = matches.find(m => m.name.toLowerCase() === searchQuery);
            if (exact) {
                // Proceed with exact
            } else {
                const suggestions = matches.slice(0, 10).map(m => `• ${m.name}`).join('\n');
                await interaction.editReply(`🔍 Multiple items found. Please be specific:\n${suggestions}`);
                return;
            }
        }

        const item = matches.length === 1 ? matches[0] : matches.find(m => m.name.toLowerCase() === searchQuery) || matches[0];

        // Fetch market data and foreign stock data in parallel
        const [marketData, foreignStock] = await Promise.all([
            getV2(apiKey, `market/${item.id}/itemmarket`),
            getForeignStockInfo(item.id)
        ]);

        const embed = await buildMarketEmbed(item, marketData, foreignStock);
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
    const country = interaction.options.getString('country') || 'Torn';

    await interaction.deferReply({ ephemeral: true });

    try {
        // Log it directly (logic remains same)
        const entry = logTrade(type, itemName, qty, price, country);

        const emoji = type === 'buy' ? '💸' : '💰';
        const profitText = entry.profit ? `\n📈 **${getUi('profit')}:** ${formatMoney(entry.profit)}` : '';
        const tradeLoggedText = type === 'buy' ? getUi('you_bought') : getUi('you_sold');

        const embed = new EmbedBuilder()
            .setColor(type === 'buy' ? 0xE74C3C : 0x2ECC71)
            .setTitle(`${emoji} ${getUi('trade_logged')}: ${type.toUpperCase()}`)
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

async function buildMarketEmbed(item, marketData, foreignStock) {
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
    let liquidity = `🔴 ${getUi('low')}`;
    if (totalQuantity > 10000) liquidity = `🟢 ${getUi('high')}`;
    else if (totalQuantity > 1000) liquidity = `🟡 ${getUi('medium')}`;

    // Construct image URL directly to ensure high res
    const imageUrl = `https://www.torn.com/images/items/${item.id}/large.png`;

    const embed = new EmbedBuilder()
        .setColor(0x2C2F33)
        .setTitle(`📦｜${item.name}`)
        .setDescription('────────────────────────────────────────────────')
        .setImage(imageUrl)
        .setTimestamp()
        .setFooter({ text: `Torn Sentinel • ${getUi('market')}` });

    // 1. Top Row: Type | Price | Foreign/Cheapest
    if (item.type) {
        embed.addFields({ name: `📋｜${getUi('type')}`, value: `\`\`\`${item.type}\`\`\``, inline: true });
    }

    if (foreignStock) {
        embed.addFields(
            { name: `💰｜${getUi('buy_price')}`, value: `\`\`\`$${formatCompact(foreignStock.price)}\`\`\``, inline: true },
            { name: `🌍｜${getUi('cheapest')}`, value: `\`\`\`${foreignStock.location}\`\`\``, inline: true }
        );
    } else {
        const val = item.market_value || avgPrice;
        embed.addFields(
            { name: `💵｜${getUi('market_value')}`, value: `\`\`\`$${formatCompact(val)}\`\`\``, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }
        );
    }

    // 2. Description (Wrapped in code block)
    if (item.description) {
        // Truncate if too long (Discord limit 1024)
        // Translate description (Enable AI)
        const descResult = await translate(item.description, { useAi: true, category: 'items_desc', key: item.id });
        const desc = descResult.text.length > 1000 ? descResult.text.substring(0, 990) + '...' : descResult.text;
        embed.addFields({ name: `📝｜${getUi('description')}`, value: `\`\`\`${desc}\`\`\``, inline: false });
    }

    // 3. Effect (Wrapped in code block)
    if (item.effect) {
        // Translate effect (Enable AI)
        const effectResult = await translate(item.effect, { useAi: true, category: 'items_effect', key: item.id });
        embed.addFields({ name: `⚡｜${getUi('effect')}`, value: `\`\`\`${effectResult.text}\`\`\``, inline: false });
    }

    if (totalListings === 0) {
        embed.addFields({ name: `🏪｜${getUi('market')}`, value: `\`\`\`${getUi('no_listings')}\`\`\``, inline: false });
        // NOTE: "Pasar" might be generic, maybe "Info Pasar" for header?
        return embed;
    }

    // 4. Market Stats Rows
    embed.addFields(
        // Row A
        { name: `💰｜${getUi('lowest_ask')}`, value: `\`\`\`$${formatCompact(lowestAsk)}\`\`\``, inline: true },
        { name: `📈｜${getUi('highest_ask')}`, value: `\`\`\`$${formatCompact(highestAsk)}\`\`\``, inline: true },
        { name: `📊｜${getUi('average')}`, value: `\`\`\`$${formatCompact(avgPrice)}\`\`\``, inline: true },

        // Row B
        { name: `📦｜${getUi('listings')}`, value: `\`\`\`${formatNumber(totalListings)}\`\`\``, inline: true },
        { name: `🔢｜${getUi('quantity')}`, value: `\`\`\`${formatNumber(totalQuantity)}\`\`\``, inline: true },
        { name: `💧｜${getUi('liquidity')}`, value: `\`\`\`${liquidity}\`\`\``, inline: true },

        // Row C (Spread)
        { name: `📉｜${getUi('spread')}`, value: `\`\`\`$${formatCompact(spread)} (+${spreadPercent}%)\`\`\``, inline: false }
    );

    return embed;
}

function formatCompact(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

async function getForeignStockInfo(itemId) {
    try {
        const { countries } = getAllCountriesData();
        if (!countries || Object.keys(countries).length === 0) return null;

        let bestStock = null;

        // Iterate over all countries in Cache
        for (const [countryCode, items] of Object.entries(countries)) {
            if (!items) continue;

            const stockItem = items.find(s => s.id == itemId);
            if (stockItem) {
                // Find lowest price
                if (!bestStock || stockItem.cost < bestStock.price) {

                    let locationName = countryCode.toUpperCase();
                    // Map code to Name/Emoji
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
