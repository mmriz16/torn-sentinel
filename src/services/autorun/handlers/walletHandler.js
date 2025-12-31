/**
 * Wallet Handler for Auto-Run
 * Builds wallet embed from API data
 */

import { EmbedBuilder } from 'discord.js';
import { get } from '../../tornApi.js';
import { getAllUsers } from '../../userStorage.js';
import { formatMoney } from '../../../utils/formatters.js';
import { getUi } from '../../../localization/index.js';

/**
 * Wallet handler - fetches data and returns embed
 * @param {Client} client - Discord client (not used directly)
 * @returns {EmbedBuilder|null}
 */
export async function walletHandler(client) {
    try {
        // Get first registered user's API key
        const users = getAllUsers();
        const userId = Object.keys(users)[0];

        if (!userId) {
            console.warn('⚠️ No users registered for wallet handler');
            return null;
        }

        const user = users[userId];
        const data = await get(user.apiKey, 'user', 'money,networth');

        return buildWalletEmbed(data);

    } catch (error) {
        console.error('❌ Wallet handler error:', error.message);
        return null;
    }
}

/**
 * Build wallet embed
 */
function buildWalletEmbed(data) {
    const networth = data.networth || {};
    const totalNetworth = networth.total || 0;

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF)
        .setTitle(`💼｜${getUi('financial_overview')}`)
        .setDescription('────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Auto-Run' });

    // Liquidity
    const liquidity = (data.money_onhand || 0) +
        (networth.bank || 0) +
        (data.cayman_bank || 0) +
        (data.vault_amount || 0);

    // Market assets
    const marketAssets = (networth.itemmarket || 0) +
        (networth.stockmarket || 0) +
        (networth.auctionhouse || 0);

    // Misc
    const miscTotal = (networth.displaycase || 0) +
        (networth.bazaar || 0) +
        (networth.trade || 0) +
        (networth.company || 0) +
        (networth.bookie || 0) +
        (networth.enlistedcars || 0) +
        (networth.piggybank || 0) +
        (networth.loan || 0) +
        (networth.unpaidfees || 0);

    // Total Networth
    embed.addFields({
        name: `💰｜${getUi('networth')}`,
        value: `\`\`\`${formatMoney(totalNetworth)}\`\`\``,
        inline: true
    });

    // Liquidity
    if (liquidity > 0) {
        embed.addFields({
            name: `💵｜${getUi('liquidity')}`,
            value: `\`\`\`${formatMoney(liquidity)}\`\`\``,
            inline: true
        });
    }

    // Points
    if (networth.points > 0) {
        embed.addFields({
            name: `⭐｜${getUi('points')}`,
            value: `\`\`\`${formatMoney(networth.points)}\`\`\``,
            inline: true
        });
    }

    // Items
    if (networth.items > 0) {
        embed.addFields({
            name: `🎒｜${getUi('items')}`,
            value: `\`\`\`${formatMoney(networth.items)}\`\`\``,
            inline: true
        });
    }

    // Properties
    if (networth.properties > 0) {
        embed.addFields({
            name: `🏠｜${getUi('properties')}`,
            value: `\`\`\`${formatMoney(networth.properties)}\`\`\``,
            inline: true
        });
    }

    // Market Assets
    if (marketAssets > 0) {
        embed.addFields({
            name: `🏪｜${getUi('market_assets')}`,
            value: `\`\`\`${formatMoney(marketAssets)}\`\`\``,
            inline: true
        });
    }

    // Misc
    if (miscTotal !== 0) {
        const miscValue = miscTotal < 0
            ? `🔻 ${formatMoney(miscTotal)}`
            : formatMoney(miscTotal);
        embed.addFields({
            name: `📦｜${getUi('misc')}`,
            value: `\`\`\`${miscValue}\`\`\``,
            inline: true
        });
    }

    return embed;
}
