
console.log('🏥 Starting System Health Check...');

try {
    console.log('1. Checking Profit Engine Storage...');
    await import('./src/services/analytics/profitEngineStorage.js');
    console.log('✅ Profit Engine Storage OK');

    console.log('2. Checking Stats Handler...');
    await import('./src/services/autorun/handlers/statsHandler.js');
    console.log('✅ Stats Handler OK');

    console.log('3. Checking Financial Log Handler...');
    await import('./src/services/autorun/handlers/financialLogHandler.js');
    console.log('✅ Financial Log Handler OK');

    console.log('4. Checking Market Alert Storage...');
    await import('./src/services/market/marketAlertStorage.js');
    console.log('✅ Market Alert Storage OK');

    console.log('5. Checking Market Alert Handler...');
    await import('./src/services/autorun/handlers/marketAlertHandler.js');
    console.log('✅ Market Alert Handler OK');

    console.log('6. Checking Gym Training Storage...');
    await import('./src/services/analytics/gymTrainingStorage.js');
    console.log('✅ Gym Training Storage OK');

    console.log('🎉 ALL SYSTEMS GO! No load errors detected.');
} catch (error) {
    console.error('❌ FATAL ERROR DURING LOAD:', error);
    process.exit(1);
}
