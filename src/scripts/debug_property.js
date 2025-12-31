
import { getV2 } from '../services/tornApi.js';
import { getAllUsers } from '../services/userStorage.js';
import { initRuntimeState } from '../services/autorun/runtimeStateManager.js';

async function run() {
    initRuntimeState(); // Load users

    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    const user = users[userId];

    try {
        console.log('Fetching V2 user/properties...');
        const data = await getV2(user.apiKey, 'user/properties');

        if (!data || !data.properties) {
            console.log('No properties data returned.');
            return;
        }

        const properties = Object.values(data.properties);
        if (properties.length > 0) {
            console.log('--- FIRST PROPERTY SAMPLE ---');
            console.log(JSON.stringify(properties[0], null, 2));
            console.log('-----------------------------');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
