/**
 * User Storage Service
 * JSON-based storage for user data (API keys, preferences)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES Module directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../../data');
const USERS_FILE = join(DATA_DIR, 'users.json');

/**
 * Ensure data directory and file exist
 */
function ensureDataFile() {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!existsSync(USERS_FILE)) {
        writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
    }
}

/**
 * Load all users from storage
 * @returns {object} All user data
 */
function loadUsers() {
    ensureDataFile();

    try {
        const data = readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Error loading users file:', error);
        return {};
    }
}

/**
 * Save all users to storage
 * @param {object} users - All user data
 */
function saveUsers(users) {
    ensureDataFile();

    try {
        writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('❌ Error saving users file:', error);
        throw error;
    }
}

/**
 * Get user by Discord ID
 * @param {string} discordId - Discord user ID
 * @returns {object|null} User data or null if not found
 */
export function getUser(discordId) {
    const users = loadUsers();
    return users[discordId] || null;
}

/**
 * Save or update user data
 * @param {string} discordId - Discord user ID
 * @param {object} data - User data to save
 */
export function setUser(discordId, data) {
    const users = loadUsers();

    users[discordId] = {
        ...users[discordId], // Preserve existing data
        ...data,
        updatedAt: new Date().toISOString()
    };

    saveUsers(users);
}

/**
 * Delete user data
 * @param {string} discordId - Discord user ID
 * @returns {boolean} True if user was deleted
 */
export function deleteUser(discordId) {
    const users = loadUsers();

    if (users[discordId]) {
        delete users[discordId];
        saveUsers(users);
        return true;
    }

    return false;
}

/**
 * Check if user exists
 * @param {string} discordId - Discord user ID
 * @returns {boolean} True if user exists
 */
export function hasUser(discordId) {
    const users = loadUsers();
    return !!users[discordId];
}

/**
 * Get all registered users
 * @returns {object} All user data
 */
export function getAllUsers() {
    return loadUsers();
}

export default {
    getUser,
    setUser,
    deleteUser,
    hasUser,
    getAllUsers
};
