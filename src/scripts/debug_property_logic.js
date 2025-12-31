
import { getV2 } from '../services/tornApi.js';
import { getAllUsers } from '../services/userStorage.js';
import { initRuntimeState } from '../services/autorun/runtimeStateManager.js';

async function run() {
    initRuntimeState(); // Load users

    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    const user = users[userId];
    const myTornId = user.tornId;

    console.log(`Running logic for User ID: ${myTornId}`);

    try {
        const data = await getV2(user.apiKey, 'user/properties');
        if (!data || !data.properties) return;

        const properties = Object.values(data.properties);
        console.log(`Total properties fetched: ${properties.length}`);

        let activeProperty = null;
        const ownedProperties = [];
        const rentedProperties = [];

        for (const prop of properties) {
            let isActive = false;

            // Logic match from propertyHandler.js
            if (prop.used_by && Array.isArray(prop.used_by)) {
                isActive = prop.used_by.some(u => u.id === myTornId);
            }
            if (!isActive && prop.status && prop.status.toLowerCase() === 'rented' && prop.rented_by?.id === myTornId) {
                // Fallback
                // console.log(`Fallback active trigger for ${prop.name}`);
            }

            const isOwned = prop.owner && prop.owner.id === myTornId;
            const isTenant = prop.rented_by && prop.rented_by.id === myTornId;

            console.log(`Prop [${prop.id}] ${prop.property?.name}: used_by=${JSON.stringify(prop.used_by)} owner=${prop.owner?.id} rented_by=${prop.rented_by?.id} => isActive:${isActive}, isOwned:${isOwned}, isTenant:${isTenant}`);

            if (isActive) {
                activeProperty = prop;
            } else {
                if (isOwned) ownedProperties.push(prop);
                if (isTenant) rentedProperties.push(prop);
            }
        }

        console.log('\n--- RESULTS ---');
        console.log('ACTIVE:', activeProperty ? activeProperty.property?.name : 'None');
        console.log('OWNED:', ownedProperties.map(p => p.property?.name).join(', '));
        console.log('RENTED (Inactive):', rentedProperties.map(p => p.property?.name).join(', '));

        if (activeProperty) {
            console.log('\nActive Property Staff Check:');
            console.log(JSON.stringify(activeProperty.staff, null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

run();
