
import { getUi, getStat, getAction, fromDictionary, applyTemplate } from '../localization/index.js';

console.log('🔍 Starting Localization Verification...');

let failed = 0;

// 1. Test basic UI retrieval
console.log('\n--- 1. Testing UI Retrieval ---');
const tests = [
    'activity_log', 'battle_stats', 'training_estimate', 'networth',
    'financial_overview', 'liquidity'
];

tests.forEach(key => {
    const val = getUi(key);
    if (val === key) { // Fallback returns key if missing
        console.error(`❌ Missing UI key: ${key}`);
        failed++;
    } else {
        console.log(`✅ ${key}: ${val}`);
    }
});

// 2. Test Stats Retrieval
console.log('\n--- 2. Testing Stats Retrieval ---');
const stats = ['strength', 'defense', 'speed', 'dexterity', 'intelligence', 'manual_labor'];
stats.forEach(key => {
    const val = getStat(key);
    if (val === key) {
        console.error(`❌ Missing Stat key: ${key}`);
        failed++;
    } else {
        console.log(`✅ ${key}: ${val}`);
    }
});

// 3. Test Dictionary Sections (Company)
console.log('\n--- 3. Testing Sections ---');
const companyStats = fromDictionary('company', 'working_stats');
if (companyStats === 'working_stats' || !companyStats) {
    console.error(`❌ Missing company.working_stats (Got: ${companyStats})`);
    failed++;
} else {
    console.log(`✅ company.working_stats: ${companyStats}`);
}

const companyPoints = fromDictionary('company', 'job_points');
if (companyPoints === 'job_points' || !companyPoints) {
    console.error(`❌ Missing company.job_points (Got: ${companyPoints})`);
    failed++;
} else {
    console.log(`✅ company.job_points: ${companyPoints}`);
}

// 4. Test Templates
console.log('\n--- 4. Testing Templates ---');
const templateTest = applyTemplate('gym_trained', {
    stat: 'Kekuatan',
    trains: 10,
    gym: 'Premier Fitness',
    energy: 100
});
console.log(`gym_trained: ${templateTest}`);

const templatesToCheck = [
    { name: 'travel_boarded', params: { duration: '2j 30m', origin: 'Torn City', destination: 'Meksiko' } },
    { name: 'travel_bought', params: { quantity: 5, item: 'Boneka', total: '$5,000', location: 'Meksiko' } },
    { name: 'crime_success', params: { item: 'Dompet', nerve: 5 } },
    { name: 'crime_failed', params: { time: '1j' } },
    { name: 'market_sold', params: { quantity: 1, item: 'Xanax', total: '$830,000' } },
    { name: 'market_bought', params: { quantity: 1, item: 'Xanax', total: '$830,000' } },
    { name: 'market_listed', params: { quantity: 1, item: 'Xanax', price: '$830,000' } },
    { name: 'hospitalized', params: { time: '3j' } },
    { name: 'attacked_anon', params: { time: '5j' } },
    { name: 'jailed', params: { time: '2j' } },
    { name: 'busted', params: {} },
    { name: 'paid', params: { amount: '$1,000,000', jp: 10 } },
    { name: 'mission_accepted', params: { difficulty: 'Sulit' } },
    { name: 'medal_awarded', params: {} },
    { name: 'login', params: {} }
];

templatesToCheck.forEach(t => {
    const result = applyTemplate(t.name, t.params);
    console.log(`${t.name}: ${result}`);
    if (result.includes('{') && result.includes('}')) {
        console.error(`❌ Template ${t.name} failed substitution`);
        failed++;
    }
});

if (templateTest.includes('{stat}')) {
    console.error('❌ Template failed to replace placeholders');
    failed++;
} else {
    console.log('✅ Template substitution passed');
}

// Summary
console.log('\n--- Summary ---');
if (failed === 0) {
    console.log('🎉 All localization tests passed!');
} else {
    console.error(`❌ ${failed} tests failed.`);
    process.exit(1);
}
