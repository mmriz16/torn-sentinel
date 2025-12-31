/**
 * Stats Handler for Auto-Run
 * Builds personal stats embed - MATCHES /stats command exactly
 */

import { EmbedBuilder } from 'discord.js';
import { get } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import {
    formatNumber,
    formatMoney,
    createProgressBar,
    getThresholdColor,
    discordTimestamp
} from '../../../utils/formatters.js';
import { getUi, getStat } from '../../../localization/index.js';

// Education name mapping (same as /stats command)
const EDUCATION_NAMES = {
    1: 'General Studies', 2: 'Biology', 3: 'Business Studies', 4: 'Combat Training', 5: 'Psychology',
    41: 'Introduction to Sport', 42: 'Sports Science', 43: 'Sport Science', 44: 'Sports Management',
    11: 'Introduction to Biology', 12: 'General Science', 13: 'Health & Fitness',
    21: 'Introduction to Computer', 22: 'Networking', 23: 'Programming',
    31: 'Introduction to Law', 32: 'Criminal Justice', 33: 'Law Degree',
};

function getEducationName(id) {
    return EDUCATION_NAMES[id] || getUi('studying');
}

/**
 * Helper to capitalize first letter
 */
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Stats handler - fetches data and returns embed
 */
export async function statsHandler(client) {
    try {
        const users = getAllUsers();
        const userId = Object.keys(users)[0];
        if (!userId) return null;

        const user = users[userId];
        const data = await get(user.apiKey, 'user', 'bars,cooldowns,education,profile,money,refills');

        return buildStatsEmbed(data);
    } catch (error) {
        console.error('❌ Stats handler error:', error.message);
        return null;
    }
}

/**
 * Build stats embed - EXACT COPY from /stats command
 */
