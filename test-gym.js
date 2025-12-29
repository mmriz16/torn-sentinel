/**
 * Debug: Test gym and battlestats API
 */

import { config } from 'dotenv';
config();

import { readFileSync } from 'fs';
import { get } from './src/services/tornApi.js';

async function testGymApi() {
    const users = JSON.parse(readFileSync('./data/users.json', 'utf8'));
    const userId = Object.keys(users)[0];

    if (!userId) {
        console.log('No users registered');
        return;
    }

    const user = users[userId];
    console.log('Testing API for:', user.tornName);

    try {
        // Test gym selection
        const gymData = await get(user.apiKey, 'user', 'gym,battlestats');
        console.log('\n=== GYM & BATTLESTATS ===');
        console.log(JSON.stringify(gymData, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

testGymApi();
