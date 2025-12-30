/**
 * Foreign Market Handler for Auto-Run
 * Returns 4 SEPARATE embeds per category: Flower, Plushie, Drug, Other
 * First embed has country header + update time, others just show category
 */

import { EmbedBuilder } from 'discord.js';
import { formatCompact } from '../../../utils/formatters.js';

// Country codes mapping
export const COUNTRIES = {
    argentina: { code: 'arg', emoji: '🇦🇷', name: 'Argentina' },
    canada: { code: 'can', emoji: '🇨🇦', name: 'Canada' },
    cayman: { code: 'cay', emoji: '🇰🇾', name: 'Cayman Islands' },
    china: { code: 'chi', emoji: '🇨🇳', name: 'China' },
    hawaii: { code: 'haw', emoji: '🇺🇸', name: 'Hawaii' },
    japan: { code: 'jap', emoji: '🇯🇵', name: 'Japan' },
    mexico: { code: 'mex', emoji: '🇲🇽', name: 'Mexico' },
    southafrica: { code: 'sou', emoji: '🇿🇦', name: 'South Africa' },
    switzerland: { code: 'swi', emoji: '🇨🇭', name: 'Switzerland' },
    uk: { code: 'uni', emoji: '🇬🇧', name: 'United Kingdom' },
    uae: { code: 'uae', emoji: '🇦🇪', name: 'UAE' },
};

// Item category keywords
const CATEGORIES = {
    flower: ['Flower', 'Rose', 'Orchid', 'Violet', 'Dahlia', 'Crocus', 'Heather', 'Edelweiss', 'Cherry Blossom', 'Peony', 'Ceibo', 'Banana Orchid'],
    plushie: ['Plushie'],
    drug: ['Xanax', 'Cannabis', 'Ecstasy', 'Ketamine', 'Vicodin', 'PCP', 'LSD', 'Opium', 'Shrooms', 'Speed'],
};

// YATA API
const YATA_API_URL = 'https://yata.yt/api/v1/travel/export/';
let yataCache = null;
let yataCacheTime = 0;
const CACHE_TTL = 60 * 1000;

export async function fetchYataData() {
    const now = Date.now();
    if (yataCache && (now - yataCacheTime) < CACHE_TTL) return yataCache;

    try {
        const response = await fetch(YATA_API_URL, {
            headers: { 'User-Agent': 'TornSentinel/1.0' }
        });
        if (!response.ok) throw new Error(`YATA API error: ${response.status}`);
        yataCache = await response.json();
        yataCacheTime = now;
        console.log('📡 YATA data refreshed');
        return yataCache;
    } catch (error) {
        console.error('❌ YATA API error:', error.message);
        return yataCache;
    }
}

function getCountryItems(yataData, countryCode) {
    if (!yataData?.stocks?.[countryCode]) return [];
    return yataData.stocks[countryCode].stocks || [];
}

function categorizeItem(itemName) {
    for (const keyword of CATEGORIES.flower) {
        if (itemName.includes(keyword)) return 'flower';
    }
    for (const keyword of CATEGORIES.plushie) {
        if (itemName.includes(keyword)) return 'plushie';
    }
    for (const keyword of CATEGORIES.drug) {
        if (itemName.includes(keyword)) return 'drug';
    }
    return 'other';
}

function getCategoryColor(category) {
    switch (category) {
        case 'flower': return 0xFF69B4;
        case 'plushie': return 0x8B4513;
        case 'drug': return 0x00CED1;
        default: return 0x808080;
    }
}

/**
 * Build category embed (simple, no footer/status)
 */
function buildCategoryEmbed(categoryEmoji, categoryName, items, color) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${categoryEmoji} ${categoryName}`);

    // Sort: in-stock first, then by cost
    const sorted = [...items].sort((a, b) => {
        if (a.quantity === 0 && b.quantity > 0) return 1;
        if (b.quantity === 0 && a.quantity > 0) return -1;
        return b.cost - a.cost;
    });

    if (sorted.length === 0) {
        embed.setDescription('No items');
        return embed;
    }

    // Build table
    let table = '```\n';
    table += 'Item'.padEnd(20) + 'Stock'.padStart(6) + 'Price'.padStart(10) + '\n';
    table += '─'.repeat(36) + '\n';

    for (const item of sorted) {
        const name = item.name.length > 18 ? item.name.substring(0, 17) + '…' : item.name;
        const stock = item.quantity > 0 ? String(item.quantity) : 'OUT';
        const price = '$' + formatCompact(item.cost);
        table += name.padEnd(20) + stock.padStart(6) + price.padStart(10) + '\n';
    }
    table += '```';

    embed.setDescription(table);
    return embed;
}

/**
 * Create handler that returns MULTIPLE embeds
 */
export function createForeignMarketHandler(countryKey) {
    const country = COUNTRIES[countryKey];
    if (!country) return null;

    return async function foreignMarketHandler(client) {
        try {
            const yataData = await fetchYataData();
            if (!yataData) return null;

            const items = getCountryItems(yataData, country.code);
            const updateTime = yataData.stocks?.[country.code]?.update || 0;

            // Categorize all items
            const categories = { flower: [], plushie: [], drug: [], other: [] };
            for (const item of items) {
                categories[categorizeItem(item.name)].push(item);
            }

            // Count in-stock
            const totalInStock = items.filter(i => i.quantity > 0).length;
            const minsAgo = updateTime ? Math.floor((Date.now() - updateTime * 1000) / 60000) : '?';

            // Build embeds
            const embeds = [];
            const catConfig = [
                { key: 'flower', emoji: '🌸', name: 'Flowers' },
                { key: 'plushie', emoji: '🧸', name: 'Plushies' },
                { key: 'drug', emoji: '💊', name: 'Drugs' },
                { key: 'other', emoji: '📦', name: 'Other Items' },
            ];

            // Header embed (first one)
            const headerEmbed = new EmbedBuilder()
                .setColor(0x9C27B0)
                .setTitle(`${country.emoji} ${country.name} — Foreign Market`)
                .setDescription(`📡 YATA • Updated ${minsAgo}m ago • ✅ ${totalInStock}/${items.length} in stock`);
            embeds.push(headerEmbed);

            // Category embeds
            for (const { key, emoji, name } of catConfig) {
                if (categories[key].length > 0) {
                    embeds.push(buildCategoryEmbed(emoji, name, categories[key], getCategoryColor(key)));
                }
            }

            return embeds.length > 1 ? embeds : null;

        } catch (error) {
            console.error(`❌ Foreign market error (${countryKey}):`, error.message);
            return null;
        }
    };
}

// Pre-create handlers
export const foreignMarketHandlers = {};
for (const key of Object.keys(COUNTRIES)) {
    foreignMarketHandlers[key] = createForeignMarketHandler(key);
}
