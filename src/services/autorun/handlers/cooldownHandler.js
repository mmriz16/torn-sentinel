/**
 * Cooldown Check Handler for Auto-Run
 * Provides live travel status and cooldown countdowns
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { formatTime } from '../../../utils/formatters.js'; // Can be removed if fully replaced, but kept for safety if used elsewhere or keep removing
import { getAllUsers } from '../../userStorage.js';
import { getCapacity, updateCapacity, getLastCountry, setLastCountry } from '../../analytics/travelAnalyticsService.js';
import { getLocation, getUi, formatTimeId, getAction } from '../../../localization/index.js';

export async function cooldownHandler(client) {
    try {
        // Get the first configured user (usually owner)
        const users = getAllUsers();
        const userIds = Object.keys(users);
        if (userIds.length === 0) return null;

        const userId = userIds[0];
        const user = users[userId];

        if (!user.apiKey) return null;

        // Fetch FRESH data: travel, cooldowns, perks
        const stats = await getCombinedStats(user.apiKey, 'travel,cooldowns,basic,perks');

        if (!stats) return null;

        // Status Logic
        const travel = stats.travel || {};
        const cooldowns = stats.cooldowns || {};
        const status = stats.status || {};

        // Extract travel capacity from perks
        let capacity = getCapacity();
        let hasAirstrip = false;

        // Check perks for travel items and airstrip
        if (stats.property_perks) {
            for (const perk of stats.property_perks) {
                if (perk.match(/Access to airstrip/i)) {
                    hasAirstrip = true;
                }
            }
        }

        // Calculate capacity from various perks
        if (stats.faction_perks) {
            for (const perk of stats.faction_perks) {
                const match = perk.match(/(\d+)\s*travel item capacity/i);
                if (match) {
                    capacity = 5 + parseInt(match[1]) + (hasAirstrip ? 10 : 0);
                    updateCapacity(capacity);
                }
            }
        }

        // Get transport type from travel data
        const transportType = travel.method || 'Standard';
        if (capacity === 0) capacity = 5; // Default base

        // Default state
        let state = 'READY';
        let color = 0x00FF00; // Green
        let title = `✅ ${getUi('travel_status')} - Siap Berangkat`; // "Ready to Travel"
        let description = 'Tidak ada cooldown aktif. Kamu di Torn.';

        // 1. Check if Traveling
        if (travel.time_left > 0) {
            state = 'TRAVELING';
            color = 0x3498DB; // Blue
            const destination = travel.destination || 'Unknown';

            // Get country codes and flags
            const countryCodes = {
                'Torn': { code: 'TCN', flag: '🌆', city: 'Torn City' },
                'Mexico': { code: 'MEX', flag: '🇲🇽', city: 'Mexico City' },
                'Cayman Islands': { code: 'CYM', flag: '🇰🇾', city: 'Grand Cayman' },
                'Canada': { code: 'CAN', flag: '🇨🇦', city: 'Toronto' },
                'Hawaii': { code: 'HNL', flag: '🇺🇸', city: 'Honolulu' },
                'United Kingdom': { code: 'LHR', flag: '🇬🇧', city: 'London' },
                'Argentina': { code: 'EZE', flag: '🇦🇷', city: 'Buenos Aires' },
                'Switzerland': { code: 'ZRH', flag: '🇨🇭', city: 'Zurich' },
                'Japan': { code: 'NRT', flag: '🇯🇵', city: 'Tokyo' },
                'China': { code: 'PEK', flag: '🇨🇳', city: 'Beijing' },
                'UAE': { code: 'DXB', flag: '🇦🇪', city: 'Dubai' },
                'South Africa': { code: 'JNB', flag: '🇿🇦', city: 'Johannesburg' }
            };

            // Determine origin and destination based on travel direction
            const isReturning = destination === 'Torn';

            let origin, dest;
            if (isReturning) {
                // Returning to Torn - use lastCountry as origin
                const lastCountry = getLastCountry();

                // Handle case where lastCountry wasn't tracked (legacy trips)
                if (lastCountry === 'Torn' || lastCountry === 'Unknown') {
                    origin = { code: 'ABR', flag: '✈️', city: 'Luar Negeri' };
                } else {
                    origin = countryCodes[lastCountry] || { code: 'ABR', flag: '🌍', city: getLocation(lastCountry) };
                }
                dest = countryCodes['Torn'];
            } else {
                // Departing to foreign country - save destination for return trip
                setLastCountry(destination);
                origin = countryCodes['Torn'];
                const destCity = getLocation(destination); // Localized name
                dest = countryCodes[destination] || { code: 'UNK', flag: '🌍', city: destCity };
                // Override city name with localized one if it exists in countryCodes (it doesn't, so we do it manually or assume countryCodes has English)
                // Actually countryCodes has 'city' property which is proper name (e.g. Mexico City).
                // Let's rely on countryCodes for consistency but maybe translate 'city' if needed.
                // For now, keeping city names as is (Proper Nouns) is usually fine.
            }

            // Calculate times - travel.departed is Unix timestamp (seconds)
            const now = new Date();
            const departureDate = travel.departed ? new Date(travel.departed * 1000) : now;
            const arrivalDate = new Date(now.getTime() + travel.time_left * 1000);

            // Format dates (WIB timezone, ID locale)
            const formatDate = (d) => d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Jakarta' });
            const formatTimeShort = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace('.', ':');

            // Calculate remaining time for footer
            const mins = Math.floor(travel.time_left / 60);
            const timeLeftStr = formatTimeId(travel.time_left);
            const footerText = `Tiba dalam ${timeLeftStr} (${formatTimeShort(arrivalDate)})`;

            // Build premium embed
            const embed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: formatDate(now) })
                .setTitle(`✈️｜Torn Airways — Penerbangan TCN-${Math.floor(Math.random() * 900 + 100)}`)
                .setDescription('──────────────────────────────────')
                .addFields(
                    {
                        name: `${origin.flag}｜${origin.code}`,
                        value: `\`\`\`${origin.city}\`\`\`${formatDate(departureDate)} • ${formatTimeShort(departureDate)}`,
                        inline: true
                    },
                    {
                        name: `${dest.flag}｜${dest.code}`,
                        value: `\`\`\`${dest.city}\`\`\`${formatDate(arrivalDate)} • ${formatTimeShort(arrivalDate)}`,
                        inline: true
                    },
                    {
                        name: 'Tipe',
                        value: `\`\`\`🎫 ${hasAirstrip ? 'Airstrip' : transportType} • 🎒 ${capacity} Item\`\`\``,
                        inline: false
                    }
                )
                .setFooter({ text: footerText });

            return embed;
        }
        // 2. Check Hospital/Jail
        else if (status.state === 'Hospital' || status.state === 'Jail') {
            const icon = status.state === 'Hospital' ? '🏥' : '⛓️';
            const healTime = status.until > 0 ? `<t:${status.until}:R>` : 'segera';

            const stateName = status.state === 'Hospital' ? 'Rumah Sakit' : 'Penjara';
            const actionText = status.state === 'Hospital' ? 'Sembuh' : 'Bebas';

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C) // Red
                .setTitle(`${icon}｜Kamu di ${stateName}`)
                .setDescription(`\`\`\`${status.details || 'Tidak bisa bepergian...'}\`\`\`${actionText} ${healTime}`)
                .setFooter({ text: `Auto update setiap 60s • Hari ini jam ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace('.', ':')}` });

            return embed;
        }
        // 3. If we are in foreign country, time_left=0. We are "Abroad".
        else if (travel.destination && travel.destination !== 'Torn') {
            const countryCodes = {
                'Mexico': '🇲🇽', 'Cayman Islands': '🇰🇾', 'Canada': '🇨🇦',
                'Hawaii': '🇺🇸', 'United Kingdom': '🇬🇧', 'Argentina': '🇦🇷',
                'Switzerland': '🇨🇭', 'Japan': '🇯🇵', 'China': '🇨🇳',
                'UAE': '🇦🇪', 'South Africa': '🇿🇦'
            };
            const flag = countryCodes[travel.destination] || '🌍';
            const locationName = getLocation(travel.destination);

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F) // Yellow
                .setTitle(`📍｜Kamu di ${locationName} ${flag}`)
                .setDescription('```Kamu sedang berada di luar negeri.```')
                .setFooter({ text: `Auto update setiap 60s • Hari ini jam ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace('.', ':')}` });

            return embed;
        }

        // 4. Default: Ready in Torn
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // Green
            .setTitle(title)
            .setDescription(`\`\`\`${description}\`\`\``)
            .setFooter({ text: `Auto update setiap 60s • Hari ini jam ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace('.', ':')}` });

        return embed;

    } catch (error) {
        console.error('❌ Cooldown Handler Error:', error.message);
        return null;
    }
}
