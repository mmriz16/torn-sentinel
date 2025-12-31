/**
 * Trade Detection Engine (Refactored)
 * Detects BUY trades via Cash Delta + YATA Prices (because inventory API is broken)
 * Detects SELL trades via Market/Bazaar Listings (V2 API)
 */

import { recordBuy, recordSell, MARKET_TAX } from './tradeHistoryStorage.js';
import { COUNTRIES } from '../autorun/handlers/foreignMarketHandler.js';
import { getCountryData } from '../yataGlobalCache.js';

// Configuration
const CONFIG = {
    MIN_BUY_COST: 1000,           // Ignore tiny spending
    PRICE_TOLERANCE: 0.05,        // 5% price matching tolerance (market fluctuation)
    PROFIT_MARGIN_TAX: 0.95,      // 5% market tax deducted when selling
    COOLDOWN_MS: 60 * 1000        // Prevent duplicate detections
};

// State to track last detected actions to prevent dupes
const detectionHistory = new Map();

/**
 * Get country name from code or alias
 */
function normalizeCountry(country) {
    if (!country) return 'Unknown';
    // Check if it's a key in COUNTRIES
    if (COUNTRIES[country.toLowerCase()]) return COUNTRIES[country.toLowerCase()].name;
    // Check if it's a name
    const found = Object.values(COUNTRIES).find(c => c.name.toLowerCase() === country.toLowerCase());
    return found ? found.name : country;
}

/**
 * Get YATA items for a specific country
 */
async function getCountryItems(countryName) {
    // Find country key from name (e.g., 'Argentina' -> 'argentina')
    const countryKey = Object.keys(COUNTRIES).find(key => COUNTRIES[key].name === countryName);

    if (!countryKey) return [];

    // Get data directly from global cache
    const data = getCountryData(countryKey);
    return data.items || [];
}

/**
 * Detect BUY Trades
 * Logic: User Abroad + Cash Dropped
 * Method: Find item in that country where (Price * Qty) ≈ CashDrop
 */


/**
 * Check if a trade was detected recently
 */
export function wasDetectedRecently(type, uniqueId, thresholdMs = 60000) {
    const now = Date.now();
    // Unique key: TYPE:ID
    const key = `${type}:${uniqueId}`;

    if (detectionHistory.has(key)) {
        const lastTs = detectionHistory.get(key);
        if (now - lastTs < thresholdMs) return true;
    }

    detectionHistory.set(key, now);

    // Cleanup old keys
    for (const [k, ts] of detectionHistory.entries()) {
        if (now - ts > thresholdMs * 2) detectionHistory.delete(k);
    }

    return false;
}

/**
 * Detect BUY Trades
 * Logic: User Abroad + Cash Dropped
 * Method: Find item in that country where (Price * Qty) ≈ CashDrop
 */
async function detectBuyTrades(userId, prevSnapshot, currentSnapshot) {
    const trades = [];

    // Must be abroad or traveling
    if (currentSnapshot.location === 'Torn') return [];

    // Must have lost cash
    const cashDiff = prevSnapshot.cash - currentSnapshot.cash;
    if (cashDiff <= CONFIG.MIN_BUY_COST) return []; // No significant spending

    console.log(`📉 Cash Drop Detected in ${currentSnapshot.location}: $${cashDiff}`);

    // Fetch items available in this country
    const countryItems = await getCountryItems(currentSnapshot.location);
    if (countryItems.length === 0) {
        console.log(`⚠️ No YATA item data for ${currentSnapshot.location}`);
        return [];
    }

    // Try to match cash drop to an item purchase
    // We look for: CashDiff ≈ ItemPrice * IntegerQty
    let bestMatch = null;

    for (const item of countryItems) {
        if (item.cost <= 0) continue;

        // Calculate theoretical qty
        const rawQty = cashDiff / item.cost;
        const roundedQty = Math.round(rawQty);

        // Check if close to integer
        const deviation = Math.abs(rawQty - roundedQty);

        // Tolerance: extremely low deviation (it should be exact price usually)
        // But maybe user bought 2 different things? We assume single bulk buy for now.
        if (deviation < 0.01 && roundedQty > 0) {
            // Found a match!
            // If multiple matches (rare), prioritize the one that matches typical capacity (e.g. ~20-30)
            if (!bestMatch || (Math.abs(roundedQty - 25) < Math.abs(bestMatch.qty - 25))) {
                bestMatch = {
                    itemId: item.id,
                    itemName: item.name,
                    qty: roundedQty,
                    unitPrice: item.cost,
                    totalCost: item.cost * roundedQty
                };
            }
        }
    }

    if (bestMatch) {
        // Check total cost match again
        if (Math.abs(bestMatch.totalCost - cashDiff) < 500) { // allow small variance?
            // Deduplicate: Use UserId + ItemId + Qty as unique signature (approx)
            // Or better: Use currentSnapshot.timestamp if available?
            // Using "Buy:ItemId:Qty" is risky if user buys same amount twice quickly.
            // But detection runs every 30s. User can't buy same amount instantly twice unless fast hands.
            // Safer: include currentSnapshot cash in key?
            const signature = `${userId}:${bestMatch.itemId}:${bestMatch.qty}:${Math.floor(currentSnapshot.cash / 1000)}`;

            if (wasDetectedRecently('BUY', signature, CONFIG.COOLDOWN_MS)) {
                console.log(`Duplicate BUY suppressed: ${bestMatch.itemName}`);
                return [];
            }

            const trade = {
                type: 'BUY',
                itemId: bestMatch.itemId,
                itemName: bestMatch.itemName,
                qty: bestMatch.qty,
                unitPrice: bestMatch.unitPrice,
                totalCost: bestMatch.totalCost,
                country: currentSnapshot.location,
                countryFlag: COUNTRIES[Object.keys(COUNTRIES).find(k => COUNTRIES[k].name === currentSnapshot.location)]?.emoji || '🌍'
            };

            const record = recordBuy(userId, trade);
            trade.record = record;
            trades.push(trade);
        }
    }

    return trades;
}

