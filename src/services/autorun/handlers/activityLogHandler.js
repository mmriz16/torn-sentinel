/**
 * Activity Log Handler
 * Shows activity events from Torn API logs in Discord channel
 * Uses direct API log selection for accurate event tracking
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { get } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
    applyTemplate,
    getLocation,
    getStat,
    formatTimeId,
    formatTimeAgoId,
    getUi,
    getAction,
    getTemplate
} from '../../../localization/index.js';

const STATE_FILE = './data/activity-log-state.json';
const ITEMS_PER_PAGE = 5;

// Category icons mapping
const CATEGORY_ICONS = {
    'Gym': '🏋️',
    'Travel': '✈️',
    'Crimes': '🧠',
    'Item market': '🛒',
    'Hospital': '🏥',
    'Attacking': '⚔️',
    'Jail': '🔒',
    'Company': '🏢',
    'Missions': '🎯',
    'Merits': '🏅',
    'Authentication': '🔐',
    'Casino': '🎰',
    'Racing': '🏎️',
    'Faction': '⚔️',
    'War': '💥',
    'Trade': '📦',
    'Education': '📚',
    'Drug': '💊',
    'Points': '💎',
    'Bounty': '💰',
    'Property': '🏠',
    'Bazaar': '🏪',
    'Stock market': '📈',
    'Bank': '🏦',
    'Messages': '💬',
    'Events': '🎉',
    'Classified Ads': '📰',
    'Awards': '🏆',
    'Points market': '💎',
    'Item use': '🎁',
    'default': '📌'
};

// Category colors mapping
const CATEGORY_COLORS = {
    'Gym': 0x58ACFF,        // Light blue
    'Travel': 0x3498DB,      // Blue
    'Crimes': 0x9B59B6,      // Purple
    'Item market': 0x2ECC71, // Green
    'Hospital': 0xE74C3C,    // Red
    'Attacking': 0xE74C3C,   // Red
    'Jail': 0xE67E22,        // Orange
    'Company': 0x1ABC9C,     // Teal
    'Missions': 0xF39C12,    // Yellow
    'Merits': 0xF1C40F,      // Gold
    'Authentication': 0x95A5A6, // Gray
    'Casino': 0xF39C12,      // Yellow-orange
    'Racing': 0xE74C3C,      // Red
    'Faction': 0xE74C3C,     // Red
    'War': 0xE74C3C,         // Red
    'Trade': 0x2ECC71,       // Green
    'Education': 0x3498DB,   // Blue
    'Drug': 0x9B59B6,        // Purple
    'Points': 0xF1C40F,      // Gold
    'Bounty': 0xF39C12,      // Yellow-orange
    'Property': 0x1ABC9C,    // Teal
    'Bazaar': 0x2ECC71,      // Green
    'Stock market': 0x2ECC71, // Green
    'Bank': 0x1ABC9C,        // Teal
    'Messages': 0x3498DB,    // Blue
    'Events': 0xF39C12,      // Yellow-orange
    'Classified Ads': 0x95A5A6, // Gray
    'Awards': 0xF1C40F,      // Gold
    'Points market': 0xF1C40F,  // Gold
    'Item use': 0x9B59B6,    // Purple
    'default': 0x3498DB
};

// Last processed log timestamp to avoid duplicates - persisted
let lastProcessedTimestamp = loadLastTimestamp();

// Category tracking
const CATEGORY_STATE_FILE = './data/activity-categories.json';

function loadLastTimestamp() {
    if (existsSync(STATE_FILE)) {
        try {
            const data = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
            console.log(`📜 Activity log state loaded: last processed ${new Date(data.lastProcessedTimestamp * 1000).toISOString()}`);
            return data.lastProcessedTimestamp || 0;
        } catch (e) {
            return 0;
        }
    }
    return 0;
}

function saveLastTimestamp(timestamp) {
    try {
        writeFileSync(STATE_FILE, JSON.stringify({ lastProcessedTimestamp: timestamp }, null, 2));
    } catch (e) {
        console.error('❌ Error saving activity log state:', e.message);
    }
}

/**
 * Load known categories from persistent storage
 */
function loadKnownCategories() {
    if (existsSync(CATEGORY_STATE_FILE)) {
        try {
            const data = JSON.parse(readFileSync(CATEGORY_STATE_FILE, 'utf8'));
            return data.categories || {};
        } catch (e) {
            return {};
        }
    }
    return {};
}

/**
 * Save a newly discovered category
 */
