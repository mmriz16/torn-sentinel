/**
 * Profit Engine Handler
 * Real-time accounting system for Torn
 * Shows daily P&L, income breakdown, and expense tracking
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats, getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';
import {
    getProfitState,
    addIncome,
    addExpense,
    incrementStat,
    calculateTotals,
    initProfitEngine
} from '../../analytics/profitEngineStorage.js';
import { getRecentEvents } from '../../analytics/activityDetectionEngine.js';


import { AUTO_RUNNERS } from '../autoRunRegistry.js';
import { formatTimeShort } from '../../../utils/formatters.js';
import { getRunnerFooter } from '../../../utils/footerHelper.js';

// Track initialization and last update
let initialized = false;
let lastProcessedEventTs = 0;

// Xanax item ID for drug tracking
const XANAX_ID = 206;

// Cache for market prices
let marketPriceCache = {
    xanax: 850000, // Default fallback
    lastUpdate: 0
};

/**
 * Fetch current market price for Xanax
 */
async function updateXanaxPrice(apiKey) {
    try {
        // Only update every 5 minutes
        if (Date.now() - marketPriceCache.lastUpdate < 5 * 60 * 1000) {
            return marketPriceCache.xanax;
        }

        const data = await getV2(apiKey, `market/${XANAX_ID}/itemmarket`);
        if (data?.itemmarket?.length > 0) {
            // Get lowest selling price
            const lowestPrice = data.itemmarket[0].price || marketPriceCache.xanax;
            marketPriceCache.xanax = lowestPrice;
            marketPriceCache.lastUpdate = Date.now();
        }
    } catch (e) {
        console.error('❌ Failed to fetch Xanax price:', e.message);
    }
    return marketPriceCache.xanax;
}

/**
 * Process activity events and update profit tracking
 */
function processActivityEvents() {
    const events = getRecentEvents(20);

    for (const event of events) {
        // Skip already processed events
        if (event.timestamp <= lastProcessedEventTs) continue;

        switch (event.type) {
            case 'trade_sell':
                // Travel/Market sell - add income
                // Note: Full income tracking is handled by tradeHandler via logTrade
                break;

            case 'trade_buy':
                // Items bought - check if abroad for travel buy expense
                // Note: Handled by tradeHandler
                break;

            case 'wallet_change':
                // Cash changes are tracked via delta
                if (event.delta > 0) {
                    // Positive = income (could be sell, could be crime, could be other)
                    // Don't double-count with trade detection
                }
                break;

            case 'crime_reward':
                // Crime completed - can add estimated income
                incrementStat('crimeCount', event.crimesCompleted || 1);
                break;

            case 'energy_used':
                // Check if Xanax was used (energy jump of 250+)
                if (event.source === 'Xanax (inferred)') {
                    incrementStat('xanaxUsed', 1);
                    addExpense('xanax', marketPriceCache.xanax);
                }
                break;

            case 'travel_arrive':
                if (event.location === 'Torn') {
                    incrementStat('tripCount', 1);
                }
                break;
        }
    }

    // Update last processed timestamp
    if (events.length > 0) {
        lastProcessedEventTs = events[0].timestamp;
    }
}

/**
 * Calculate property expense from API data (V2 format)
 * Only counts the ACTIVE property (the one user is currently using)
 * Note: Rent is paid upfront, so only daily upkeep + staff is counted
 */
function calculatePropertyExpense(properties, myTornId) {
    if (!properties || !Array.isArray(properties)) return 0;

    let dailyExpense = 0;

    for (const prop of properties) {
        if (!prop) continue;

        // Check if I am actively using this property (my ID is in used_by)
        let isActivelyUsing = false;
        if (prop.used_by && Array.isArray(prop.used_by)) {
            isActivelyUsing = prop.used_by.some(u => u.id == myTornId);
        }

        // Only count the property I'm actively using
        if (isActivelyUsing) {
            // Daily costs: upkeep (property + staff)
            const upkeep = prop.upkeep?.property || 0;
            const staffCost = prop.upkeep?.staff || 0;
            dailyExpense += upkeep + staffCost;
            break; // Only one active property at a time
        }
    }

    return dailyExpense;
}

/**
 * Profit Engine Handler
 */
