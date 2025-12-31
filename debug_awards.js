import { get } from './src/services/tornApi.js';
import { getAllUsers } from './src/services/userStorage.js';
import { readFileSync } from 'fs';

async function debugAwardsLogs() {
    try {
        const users = getAllUsers();
        const userId = Object.keys(users)[0];
        const user = users[userId];

        if (!user.apiKey) {
            console.log('No API key found');
            return;
        }

        console.log('Fetching activity logs...\n');
        const data = await get(user.apiKey, 'user', 'log');

        if (!data || !data.log) {
            console.log('No log data');
            return;
        }

        // Find Awards category entries
        const awardsEntries = Object.entries(data.log)
            .filter(([id, entry]) => entry.category === 'Awards')
            .slice(0, 5); // Get first 5 Awards entries

        console.log(`Found ${awardsEntries.length} Awards entries:\n`);

        for (const [id, entry] of awardsEntries) {
            console.log('─'.repeat(60));
            console.log(`ID: ${id}`);
            console.log(`Log Type: ${entry.log}`);
            console.log(`Title: ${entry.title}`);
            console.log(`Timestamp: ${new Date(entry.timestamp * 1000).toLocaleString()}`);
            console.log(`Data:`, JSON.stringify(entry.data, null, 2));
            console.log('');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugAwardsLogs();
