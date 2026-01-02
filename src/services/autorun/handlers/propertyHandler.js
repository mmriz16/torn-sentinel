/**
 * Property Info Handler
 * Displays real-time dashboard of user's active property, costs, and portfolio.
 * Updated to support Rented vs Active property distinction.
 */

import { EmbedBuilder } from 'discord.js';
import { getV2 } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney, formatNumber, formatTimeShort } from '../../../utils/formatters.js';
import { getUi, applyTemplate } from '../../../localization/index.js';
import { AUTO_RUNNERS } from '../autoRunRegistry.js';

export async function propertyHandler(client) {
    try {
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];
        if (!user.apiKey) return null;

        // Fetch properties from V2 API
        const data = await getV2(user.apiKey, 'user/properties');
        if (!data || !data.properties) return null;

        const properties = Object.values(data.properties); // V2 might return object or array, handle both if possible, but usually V2 list endpoints return object with IDs keys or array. 
        // Docs say: local properties = ... 
        // Actually V2 'user/properties' returns a list/map. Let's assume object values is safe.
        // Wait, V2 usually returns 'properties': { 'id': { ... } }

        // Find Active Property (used by user)
        // Check 'status' ('rented', 'owned') and 'used_by' user ID? 
        // V2 structure usually has 'status' and depending on status, 'rented' fields.
        // PRD says: status -> rented | owned | none
        // used_by matches user?

        // We probably need to fetch 'torn' user ID first to know who "we" are? 
        // But `user.tornId` should be available in userStorage if we saved it.
        const myTornId = user.tornId;

        let activeProperty = null;
        const ownedProperties = [];
        const rentedProperties = [];

        for (const prop of properties) {
            let isActive = false;

            // Check if active (used by me)
            if (prop.used_by && Array.isArray(prop.used_by)) {
                isActive = prop.used_by.some(user => user.id == myTornId);
            }
            // Fallback active check
            if (!isActive && prop.status && prop.status.toLowerCase() === 'rented' && prop.rented_by?.id == myTornId) {
                // If I assume rented = active if used_by is missing/empty, but usually used_by is accurate.
                // We'll stick to used_by preference, but this fallback exists.
                // However, distinguishing "rented active" vs "rented inactive" relies on used_by.
                // If used_by is empty, and I rent it, assume active? Or inactive? 
                // Let's assume if I rent it, I probably intend to use it, unless I have another one that IS used.
                // But let's only set isActive if strictly confident.
                // Actually, relying on used_by is best.
            }

            // Correction: Previous logic relied on loop finding it.
            // Let's rely on used_by primarily.

            // Check ownership and tenancy
            const isOwned = prop.owner && prop.owner.id == myTornId;
            const isTenant = prop.rented_by && prop.rented_by.id == myTornId;

            if (isActive) {
                activeProperty = prop;
            } else {
                // Only add to secondary lists if NOT active
                if (isOwned) {
                    ownedProperties.push(prop);
                }
                if (isTenant) {
                    rentedProperties.push(prop);
                }
            }
        }

        // Double check: if activeProperty was found, ensure it's not in the lists (already handled by else branch above)
        // Except if logic above missed setting isActive for the active one until later iterations? 
        // No, loop processes each independent. `activeProperty` is a single ref.
        // Wait, if I have 2 properties, A (Active) and B (Inactive). 
        // Loop A: isActive=true. activeProperty=A.
        // Loop B: isActive=false. Added to owned/rented. 
        // Correct.

        // Handling edge case: What if `used_by` is missing on the actual active property? 
        // Then `isActive` is false, and it goes to owned/rented. 
        // Then `activeProperty` remains null.
        // Then at end, we might want to fallback pick one? 
        // For now, let's respect appropriate flags.

        const embed = new EmbedBuilder()
            .setColor(0x3498DB); // Default blue

        // ... Build sections (Code will follow) ...

        // Just return the logic structure with embeds
        return buildEmbed(activeProperty, ownedProperties, rentedProperties, myTornId);


    } catch (error) {
        console.error('❌ Property Handler Error:', error.message);
        return null;
    }
}


// Helper to calculate total daily cost
function calculateDailyCost(property) {
    const rentPerDay = property.cost_per_day || 0;
    const propertyUpkeep = property.upkeep?.property || 0;
    const staffUpkeep = property.upkeep?.staff || 0;

    return {
        rent: rentPerDay,
        propUpkeep: propertyUpkeep,
        staffUpkeep: staffUpkeep,
        total: rentPerDay + propertyUpkeep + staffUpkeep
    };
}

