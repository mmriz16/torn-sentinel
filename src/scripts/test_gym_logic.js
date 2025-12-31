
import { getEnergyPerClick, updateFromApiLogs } from '../services/analytics/gymTrainingStorage.js';

console.log('🏋️ Starting Gym Logic Verification...');

// Mock data
// Log entry for gym 999 (Test Gym 1): 10 trains, 100 energy used -> 10E/click
const mockLog1 = {
    "12345": {
        log: 5300,
        title: "Gym train strength",
        timestamp: 1700000000,
        category: "Gym",
        data: {
            gym: 999,
            trains: 10,
            energy_used: 100
        }
    }
};

// Log entry for gym 888 (Test Gym 2): 2 trains, 10 energy used -> 5E/click
const mockLog2 = {
    "12346": {
        log: 5300,
        title: "Gym train defense",
        timestamp: 1700000100,
        category: "Gym",
        data: {
            gym: 888,
            trains: 2,
            energy_used: 10
        }
    }
};
// Use high IDs to avoid conflict with real gyms (1-32)

console.log('\n--- Testing gym 999 (Expected 10E/click) ---');
updateFromApiLogs(mockLog1);
const gym1 = getEnergyPerClick(999);
console.log(`Gym 999 result: ${gym1.energyPerClick}E (${gym1.confidence})`);

if (gym1.energyPerClick === 10 && gym1.confidence === 'confirmed') {
    console.log('✅ Gym 999 passed');
} else {
    console.error(`❌ Gym 999 failed. Got ${gym1.energyPerClick}E, ${gym1.confidence}`);
}

console.log('\n--- Testing gym 888 (Expected 5E/click) ---');
updateFromApiLogs(mockLog2);
const gym2 = getEnergyPerClick(888);
console.log(`Gym 888 result: ${gym2.energyPerClick}E (${gym2.confidence})`);

if (gym2.energyPerClick === 5 && gym2.confidence === 'confirmed') {
    console.log('✅ Gym 888 passed');
} else {
    console.error(`❌ Gym 888 failed. Got ${gym2.energyPerClick}E, ${gym2.confidence}`);
}
