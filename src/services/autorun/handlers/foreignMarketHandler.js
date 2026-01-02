/**
 * Foreign Market Handler for Auto-Run (REFACTORED V2)
 * 
 * Features:
 * - Reads from global YATA cache (no API calls)
 * - Returns multiple embeds for clean layout: Header + Category Tables
 * - Precise table formatting inside code blocks
 */

import { EmbedBuilder } from 'discord.js';
import { getCountryData } from '../../yataGlobalCache.js';
import { getUi } from '../../../localization/index.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';
import { formatTimeShort } from '../../../utils/formatters.js';
import { getRunnerFooter } from '../../../utils/footerHelper.js';


// Country metadata mapping
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

/**
 * Categorize item by name
 */
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

/**
 * Get category color
 */
function getCategoryColor(category) {
    switch (category) {
        case 'flower': return 0xFF69B4;  // Pink
        case 'plushie': return 0xC74C00; // Brown/Orange
        case 'drug': return 0x00CED1;    // Cyan
        default: return 0x797D7F;        // Grey
    }
}

/**
 * Get category emoji & title
 */
function getCategoryHeader(category) {
    switch (category) {
        case 'flower': return `🌸｜${getUi('flowers')}`;
        case 'plushie': return `🧸｜${getUi('plushies')}`;
        case 'drug': return `💊｜${getUi('drugs')}`;
        default: return `📦｜${getUi('others')}`;
    }
}

/**
 * Format money compact e.g., "$ 14K", "$ 25B"
 */
function formatMoneyCompact(num) {
    if (num >= 1_000_000_000) return `$ ${(num / 1_000_000_000).toFixed(0)}B`; // $ 25B
    if (num >= 1_000_000) return `$ ${(num / 1_000_000).toFixed(1)}M`;     // $ 1.5M
    if (num >= 1_000) return `$ ${(num / 1_000).toFixed(1)}K`;          // $ 14.5K
    return `$ ${num}`;
}

/**
 * Format table row
 */
function formatTableRow(item) {
    // Layout: Name (21) | Stock (7) | Price (11)

    let name = item.name;
    if (name.length > 21) name = name.substring(0, 19) + '..';

    const stock = item.quantity >= 1000 ? (item.quantity / 1000).toFixed(1) + 'k' : item.quantity.toString();
    const price = formatMoneyCompact(item.cost);

    return `${name.padEnd(21)} ${stock.padStart(7)} ${price.padStart(11)}`;
}

/**
 * Build embeds for a country from CACHE
 */
function buildCountryEmbeds(countryKey) {
    const country = COUNTRIES[countryKey];
    if (!country) return [];

    const cacheData = getCountryData(countryKey);
    const items = cacheData.items;
    const embeds = [];

    // 1. HEADER EMBED
    const headerEmbed = new EmbedBuilder()
        .setTitle(`${country.emoji}｜${country.name}｜${getUi('foreign_market')}`)
        .setColor(null); // Default/Black

    if (!items || items.length === 0) {
        headerEmbed.setDescription(`\`\`\`${getUi('market_no_data')}\`\`\``);
        headerEmbed.setFooter({ text: getUi('waiting_data') });
        return [headerEmbed];
    }

    embeds.push(headerEmbed);

    // Group items
    const grouped = { flower: [], plushie: [], drug: [], other: [] };
    for (const item of items) {
        const cat = categorizeItem(item.name);
        grouped[cat].push(item);
    }

    // Process categories in order
    const categoryOrder = ['plushie', 'flower', 'drug', 'other'];

    for (const cat of categoryOrder) {
        const catItems = grouped[cat];
        if (catItems.length === 0) continue;

        // Sort by cost descending (usually expensive items first)
        catItems.sort((a, b) => b.cost - a.cost);

        // Build Table
        // Header alignment matches formatTableRow: 21 + 1 + 7 + 1 + 11 = 41 chars
        const headName = getUi('item_name').padEnd(21);
        const headStock = getUi('stock').padStart(7);
        const headPrice = getUi('price').padStart(11);
        const header = `${headName} ${headStock} ${headPrice}`;

        const separator = `──────────────────────────────────────────`;
        // Limit to 15 items to prevent Field Value overflow (1024 chars)
        const rows = catItems.slice(0, 15).map(formatTableRow);
        const table = `\`\`\`\n${header}\n${separator}\n${rows.join('\n')}\`\`\``;

        const embed = new EmbedBuilder()
            .setColor(getCategoryColor(cat))
            .addFields({
                name: getCategoryHeader(cat),
                value: table,
                inline: false // Force full width for table
            });

        embeds.push(embed);
    }

    // Add Footer to the LAST embed
    if (embeds.length > 0) {
        const lastEmbed = embeds[embeds.length - 1];

        // Footer timestamp logic
        lastEmbed.setFooter(getRunnerFooter(`foreignMarket.${countryKey}`))
            .setTimestamp(new Date(cacheData.updatedAt || Date.now()));
    }

    return embeds;
}

/**
 * Create handler for a specific country
 */
export function createForeignMarketHandler(countryKey) {
    return async function (client) {
        try {
            const embeds = buildCountryEmbeds(countryKey);
            return embeds.length > 0 ? embeds : null;
        } catch (error) {
            console.error(`❌ Foreign Market Handler Error (${countryKey}):`, error.message);
            return null;
        }
    };
}

// Pre-create handlers for all countries
export const foreignMarketHandlers = {};
for (const countryKey of Object.keys(COUNTRIES)) {
    foreignMarketHandlers[countryKey] = createForeignMarketHandler(countryKey);
}

export default {
    COUNTRIES,
    createForeignMarketHandler,
    foreignMarketHandlers
};
