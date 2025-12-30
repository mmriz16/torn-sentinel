/**
 * Debug API - Check all available data for trade detection
 */
import { config } from 'dotenv';
import { getAllUsers } from './src/services/userStorage.js';

config();

async function debugApi() {
    // Get API key from registered user
    const users = getAllUsers();
    const userId = Object.keys(users)[0];

    if (!userId) {
        console.log('❌ No users registered. Run /register first.');
        return;
    }

    const API_KEY = users[userId].apiKey;
    console.log('✅ Using API key from user:', userId);
    console.log('\n🔍 Fetching Torn API data...\n');

    try {
        // V1 API for basic data
        const urlV1 = `https://api.torn.com/user/?selections=basic,money,inventory,travel&key=${API_KEY}`;
        const responseV1 = await fetch(urlV1);
        const dataV1 = await responseV1.json();

        if (dataV1.error) {
            console.error('❌ V1 API Error:', dataV1.error);
            return;
        }

        console.log('═══════════════════════════════════════');
        console.log('📍 LOCATION / TRAVEL');
        console.log('═══════════════════════════════════════');
        console.log('Status:', dataV1.status);
        console.log('Travel:', dataV1.travel);

        console.log('\n═══════════════════════════════════════');
        console.log('💰 MONEY');
        console.log('═══════════════════════════════════════');
        console.log('money_onhand:', dataV1.money_onhand);

        console.log('\n═══════════════════════════════════════');
        console.log('🎒 INVENTORY');
        console.log('═══════════════════════════════════════');
        if (dataV1.inventory) {
            const items = Array.isArray(dataV1.inventory) ? dataV1.inventory : Object.entries(dataV1.inventory);
            console.log('Type:', typeof dataV1.inventory, Array.isArray(dataV1.inventory) ? '(Array)' : '(Object)');
            console.log('Count:', items.length);
            if (items.length > 0) {
                console.log('First 3 items:', JSON.stringify(items.slice(0, 3), null, 2));
            }
        } else {
            console.log('No inventory data in response');
        }

        // V2 API for itemmarket/bazaar
        console.log('\n═══════════════════════════════════════');
        console.log('🏪 ITEM MARKET (V2 API - your listings)');
        console.log('═══════════════════════════════════════');

        const urlV2Market = `https://api.torn.com/v2/user/?selections=itemmarket&key=${API_KEY}`;
        const responseV2 = await fetch(urlV2Market);
        const dataV2 = await responseV2.json();

        if (dataV2.error) {
            console.log('V2 API Error:', dataV2.error);
        } else if (dataV2.itemmarket) {
            console.log('Type:', typeof dataV2.itemmarket, Array.isArray(dataV2.itemmarket) ? '(Array)' : '(Object)');
            console.log('Data:', JSON.stringify(dataV2.itemmarket, null, 2));
        } else {
            console.log('No itemmarket data (not selling anything or wrong endpoint)');
            console.log('Full V2 response:', JSON.stringify(dataV2, null, 2));
        }

        // Bazaar
        console.log('\n═══════════════════════════════════════');
        console.log('🏬 BAZAAR (V2 API)');
        console.log('═══════════════════════════════════════');

        const urlV2Bazaar = `https://api.torn.com/v2/user/?selections=bazaar&key=${API_KEY}`;
        const responseV2B = await fetch(urlV2Bazaar);
        const dataV2B = await responseV2B.json();

        if (dataV2B.error) {
            console.log('V2 Bazaar Error:', dataV2B.error);
        } else if (dataV2B.bazaar) {
            console.log('Data:', JSON.stringify(dataV2B.bazaar, null, 2));
        } else {
            console.log('No bazaar data');
            console.log('Full response:', JSON.stringify(dataV2B, null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugApi();