// Build the main embed
function buildEmbed(active, owned, rented, myId) {
    const embeds = [];

    // --- EMBED 1: ACTIVE PROPERTY ---
    const embed1 = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🏠｜Property Information')
        .setDescription('─────────────────────────────────────────────────────────────');

    const interval = formatTimeShort(AUTO_RUNNERS.propertyInfo.interval);
    // Only put footer on the last embed usually, or first? User screenshot shows footer on the main one? 
    // Actually user JSON doesn't show footer. But usually we want footer.
    // I'll put footer on the last embed (Other Properties) if it exists, otherwise on this one.
    // Or just put it on the first one? Screenshot shows it at the bottom.
    // If I split into 2 embeds, standard discord behavior renders them stacked.
    // I'll add timestamp to the last one.

    if (active) {
        // --- Row 1: Active Property & Happy ---
        const status = active.status === 'rented' ? '(Rented)' : active.status === 'owned' ? '(Owned)' : '';
        const propName = active.property?.name || active.name || 'Unknown Property';

        embed1.addFields({
            name: '🏠 Active Property',
            value: `\`\`\`${propName} ${status}\`\`\``,
            inline: true
        });

        const happy = active.happy || 0;
        embed1.addFields({
            name: '😊 Happy Bonus',
            value: `\`\`\`+${formatNumber(happy)}\`\`\``,
            inline: true
        });

        // --- Row 2: Modifications ---
        let modsText = 'None';
        if (active.modifications && active.modifications.length > 0) {
            // Comma separated
            modsText = active.modifications.join(', ');
        }
        embed1.addFields({
            name: '🧩 Modifications',
            value: `\`\`\`${modsText}\`\`\``,
            inline: false
        });

        // --- Row 3: Team ---
        let staffText = 'None';
        if (active.staff && active.staff.length > 0) {
            // "Maid (1), Guard (1)"
            staffText = active.staff.map(s => `${s.type || s.name || s} (${s.amount || s.quantity || 1})`).join(', ');
        }
        embed1.addFields({
            name: '👷 Team',
            value: `\`\`\`${staffText}\`\`\``,
            inline: false
        });

        // --- Row 4: Daily Cost ---
        const costs = calculateDailyCost(active);
        const LINE_WIDTH = 56; // Reduced from 58 to 38 for compact look

        // Helper for fixed width row pair
        const padRow = (label, val) => {
            const valStr = formatMoney(val);
            const padding = Math.max(0, LINE_WIDTH - label.length - valStr.length);
            return label + ' '.repeat(padding) + valStr;
        };

        const costBreakdown = [
            padRow('Rent/day', costs.rent),
            padRow('Property upkeep', costs.propUpkeep),
            padRow('Staff upkeep', costs.staffUpkeep),
            '─'.repeat(LINE_WIDTH),
            padRow('TOTAL/day', costs.total)
        ].join('\n');

        embed1.addFields({
            name: '💸 Daily Cost Breakdown',
            value: `\`\`\`\n${costBreakdown}\`\`\``,
            inline: false
        });

        // --- Row 5: Efficiency ---
        const monthlyCost = costs.total * 30;
        const efficiency = monthlyCost > 0 ? (happy / (monthlyCost / 1000000)).toFixed(0) : '∞';
        const hasAirstrip = active.modifications && (
            Array.isArray(active.modifications)
                ? active.modifications.some(m => m.toLowerCase().includes('airstrip'))
                : false
        );
        const travelText = hasAirstrip ? '✅ Airstrip' : '❌ No Airstrip';

        // Align Efficiency
        // Happy / $1M cost : 1267
        // Travel bonus     : ✅ Airstrip

        // Left column width including colon
        const LABEL_COL_WIDTH = 20;

        const formatEffRow = (label, valueStr) => {
            const paddedLabel = (label + ' :').padEnd(LABEL_COL_WIDTH);
            const remainingWidth = LINE_WIDTH - paddedLabel.length;
            // Check for emoji (simple check for now, or just assume if it starts with emoji, length is +1)
            // '✅'.length is 1, but visual is 2.
            const realLength = valueStr.match(/^[✅❌]/) ? valueStr.length + 1 : valueStr.length;

            const padding = Math.max(0, remainingWidth - realLength);
            return paddedLabel + ' '.repeat(padding) + valueStr;
        };

        const effRow = formatEffRow('Happy / $1M cost', efficiency);
        const tvlRow = formatEffRow('Travel bonus', travelText);


        embed1.addFields({
            name: '📊 Efficiency',
            value: `\`\`\`\n${effRow}\n${tvlRow}\`\`\``,
            inline: false
        });

    } else {

        embed1.setDescription('User has no active property.');
    }

    embeds.push(embed1);

    // --- EMBED 2: OTHER PROPERTIES (Owned + Inactive Rented) ---
    const allOther = [];

    // Add Owned
    owned.forEach(p => {
        allOther.push({ ...p, _displayParams: { type: 'Owned', label: '(Owned)' } });
    });

    // Add Rented (Inactive)
    rented.forEach(p => {
        allOther.push({ ...p, _displayParams: { type: 'Rented', label: '(Rented)' } });
    });

    if (allOther.length > 0) {
        const embed2 = new EmbedBuilder()
            .setTitle('🏡 Other Properties')
            .setDescription('─────────────────────────────────────────────────────────────');
        // Color can be same or null (default dark). User JSON has color: null. 
        // I'll stick to a subtle color or null. Let's use null (default gray/black) to differentiate.

        // Sort: Rented first? Or Value?
        // Let's sort by market price descending, as per usual asset listings.
        allOther.sort((a, b) => (b.market_price || 0) - (a.market_price || 0));

        allOther.forEach(p => {
            const pName = p.property?.name || p.name || 'Property';
            const statusLabel = p._displayParams.label; // (Owned) or (Rented)
            const marketVal = p.market_price ? formatMoney(p.market_price) : 'N/A';

            embed2.addFields({
                name: `${pName} ${statusLabel}`,
                value: `\`\`\`Market ${marketVal}\`\`\``,
                inline: true
            });
        });

        embeds.push(embed2);
    }

    // Set Footer on Last Embed
    const lastEmbed = embeds[embeds.length - 1];
    lastEmbed.setFooter({ text: `Torn Sentinel • Auto update every ${interval}` })
        .setTimestamp();

    return { embeds };
}

