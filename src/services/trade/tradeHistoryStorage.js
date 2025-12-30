/**
 * Trade History Storage
 * Manages trade records with FIFO matching for profit calculation
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const STORAGE_PATH = './data/trade-history.json';
export const MARKET_TAX = 0.05;

/**
 * Initialize storage file if not exists
 */
function initStorage() {
    const dir = dirname(STORAGE_PATH);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(STORAGE_PATH)) {
        writeFileSync(STORAGE_PATH, JSON.stringify({}, null, 2));
    }
}

/**
 * Load all trade history
 * @returns {Object} All user trade histories
 */
function loadHistory() {
    initStorage();
    try {
        const data = readFileSync(STORAGE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading trade history:', error);
        return {};
    }
}

/**
 * Save all trade history
 * @param {Object} history - All user trade histories
 */
function saveHistory(history) {
    writeFileSync(STORAGE_PATH, JSON.stringify(history, null, 2));
}

/**
 * Record a BUY trade
 * @param {string} userId - Discord user ID
 * @param {Object} trade - Trade details
 * @returns {Object} Recorded trade with ID
 */
export function recordBuy(userId, trade) {
    const history = loadHistory();

    if (!history[userId]) {
        history[userId] = { buys: [], sells: [], completedTrades: [] };
    }

    const buyRecord = {
        id: `buy_${Date.now()}`,
        type: 'BUY',
        itemId: trade.itemId,
        itemName: trade.itemName,
        qty: trade.qty,
        unitPrice: trade.unitPrice,
        totalCost: trade.totalCost,
        country: trade.country,
        timestamp: Math.floor(Date.now() / 1000),
        matched: false,
        matchedQty: 0
    };

    history[userId].buys.push(buyRecord);
    saveHistory(history);

    return buyRecord;
}

/**
 * Record a SELL trade and match with previous BUYs (FIFO)
 * @param {string} userId - Discord user ID
 * @param {Object} trade - Trade details
 * @returns {Object} Sell record with profit calculation
 */
export function recordSell(userId, trade) {
    const history = loadHistory();

    if (!history[userId]) {
        history[userId] = { buys: [], sells: [], completedTrades: [] };
    }

    // Calculate gross and net
    const grossRevenue = trade.unitPrice * trade.qty;
    const tax = grossRevenue * MARKET_TAX;
    const netRevenue = grossRevenue - tax;

    // FIFO matching: find unmatched BUYs for this item
    let remainingQty = trade.qty;
    let totalBuyCost = 0;
    const matchedBuys = [];

    for (const buy of history[userId].buys) {
        if (remainingQty <= 0) break;
        if (buy.itemId !== trade.itemId) continue;
        if (buy.matched && buy.matchedQty >= buy.qty) continue;

        const availableQty = buy.qty - (buy.matchedQty || 0);
        const matchQty = Math.min(availableQty, remainingQty);

        if (matchQty > 0) {
            // Calculate cost for this portion
            const portionCost = buy.unitPrice * matchQty;
            totalBuyCost += portionCost;
            remainingQty -= matchQty;

            // Update buy record
            buy.matchedQty = (buy.matchedQty || 0) + matchQty;
            if (buy.matchedQty >= buy.qty) {
                buy.matched = true;
            }

            matchedBuys.push({
                buyId: buy.id,
                matchQty,
                unitPrice: buy.unitPrice,
                portionCost,
                country: buy.country
            });
        }
    }

    // Calculate profit
    const profit = remainingQty > 0 ? null : netRevenue - totalBuyCost;
    const isOrphan = matchedBuys.length === 0;

    const sellRecord = {
        id: `sell_${Date.now()}`,
        type: 'SELL',
        itemId: trade.itemId,
        itemName: trade.itemName,
        qty: trade.qty,
        unitPrice: trade.unitPrice,
        grossRevenue,
        tax,
        netRevenue,
        totalBuyCost,
        profit,
        isOrphan,
        orphanQty: remainingQty,
        matchedBuys,
        timestamp: Math.floor(Date.now() / 1000)
    };

    history[userId].sells.push(sellRecord);

    // If fully matched, add to completed trades
    if (!isOrphan && remainingQty === 0) {
        history[userId].completedTrades.push({
            itemId: trade.itemId,
            itemName: trade.itemName,
            qty: trade.qty,
            buyCost: totalBuyCost,
            sellRevenue: netRevenue,
            profit,
            timestamp: sellRecord.timestamp
        });
    }

    saveHistory(history);

    return sellRecord;
}

/**
 * Get unmatched BUYs for an item
 * @param {string} userId - Discord user ID
 * @param {number} itemId - Item ID
 * @returns {Array} Unmatched buy records
 */
export function getUnmatchedBuys(userId, itemId) {
    const history = loadHistory();
    if (!history[userId]) return [];

    return history[userId].buys.filter(
        buy => buy.itemId === itemId && !buy.matched
    );
}

/**
 * Get user's trade summary
 * @param {string} userId - Discord user ID
 * @returns {Object} Trade summary stats
 */
export function getTradeSummary(userId) {
    const history = loadHistory();
    if (!history[userId]) {
        return { totalProfit: 0, completedTrades: 0, pendingBuys: 0 };
    }

    const completedTrades = history[userId].completedTrades || [];
    const totalProfit = completedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const pendingBuys = history[userId].buys.filter(b => !b.matched).length;

    return {
        totalProfit,
        completedTrades: completedTrades.length,
        pendingBuys
    };
}

/**
 * Clear user's trade history
 * @param {string} userId - Discord user ID
 */
export function clearHistory(userId) {
    const history = loadHistory();
    delete history[userId];
    saveHistory(history);
}

export default {
    recordBuy,
    recordSell,
    getUnmatchedBuys,
    getTradeSummary,
    clearHistory,
    MARKET_TAX
};