/**
 * Detect SELL Trades
 * Logic: Monitor 'itemmarket' and 'bazaar' listings (V2 API)
 * If a new listing appears that matches a previous BUY, establish the link.
 * Note: determining "Sold" is hard without cash increasing EXACTLY by sale amount.
 * For now, we assume "Listed" = "Intention to Sell" -> we can track potential profit.
 * OR: We wait for cash to increase?
 * 
 * User Request: "travel from UAE to Torn ... then in Torn can sell".
 * "sell what I bought".
 * 
 * Strategy: 
 * 1. Track what is currently listed in Market/Bazaar.
 * 2. Compare with previous snapshot's listings.
 * 3. If new listing appears -> User listed it.
 * 4. If listing disappears AND cash increased -> User sold it!
 */
async function detectSellTrades(userId, prevSnapshot, currentSnapshot) {
    const trades = [];

    if (currentSnapshot.location !== 'Torn') return [];

    // Cash increase?
    const cashDelta = currentSnapshot.cash - prevSnapshot.cash;

    // Check listings (This requires snapshot to include 'listings' field)
    const prevListings = prevSnapshot.listings || [];
    const currListings = currentSnapshot.listings || []; // Combined market + bazaar

    // Find items REMOVED from listings (Sold or Cancelled)
    // If Removed AND Cash Increased -> Likely Sold
    for (const prevItem of prevListings) {
        const stillListed = currListings.find(c => c.uid === prevItem.uid && c.amount === prevItem.amount);

        if (!stillListed) {
            // Item disappeared. Did we get money?
            // Expected return = Price * Qty * 0.97 (tax?) or 1.0 (bazaar)
            // Market fee is 5%? No, 3%? 
            // Bazaar is 0% tax. Item Market is 5% (if not donator?).
            // Let's check cash delta.

            if (cashDelta > 0) {
                // Approximate match?
                const revenue = prevItem.price * prevItem.amount;

                // Allow some variance (maybe other expenses happened same time)
                // If cashDelta is roughly revenue (95% to 100%)
                const ratio = cashDelta / revenue;

                if (ratio >= 0.90 && ratio <= 1.05) {
                    // SOLD!
                    const trade = {
                        type: 'SELL',
                        itemId: prevItem.id || prevItem.item_id, // Adjust based on API structure
                        itemName: prevItem.name || `Item ${prevItem.id}`,
                        qty: prevItem.amount,
                        unitPrice: prevItem.price,
                        country: 'Torn',
                        countryFlag: '🏠',
                        grossRevenue: revenue,
                        netRevenue: cashDelta,
                        profit: 0 // Will be calc by recordSell
                    };

                    const record = recordSell(userId, trade);
                    trade.record = record;
                    trade.profit = record.profit;

                    trades.push(trade);
                    console.log(`💰 Sell Detected: ${trade.qty}x ${trade.itemName} for $${trade.netRevenue}`);
                }
            }
        }
    }

    return trades;
}


/**
 * Main Detection Function
 */
export async function detectTrades(userId, prevSnapshot, currentSnapshot) {
    if (!prevSnapshot || !currentSnapshot) return [];

    const buys = await detectBuyTrades(userId, prevSnapshot, currentSnapshot);

    // Need listing data in snapshot to detect sells properly
    const sells = await detectSellTrades(userId, prevSnapshot, currentSnapshot);

    return [...buys, ...sells];
}

// Helper exports
export function getCountryFlag(country) {
    const entry = Object.values(COUNTRIES).find(c => c.name === country || c.code === country);
    return entry ? entry.emoji : '🌍';
}

export function getItemName(itemId) {
    // This is optional since we get names from YATA/API now
    return `Item #${itemId}`;
}

export default {
    detectTrades,
    getCountryFlag,
    getItemName
};
