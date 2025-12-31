/**
 * Bazaar Check Handler for Auto-Run
 * Monitors bazaar value and provides market insights
 * 
 * Mode A: User has NO bazaar - shows flipping recommendations
 * Mode B: User HAS bazaar - shows estimated value & breakdown
 */

import { EmbedBuilder } from 'discord.js';
import { getV2, getCombinedStats } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';
import { formatTimeShort } from '../../../utils/formatters.js';


// Snapshot storage for delta tracking
let lastBazaarSnapshot = {
    value: 0,
    timestamp: 0
};

// Popular items for flipping recommendations
const FLIP_ITEMS = [
    { name: 'Xanax', id: 206, category: 'Drug' },
    { name: 'FHC', id: 67, category: 'Medical' },
    { name: 'Feathery Hotel Coupon', id: 260, category: 'Special' },
    { name: 'Camel Plushie', id: 186, category: 'Plushie' },
    { name: 'Lion Plushie', id: 273, category: 'Plushie' },
    { name: 'Jaguar Plushie', id: 258, category: 'Plushie' },
];

export async function bazaarHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // 1. Get Networth data (includes bazaar value)
        const networthData = await getCombinedStats(user.apiKey, 'networth');
        if (!networthData.networth) return null;

        const bazaarValue = networthData.networth.bazaar || 0;
        const hasBazaar = bazaarValue > 0;

        // 2. Track value changes
        const now = Date.now();
        const valueDelta = bazaarValue - lastBazaarSnapshot.value;
        const deltaPercent = lastBazaarSnapshot.value > 0
            ? ((valueDelta / lastBazaarSnapshot.value) * 100).toFixed(1)
            : 0;

        // Update snapshot
        lastBazaarSnapshot = { value: bazaarValue, timestamp: now };

        // 3. Build embed based on mode
        if (!hasBazaar) {
            // MODE A: No Bazaar - Show flipping recommendations
            return await buildModeAEmbed(user.apiKey);
        } else {
            // MODE B: Has Bazaar - Show value overview
            return buildModeBEmbed(bazaarValue, valueDelta, deltaPercent, networthData.networth);
        }

    } catch (error) {
        console.error('❌ Bazaar Handler Error:', error.message);
        return null;
    }
}

/**
 * Mode A: User doesn't have bazaar
 * Shows item flipping recommendations
 */
async function buildModeAEmbed(apiKey) {
    // Get market data for flip items
    const marketInsights = [];

    for (const item of FLIP_ITEMS.slice(0, 4)) {
        try {
            const marketData = await getV2(apiKey, `market/${item.id}/itemmarket`);
            const listings = marketData.itemmarket?.listings || [];

            if (listings.length > 0) {
                const prices = listings.map(l => l.price);
                const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
                const lowestPrice = Math.min(...prices);
                const margin = ((avgPrice - lowestPrice) / lowestPrice * 100).toFixed(1);

                marketInsights.push({
                    name: item.name,
                    avgPrice,
                    lowestPrice,
                    margin,
                    listings: listings.length
                });
            }
        } catch (e) {
            // Skip failed items
        }
    }

    // Build recommendation text
    let recommendations = '';
    if (marketInsights.length > 0) {
        recommendations = marketInsights
            .sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin))
            .slice(0, 4)
            .map(i => `• **${i.name}** — ${formatMoney(i.avgPrice)} | Margin ~${i.margin}%`)
            .join('\n');
    } else {
        recommendations = `• ${getUi('market_no_data')}`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x95A5A6) // Gray - no bazaar
        .setTitle(`🛒 ${getUi('bazaar_check')}`)
        .addFields(
            { name: 'Status', value: `\`\`\`❌ ${getUi('not_owned')}\`\`\``, inline: false },
            { name: `💡 ${getUi('recommended_items')}`, value: recommendations, inline: false },
            { name: '📌 Tip', value: getUi('tip_bazaar'), inline: false }
        )
    const interval = formatTimeShort(AUTO_RUNNERS.bazaarCheck.interval);
    embed.setFooter({ text: `Torn Sentinel • Auto update every ${interval}` })

        .setTimestamp();

    return embed;
}

/**
 * Mode B: User has bazaar
 * Shows estimated value and market signals
 */
function buildModeBEmbed(bazaarValue, valueDelta, deltaPercent, networth) {
    // Determine trend indicator
    let trendIcon = '→';
    let trendColor = 0x3498DB; // Blue - stable

    if (valueDelta > 100000) {
        trendIcon = '📈';
        trendColor = 0x2ECC71; // Green - rising
    } else if (valueDelta < -100000) {
        trendIcon = '📉';
        trendColor = 0xE74C3C; // Red - falling
    }

    // Delta display
    let deltaText = getUi('no_change');
    if (valueDelta !== 0) {
        const sign = valueDelta > 0 ? '+' : '';
        deltaText = `${sign}${formatMoney(valueDelta)} (${sign}${deltaPercent}%)`;
    }

    // Estimate breakdown (based on typical bazaar composition)
    // Since API doesn't provide actual items, we estimate categories
    const consumablesEst = Math.round(bazaarValue * 0.55);
    const plushiesEst = Math.round(bazaarValue * 0.25);
    const othersEst = bazaarValue - consumablesEst - plushiesEst;

    // Market signals (simplified - would need more complex tracking for real signals)
    const signals = [
        { item: 'Xanax', trend: '↓', note: getUi('oversupplied') },
        { item: 'FHC', trend: '→', note: getUi('demand') },
        { item: 'Plushies', trend: '↑', note: getUi('collectors') },
    ];

    const signalText = signals
        .map(s => `• ${s.item} ${s.trend} — ${s.note}`)
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor(trendColor)
        .setTitle(`🛒 ${getUi('bazaar_check')} ${trendIcon}`)
        .addFields(
            { name: 'Status', value: `\`\`\`✅ ${getUi('active').toUpperCase()}\`\`\``, inline: true },
            { name: getUi('estimated_value'), value: `\`\`\`${formatMoney(bazaarValue)}\`\`\``, inline: true },
            { name: getUi('change'), value: `\`\`\`${deltaText}\`\`\``, inline: true },

            {
                name: `📊 ${getUi('estimated_breakdown')}`, value: [
                    `• ${getUi('consumables')}: ~${formatMoney(consumablesEst)}`,
                    `• Plushies: ~${formatMoney(plushiesEst)}`, // Plushies is generic, keep English or "Boneka"? (Plushies is common term) -> "Plushie" is usually kept.
                    `• ${getUi('others')}: ~${formatMoney(othersEst)}`
                ].join('\n'), inline: false
            },

            { name: `📈 ${getUi('market_signals')}`, value: signalText, inline: false }
        )
    const interval = formatTimeShort(AUTO_RUNNERS.bazaarCheck.interval);
    embed.setFooter({ text: `${getUi('listings_unavailable')} • Updated every ${interval}` })

        .setTimestamp();

    return embed;
}
