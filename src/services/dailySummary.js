/**
 * Daily Summary Service
 * Handles scheduled daily snapshots, delta calculation, and embed posting
 */

import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { get } from './tornApi.js';
import { getUser, getAllUsers } from './userStorage.js';
import { saveSnapshot, getYesterdaySnapshot } from './snapshotStorage.js';
import { formatMoney, formatNumber } from '../utils/formatters.js';

// API selections for daily summary
const SUMMARY_SELECTIONS = 'money,networth,bars,personalstats,crimes,travel';

/**
 * Start the daily summary scheduler
 * @param {Client} client - Discord client
 */
export function startDailySummary(client) {
    const enabled = process.env.DAILY_SUMMARY_ENABLED === 'true';

    if (!enabled) {
        console.log('📅 Daily Summary is disabled');
        return;
    }

    // Schedule at 00:00 UTC (Torn City Time)
    cron.schedule('0 0 * * *', async () => {
        console.log('📅 Running Daily Summary...');
        await runDailySummary(client);
    }, {
        timezone: 'UTC'
    });

    console.log('📅 Daily Summary scheduler started (00:00 UTC)');
}

/**
 * Run daily summary for all registered users
 * @param {Client} client - Discord client
 */
export async function runDailySummary(client) {
    const channelId = process.env.DAILY_SUMMARY_CHANNEL_ID;

    if (!channelId) {
        console.error('❌ DAILY_SUMMARY_CHANNEL_ID not configured');
        return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        console.error('❌ Could not find daily summary channel');
        return;
    }

    // Get all registered users
    const users = getAllUsers();

    for (const [discordId, userData] of Object.entries(users)) {
        try {
            await processDailySummary(client, channel, discordId, userData);
        } catch (error) {
            console.error(`❌ Daily summary error for ${userData.tornName}:`, error);
        }
    }
}

/**
 * Process daily summary for a single user
 */
async function processDailySummary(client, channel, discordId, userData) {
    const { apiKey, tornName } = userData;

    // Fetch today's snapshot
    const todayData = await fetchSnapshot(apiKey);
    if (!todayData) {
        console.error(`❌ Failed to fetch snapshot for ${tornName}`);
        return;
    }

    // Get yesterday's snapshot
    const yesterdayData = getYesterdaySnapshot();

    // Calculate deltas
    const deltas = calculateDeltas(todayData, yesterdayData);

    // Build and send embed
    const embed = buildSummaryEmbed(todayData, deltas, tornName, !yesterdayData);
    await channel.send({ embeds: [embed] });

    // Save today's snapshot
    saveSnapshot(todayData);

    console.log(`✅ Daily summary posted for ${tornName}`);
}

/**
 * Fetch snapshot data from Torn API
 * @param {string} apiKey - User's API key
 * @returns {Object|null} Snapshot data
 */
async function fetchSnapshot(apiKey) {
    try {
        const data = await get(apiKey, 'user', SUMMARY_SELECTIONS);

        return {
            money: {
                wallet: data.money_onhand || 0,
                bank: data.city_bank?.amount || 0,
                points: data.points || 0
            },
            networth: {
                total: data.networth?.total || 0,
                items: data.networth?.items || 0,
                properties: data.networth?.properties || 0,
                itemmarket: data.networth?.itemmarket || 0,
                unpaidfees: data.networth?.unpaidfees || 0
            },
            bars: {
                energy: {
                    current: data.energy?.current || 0,
                    max: data.energy?.maximum || 0
                },
                nerve: {
                    current: data.nerve?.current || 0,
                    max: data.nerve?.maximum || 0
                },
                happy: data.happy?.current || 0
            },
            personalstats: {
                energydrinkused: data.personalstats?.energydrinkused || 0,
                attackswon: data.personalstats?.attackswon || 0,
                criminaloffenses: data.personalstats?.criminaloffenses || 0,
                traveltimes: data.personalstats?.traveltimes || 0
            }
        };
    } catch (error) {
        console.error('Snapshot fetch error:', error);
        return null;
    }
}

/**
 * Calculate deltas between today and yesterday
 */
