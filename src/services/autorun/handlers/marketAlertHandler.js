
/**
 * Auto-run Handler: Market Alert Engine
 * Checks for restock alerts based on user travel status
 */

import { processAlerts } from '../../market/marketAlertEngine.js';

export async function marketAlertHandler(client) {
    // Process all active market alerts
    await processAlerts(client);
}
