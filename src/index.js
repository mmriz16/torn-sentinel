/**
 * Torn Sentinel — Discord Bot for Torn City
 * Main entry point
 */

import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startDailySummary } from './services/dailySummary.js';
import { startAlertScheduler, stopAlertScheduler } from './services/alerts/index.js';
import { startupBootstrap, stopAllSchedulers, forceSaveRuntimeState } from './services/autorun/index.js';

// Load environment variables
config();

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
 */
const presenceStates = [
    { text: 'Wallet • Market • Stats', type: ActivityType.Watching },
    { text: 'Torn Economy', type: ActivityType.Watching },
    { text: '/wallet for networth', type: ActivityType.Playing },
    { text: '/stats for bars', type: ActivityType.Playing },
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
