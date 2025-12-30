/**
 * Trade Detection Engine
 * Detects BUY and SELL trades via inventory/wallet delta analysis
 */

import { recordBuy, recordSell, MARKET_TAX } from './tradeHistoryStorage.js';

// Item ID -> Name mapping (common travel items)
const ITEM_NAMES = {
    // Plushies
    258: 'Camel Plushie',
    261: 'Chamois Plushie',
    266: 'Jaguar Plushie',
    268: 'Wolverine Plushie',
    269: 'Nessie Plushie',
    273: 'Red Fox Plushie',
    274: 'Monkey Plushie',
    281: 'Panda Plushie',
    384: 'Teddy Bear Plushie',
    618: 'Stingray Plushie',
    // Flowers
    260: 'Dahlia',
    263: 'African Violet',
    264: 'Orchid',
    267: 'Heather',
    271: 'Ceibo Flower',
    272: 'Edelweiss',
    276: 'Crocus',
    277: 'Peony',
    282: 'Cherry Blossom',
    617: 'Tribulus Omanense',
    // Other valuables
    206: 'Xanax'
};

// Country flags
const COUNTRY_FLAGS = {
    'Argentina': '🇦🇷',
    'Canada': '🇨🇦',
    'Cayman Islands': '🇰🇾',
    'China': '🇨🇳',
    'Hawaii': '🇺🇸',
    'Japan': '🇯🇵',
    'Mexico': '🇲🇽',
    'South Africa': '🇿🇦',
    'Switzerland': '🇨🇭',
    'UAE': '🇦🇪',
    'United Kingdom': '🇬🇧',
    'Torn': '🏠'
};

// Anti false-positive thresholds
const CONFIG = {
    MIN_CASH_DELTA: 10000,          // Ignore changes < $10k
    ITEM_COOLDOWN_MS: 60000,        // 1 minute cooldown per item
    MAX_INFERRED_PRICE: 500000      // Max reasonable unit price
};

// Cooldown tracking
const itemCooldowns = new Map();

/**
 * Check if item is on cooldown
 */
function isOnCooldown(userId, itemId) {
    const key = `${userId}_${itemId}`;
    const lastTime = itemCooldowns.get(key);
    if (!lastTime) return false;
    return (Date.now() - lastTime) < CONFIG.ITEM_COOLDOWN_MS;
}

/**
 * Set cooldown for item
 */
function setCooldown(userId, itemId) {
    const key = `${userId}_${itemId}`;
    itemCooldowns.set(key, Date.now());
}

/**
 * Get item name from ID
 */
export function getItemName(itemId) {
    return ITEM_NAMES[itemId] || `Item #${itemId}`;
}

/**
 * Get country flag
 */
export function getCountryFlag(country) {
    return COUNTRY_FLAGS[country] || '🌍';
}

/**
 * Detect trades from snapshot delta
 * @param {string} userId - Discord user ID
 * @param {Object} prevSnapshot - Previous snapshot
 * @param {Object} currentSnapshot - Current snapshot
 * @returns {Array} Array of detected trades
 */
export function detectTrades(userId, prevSnapshot, currentSnapshot) {
    if (!prevSnapshot || !currentSnapshot) return [];

    const trades = [];
    const prevInventory = prevSnapshot.inventory || {};
    const currentInventory = currentSnapshot.inventory || {};
    const cashDelta = currentSnapshot.cash - prevSnapshot.cash;

    // Get all unique item IDs
    const allItemIds = new Set([
        ...Object.keys(prevInventory),
        ...Object.keys(currentInventory)
    ]);

    for (const itemId of allItemIds) {
        const id = parseInt(itemId);
        const prevQty = prevInventory[itemId] || 0;
        const currentQty = currentInventory[itemId] || 0;
        const qtyDelta = currentQty - prevQty;

        if (qtyDelta === 0) continue;
        if (isOnCooldown(userId, id)) continue;

        // BUY: Abroad + inventory increased + cash decreased
        if (qtyDelta > 0 && currentSnapshot.location !== 'Torn' && cashDelta < 0) {
            // Anti false-positive: require significant cash drop
            if (Math.abs(cashDelta) < CONFIG.MIN_CASH_DELTA) continue;

            // Infer unit price
            const totalCost = Math.abs(cashDelta);
            const unitPrice = Math.round(totalCost / qtyDelta);

            // Sanity check on price
            if (unitPrice > CONFIG.MAX_INFERRED_PRICE) continue;

            const trade = {
                type: 'BUY',
                itemId: id,
                itemName: getItemName(id),
                qty: qtyDelta,
                unitPrice,
                totalCost,
                country: currentSnapshot.location,
                countryFlag: getCountryFlag(currentSnapshot.location)
            };

            // Record and add to results
            const record = recordBuy(userId, trade);
            trade.record = record;
            trades.push(trade);
            setCooldown(userId, id);
        }

        // SELL: In Torn + inventory decreased + cash increased
        if (qtyDelta < 0 && currentSnapshot.location === 'Torn' && cashDelta > 0) {
            // Anti false-positive: require significant cash increase
            if (cashDelta < CONFIG.MIN_CASH_DELTA) continue;

            const qty = Math.abs(qtyDelta);

            // Infer unit price (before tax - we need to reverse the 5% deduction)
            // If user received $X after 5% tax, gross was X / 0.95
            const netReceived = cashDelta;
            const grossRevenue = netReceived / (1 - MARKET_TAX);
            const unitPrice = Math.round(grossRevenue / qty);

            // Sanity check
            if (unitPrice > CONFIG.MAX_INFERRED_PRICE * 10) continue;

            const trade = {
                type: 'SELL',
                itemId: id,
                itemName: getItemName(id),
                qty,
                unitPrice,
                country: 'Torn',
                countryFlag: '🏠'
            };

            // Record and calculate profit
            const record = recordSell(userId, trade);
            trade.record = record;
            trade.grossRevenue = record.grossRevenue;
            trade.tax = record.tax;
            trade.netRevenue = record.netRevenue;
            trade.profit = record.profit;
            trade.isOrphan = record.isOrphan;
            trades.push(trade);
            setCooldown(userId, id);
        }
    }

    return trades;
}

export default {
    detectTrades,
    getItemName,
    getCountryFlag,
    CONFIG
};
