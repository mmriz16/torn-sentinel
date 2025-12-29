/**
 * /register Command
 * Register or unregister Torn API key
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { verifyApiKey } from '../services/tornApi.js';
import { getUser, setUser, deleteUser } from '../services/userStorage.js';
import { COLORS, EMOJI } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your Torn API key')
    .addSubcommand(subcommand =>
        subcommand
            .setName('key')
            .setDescription('Register your Torn API key')
            .addStringOption(option =>
                option
                    .setName('api_key')
                    .setDescription('Your Torn API key (Limited Access recommended)')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Remove your registered API key')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Check your registration status')
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'key':
            await handleRegister(interaction);
            break;
        case 'remove':
            await handleRemove(interaction);
            break;
        case 'status':
            await handleStatus(interaction);
            break;
    }
}

/**
 * Handle API key registration
 */
async function handleRegister(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const apiKey = interaction.options.getString('api_key');

    try {
        // Verify the API key
        const userData = await verifyApiKey(apiKey);

        // Store user data
        setUser(interaction.user.id, {
            apiKey: apiKey,
            tornId: userData.player_id,
            tornName: userData.name,
            registeredAt: new Date().toISOString()
        });

        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.SUCCESS} Registration Successful`)
            .setDescription(`Welcome, **${userData.name}** [${userData.player_id}]!`)
            .addFields(
                { name: 'Torn ID', value: `${userData.player_id}`, inline: true },
                { name: 'Level', value: `${userData.level}`, inline: true }
            )
            .setFooter({ text: 'Your API key is stored securely and never shown publicly.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Registration error:', error);

        const embed = new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle(`${EMOJI.ERROR} Registration Failed`)
            .setDescription(error.userMessage || error.message)
            .setFooter({ text: 'Make sure your API key is valid and has the correct permissions.' });

        await interaction.editReply({ embeds: [embed] });
    }
}

/**
 * Handle API key removal
 */
async function handleRemove(interaction) {
    const user = getUser(interaction.user.id);

    if (!user) {
        await interaction.reply({
            content: `${EMOJI.WARNING} You don't have a registered API key.`,
            ephemeral: true
        });
        return;
    }

    deleteUser(interaction.user.id);

    const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.SUCCESS} API Key Removed`)
        .setDescription(`Your API key has been removed from the bot.`)
        .setFooter({ text: 'You can register again anytime with /register key' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Handle registration status check
 */
async function handleStatus(interaction) {
    const user = getUser(interaction.user.id);

    if (!user) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle(`${EMOJI.WARNING} Not Registered`)
            .setDescription('You have not registered an API key yet.')
            .addFields({
                name: 'How to Register',
                value: 'Use `/register key` with your Torn API key.\n\n' +
                    '**Getting your API key:**\n' +
                    '1. Go to [Torn Settings](https://www.torn.com/preferences.php#tab=api)\n' +
                    '2. Create a new key with "Limited Access"\n' +
                    '3. Copy the key and use it here'
            });

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.SUCCESS} Registration Active`)
        .addFields(
            { name: 'Torn Name', value: user.tornName || 'Unknown', inline: true },
            { name: 'Torn ID', value: `${user.tornId || 'Unknown'}`, inline: true },
            { name: 'Registered', value: user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'Unknown', inline: true }
        )
        .setFooter({ text: 'Use /register remove to unlink your account' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}
