/**
 * Cooldown Check Handler for Auto-Run
 * Provides live travel status and cooldown countdowns
 */

import { EmbedBuilder } from 'discord.js';
import { getCombinedStats } from '../../tornApi.js';
import { formatTime } from '../../../utils/formatters.js';
import { getAllUsers } from '../../userStorage.js';
import { getCapacity, updateCapacity, getLastCountry, setLastCountry } from '../../analytics/travelAnalyticsService.js';

export async function cooldownHandler(client) {
    try {
        // Get the first configured user (usually owner)
        // Since auto-run is global for the bot instance, we target the primary user
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

        let state = 'READY';
        let color = 0x00FF00; // Green
        let title = '✅ Ready to Travel';
        let description = 'No active cooldowns. You are in Torn.';
        let fields = [];

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
            // If destination is Torn, we're RETURNING (origin = abroad)
            // If destination is foreign, we're DEPARTING (origin = Torn)
            const isReturning = destination === 'Torn';

            let origin, dest;
            if (isReturning) {
                // Returning to Torn - use lastCountry as origin
                const lastCountry = getLastCountry();

                // Handle case where lastCountry wasn't tracked (legacy trips)
                if (lastCountry === 'Torn' || lastCountry === 'Unknown') {
                    origin = { code: 'ABR', flag: '✈️', city: 'Abroad' };
                } else {
                    origin = countryCodes[lastCountry] || { code: 'ABR', flag: '🌍', city: lastCountry };
                }
                dest = countryCodes['Torn'];
            } else {
                // Departing to foreign country - save destination for return trip
                setLastCountry(destination);
                origin = countryCodes['Torn'];
                dest = countryCodes[destination] || { code: 'UNK', flag: '🌍', city: destination };
            }

            // Calculate times - travel.departed is Unix timestamp (seconds)
            const now = new Date();
            const departureDate = travel.departed ? new Date(travel.departed * 1000) : now;
            const arrivalDate = new Date(now.getTime() + travel.time_left * 1000);
            const arrivalUnix = Math.floor(arrivalDate.getTime() / 1000);

            // Format dates (WIB timezone)
            const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Jakarta' });
            const formatTimeShort = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Jakarta' });

            // Calculate remaining time for footer
            const mins = Math.floor(travel.time_left / 60);
            const footerText = `Arriving in ${mins} minutes (${formatTimeShort(arrivalDate)})`;

            // Build premium embed
            const embed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: formatDate(now) })
                .setTitle(`✈️｜Torn Airways — Flight TCN-${Math.floor(Math.random() * 900 + 100)}`)
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
                        name: 'Type',
                        value: `\`\`\`🎫 ${hasAirstrip ? 'Airstrip' : transportType} • 🎒 ${capacity} Items\`\`\``,
                        inline: false
                    }
                )
                .setFooter({ text: footerText });

            return embed;
        }
        // 2. Check Hospital/Jail
        else if (status.state === 'Hospital' || status.state === 'Jail') {
            const icon = status.state === 'Hospital' ? '🏥' : '⛓️';
            const healTime = status.until > 0 ? `<t:${status.until}:R>` : 'soon';

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C) // Red
                .setTitle(`${icon}｜You're in ${status.state}`)
                .setDescription(`\`\`\`${status.details || 'Unable to travel...'}\`\`\`${status.state === 'Hospital' ? 'Heal' : 'Free'} ${healTime}`)
                .setFooter({ text: `Auto update every 60s • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })}` });

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

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F) // Yellow
                .setTitle(`📍｜You're in ${travel.destination} ${flag}`)
                .setDescription('```You are currently abroad.```')
                .setFooter({ text: `Auto update every 60s • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })}` });

            return embed;
        }

        // 4. Default: Ready in Torn
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // Green
            .setTitle('✅｜Ready to Travel')
            .setDescription('```No active cooldowns. You are in Torn.```')
            .setFooter({ text: `Auto update every 60s • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })}` });

        return embed;

    } catch (error) {
        console.error('❌ Cooldown Handler Error:', error.message);
        return null;
    }
}
