/**
 * Debug script to find correct field for job info
 */
import { get } from './src/services/tornApi.js';
import { getAllUsers } from './src/services/userStorage.js';
import fs from 'fs';

async function debugApiFields() {
    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    if (!userId) {
        console.log('No user found');
        return;
    }

    const user = users[userId];
    const apiKey = user.apiKey;

    const results = {};

    // Test different field names for job data
    const testFields = ['profile', 'basic', 'job', 'company'];

    for (const field of testFields) {
        try {
            console.log(`Testing v1 user/${field}...`);
            const data = await get(apiKey, 'user', field);
            results[`user/${field}`] = data;
            console.log(`user/${field} keys:`, Object.keys(data));

            // Check if it contains job info
            if (data.job) {
                console.log('  → Contains job data:', Object.keys(data.job));
            }
        } catch (e) {
            results[`user/${field}`] = { error: e.message };
            console.log(`user/${field} error:`, e.message);
        }
    }

    // Save to file
    fs.writeFileSync('./data/api_debug2.json', JSON.stringify(results, null, 2));
    console.log('\n✅ Results saved to data/api_debug2.json');
}

debugApiFields();
