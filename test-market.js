/**
 * Test what data we can get for cooldowns
 */

import { config } from 'dotenv';
config();

import { readFileSync } from 'fs';
import { get } from './src/services/tornApi.js';

async function testCooldownsData() {
    const users = JSON.parse(readFileSync('./data/users.json', 'utf8'));
    const userId = Object.keys(users)[0];

    if (!userId) {
        console.log('No users registered');
        return;
    }

    const user = users[userId];
    console.log('Testing Full Data for:', user.tornName);

    try {
        // Get all relevant data
        const data = await get(user.apiKey, 'user', 'bars,cooldowns,education,personalstats');

        console.log('\n=== COOLDOWNS ===');
        console.log(JSON.stringify(data.cooldowns, null, 2));

        console.log('\n=== EDUCATION ===');
        console.log('Current:', data.education_current);
        console.log('Time Left:', data.education_timeleft);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testCooldownsData();
