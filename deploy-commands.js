import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import 'dotenv/config';

// Check for required environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ Error: DISCORD_TOKEN is missing in .env');
    process.exit(1);
}

if (!process.env.CLIENT_ID) {
    console.warn('⚠️  Warning: CLIENT_ID is missing in .env');
    console.warn('ℹ️  If you are running this script manually, you MUST add CLIENT_ID=your_bot_id to .env');
    console.warn('ℹ️  Alternatively, run "npm start" which registers commands automatically using the logged-in client.');
    process.exit(1);
}

const commands = [];
const commandsPath = path.resolve('./src/commands');

if (!fs.existsSync(commandsPath)) {
    console.error(`❌ Error: Commands directory not found at ${commandsPath}`);
    process.exit(1);
}

const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file =>
        file.endsWith('.js') &&
        !file.includes('test')
    );

console.log(`📦 Found ${commandFiles.length} command files in ${commandsPath}`);

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    // Import using file URL for Windows compatibility
    const commandModule = await import(pathToFileURL(filePath).href);

    // Support both Named Export (export const data) and Default Export (export default { data })
    const commandData = commandModule.data || commandModule.default?.data;

    if (commandData) {
        commands.push(commandData.toJSON());
    } else {
        console.warn(`⚠️  ${file} skipped: missing "data" export`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🚀 Deploying ${commands.length} slash commands...`);

        // Check if GUILD_ID is present for guild-specific deployment (faster)
        if (process.env.GUILD_ID) {
            console.log(`target: Guild (${process.env.GUILD_ID})`);
            await rest.put(
                Routes.applicationGuildCommands(
                    process.env.CLIENT_ID,
                    process.env.GUILD_ID
                ),
                { body: commands }
            );
        } else {
            console.log(`target: Global`);
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
        }

        console.log('✅ Slash commands deployed successfully!');
    } catch (error) {
        console.error('❌ Deploy failed:', error);
    }
})();
