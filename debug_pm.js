
import { get } from './src/services/tornApi.js';
import { getAllUsers } from './src/services/userStorage.js';

async function test() {
    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    const user = users[userId];

    console.log('Testing with user:', user.name);

    try {
        console.log('--- TIPS ---');
        const d1 = await get(user.apiKey, 'user', 'points');
        console.log('POINTS:', JSON.stringify(d1, null, 2));

        const d2 = await get(user.apiKey, 'user', 'merits');
        console.log('MERITS:', JSON.stringify(d2, null, 2));
    } catch (e) {
        console.log('ERROR:', e);
    }
}

test();
