/**
 * Debug: Try API v1 for job/company data
 */

import { config } from 'dotenv';
config();

import { readFileSync, writeFileSync } from 'fs';
import { get } from './src/services/tornApi.js';

async function testJobApiV1() {
    const users = JSON.parse(readFileSync('./data/users.json', 'utf8'));
    const userId = Object.keys(users)[0];

    if (!userId) {
        console.log('No users registered');
        return;
    }

    const user = users[userId];
    console.log('Testing API v1 for:', user.tornName);

    // Try to get company data from v1 company endpoint
    try {
        // First get employee data using company endpoint without ID (should return current company)
        const companyData = await get(user.apiKey, 'company', 'employees,profile');
        console.log('\n=== COMPANY (v1) ===');
        writeFileSync('company-response.json', JSON.stringify(companyData, null, 2));
        console.log('Keys:', Object.keys(companyData));
        if (companyData.company) {
            console.log('Company name:', companyData.company.name);
            console.log('Company rating:', companyData.company.rating);
        }
        if (companyData.employees) {
            // Find current user in employees
            const me = Object.values(companyData.employees).find(e => e.name === user.tornName);
            if (me) {
                console.log('My position:', me.position);
                console.log('Days in company:', me.days_in_company);
            }
        }
    } catch (e) {
        console.error('company v1 Error:', e.message);
    }
}

testJobApiV1();
