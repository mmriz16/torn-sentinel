
import { get } from './src/services/tornApi.js';
import { getAllUsers } from './src/services/userStorage.js';

async function test() {
    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    const user = users[userId];

    console.log('Testing with user:', user.name);
    console.log('API Key length:', user.apiKey ? user.apiKey.length : 0);

    console.log('Testing "merits" selection...');
    try {
        const data = await get(user.apiKey, 'user', 'merits');
        console.log('SUCCESS:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('ERROR:', e);
    }
}

test();
