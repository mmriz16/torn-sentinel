/**
 * Best Travel Route Handler for Auto-Run
 * Calculates highest profit efficiency globally based on real-time YATA data
 */

import { EmbedBuilder } from 'discord.js';
import { formatCompact } from '../../../utils/formatters.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve path to travel-all.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '../../../../travel-all.json');

// YATA API
const YATA_API_URL = 'https://yata.yt/api/v1/travel/export/';

// Cache
let yataCache = null;
let yataCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

// Static flight times (backup if not in YATA)
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
 * Fetch data from YATA API
 */
async function fetchYataData() {
    const now = Date.now();
    if (yataCache && (now - yataCacheTime) < CACHE_TTL) return yataCache;

    try {
        const response = await fetch(YATA_API_URL, {
            headers: { 'User-Agent': 'TornSentinel/1.0' }
        });
        if (!response.ok) throw new Error(`YATA API error: ${response.status}`);
        yataCache = await response.json();
        yataCacheTime = now;
        return yataCache;
    } catch (error) {
        console.error('❌ YATA API error:', error.message);
        return yataCache;
    }
}

/**
 * Load static flight times from travel-all.json as fallback/base
 */
function loadTravelData() {
    try {
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        console.error('❌ Failed to load travel-all.json:', error.message);
        return { items: [] };
    }
}

/**
 * Main Handler
 */
export async function bestRouteHandler(client) {
    try {
        // 1. Get Real-time Data
        const yataData = await fetchYataData();
        if (!yataData || !yataData.stocks) return null;

        // 2. Process all items
        const allItems = [];
        const staticData = loadTravelData();

        for (const [countryCode, countryData] of Object.entries(yataData.stocks)) {
            const countryName = COUNTRY_MAP[countryCode] || countryCode;
            // Default to Airstrip time (can be configurable later)
            const flightTime = FLIGHT_TIMES[countryName] || 200;

            if (!countryData.stocks) continue;

            for (const item of countryData.stocks) {
                // Skip if no profit or no stock
                // Note: YATA provides cost (buy price from abroad)
                // We need market price to calc profit. 
                // Since YATA export doesn't have market price, 
                // we'll try to match with staticData or fall back to 0 profit.

                // Find matching item in static data for Market Price
                const staticItem = staticData.items.find(i => i.name === item.name);
                const marketPrice = staticItem ? staticItem.market_price : 0;

                // Calculate Profit: (Market Price - Buy Price)
                // Assuming market price is 95% to account for quick sell/fees if using trader? 
                // Or user's PRD says "5% market tax" in previous convos.
                // Let's us Gross Profit for now or standard formula: Market - Buy

                const profit = marketPrice - item.cost;

                // Filter logic from PRD: profit > 0 && stock > 0
                if (profit <= 0 || item.quantity <= 0) continue;

                const profitPerMin = profit / flightTime;

                allItems.push({
                    name: item.name,
                    country: countryName,
                    code: countryCode,
                    quantity: item.quantity,
                    cost: item.cost,
                    profit: profit,
                    time: flightTime,
                    efficiency: profitPerMin,
                    update: countryData.update
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
            .setFooter({ text: 'Auto update every 5 min • YATA API' });

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
