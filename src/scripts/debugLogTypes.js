
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
        console.log('Fetching ALL log types definitions...');
        // Use 'torn' endpoint for logtypes
        const data = await get(apiKey, 'torn', 'logtypes');

        if (!data.logtypes) {
            console.log('No logtypes data returned.');
            return;
        }

        const types = data.logtypes; // Object: ID -> Description
        console.log(`Found ${Object.keys(types).length} log types.`);

        // Filter for financial related keywords in the VALUE (description)
        const financialKeywords = ['Market', 'Bazaar', 'Trade', 'Check', 'Deposit', 'Withdraw', 'Sell', 'Buy', 'Company', 'Faction', 'Casino', 'Mission', 'Stock', 'Dividend', 'Wage', 'Payout', 'Property'];

        console.log('\n--- Financial Log Variables (IDs) ---');
        for (const [id, description] of Object.entries(types)) {
            if (financialKeywords.some(k => description.toLowerCase().includes(k.toLowerCase()))) {
                console.log(`${id}: ${description}`);
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
