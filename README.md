# Torn Sentinel 🛡️

A Discord bot for Torn City players — Financial tracking, stats monitoring, and market analysis.

## Features

- **`/register`** — Register your Torn API key securely
- **`/wallet`** — Financial overview with auto-refresh (60s)
- **`/stats`** — Player bars with threshold indicators (30s auto-refresh)

## Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Copy the bot token

### 2. Get Bot Invite Link

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
4. Copy and open the generated URL to invite the bot

### 3. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your values
DISCORD_TOKEN=your_bot_token_here
OWNER_ID=your_discord_user_id
GUILD_ID=your_test_server_id  # Optional, for faster command updates
```

### 4. Install & Run

```bash
# Install dependencies
npm install

# Start the bot
npm start

# Or for development (auto-restart on changes)
npm run dev
```

## Getting Your Torn API Key

1. Go to [Torn API Settings](https://www.torn.com/preferences.php#tab=api)
2. Create a new key with "Limited Access" permissions
3. Use `/register key` in Discord to link your account

## Commands

| Command | Description | Refresh Rate |
|---------|-------------|--------------|
| `/register key` | Link your Torn API key | - |
| `/register status` | Check registration status | - |
| `/register remove` | Unlink your account | - |
| `/wallet` | Financial overview | 60 seconds |
| `/stats` | Player bars & cooldowns | 30 seconds |

## Data Storage

User data (API keys) are stored in `data/users.json`. This file is gitignored and never committed.

## Development

```bash
# Run with auto-reload
npm run dev
```

## Tech Stack

- **Discord.js** v14
- **Node.js** 18+
- **dotenv** for configuration

## License

MIT
