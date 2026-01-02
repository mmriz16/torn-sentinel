/**
 * Compare v1 vs v2 job data
 */
import { get, getV2 } from './src/services/tornApi.js';
import { getAllUsers } from './src/services/userStorage.js';
import fs from 'fs';

async function compareJobData() {
    const users = getAllUsers();
    const userId = Object.keys(users)[0];
    const user = users[userId];

    const results = {};

    // V1 profile
    console.log('Getting v1 profile...');
    results.v1_profile = await get(user.apiKey, 'user', 'profile');

    // V2 job
    console.log('Getting v2 job...');
    results.v2_job = await getV2(user.apiKey, 'user?selections=job');

    // Compare
    console.log('\n=== V1 profile.job ===');
    console.log(JSON.stringify(results.v1_profile.job, null, 2));

    console.log('\n=== V2 job ===');
    console.log(JSON.stringify(results.v2_job.job, null, 2));

    // Check what's in v2 but not v1
    const v1Keys = Object.keys(results.v1_profile.job || {});
    const v2Keys = Object.keys(results.v2_job.job || {});

    const onlyInV2 = v2Keys.filter(k => !v1Keys.includes(k));
    console.log('\n=== Fields ONLY in V2 ===');
    console.log(onlyInV2);

    fs.writeFileSync('./data/v1_v2_comparison.json', JSON.stringify(results, null, 2));
    console.log('\n✅ Saved to data/v1_v2_comparison.json');
}

compareJobData();
