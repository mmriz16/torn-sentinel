
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERTS_FILE = path.join(__dirname, '../../../data/market_alerts.json');

// Ensure data directory exists
const dataDir = path.dirname(ALERTS_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// In-memory cache
let alertsCache = null;

/**
 * Load alerts from disk
 */
function loadAlerts() {
    if (alertsCache) return alertsCache;

    try {
        if (fs.existsSync(ALERTS_FILE)) {
            const data = fs.readFileSync(ALERTS_FILE, 'utf8');
            alertsCache = JSON.parse(data);
        } else {
            alertsCache = {};
        }
    } catch (error) {
        console.error('❌ Error loading market alerts:', error);
        alertsCache = {};
    }
    return alertsCache;
}

/**
 * Save alerts to disk
 */
function saveAlerts() {
    if (!alertsCache) return;
    try {
        fs.writeFileSync(ALERTS_FILE, JSON.stringify(alertsCache, null, 2));
    } catch (error) {
        console.error('❌ Error saving market alerts:', error);
    }
}

/**
 * Add a new alert for a user
 */
export function addAlert(userId, alert) {
    const data = loadAlerts();
    if (!data[userId]) {
        data[userId] = { alerts: [] };
    }

    // Check formatting
    alert.state = 'IDLE';
    alert.lastStock = null;
    alert.lastUpdate = Date.now();
    alert.cooldownUntil = 0;

    data[userId].alerts.push(alert);
    saveAlerts();
    return true;
}

/**
 * Remove an alert
 */
export function removeAlert(userId, itemId, country) {
    const data = loadAlerts();
    if (!data[userId]) return false;

    const initialLength = data[userId].alerts.length;
    data[userId].alerts = data[userId].alerts.filter(
        a => !(a.itemId === itemId && a.country === country)
    );

    if (data[userId].alerts.length !== initialLength) {
        saveAlerts();
        return true;
    }
    return false;
}

/**
 * Get alerts for a user
 */
export function getUserAlerts(userId) {
    const data = loadAlerts();
    return data[userId]?.alerts || [];
}

/**
 * Get ALL alerts (for engine processing)
 */
export function getAllAlerts() {
    return loadAlerts();
}

/**
 * Update a specific alert's state (by reference or index)
 * Since we return objects by reference from getAllAlerts, we can just save.
 */
export function saveAlertState() {
    saveAlerts();
}
