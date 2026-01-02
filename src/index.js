/**
 * Torn Sentinel — Discord Bot for Torn City
 * Main entry point
 */

import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import express from 'express';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startDailySummary } from './services/dailySummary.js';
import { startAlertScheduler, stopAlertScheduler } from './services/alerts/index.js';
import { startupBootstrap, stopAllSchedulers, forceSaveRuntimeState, getActiveSchedulers, getSchedulerHealth } from './services/autorun/index.js';
import { getAllRunnerStates } from './services/autorun/runtimeStateManager.js';

// Load environment variables
config();

// HTTP server for Render (required)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Torn Sentinel is alive');
});

// Enhanced health endpoint for monitoring
app.get('/health', (req, res) => {
    const schedulerHealth = getSchedulerHealth();
    const runnerStates = getAllRunnerStates();
    const activeSchedulers = getActiveSchedulers();

    // Count healthy vs unhealthy
    const healthyCount = Object.values(schedulerHealth).filter(h => h.healthy).length;
    const totalCount = Object.keys(schedulerHealth).length;

    // Find stale runners (not updated in 10x their interval)
    const now = Date.now();
    const staleRunners = [];
    for (const [key, state] of Object.entries(runnerStates)) {
        if (state.lastRun && (now - state.lastRun) > 10 * 60 * 1000) { // 10 min threshold
            staleRunners.push(key);
        }
    }

    res.json({
        status: healthyCount === totalCount && staleRunners.length === 0 ? 'ok' : 'degraded',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        schedulers: {
            active: activeSchedulers.length,
            healthy: healthyCount,
            total: totalCount
        },
        staleRunners: staleRunners.slice(0, 5), // Show first 5
        timestamp: new Date().toISOString()
    });
});

// Detailed status endpoint
app.get('/status', (req, res) => {
    const runnerStates = getAllRunnerStates();
    const now = Date.now();

    const status = {};
    for (const [key, state] of Object.entries(runnerStates)) {
        const ago = state.lastRun ? Math.floor((now - state.lastRun) / 1000) : null;
        status[key] = {
            lastRun: ago !== null ? `${ago}s ago` : 'never',
            errorCount: state.errorCount || 0,
            lastError: state.lastError || null
        };
    }

    res.json(status);
});

app.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

// ES Module directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// Command collection
client.commands = new Collection();

// Active intervals tracker (for auto-refresh cleanup)
client.activeIntervals = new Map();

/**
 * Load all commands from the commands directory
 */
async function loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = join(commandsPath, file);
        const command = await import(`file://${filePath}`);

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Loaded command: ${command.data.name}`);
        } else {
            console.warn(`⚠️ Command ${file} missing required "data" or "execute" export`);
        }
    }
}

/**
 * Register slash commands with Discord API
 */
async function registerCommands() {
    const commands = [];

    client.commands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`🔄 Registering ${commands.length} slash commands...`);

        // Use guild commands for faster updates during development
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
                { body: commands }
            );
            console.log(`✅ Registered commands to guild: ${process.env.GUILD_ID}`);
        } else {
            // Global commands (can take up to 1 hour to propagate)
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log('✅ Registered global commands');
        }
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
}

/**
 * Load event handlers
 */
async function loadEvents() {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = join(eventsPath, file);
        const event = await import(`file://${filePath}`);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }

        console.log(`✅ Loaded event: ${event.name}`);
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`\n🤖 Torn Sentinel is online!`);
    console.log(`📛 Logged in as: ${client.user.tag}`);
    console.log(`🏠 Serving ${client.guilds.cache.size} servers\n`);

    // Set Rich Presence
    updatePresence(client);

    // Rotate presence every 30 seconds
    setInterval(() => updatePresence(client), 30000);

    // Register commands after bot is ready
    await registerCommands();

    // Start daily summary scheduler
    startDailySummary(client);

    // Start alert notification scheduler
    startAlertScheduler(client);

    // Start auto-run channels
    await startupBootstrap(client);
});

/**
 * Update bot Rich Presence with rotating status
 * Torn-themed presence that rotates every 30s
 */
const presenceStates = [
    // Commands
    { text: '/stats • /wallet • /travel', type: ActivityType.Listening },
    { text: '/gym • /work • /market', type: ActivityType.Listening },

    // Torn vibes
    { text: 'Torn City markets 📈', type: ActivityType.Watching },
    { text: 'your travel profits 💰', type: ActivityType.Watching },
    { text: 'foreign stock prices', type: ActivityType.Watching },

    // Tips
    { text: 'Buy low, sell high 🎯', type: ActivityType.Playing },
    { text: 'Tracking 11 countries ✈️', type: ActivityType.Playing },
    { text: 'Real-time alerts 🔔', type: ActivityType.Playing },
];

let presenceIndex = 0;

function updatePresence(client) {
    const presence = presenceStates[presenceIndex];

    client.user.setPresence({
        activities: [{
            name: presence.text,
            type: presence.type,
        }],
        status: 'online',
    });

    presenceIndex = (presenceIndex + 1) % presenceStates.length;
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');

    // Stop alert scheduler
    stopAlertScheduler();

    // Stop auto-run schedulers
    stopAllSchedulers();
    forceSaveRuntimeState();

    // Clear all active intervals
    client.activeIntervals.forEach((interval, key) => {
        clearInterval(interval);
        console.log(`⏹️ Cleared interval: ${key}`);
    });

    client.destroy();
    process.exit(0);
});

// Unhandled errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

// Start the bot
async function start() {
    try {
        await loadCommands();
        await loadEvents();
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

start();
