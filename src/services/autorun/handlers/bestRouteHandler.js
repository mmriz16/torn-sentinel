/**
 * Best Travel Route Handler for Auto-Run (REFACTORED)
 * Calculates highest profit efficiency globally based on real-time YATA data
 * Uses centralized YATA cache (no direct API calls)
 */

import { EmbedBuilder } from 'discord.js';
import { formatCompact } from '../../../utils/formatters.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllCountriesData } from '../../yataGlobalCache.js';

// Resolve path to travel-all.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '../../../../travel-all.json');

// Static flight times (backup/base)
const FLIGHT_TIMES = {
    'Argentina': 208, // Airstrip
    'Canada': 25,
    'Cayman Islands': 35,
    'China': 239,
    'Hawaii': 114,
    'Japan': 227,
    'Mexico': 18,
    'South Africa': 208,
    'Switzerland': 123,
    'UAE': 194,
    'United Kingdom': 111
};

// YATA Country Code Map
const COUNTRY_MAP = {
    'arg': 'Argentina',
    'can': 'Canada',
    'cay': 'Cayman Islands',
    'chi': 'China',
    'haw': 'Hawaii',
    'jap': 'Japan',
    'mex': 'Mexico',
    'sou': 'South Africa',
    'swi': 'Switzerland',
    'uae': 'UAE',
    'uni': 'United Kingdom'
};

/**
 * Load static flight times from travel-all.json as fallback/base
 * Used getting market prices (if available statically)
 */
function loadTravelData() {
    try {
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf8');
            return JSON.parse(raw);
        }
    } catch (error) {
        console.error('❌ Failed to load travel-all.json:', error.message);
    }
    return { items: [] };
}

/**
 * Main Handler
 */
export async function bestRouteHandler(client) {
    try {
        // 1. Get Real-time Data from Global Cache
        const { countries, isStale, error } = getAllCountriesData();

        if (!countries || Object.keys(countries).length === 0) {
            // If cache is empty and error exists, log it
            if (error) console.error('BestRoute: YATA Cache empty or error:', error);
            return null; // Don't send empty embed if no data
        }

        // 2. Process all items
        const allItems = [];
        const staticData = loadTravelData();

        for (const [countryCode, items] of Object.entries(countries)) {
            const countryName = COUNTRY_MAP[countryCode] || countryCode;
            // Default to Airstrip time (can be configurable later)
            const flightTime = FLIGHT_TIMES[countryName] || 200;

            if (!items || !Array.isArray(items)) continue;

            for (const item of items) {
                // Skip if no stock
                if (!item.quantity || item.quantity <= 0) continue;

                // Find matching item in static data for Market Price
                // Note: cost in YATA data is the "Foreign Cost" (Buy Price)
                const staticItem = staticData.items.find(i => i.name === item.name);
                const marketPrice = staticItem ? staticItem.market_price : 0;

                // Calculate Profit: (Market Price - Buy Price)
                const profit = marketPrice - item.cost;

                // Filter logic: profitable items only
                if (profit <= 0) continue;

                const profitPerMin = profit / flightTime;

                allItems.push({
                    name: item.name,
                    country: countryName,
                    code: countryCode,
                    quantity: item.quantity,
                    cost: item.cost,
                    profit: profit,
                    time: flightTime,
                    efficiency: profitPerMin
                });
            }
        }

        // 3. Sort by Efficiency DESC
        allItems.sort((a, b) => b.efficiency - a.efficiency);

        // 4. Take Top 5
        const topRoutes = allItems.slice(0, 5);

        // 5. Build Embed
        const embed = new EmbedBuilder()
            .setColor(0x00FF00) // Bright Green
            .setTitle('🗺️ Best Travel Routes (Right Now)')
            .setDescription('Highest profit efficiency based on current market prices & real-time stock.')
            .setTimestamp()
            .setFooter({ text: isStale ? '⚠️ Cached data (YATA limit)' : 'Auto update every 5 min • YATA API' });

        if (topRoutes.length === 0) {
            embed.setDescription('No profitable routes found right now.');
            return embed;
        }

        // Add Fields
        for (const route of topRoutes) {
            const emoji = getCountryEmoji(route.code);
            const eff = formatCompact(route.efficiency);
            const prof = formatCompact(route.profit);

            embed.addFields({
                name: `${emoji} ${route.country} — ${route.name}`,
                value: `> **Profit:** $${prof}/item\n> **Time:** ${route.time} min\n> **Efficiency:** **$${eff} / min**\n> **Stock:** ${route.quantity}`,
                inline: false
            });
        }

        return embed;

    } catch (error) {
        console.error('❌ Best Route Handler Error:', error.message);
        return null;
    }
}

function getCountryEmoji(code) {
    const emojis = {
        'arg': '🇦🇷', 'can': '🇨🇦', 'cay': '🇰🇾', 'chi': '🇨🇳', 'haw': '🇺🇸',
        'jap': '🇯🇵', 'mex': '🇲🇽', 'sou': '🇿🇦', 'swi': '🇨🇭', 'uae': '🇦🇪', 'uni': '🇬🇧'
    };
    return emojis[code] || '🏳️';
}
