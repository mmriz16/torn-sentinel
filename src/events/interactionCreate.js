/**
 * Interaction Create Event Handler
 * Handles all Discord interactions (slash commands, buttons, etc.)
 */

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction, client) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, client);
        return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
        await handleButton(interaction, client);
        return;
    }

    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction, client);
        return;
    }
}

/**
 * Handle autocomplete interactions
 */
async function handleAutocomplete(interaction, client) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        if (command.autocomplete) {
            await command.autocomplete(interaction, client);
        }
    } catch (error) {
        console.error(`❌ Autocomplete error in /${interaction.commandName}:`, error);
    }
}

/**
 * Handle slash command execution
 */
async function handleSlashCommand(interaction, client) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.warn(`⚠️ Unknown command: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`❌ Error executing /${interaction.commandName}:`, error);

        const errorMessage = {
            content: '❌ An error occurred while executing this command.',
            ephemeral: true
        };

        // Reply or follow up based on interaction state
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
}

/**
 * Handle button interactions
 */
async function handleButton(interaction, client) {
    const [action, ...params] = interaction.customId.split(':');

    try {
        switch (action) {
            case 'refresh_wallet':
                const walletCommand = client.commands.get('wallet');
                if (walletCommand && walletCommand.handleRefresh) {
                    await walletCommand.handleRefresh(interaction, client);
                }
                break;

            case 'refresh_stats':
                const statsCommand = client.commands.get('stats');
                if (statsCommand && statsCommand.handleRefresh) {
                    await statsCommand.handleRefresh(interaction, client);
                }
                break;

            case 'stop_refresh':
                await handleStopRefresh(interaction, client, params[0]);
                break;

            case 'activity_log_prev':
            case 'activity_log_next':
                await handleActivityLogPagination(interaction, client, action, params);
                break;

            default:
                console.warn(`⚠️ Unknown button action: ${action}`);
        }
    } catch (error) {
        console.error(`❌ Error handling button ${action}:`, error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while processing this action.',
                ephemeral: true
            });
        }
    }
}

/**
 * Handle stop refresh button
 */
async function handleStopRefresh(interaction, client, intervalKey) {
    const fullKey = `${intervalKey}:${interaction.user.id}`;
    const interval = client.activeIntervals.get(fullKey);

    if (interval) {
        clearInterval(interval);
        client.activeIntervals.delete(fullKey);

        await interaction.update({
            components: [] // Remove buttons
        });

        await interaction.followUp({
            content: '⏹️ Auto-refresh stopped.',
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: '⚠️ No active refresh to stop.',
            ephemeral: true
        });
    }
}

/**
 * Handle activity log pagination buttons
 */
async function handleActivityLogPagination(interaction, client, action, params) {
    const currentPage = parseInt(params[0]) || 0;
    const newPage = action === 'activity_log_next' ? currentPage + 1 : currentPage - 1;

    try {
        // Import handler
        const { getActivityLogPage } = await import('../services/autorun/handlers/activityLogHandler.js');

        // Get new page
        const result = await getActivityLogPage(client, newPage);

        if (result) {
            // Update message with new page
            await interaction.update(result);
        } else {
            await interaction.reply({
                content: '❌ Failed to load activity log',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('❌ Error loading activity log page:', error);
        await interaction.reply({
            content: '❌ An error occurred while loading the page',
            ephemeral: true
        });
    }
}
