/**
 * Debug script to check Torn API response
 */

import { config } from 'dotenv';
config();

import { getUser } from './src/services/userStorage.js';
import { get } from './src/services/tornApi.js';

async function debugApi() {
    // Get first user from storage
    const fs = await import('fs');
    const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf8'));
    const userId = Object.keys(users)[0];

    if (!userId) {
        console.log('No users registered');
        return;
    }

    const user = users[userId];
    console.log('Fetching data for:', user.tornName);

    try {
        const data = await get(user.apiKey, 'user', 'money,networth');
        console.log('\n=== MONEY FIELDS ===');
        console.log('money_onhand:', data.money_onhand);
        console.log('cayman_bank:', data.cayman_bank);
        console.log('vault_amount:', data.vault_amount);

        console.log('\n=== NETWORTH OBJECT ===');
        console.log(JSON.stringify(data.networth, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

debugApi();