function saveKnownCategory(category) {
    const known = loadKnownCategories();
    if (!known[category]) {
        known[category] = {
            firstSeen: Date.now(),
            icon: CATEGORY_ICONS[category] || CATEGORY_ICONS.default,
            color: CATEGORY_COLORS[category] || CATEGORY_COLORS.default
        };

        try {
            writeFileSync(CATEGORY_STATE_FILE, JSON.stringify({ categories: known }, null, 2));
            console.log(`📌 New activity category discovered: "${category}"`);
        } catch (e) {
            console.error('❌ Error saving category:', e.message);
        }
    }
}

/**
 * Format log entry for display - Compact and scannable format
 */
/**
 * Format log entry for display - Compact and scannable format
 */
function formatLogEntry(entry) {
    const icon = CATEGORY_ICONS[entry.category] || CATEGORY_ICONS.default;
    const time = `<t:${entry.timestamp}:R>`;
    const text = formatLogText(entry);

    // We already have the text from formatLogText, so we just return it with icon and time
    // But since the new design splits label and detail, we might want to refactor formatLogText to return object
    // For now, let's keep the single string return from formatLogText as it handles the logic

    return `${icon} ${text} ${time}`;
}

/**
 * Get location name from ID
 */
/**
 * Get location name from ID (using localization)
 */
function getLocationName(id) {
    const locations = {
        1: 'Torn City', 2: 'Mexico', 3: 'Cayman Islands', 4: 'Canada',
        5: 'Hawaii', 6: 'United Kingdom', 7: 'Argentina', 8: 'Switzerland',
        9: 'Japan', 10: 'China', 11: 'UAE', 12: 'South Africa'
    };
    const name = locations[id] || `Location ${id}`;
    return getLocation(name);
}

/**
 * Get gym name from ID
 */
function getGymName(id) {
    const gyms = {
        1: 'Premier Fitness', 2: 'Average Joes', 3: "Woody's Workout", 4: 'Beach Bods',
        5: 'Silver Gym', 6: 'Pour Femme', 7: 'Davies Den', 8: 'Global Gym',
        9: 'Knuckle Heads', 10: 'Pioneer Fitness', 11: 'Anabolic Anomalies', 12: 'Core',
        13: 'Racing Fitness', 14: 'Complete Cardio', 15: 'Legs Bums and Tums', 16: 'Deep Burn',
        17: 'Apollo Gym', 18: 'Gun Shop', 19: 'Force Training', 20: "Cha Cha's",
        21: 'Atlas', 22: 'Last Round', 23: 'The Edge', 24: "George's",
        25: 'Balboas Gym', 26: 'Frontline Fitness', 27: 'Gym 3000', 28: "Mr. Miyagi's",
        29: 'Total Rebound', 30: 'Elites', 31: 'Sports Science Lab', 32: 'Crims Gym'
    };
    return gyms[id] || `Gym ${id}`;
}

/**
 * Get item name from ID - Common items
 */
function getItemName(id) {
    const items = {
        // Travel items
        384: 'Xanax', 206: 'Feathery Hotel Coupon', 366: 'Morphine',
        367: 'Opium', 368: 'Shrooms', 369: 'Speed', 370: 'Cannabis',
        371: 'Ketamine', 372: 'LSD', 373: 'PCP', 374: 'Vicodin', 375: 'Ecstasy',
        // Plushies
        258: 'Sheep Plushie', 261: 'Teddy Bear Plushie', 266: 'Chamois Plushie',
        268: 'Jaguar Plushie', 269: 'Wolverine Plushie', 270: 'Nessie Plushie',
        271: 'Red Fox Plushie', 272: 'Camel Plushie', 273: 'Panda Plushie',
        274: 'Lion Plushie', 281: 'Monkey Plushie', 282: 'Kitten Plushie',
        // Flowers
        260: 'Dahlia', 262: 'Crocus', 263: 'Orchid', 264: 'African Violet',
        265: 'Cherry Blossom', 267: 'Heather', 276: 'Peony', 277: 'Ceibo Flower',
        282: 'Edelweiss', 285: 'Banana Orchid', 617: 'Tribulus Omanense',
        // Boosters
        176: 'Can of Damp', 177: 'Can of Munster', 178: 'Bottle of Beer',
        179: 'Bottle of Tequila', 180: 'Bottle of Champagne',
        // Crime items
        35: 'Box of Chocolate Bars', 36: 'Big Box of Chocolate Bars',
        // Other
        283: 'Brick'
    };
    return items[id] || `Item #${id}`;
}

/**
 * Format time in seconds to readable format
 */
// formatTime removed, replaced by formatTimeId from localization


/**
 * Format duration in seconds to readable format (for travel)
 */
// formatDuration removed, replaced by formatTimeId from localization


/**
 * Format number with commas
 */
