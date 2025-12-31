
import { EmbedBuilder } from 'discord.js';
import { get } from '../../tornApi.js';
import { addIncome, addExpense, incrementStat } from '../../analytics/profitEngineStorage.js';
import { getAllUsers } from '../../userStorage.js';

// Mapping of Log Types to Profit Categories
// IDs based on research and observation
const LOG_TYPES = {
    // Market (Item Market)
    1103: { type: 'expense', cat: 'expense_travel_buy', desc: 'Market Buy' },
    1104: { type: 'income', cat: 'source_travel', desc: 'Market Sell' },
    // Bazaar
    1220: { type: 'expense', cat: 'expense_travel_buy', desc: 'Bazaar Buy' },
    1221: { type: 'income', cat: 'source_travel', desc: 'Bazaar Sell' },
    // Trades
    3600: { type: 'expense', cat: 'expense_other', desc: 'Trade Accept (Buy?)' }, // Needs filtering
    3602: { type: 'income', cat: 'source_other', desc: 'Trade Accept (Sell?)' }, // Needs filtering
    // Properties
    5937: { type: 'income', cat: 'source_other', desc: 'Property Rental' },
    // Company
    6300: { type: 'income', cat: 'source_job', desc: 'Company Pay' },
    6301: { type: 'income', cat: 'source_job', desc: 'Company Bonus' },
    // Faction
    6811: { type: 'income', cat: 'source_other', desc: 'Faction Pay' },
    // Missions
    7815: { type: 'income', cat: 'source_crime', desc: 'Mission Reward' },
    // Casino
    8300: { type: 'income', cat: 'source_other', desc: 'Casino Win' }, // Slots
    8301: { type: 'expense', cat: 'expense_other', desc: 'Casino Lose' },
    // Generic fallback for others manually added later
};

const processedLogIds = new Set(); // Runtime cache (reset on restart is OK if we check timestamp/state)
// Better: Persist last processed Log ID per user?
// For now, runtime cache + short loop.

export async function financialLogHandler(client) {
    const users = getAllUsers();

    for (const [userId, user] of Object.entries(users)) {
        if (!user.apiKey) continue;

        try {
            // Fetch recent logs (last 50 is enough for polling every minute)
            const response = await get(user.apiKey, 'user', 'log', { limit: 50 });

            if (!response.log) continue;

            // Torn V1/V2 'log' is a Map (Object) where Key = Log ID.
            // We iterate values.
            const logs = Object.values(response.log).sort((a, b) => a.timestamp - b.timestamp);

            for (const log of logs) {
                const logId = log.log;
                const logType = log.type; // Check if 'type' field exists, or we use log category?
                // V1 Log object: { log: 123, type: 1104, title: "...", data: {...}, timestamp: 123 }

                // Deduplicate
                if (processedLogIds.has(logId)) continue;
                processedLogIds.add(logId);

                // Cleanup cache
                if (processedLogIds.size > 1000) {
                    const it = processedLogIds.values();
                    processedLogIds.delete(it.next().value);
                }

                if (LOG_TYPES[logType]) {
                    const def = LOG_TYPES[logType];
                    const money = extractMoney(log);

                    if (money > 0) {
                        if (def.type === 'income') {
                            addIncome(def.cat, money);
                            console.log(`[Finance] Logged Income: ${def.desc} +$${money}`);
                        } else {
                            addExpense(def.cat, money);
                            console.log(`[Finance] Logged Expense: ${def.desc} -$${money}`);
                        }
                    }
                }

                // Increment Stats: Crime Count
                if (log.category === 'Crimes') {
                    incrementStat('crimeCount');
                }

                // Increment Stats: Xanax Used (Log 2440 = Drug Use, verify type for Xanax?)
                // Just checking category 'Drug' and title contains 'Xanax'
                if (log.category === 'Drug use' && log.title.includes('Xanax')) {
                    incrementStat('xanaxUsed');
                }
            }

        } catch (error) {
            console.error(`Error processing financial logs for ${user.name}:`, error.message);
        }
    }
}

function extractMoney(log) {
    // Try to find money in data
    if (log.data) {
        if (log.data.money) return Math.abs(log.data.money);
        if (log.data.cost) return Math.abs(log.data.cost);
        if (log.data.price) return Math.abs(log.data.price);
        if (log.data.winnings) return Math.abs(log.data.winnings);
        if (log.data.bet) return Math.abs(log.data.bet);
    }
    // Fallback: Parse description? (Heuristic) -> "Sold ... for $500,000"
    return 0;
}