export async function profitEngineHandler(client) {
    try {
        // Initialize on first run
        if (!initialized) {
            initProfitEngine();
            initialized = true;
        }

        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Fetch user data
        const data = await getCombinedStats(user.apiKey, 'money,networth');
        if (!data) return null;

        // Fetch V2 properties for accurate used_by data
        const propData = await getV2(user.apiKey, 'user/properties');
        const properties = propData?.properties ? Object.values(propData.properties) : [];

        // Update market prices
        await updateXanaxPrice(user.apiKey);

        // Process recent activity events
        processActivityEvents();

        // Calculate property expense (only active property)
        const propertyDailyExpense = calculatePropertyExpense(properties, user.tornId);

        // Get current state and totals
        const state = getProfitState();
        const totals = calculateTotals();

        // Update property expense (set, not add - because it's a daily fixed cost)
        // Only set if not already set today
        if (state.expense.property === 0 && propertyDailyExpense > 0) {
            addExpense('property', propertyDailyExpense);
        }

        // Build embed
        const netProfit = totals.netProfit;
        const profitColor = netProfit >= 0 ? 0x2ECC71 : 0xE74C3C;
        const profitIcon = netProfit >= 0 ? '🟢' : '🔴';
        const profitSign = netProfit >= 0 ? '+' : '';

        const embed = new EmbedBuilder()
            .setColor(profitColor)
            .setTitle(`🧮 ${getUi('profit_engine_title')}`)
            .setDescription(`**💰 ${getUi('net_pnl')}:** ${profitIcon} ${profitSign}${formatMoney(netProfit)}`)
            .setTimestamp();
        embed.setFooter(getRunnerFooter('profitEngine'));

        // Income breakdown
        // Dynamic Income Breakdown
        const incomeLines = [];
        for (const [key, value] of Object.entries(state.income)) {
            if (value > 0) {
                const label = getUi(`source_${key}`) || getUi(key) || key;
                incomeLines.push(`• ${label.padEnd(20)} +${formatMoney(value)}`);
            }
        }

        if (incomeLines.length > 0) {
            embed.addFields({
                name: `📥 ${getUi('income')}`,
                value: '```\n' + incomeLines.join('\n') + '\n```',
                inline: false
            });
        } else {
            embed.addFields({
                name: `📥 ${getUi('income')}`,
                value: `\`\`\`${getUi('no_income')}\`\`\``,
                inline: false
            });
        }

        // Expense breakdown
        // Dynamic Expense Breakdown
        const expenseLines = [];
        for (const [key, value] of Object.entries(state.expense)) {
            if (value > 0) {
                const label = getUi(`expense_${key}`) || getUi(key) || key;
                expenseLines.push(`• ${label.padEnd(20)} -${formatMoney(value)}`);
            }
        }

        if (expenseLines.length > 0) {
            embed.addFields({
                name: `📤 ${getUi('expenses')}`,
                value: '```\n' + expenseLines.join('\n') + '\n```',
                inline: false
            });
        } else {
            embed.addFields({
                name: `📤 ${getUi('expenses')}`,
                value: `\`\`\`${getUi('no_expenses')}\`\`\``,
                inline: false
            });
        }

        // Efficiency metrics
        const profitPerHour = totals.hoursActive > 0 ? totals.netProfit / totals.hoursActive : 0;
        const crimeROI = state.stats.crimeCount > 0 ? state.income.crime / state.stats.crimeCount : 0;
        const travelROI = state.expense.travel_buy > 0
            ? (state.income.travel / state.expense.travel_buy).toFixed(1) + '×'
            : 'N/A';

        embed.addFields({
            name: `📊 ${getUi('efficiency')}`,
            value: [
                `**${getUi('profit_per_hour')}:** ${formatMoney(Math.round(profitPerHour))}`,
                `**${getUi('trips_today')}:** ${state.stats.tripCount}`,
                `**${getUi('crimes_today')}:** ${state.stats.crimeCount}`,
                `**${getUi('xanax_used')}:** ${state.stats.xanaxUsed}`
            ].join('\n'),
            inline: false
        });

        return embed;

    } catch (error) {
        console.error('❌ Profit Engine Handler Error:', error.message);
        return null;
    }
}

export default profitEngineHandler;
