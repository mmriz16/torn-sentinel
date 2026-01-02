/**
 * System Health Check Script (Simplified)
 * Quick diagnostic for all auto-run handlers
 * 
 * Usage: node src/scripts/system_health_check.js
 */

import { readFileSync, existsSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');
const RUNTIME_STATE_FILE = join(ROOT_DIR, 'data', 'runtime-state.json');

// Expected runners
const EXPECTED_RUNNERS = [
    { key: 'wallet', interval: 60000, name: 'Wallet' },
    { key: 'personalStats', interval: 300000, name: 'Personal Stats' },
    { key: 'gym', interval: 60000, name: 'Gym Progress' },
    { key: 'work', interval: 600000, name: 'Work Stats' },
    { key: 'foreignMarket.argentina', interval: 30000, name: 'Argentina' },
    { key: 'foreignMarket.canada', interval: 30000, name: 'Canada' },
    { key: 'foreignMarket.cayman', interval: 30000, name: 'Cayman' },
    { key: 'foreignMarket.china', interval: 30000, name: 'China' },
    { key: 'foreignMarket.hawaii', interval: 30000, name: 'Hawaii' },
    { key: 'foreignMarket.japan', interval: 30000, name: 'Japan' },
    { key: 'foreignMarket.mexico', interval: 30000, name: 'Mexico' },
    { key: 'foreignMarket.southafrica', interval: 30000, name: 'South Africa' },
    { key: 'foreignMarket.switzerland', interval: 30000, name: 'Switzerland' },
    { key: 'foreignMarket.uk', interval: 30000, name: 'UK' },
    { key: 'foreignMarket.uae', interval: 30000, name: 'UAE' },
    { key: 'bestTravelRoute', interval: 30000, name: 'Best Route' },
    { key: 'travelProfitSummary', interval: 30000, name: 'Profit Summary' },
    { key: 'cooldownCheck', interval: 30000, name: 'Cooldown' },
    { key: 'tradeDetection', interval: 30000, name: 'Trade Detection', noEmbed: true },
    { key: 'marketAlerts', interval: 30000, name: 'Market Alerts', noEmbed: true },
    { key: 'botStatus', interval: 30000, name: 'Bot Status' },
    { key: 'propertyInfo', interval: 300000, name: 'Property Info' },
    { key: 'companyInfo', interval: 1800000, name: 'Company Info' },
    { key: 'jobOverview', interval: 900000, name: 'Job Overview' },
    { key: 'workPerformance', interval: 3600000, name: 'Work Perf' },
    { key: 'bazaarCheck', interval: 300000, name: 'Bazaar' },
    { key: 'itemMarketListings', interval: 300000, name: 'Item Market' },
    { key: 'networthTrend', interval: 86400000, name: 'NW Trend' },
    { key: 'networthDelta', interval: 86400000, name: 'NW Delta' },
    { key: 'assetDistribution', interval: 86400000, name: 'Asset Dist' },
    { key: 'activityLog', interval: 30000, name: 'Activity Log' },
    { key: 'profitEngine', interval: 300000, name: 'Profit Engine' },
    { key: 'financialLogs', interval: 60000, name: 'Financial Logs', noChannel: true },
];

function formatDuration(ms) {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
    return `${(ms / 86400000).toFixed(1)}d`;
}

function loadJson(filepath) {
    if (!existsSync(filepath)) return null;
    try {
        return JSON.parse(readFileSync(filepath, 'utf8'));
    } catch (e) {
        return null;
    }
}

console.log('\n=== TORN SENTINEL HEALTH CHECK ===');
console.log(`Time: ${new Date().toISOString()}\n`);

const state = loadJson(RUNTIME_STATE_FILE);

if (!state) {
    console.log('ERROR: runtime-state.json not found!');
    process.exit(1);
}

const now = Date.now();
const results = { healthy: [], stale: [], never: [], missing: [] };

for (const runner of EXPECTED_RUNNERS) {
    const r = state[runner.key];

    // Skip noChannel runners - they don't have state tracking
    if (runner.noChannel) {
        results.healthy.push({ name: runner.name + ' (bg)', ago: 'N/A' });
        continue;
    }

    if (!r) {
        results.missing.push(runner.name);
        continue;
    }

    // For noEmbed runners (like tradeHandler), messageId being null is expected
    if (!r.messageId && !runner.noEmbed && r.enabled) {
        results.never.push(runner.name);
        continue;
    }

    if (!r.lastRun) {
        results.stale.push({ name: runner.name, ago: 'never' });
        continue;
    }

    const ago = now - r.lastRun;
    const maxExpected = runner.interval * 10;

    if (ago > maxExpected) {
        results.stale.push({ name: runner.name, ago: formatDuration(ago) });
    } else {
        results.healthy.push({ name: runner.name, ago: formatDuration(ago) });
    }
}

console.log(`Total: ${EXPECTED_RUNNERS.length} runners\n`);

console.log(`[OK] HEALTHY (${results.healthy.length}):`);
if (results.healthy.length > 0) {
    results.healthy.forEach(r => console.log(`  - ${r.name}: ${r.ago} ago`));
}

console.log(`\n[!!] STALE/STOPPED (${results.stale.length}):`);
if (results.stale.length > 0) {
    results.stale.forEach(r => console.log(`  - ${r.name}: ${r.ago} ago`));
} else {
    console.log('  None');
}

console.log(`\n[XX] NEVER RAN (${results.never.length}):`);
if (results.never.length > 0) {
    results.never.forEach(n => console.log(`  - ${n}`));
} else {
    console.log('  None');
}

console.log(`\n[??] MISSING CONFIG (${results.missing.length}):`);
if (results.missing.length > 0) {
    results.missing.forEach(n => console.log(`  - ${n}`));
} else {
    console.log('  None');
}

// Summary
console.log('\n=== SUMMARY ===');
if (results.stale.length > 0 || results.never.length > 0) {
    console.log('ISSUES DETECTED!');
    console.log('Cause: Bot likely crashed or was stopped.');
    console.log('Fix: Restart the bot with: npm start');
} else {
    console.log('All systems healthy!');
}
console.log('');
