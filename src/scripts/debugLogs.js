
import dotenv from 'dotenv';
import { get } from '../services/tornApi.js';
import { getAllUsers } from '../services/userStorage.js';

dotenv.config();

async function run() {
    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    if (!userId) {
        console.error('No users found.');
        return;
    }
    const user = users[userId];
    const apiKey = user.apiKey;

    try {
        // Fetch last 7 days to ensure we catch financial events
        console.log('Fetching logs for last 7 days...');
        const data = await get(apiKey, 'user', 'log', { from: Math.floor(Date.now() / 1000) - (86400 * 7), limit: 200 });

        if (!data.log) {
            console.log('No log data returned. Selection "log" might be restricted or empty.');
            console.log('Keys returned:', Object.keys(data));
            return;
        }

        const logs = Object.values(data.log); // "log" is object in V1/V2 usually ID->Log
        console.log(`Found ${logs.length} logs.`);

        // Filter for financial related keywords
        const financialKeywords = ['Market', 'Bazaar', 'Trade', 'Check', 'Deposit', 'Withdraw', 'Sell', 'Buy', 'Company', 'Faction', 'Casino', 'Mission', 'Stock', 'Dividend', 'Wage', 'Payout'];

        const types = {};
        logs.forEach(l => {
            const isFinancial = financialKeywords.some(k => l.title.includes(k));
            if (!isFinancial) return;

            const key = `${l.log} [${l.title}]`;
            if (!types[key]) types[key] = { count: 0, examples: [] };
            types[key].count++;
            if (types[key].examples.length < 1) types[key].examples.push(l.data); // Keep 1 example
        });

        console.log('\n--- Financial Log Types Found ---');
        for (const [type, info] of Object.entries(types)) {
            console.log(`TYPE: ${type} (x${info.count})`);
            console.log(`DATA: ${JSON.stringify(info.examples[0])}`);
            console.log('---');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
