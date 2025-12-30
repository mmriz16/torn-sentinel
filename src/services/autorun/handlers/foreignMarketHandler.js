/**
 * Foreign Market Handler for Auto-Run (REFACTORED)
 * 
 * NOW: Reads from global YATA cache (no API calls)
 * Returns 4 SEPARATE embeds per category: Flower, Plushie, Drug, Other
 */

import { EmbedBuilder } from 'discord.js';
import { formatCompact } from '../../../utils/formatters.js';
import { getCountryData } from '../../yataGlobalCache.js';

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
        case 'plushie': return 0x8B4513; // Brown
        case 'drug': return 0x00CED1;    // Cyan
        default: return 0x808080;        // Gray
    }
}

/**
 * Get category emoji
 */
function getCategoryEmoji(category) {
    switch (category) {
        case 'flower': return '🌸';
        case 'plushie': return '🧸';
        case 'drug': return '💊';
        default: return '📦';
    }
}

/**
 * Format item line for embed
 */
function formatItemLine(item) {
    const name = item.name.length > 18 ? item.name.substring(0, 16) + '..' : item.name;
    const qty = item.quantity?.toString() || '?';
    const cost = formatCompact(item.cost);
    return `\`${name.padEnd(18)} x${qty.padStart(3)} @ $${cost}\``;
}

/**
 * Build embeds for a country from CACHE (no API call)
 * @param {string} countryKey - e.g., 'japan', 'uae'
 * @returns {EmbedBuilder[]} Array of embeds
 */
function buildCountryEmbeds(countryKey) {
    const country = COUNTRIES[countryKey];
    if (!country) return [];

    // READ FROM GLOBAL CACHE (no API call!)
    const cacheData = getCountryData(countryKey);
    const items = cacheData.items;

    if (!items || items.length === 0) {
        // No data available
        const embed = new EmbedBuilder()
            .setColor(0x95A5A6)
            .setTitle(`${country.emoji} ${country.name} Foreign Market`)
            .setDescription('```No market data available```')
            .setFooter({ text: cacheData.error ? `Error: ${cacheData.error}` : 'Waiting for data...' })
            .setTimestamp();
        return [embed];
    }

    // Group items by category
    const grouped = { flower: [], plushie: [], drug: [], other: [] };
    for (const item of items) {
        const cat = categorizeItem(item.name);
        grouped[cat].push(item);
    }

    // Sort each category by cost (descending)
    for (const cat of Object.keys(grouped)) {
        grouped[cat].sort((a, b) => b.cost - a.cost);
    }

    const embeds = [];
    const categoryOrder = ['flower', 'plushie', 'drug', 'other'];

    for (let i = 0; i < categoryOrder.length; i++) {
        const cat = categoryOrder[i];
        const catItems = grouped[cat];
        if (catItems.length === 0) continue;

        const embed = new EmbedBuilder()
            .setColor(getCategoryColor(cat));

        // First embed gets header
        if (embeds.length === 0) {
            embed.setTitle(`${country.emoji} ${country.name} Foreign Market`);
        }

        // Category header
        const categoryTitle = `${getCategoryEmoji(cat)} ${cat.charAt(0).toUpperCase() + cat.slice(1)}s`;

        // Format items (max 8 per category)
        const lines = catItems.slice(0, 8).map(formatItemLine);

        embed.addFields({
            name: categoryTitle,
            value: lines.join('\n') || 'None',
            inline: false
        });

        embeds.push(embed);
    }

    // Add footer to last embed with cache status
    if (embeds.length > 0) {
        const lastEmbed = embeds[embeds.length - 1];
        let footerText = `YATA • Updated`;

        if (cacheData.isStale) {
            footerText = '⚠️ Cached data (YATA limit/delay)';
        }

        if (cacheData.updatedAt > 0) {
            lastEmbed.setFooter({ text: `${footerText} • <t:${Math.floor(cacheData.updatedAt / 1000)}:R>` });
        } else {
            lastEmbed.setFooter({ text: footerText });
        }
        lastEmbed.setTimestamp(new Date(cacheData.updatedAt || Date.now()));
    }

    return embeds;
}

/**
 * Create handler for a specific country
 * These handlers DO NOT call API - they read from cache
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