function formatNumber(num) {
    if (!num) return '0';
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Activity Log Handler
 * @param {Client} client - Discord client
 * @returns {Object|null} - { embeds: [...], components: [...] }
 */
export async function activityLogHandler(client) {
    return getActivityLogPage(client, 0);
}

/**
 * Get activity log page with pagination
 * @param {Client} client - Discord client
 * @param {number} page - Page number (0-indexed)
 * @returns {Object|null} - { embeds: [...], components: [...] }
 */
export async function getActivityLogPage(client, page = 0) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Fetch logs from API
        const data = await get(user.apiKey, 'user', 'log');
        if (!data || !data.log) return null;

        // Parse log entries
        const entries = Object.entries(data.log)
            .map(([id, entry]) => ({ id, ...entry }))
            .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

        if (entries.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x95A5A6)
                .setTitle(getUi('activity_log'))
                .setDescription('```Tidak ada aktivitas terbaru```')
                .setFooter({ text: 'Torn Sentinel • API Logs' })
                .setTimestamp();
            return { embeds: [embed], components: [] };
        }

        // Send notifications for NEW events (since last check) - only on page 0
        if (page === 0) {
            const channelId = process.env.ALERT_CHANNEL_ID; // Send to alerts channel, not activity log channel
            if (channelId && lastProcessedTimestamp > 0) {
                const newEntries = entries.filter(e => e.timestamp > lastProcessedTimestamp);

                if (newEntries.length > 0 && newEntries.length <= 5) {
                    try {
                        const channel = await client.channels.fetch(channelId);

                        for (const entry of newEntries.reverse()) { // Send oldest first
                            const color = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.default;
                            const miniEmbed = new EmbedBuilder()
                                .setColor(color)
                                .setDescription(formatLogEntry(entry))
                                .setTimestamp(new Date(entry.timestamp * 1000));

                            await channel.send({ embeds: [miniEmbed] });
                        }
                    } catch (e) {
                        console.error('❌ Failed to send activity notification:', e.message);
                    }
                }
            }

            // Update last processed timestamp and persist
            if (entries.length > 0) {
                lastProcessedTimestamp = entries[0].timestamp;
                saveLastTimestamp(lastProcessedTimestamp);
            }
        }

        // Group by category - only keep the LATEST entry per category
        const latestByCategory = new Map();
        for (const entry of entries) {
            const cat = entry.category || 'Other';

            // Auto-register new category
            saveKnownCategory(cat);

            if (!latestByCategory.has(cat)) {
                latestByCategory.set(cat, entry);
            }
        }

        // Sort categories by their entry timestamp (newest first)
        const sortedCategories = Array.from(latestByCategory.entries())
            .sort((a, b) => b[1].timestamp - a[1].timestamp);

        // Pagination
        const totalCategories = sortedCategories.length;
        const totalPages = Math.ceil(totalCategories / ITEMS_PER_PAGE);
        const currentPage = Math.max(0, Math.min(page, totalPages - 1)); // Clamp page

        const start = currentPage * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const paginatedCategories = sortedCategories.slice(start, end);

        // Find the newest entry overall
        const newestTimestamp = sortedCategories.length > 0 ? sortedCategories[0][1].timestamp : 0;

        const lines = [];
        lines.push('─────────────────────────────────────────────────────────────');

        // Add paginated entries
        for (const [cat, entry] of paginatedCategories) {
            const isNewest = entry.timestamp === newestTimestamp && currentPage === 0;
            lines.push(formatCategoryBlock(entry, isNewest));
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(getUi('activity_log'))
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Page ${currentPage + 1}/${totalPages} • ${latestByCategory.size} categories total` })
            .setTimestamp();

        // Create pagination buttons
        const components = [];
        if (totalPages > 1) {
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`activity_log_prev:${currentPage}`)
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`activity_log_next:${currentPage}`)
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1)
                );
            components.push(buttons);
        }

        return { embeds: [embed], components };

    } catch (error) {
        console.error('❌ Activity Log Handler Error:', error.message);
        return null;
    }
}

/**
 * Format a category block with code block
 */
function formatCategoryBlock(entry, isNewest = false) {
    const icon = CATEGORY_ICONS[entry.category] || CATEGORY_ICONS.default;
    const catName = entry.category || 'Activity';
    const timeAgo = formatTimeAgoId(entry.timestamp);
    const text = formatLogText(entry);

    const newBadge = isNewest ? ' 🔴 NEW' : '';
    return `${icon} **${catName}**${newBadge} • ${timeAgo}\n\`\`\`${text}\`\`\``;
}

/**
 * Get relative time string
 */
// getRelativeTime removed, replaced by formatTimeAgoId from localization


/**
 * Format log text for code block (natural language)
 */
