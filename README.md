# Torn Sentinel 🛡️

**Your personal Torn City intelligence hub** — Real-time stats monitoring, financial tracking, and market analysis powered by Discord.

---

## ✨ Features

### 📊 **Auto-Updating Channels**
Live dashboards that automatically refresh in dedicated Discord channels:

- **💰 Wallet** — Financial overview with vault, bank, points, and assets (60s refresh)
- **📈 Personal Stats** — Battle stats, work stats, and comprehensive status bars (5min refresh)
- **🏋️ Gym Progress** — Energy tracking, recent trains, and gym comparison
- **👔 Work Stats** — Job performance, company info, and effectiveness tracking
- **📜 Activity Log** — Latest activities with pagination (5 categories/page)
- **💹 Travel Markets** — Real-time foreign stock prices for all 11 countries (30s refresh)
- **🗺️ Best Route** — Optimal travel destination based on profit margins
- **📦 Trade Detection** — Automatic incoming/outgoing trade notifications
- **🧮 Profit Engine** — Aggregated profit analytics across all activities
- **🧾 Financial Logs** — Detailed money flow tracking
- **💎 Networth Analysis** — Advanced breakdown splitting liquid assets, inventory, market listings, and liabilities

### 🔔 **Smart Notifications**
Get instant alerts for important events:

- **🚨 Market Alerts** — Smart stock monitoring with **purchase detection** and **location awareness** (instant alerts in-country)
- **✈️ Travel Assistant** — Pre-flight checklists (nerve, profit estimates) and landing notifications
- **📜 New Activities** — Real-time notifications for every action
- **📦 Trade Updates** — Incoming/outgoing trade confirmations

### 💬 **Slash Commands**
Quick access to specific data. **Now with Global Autocomplete!**

| Command | Description |
|---------|-------------|
| `/wallet` | View financial overview |
| `/stats` | Check your battle/work stats |
| `/gym` | See gym progress |
| `/work` | View work performance |
| `/travel` | Travel market prices |
| `/market` | Item market search with autocomplete |
| `/config` | Bot configuration |

---

## 🚀 Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it
3. Go to "Bot" → "Add Bot" and copy the token
4. Enable **Message Content Intent** in Bot settings

### 2. Invite Bot to Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select permissions:
   - Send Messages
   - Embed Links
   - Use Slash Commands
   - Manage Messages (for editing auto-update channels)
4. Copy and open the URL to invite

### 3. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit .env with your values
DISCORD_TOKEN=your_bot_token_here
OWNER_ID=your_discord_user_id
GUILD_ID=your_server_id  # Optional

# Configure channel IDs for auto-updates (optional)
WALLET_CHANNEL_ID=123456789
PERSONAL_STATS_CHANNEL_ID=123456789
ACTIVITY_LOG_CHANNEL_ID=123456789
ALERT_CHANNEL_ID=123456789  # For notifications
# ...see .env.example for all available channels
```

### 4. Get Your Torn API Key

1. Go to [Torn API Settings](https://www.torn.com/preferences.php#tab=api)
2. Create new key with "Limited Access" permissions
3. Run bot and register: Use slash command in Discord

### 5. Install & Run

```bash
# Install dependencies
npm install

# Deploy slash commands
node deploy-commands.js

# Start bot
npm start

# Or for development (auto-restart)
npm run dev
```

---

## 📁 Project Structure

```
bot-discord-torn/
├── src/
│   ├── commands/          # Slash commands
│   ├── events/            # Discord event handlers
│   ├── services/
│   │   ├── autorun/       # Auto-updating channel handlers
│   │   ├── analytics/     # Data analysis engines
│   │   ├── market/        # Market monitoring
│   │   └── trade/         # Trade detection
│   ├── localization/      # i18n support (Indonesian)
│   └── utils/             # Helper functions
├── data/                  # User data & state (gitignored)
├── debug/                 # Debug scripts
├── docs/                  # Documentation & samples
└── .agent/               # Workflow definitions
```

---

## 🎯 Auto-Run Channels

The bot maintains live-updating embeds in configured channels:

**Financial & Stats** (Edit Mode)
- `/wallet` channel updates every 60s
- `/stats` channel updates every 5min
- `/gym` channel updates every 60s

**Travel Markets** (Edit Mode)  
- 11 country-specific channels update every 30s
- Best route summary updates every 30s
- Cooldown tracking updates every 60s

**Intelligence** (New Messages)
- Activity log updates every 60s with pagination
- New activity notifications sent to alerts channel
- Profit engine aggregates every 5min

---

## 🌐 Localization

Bot supports **Bahasa Indonesia** with automatic translation:

- UI elements, timestamps, and messages
- Location names, stats, and activities
- Template-based formatting for consistency

Translation cache stored in `data/translation_cache.json`.

---

## 🔧 Development

```bash
# Run with auto-reload
npm run dev

# Deploy commands to Discord
node deploy-commands.js

# Debug specific features
node debug/debug_awards.js
node debug/test-gym.js
```

---

## 📊 Tech Stack

- **Discord.js** v14 — Discord API wrapper
- **Node.js** 18+ — Runtime environment  
- **dotenv** — Environment configuration
- **Custom Analytics** — Profit tracking, trend analysis

---

## 🔒 Data Storage

All user data stored locally in `data/` (gitignored):

- `users.json` — API keys (encrypted storage recommended)
- `*-state.json` — Handler states for persistence
- `activity_*.json` — Activity tracking
- `translation_cache.json` — Translation cache

**Never commit API keys or user data!**

---

## 🆕 Recent Updates

### v3.1 - Market & UX Refinements (Dec 31, 2024)
- ✅ **Global Autocomplete** (Items, Countries, Configs)
- ✅ **Smart Market Alerts** (Purchase detection & Location awareness)
- ✅ **Travel Assistant** (Departure/Landing checklists)
- ✅ **Enhanced Networth** (Detailed liability splitting)

### v3.0 - Activity Log Pagination (Dec 31, 2024)
- ✅ Paginated activity log (5 categories per page)
- ✅ Previous/Next navigation buttons
- ✅ Separated notifications to alerts channel
- ✅ Auto-category detection and registration

### v2.0 - Localization & Intelligence (Dec 2024)
- ✅ Full Indonesian language support
- ✅ Activity detection engine
- ✅ Profit analytics with aggregation
- ✅ Auto-registration for new activity categories

---

## 📄 License

MIT

---

**Made with ❤️ for Torn City players**