function calculateDeltas(today, yesterday) {
    if (!yesterday) {
        return null; // First snapshot, no deltas
    }

    return {
        networth: today.networth.total - yesterday.networth.total,
        items: today.networth.items - yesterday.networth.items,
        itemmarket: today.networth.itemmarket - yesterday.networth.itemmarket,
        unpaidfees: today.networth.unpaidfees - yesterday.networth.unpaidfees,
        attacks: today.personalstats.attackswon - yesterday.personalstats.attackswon,
        crimes: today.personalstats.criminaloffenses - yesterday.personalstats.criminaloffenses,
        travels: today.personalstats.traveltimes - yesterday.personalstats.traveltimes,
        energyDrinks: today.personalstats.energydrinkused - yesterday.personalstats.energydrinkused
    };
}

/**
 * Detect main profit source
 */
function detectProfitSource(deltas) {
    if (!deltas) return null;

    const sources = [
        { name: 'Items', delta: deltas.items },
        { name: 'Item Market', delta: deltas.itemmarket }
    ];

    const sorted = sources.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return sorted[0].delta > 100000 ? sorted[0].name : null;
}

/**
 * Format delta with arrow
 */
function formatDelta(value, prefix = '') {
    if (value === 0) return null;
    const arrow = value > 0 ? '📈' : '📉';
    const sign = value > 0 ? '+' : '';
    return `${sign}${prefix}${formatNumber(value)} ${arrow}`;
}

/**
 * Build summary embed
 */
function buildSummaryEmbed(today, deltas, tornName, isFirstSnapshot) {
    const date = new Date().toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Jakarta'
    });

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF)
        .setTitle(`🎯｜Daily Summary — ${date}`)
        .setDescription('─────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: `${tornName} • Torn Sentinel` });

    if (isFirstSnapshot) {
        embed.addFields({
            name: '📝 First Snapshot',
            value: 'This is your first daily snapshot. Deltas will be available tomorrow.',
            inline: false
        });
    }

    // 💰 Financial Section
    const financialLines = [];
    financialLines.push(`**Networth:** ${formatMoney(today.networth.total)}`);

    if (deltas?.networth) {
        financialLines[0] += ` (${formatDelta(deltas.networth, '$')})`;
    }

    const profitSource = detectProfitSource(deltas);
    if (profitSource) {
        financialLines.push(`**Main Source:** ${profitSource}`);
    }

    if (today.networth.unpaidfees < 0) {
        financialLines.push(`**Unpaid Fees:** ${formatMoney(today.networth.unpaidfees)}`);
    }

    embed.addFields({
        name: '💰｜Financial',
        value: financialLines.join('\n'),
        inline: false
    });

    // ⚡ Activity Section (only if deltas exist)
    if (deltas) {
        const activityLines = [];

        if (deltas.attacks > 0) {
            activityLines.push(`**Attacks Won:** +${deltas.attacks}`);
        }
        if (deltas.crimes > 0) {
            activityLines.push(`**Crimes:** +${deltas.crimes}`);
        }
        if (deltas.energyDrinks > 0) {
            activityLines.push(`**Energy Drinks:** +${deltas.energyDrinks}`);
        }

        if (activityLines.length > 0) {
            embed.addFields({
                name: '⚡｜Activity',
                value: activityLines.join('\n'),
                inline: false
            });
        }
    }

    // 🧳 Travel Section (only if deltas exist)
    if (deltas?.travels > 0) {
        embed.addFields({
            name: '🧳｜Travel',
            value: `**Trips:** +${deltas.travels}`,
            inline: false
        });
    }

    // ⚠️ Notable Events
    const warnings = [];
    if (deltas?.networth < -500000) {
        warnings.push('⚠️ Significant networth decrease');
    }
    if (deltas?.unpaidfees < 0) {
        warnings.push('⚠️ Unpaid fees increased');
    }

    if (warnings.length > 0) {
        embed.addFields({
            name: '⚠️｜Notable Events',
            value: warnings.join('\n'),
            inline: false
        });
    }

    return embed;
}

/**
 * Manual trigger for testing
 */
export async function triggerDailySummary(client) {
    console.log('📅 Manual daily summary triggered');
    await runDailySummary(client);
}

export default {
    startDailySummary,
    runDailySummary,
    triggerDailySummary
};