function buildStatsEmbed(data) {
    const { energy, nerve, happy, life } = data;

    const percentages = [
        energy.current / energy.maximum,
        nerve.current / nerve.maximum,
        life.current / life.maximum
    ];
    const lowestPercentage = Math.min(...percentages);
    const embedColor = getThresholdColor(lowestPercentage, 1);

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`⚡ ${getUi('player_stats')}`)
        .setDescription('────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Auto refresh every 60 seconds' });

    // Localized labels
    const energyLabel = capitalize(getStat('energy'));
    const nerveLabel = capitalize(getStat('nerve'));
    const happyLabel = capitalize(getStat('happy'));
    const lifeLabel = capitalize(getStat('life'));

    // ─────────────────────────────────────────────────────────────
    // NEW: User Stats (Row 1 & 2)
    // ─────────────────────────────────────────────────────────────

    // Row 1: Name, Money, Level
    embed.addFields(
        {
            name: `👤 Name`,
            value: `\`\`\`${data.name || 'Unknown'}\`\`\``,
            inline: true
        },
        {
            name: `💵 Money`,
            value: `\`\`\`${formatMoney(data.money_onhand || 0)}\`\`\``,
            inline: true
        },
        {
            name: `📊 Level`,
            value: `\`\`\`${data.level || 0}\`\`\``,
            inline: true
        }
    );

    // Row 2: Points, Refills, Merits
    embed.addFields(
        {
            name: `💎 Points`,
            value: `\`\`\`${formatNumber(data.points || 0)}\`\`\``,
            inline: true
        },
        {
            name: `🥤 Refills`,
            value: `\`\`\`${data.refills ? data.refills.special_refills_available : '0'}\`\`\``,
            inline: true
        },
        {
            name: `🏅 Merits`,
            value: `\`\`\`${formatNumber(data.merits || 0)}\`\`\``,
            inline: true
        }
    );

    // Spacer before bars
    embed.addFields({ name: '** **', value: '** **', inline: false });

    // Row 3: Energy | Nerve

    // Row 1: Energy | Nerve
    const energyBar = createProgressBar(energy.current, energy.maximum, 8, 'orange');
    const energyTitle = energy.fulltime > 0
        ? `⚡ ${energyLabel} · ${discordTimestamp(Math.floor(Date.now() / 1000) + energy.fulltime, 'R')}`
        : `⚡ ${energyLabel}`;
    embed.addFields({
        name: energyTitle,
        value: `${energyBar}\n**${formatNumber(energy.current)}**/${formatNumber(energy.maximum)}`,
        inline: true
    });

    const nerveBar = createProgressBar(nerve.current, nerve.maximum, 8, 'green');
    const nerveTitle = nerve.fulltime > 0
        ? `🧠 ${nerveLabel} · ${discordTimestamp(Math.floor(Date.now() / 1000) + nerve.fulltime, 'R')}`
        : `🧠 ${nerveLabel}`;
    embed.addFields({
        name: nerveTitle,
        value: `${nerveBar}\n**${formatNumber(nerve.current)}**/${formatNumber(nerve.maximum)}`,
        inline: true
    });

    // Force new row
    embed.addFields({ name: '** **', value: '** **', inline: false });

    // Row 2: Happy | Life
    const happyBar = createProgressBar(happy.current, happy.maximum, 8, 'blue');
    const happyTitle = happy.fulltime > 0
        ? `😊 ${happyLabel} · ${discordTimestamp(Math.floor(Date.now() / 1000) + happy.fulltime, 'R')}`
        : `😊 ${happyLabel}`;
    embed.addFields({
        name: happyTitle,
        value: `${happyBar}\n**${formatNumber(happy.current)}**/${formatNumber(happy.maximum)}`,
        inline: true
    });

    const lifeBar = createProgressBar(life.current, life.maximum, 8, 'red');
    const lifeTitle = life.fulltime > 0
        ? `❤️ ${lifeLabel} · ${discordTimestamp(Math.floor(Date.now() / 1000) + life.fulltime, 'R')}`
        : `❤️ ${lifeLabel}`;
    embed.addFields({
        name: lifeTitle,
        value: `${lifeBar}\n**${formatNumber(life.current)}**/${formatNumber(life.maximum)}`,
        inline: true
    });

    // Cooldowns section header
    embed.addFields({ name: '** **', value: '** **', inline: false });
    embed.addFields({ name: `⏱️｜${getUi('cooldowns')}`, value: '** **', inline: false });

    const cooldowns = data.cooldowns || {};
    const now = Math.floor(Date.now() / 1000);
    const educationName = getEducationName(data.education_current);

    const activeText = getUi('active'); // "Aktif"
    const readyText = getUi('ready'); // "Siap" (or "Selesai", but "Siap" is usually "Ready")

    // Drug cooldown
    if (cooldowns.drug > 0) {
        embed.addFields({
            name: `💊｜${getUi('drug')}`,
            value: `\`\`\`Xanax\`\`\`${discordTimestamp(now + cooldowns.drug, 'R')}`,
            inline: true
        });
    } else {
        embed.addFields({
            name: `💊｜${getUi('drug')}`,
            value: `\`\`\`✅ ${readyText}\`\`\``,
            inline: true
        });
    }

    // Booster cooldown
    if (cooldowns.booster > 0) {
        embed.addFields({
            name: `💉｜${getUi('booster')}`,
            value: `\`\`\`${activeText}\`\`\`${discordTimestamp(now + cooldowns.booster, 'R')}`,
            inline: true
        });
    } else {
        embed.addFields({
            name: `💉｜${getUi('booster')}`,
            value: `\`\`\`✅ ${readyText}\`\`\``,
            inline: true
        });
    }

    // Force new row
    embed.addFields({ name: '** **', value: '** **', inline: false });

    // Medical cooldown
    if (cooldowns.medical > 0) {
        embed.addFields({
            name: `🏥｜${getUi('medical')}`,
            value: `\`\`\`${activeText}\`\`\`${discordTimestamp(now + cooldowns.medical, 'R')}`,
            inline: true
        });
    } else {
        embed.addFields({
            name: `🏥｜${getUi('medical')}`,
            value: `\`\`\`✅ ${readyText}\`\`\``,
            inline: true
        });
    }

    // Education cooldown
    if (data.education_timeleft > 0) {
        embed.addFields({
            name: `📚｜${getUi('education')}`,
            value: `\`\`\`${educationName}\`\`\`${discordTimestamp(now + data.education_timeleft, 'R')}`,
            inline: true
        });
    } else {
        embed.addFields({
            name: `📚｜${getUi('education')}`,
            value: `\`\`\`✅ ${readyText}\`\`\``,
            inline: true
        });
    }

    return embed;
}
