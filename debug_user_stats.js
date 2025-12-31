
import { get } from './src/services/tornApi.js';
import { getAllUsers } from './src/services/userStorage.js';

async function test() {
    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    const user = users[userId];

    console.log('Testing with user:', user.name);

    try {
        // Test points and merits individually
        console.log('Testing points selection...');
        try {
            const d1 = await get(user.apiKey, 'user', 'points');
            console.log('Points success:', d1);
        } catch (e) {
            console.log('Points failed:', e.userMessage);
        }

        console.log('Testing merits selection...');
        try {
            const d2 = await get(user.apiKey, 'user', 'merits');
            console.log('Merits success:', d2);
        } catch (e) {
            console.log('Merits failed:', e.userMessage);
        }

        console.log('Testing profile selection (for points/merits?)...');
        try {
            const d3 = await get(user.apiKey, 'user', 'profile');
            console.log('Profile keys:', Object.keys(d3));
            console.log('Profile points?', d3.points);
            console.log('Profile merits?', d3.merits);
        } catch (e) {
            console.log('Profile failed:', e.userMessage);
        }
    } catch (e) {
        console.error(e);
    }
}

test();
