/**
 * Startup Bootstrap
 * Initializes and resumes all auto-run channels on bot ready
 */

import { initRuntimeState, setRunnerEnabled, initRunner, isRunnerEnabled } from './runtimeStateManager.js';
import { getConfiguredRunners, AUTO_RUNNERS, isForeignMarketRunner } from './autoRunRegistry.js';
import { setSchedulerClient, startScheduler, registerHandler } from './schedulerEngine.js';

// Import handlers
import { walletHandler } from './handlers/walletHandler.js';
import { statsHandler } from './handlers/statsHandler.js';
import { gymHandler } from './handlers/gymHandler.js';
import { workHandler } from './handlers/workHandler.js';
import { foreignMarketHandlers, createForeignMarketHandler } from './handlers/foreignMarketHandler.js';
import { companyHandler } from './handlers/companyHandler.js';
import { bestRouteHandler } from './handlers/bestRouteHandler.js';
import { profitSummaryHandler } from './handlers/profitSummaryHandler.js';
import { cooldownHandler } from './handlers/cooldownHandler.js';
import { tradeHandler } from './handlers/tradeHandler.js';
import { botStatusHandler } from './handlers/botStatusHandler.js';
import { getAllUsers } from '../userStorage.js';
import { initLogger, logSystem } from '../system/systemLogger.js';

/**
 * Bootstrap all auto-run channels on bot startup
 */
export async function startupBootstrap(client) {
    console.log('\n🚀 Starting Auto-Run Bootstrap...');

    // Initialize runtime state from disk
    initRuntimeState();

    // Set client for scheduler
    setSchedulerClient(client);

    // Register standard handlers
    registerHandler('walletHandler', walletHandler);
    registerHandler('statsHandler', statsHandler);
    registerHandler('gymHandler', gymHandler);
    registerHandler('workHandler', workHandler);
    registerHandler('companyHandler', companyHandler);
    registerHandler('bestRouteHandler', bestRouteHandler);
    registerHandler('profitSummaryHandler', profitSummaryHandler);
    registerHandler('cooldownHandler', cooldownHandler);
    registerHandler('tradeHandler', tradeHandler);
    registerHandler('botStatusHandler', botStatusHandler);

    // Initialize system logger
    initLogger(client);
    logSystem('SYSTEM', { module: 'Bootstrap', action: 'Bot starting', force: true });

    // Register foreign market handlers (per country)
    for (const [countryKey, handler] of Object.entries(foreignMarketHandlers)) {
        registerHandler(`foreignMarket.${countryKey}`, handler);
    }

    // Get runners that have channel IDs configured
    const configuredRunners = getConfiguredRunners();

    // === START PERSONAL RUNNERS ===
    const users = getAllUsers();

    for (const user of Object.values(users)) {
        if (!user.apiKey) continue;

        if (user.channels?.personalStats) {
            await startScheduler(
                `stats:${user.discordId}`,
                user.channels.personalStats,
                { user }
            );
        }

        if (user.channels?.workStats) {
            await startScheduler(
                `work:${user.discordId}`,
                user.channels.workStats,
                { user }
            );
        }
    }

    if (configuredRunners.length === 0) {
        console.log('⚠️ No auto-run channels configured. Set channel IDs in .env');
        console.log('   Available: WALLET_CHANNEL_ID, FM_JAPAN_CHANNEL_ID, etc.');
        return;
    }

    console.log(`📋 Found ${configuredRunners.length} configured auto-run channels`);

    // Start each configured runner
    for (const runner of configuredRunners) {
        try {
            const channelId = process.env[runner.channelEnvKey];

            // Validate channel exists
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                console.error(`❌ Channel not found for ${runner.name}: ${channelId}`);
                continue;
            }

            // Initialize or enable runner in state
            if (!isRunnerEnabled(runner.key)) {
                initRunner(runner.key, channelId);
            }
            setRunnerEnabled(runner.key, true);

            // Start scheduler
            await startScheduler(runner.key, channelId);

        } catch (error) {
            console.error(`❌ Failed to start ${runner.name}:`, error.message);
        }
    }

    console.log('✅ Auto-Run Bootstrap complete!\n');
}

/**
 * Get bootstrap status for display
 */
export function getBootstrapStatus() {
    const configuredRunners = getConfiguredRunners();

    return {
        totalRunners: Object.keys(AUTO_RUNNERS).length,
        configuredRunners: configuredRunners.length,
        runners: configuredRunners.map(r => ({
            key: r.key,
            name: r.name,
            channelId: process.env[r.channelEnvKey] || 'Not configured',
            interval: r.interval
        }))
    };
}