function formatLogText(entry) {
    switch (entry.category) {
        case 'Gym':
            if (entry.data?.trains && entry.data?.energy_used) {
                const statRaw = entry.title?.replace('Gym train ', '') || 'stat';
                const stat = getStat(statRaw);
                const gymName = getGymName(entry.data.gym);

                // Using template: "Kamu berlatih {stat} {trains}x di {gym} menggunakan {energy}E"
                let text = applyTemplate('gym_trained', {
                    stat: stat,
                    trains: entry.data.trains,
                    gym: gymName,
                    energy: entry.data.energy_used
                });

                // Add gain info
                const gain = entry.data.strength_increased || entry.data.defense_increased ||
                    entry.data.speed_increased || entry.data.dexterity_increased || 0;

                if (gain > 0) text += ` (+${gain.toFixed(1)})`;
                return text;
            }
            return entry.title;

        case 'Travel':
            if (entry.log === 6000) {
                const origin = getLocationName(entry.data?.origin);
                const dest = getLocationName(entry.data?.destination);
                const duration = formatTimeId(entry.data?.duration);

                return applyTemplate('travel_boarded', {
                    duration: duration,
                    origin: origin,
                    destination: dest
                });
            } else if (entry.log === 4201) {
                const itemName = getItemName(entry.data?.item);
                const area = getLocationName(entry.data?.area);

                return applyTemplate('travel_bought', {
                    quantity: entry.data?.quantity,
                    item: itemName,
                    total: formatMoney(entry.data?.cost_total),
                    location: area
                });
            }
            return entry.title;

        case 'Crimes':
            if (entry.data?.item_gained) {
                const itemName = getItemName(entry.data.item_gained);
                return applyTemplate('crime_success', {
                    item: itemName,
                    nerve: entry.data.nerve
                });
            } else if (entry.data?.jail_time_increased) {
                return applyTemplate('crime_failed', {
                    time: formatTimeId(entry.data.jail_time_increased)
                });
            }
            return entry.title;

        case 'Item market':
            if (entry.log === 1113) {
                const items = entry.data?.items?.[0];
                const itemName = getItemName(items?.id);
                return applyTemplate('market_sold', {
                    quantity: items?.qty,
                    item: itemName,
                    total: formatMoney(entry.data?.cost_total)
                });
            } else if (entry.log === 1112) {
                const items = entry.data?.items?.[0];
                const itemName = getItemName(items?.id);
                return applyTemplate('market_bought', {
                    quantity: items?.qty,
                    item: itemName,
                    total: formatMoney(entry.data?.cost_total)
                });
            } else if (entry.log === 1110) {
                const items = entry.data?.items?.[0];
                const itemName = getItemName(items?.id);
                return applyTemplate('market_listed', {
                    quantity: items?.qty,
                    item: itemName,
                    price: formatMoney(entry.data?.price)
                });
            }
            return entry.title;

        case 'Hospital':
            return applyTemplate('hospitalized', {
                time: formatTimeId(entry.data?.time),
                reason: entry.data?.reason || 'Unknown'
            });

        case 'Attacking':
            if (entry.data?.anonymous) {
                // Seseorang menyerangmu secara anonim → RS {time}
                return applyTemplate('attacked_anon', {
                    time: formatTimeId(entry.data?.hospital_time_increased)
                });
            }
            return entry.title;

        case 'Jail':
            if (entry.log === 5350) {
                return applyTemplate('jailed', {
                    time: formatTimeId(entry.data?.time),
                });
            } else if (entry.log === 5361) {
                return applyTemplate('busted', {});
            }
            return entry.title;

        case 'Company':
            if (entry.data?.pay) {
                return applyTemplate('paid', {
                    amount: formatMoney(entry.data.pay),
                    jp: entry.data.job_points || 0
                });
            }
            return entry.title;

        case 'Missions':
            const diff = entry.data?.difficulty || 'unknown';
            return applyTemplate('mission_accepted', {
                difficulty: diff
            });

        case 'Merits':
            return applyTemplate('medal_awarded', {});

        case 'Authentication':
            return applyTemplate('login', {});

        case 'Awards':
            // Title change awards
            if (entry.log === 5140 && entry.data?.title) {
                return `Berganti title menjadi "${entry.data.title}"`;
            }
            return entry.title;

        case 'Faction':
            // Faction position change, member joined/left, etc.
            if (entry.data?.position_after !== undefined) {
                return `Posisi faction berubah`;
            }
            return entry.title;

        case 'Points market':
            // Points market transactions
            if (entry.data?.cost_total) {
                return `Transaksi Points Market: $${formatMoney(entry.data.cost_total)}`;
            }
            return entry.title;

        case 'Item use':
            // Item usage
            if (entry.data?.item) {
                const itemName = getItemName(entry.data.item);
                return `Menggunakan ${itemName}`;
            }
            return entry.title;

        default:
            return entry.title || 'Activity recorded';
    }
}

