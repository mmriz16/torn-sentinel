/**
 * /wallet Command
 * Financial overview with auto-refresh
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { get, TornApiError } from '../services/tornApi.js';
import { getUser } from '../services/userStorage.js';
import { COLORS, EMOJI, REFRESH_INTERVALS } from '../utils/constants.js';
import { formatMoney, discordTimestamp } from '../utils/formatters.js';
import { getUi, getStat } from '../localization/index.js';

export const data = new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('View your financial overview with auto-refresh');

export async function execute(interaction, client) {
    const user = getUser(interaction.user.id);

    if (!user || !user.apiKey) {
        await interaction.reply({
            content: `${EMOJI.WARNING} You need to configure your API Key in \`.env\` file first!`,
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    // Stop any existing refresh interval for this user
    const intervalKey = `wallet:${interaction.user.id}`;
    if (client.activeIntervals.has(intervalKey)) {
        clearInterval(client.activeIntervals.get(intervalKey));
        client.activeIntervals.delete(intervalKey);
    }

    // Send initial message
    const message = await sendWalletEmbed(interaction, user.apiKey, null);

    if (!message) return; // Error occurred

    // Set up auto-refresh interval
    const interval = setInterval(async () => {
        try {
            await sendWalletEmbed(interaction, user.apiKey, message);
        } catch (error) {
            console.error('Wallet refresh error:', error);
            // Don't stop the interval on error, try again next time
        }
    }, REFRESH_INTERVALS.WALLET);

    // Store interval reference for cleanup
    client.activeIntervals.set(intervalKey, interval);
}

/**
 * Send or update wallet embed
 */
async function sendWalletEmbed(interaction, apiKey, existingMessage) {
    try {
        // Fetch financial data
        const data = await get(apiKey, 'user', 'money,networth');

        const embed = buildWalletEmbed(data);

        if (existingMessage) {
            // Update existing message
            await existingMessage.edit({ embeds: [embed] });
            return existingMessage;
        } else {
            // Send new message
            return await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Wallet fetch error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle(`${EMOJI.ERROR} Failed to fetch financial data`)
            .setDescription(error.userMessage || error.message)
            .setTimestamp();

        if (existingMessage) {
            await existingMessage.edit({ embeds: [errorEmbed], components: [] });
            return existingMessage;
        } else {
            await interaction.editReply({ embeds: [errorEmbed] });
            return null;
        }
    }
}

/**
 * Build the wallet embed with compact grid layout
 * Only shows items with non-zero values
 */
function buildWalletEmbed(data) {
    const networth = data.networth || {};
    const totalNetworth = networth.total || 0;

    const embed = new EmbedBuilder()
        .setColor(0x58ACFF) // Light blue
        .setTitle(`💼｜${getUi('financial_overview')}`)
        .setDescription('────────────────────────────────────────────────')
        .setTimestamp()
        .setFooter({ text: 'Torn Sentinel • Auto refresh every 60 seconds' });

    // Calculate liquidity (wallet + bank + cayman + vault)
    const liquidity = (data.money_onhand || 0) +
        (networth.bank || 0) +
        (data.cayman_bank || 0) +
        (data.vault_amount || 0);

    // Calculate market assets (itemmarket + stockmarket + auctionhouse)
    const marketAssets = (networth.itemmarket || 0) +
        (networth.stockmarket || 0) +
        (networth.auctionhouse || 0);

    // Calculate misc (everything else that's not main categories)
    const miscTotal = (networth.displaycase || 0) +
        (networth.bazaar || 0) +
        (networth.trade || 0) +
        (networth.company || 0) +
        (networth.bookie || 0) +
        (networth.enlistedcars || 0) +
        (networth.piggybank || 0) +
        (networth.loan || 0) +
        (networth.unpaidfees || 0); // unpaidfees is negative

    // 💰 Total Networth - always show
    embed.addFields({
        name: `💰｜Total ${getUi('networth')}`,
        value: `\`\`\`${formatMoney(totalNetworth)}\`\`\``,
        inline: true
    });

    // 💵 Liquidity
    if (liquidity > 0) {
        embed.addFields({
            name: `💵｜${getUi('liquidity')}`,
            value: `\`\`\`${formatMoney(liquidity)}\`\`\``,
            inline: true
        });
    }

    // ⭐ Points
    if (networth.points > 0) {
        embed.addFields({
            name: `⭐｜${getUi('points')}`,
            value: `\`\`\`${formatMoney(networth.points)}\`\`\``,
            inline: true
        });
    }

    // 🎒 Items
    if (networth.items > 0) {
        embed.addFields({
            name: `🎒｜${getUi('items')}`,
            value: `\`\`\`${formatMoney(networth.items)}\`\`\``,
            inline: true
        });
    }

    // 🏠 Properties
    if (networth.properties > 0) {
        embed.addFields({
            name: `🏠｜${getUi('properties')}`,
            value: `\`\`\`${formatMoney(networth.properties)}\`\`\``,
            inline: true
        });
    }

    // 🏪 Market Assets
    if (marketAssets > 0) {
        embed.addFields({
            name: `🏪｜${getUi('market_assets')}`,
            value: `\`\`\`${formatMoney(marketAssets)}\`\`\``,
            inline: true
        });
    }

    // 📦 Misc (show if there's anything including negative unpaidfees)
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


