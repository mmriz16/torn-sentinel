
import { get } from './src/services/tornApi.js';
import { getAllUsers } from './src/services/userStorage.js';

async function test() {
    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    const user = users[userId];

    console.log('Testing "money" and "refills" selection...');
    try {
        const d = await get(user.apiKey, 'user', 'money,refills');
        console.log('DATA:', JSON.stringify(d, null, 2));
    } catch (e) {
        console.log('ERROR:', e);
    }
}

test();
