/**
 * Localization Resolver
 * Main entry point for translation
 * 
 * Resolution Priority:
 * 1. Static Dictionary (authoritative)
 * 2. Translation Cache (AI/manual results)
 * 3. Groq AI (fallback)
 * 4. English Fallback (if AI unavailable)
 */

import { readFileSync, existsSync } from 'fs';
import { getCached, setCached, recordAiCall } from './translationCache.js';

// Load static dictionary
const DICTIONARY_PATH = './src/localization/dictionary.id.json';
let dictionary = {};

function loadDictionary() {
    if (existsSync(DICTIONARY_PATH)) {
        try {
            dictionary = JSON.parse(readFileSync(DICTIONARY_PATH, 'utf8'));
            console.log('📖 Localization dictionary loaded');
        } catch (e) {
            console.error('❌ Error loading dictionary:', e.message);
            dictionary = {};
        }
    }
}

// Load on import
loadDictionary();

/**
 * Get translation from static dictionary
 * @param {string} category - Dictionary category (stats, gym, travel, etc)
 * @param {string} key - Key within category
 * @returns {string|null}
 */
export function fromDictionary(category, key) {
    if (dictionary[category] && dictionary[category][key]) {
        return dictionary[category][key];
    }
    return null;
}

/**
 * Get template from dictionary
 * @param {string} templateKey - Template key
 * @returns {string|null}
 */
export function getTemplate(templateKey) {
    return dictionary.templates?.[templateKey] || null;
}

/**
 * Translate text using resolution priority
 * @param {string} text - Source text (English)
 * @param {Object} options - Options
 * @returns {Promise<{text: string, confidence: string}>}
 */
export async function translate(text, options = {}) {
    const {
        category = null,
        key = null,
        useAi = false, // Default: no AI, use cache/dictionary only
        lang = 'id'
    } = options;

    // 1. Try static dictionary first (if category/key provided)
    if (category && key) {
        const dictResult = fromDictionary(category, key);
        if (dictResult) {
            return { text: dictResult, confidence: 'dictionary' };
        }
    }

    // 2. Try cache
    const cached = getCached(text, lang);
    if (cached) {
        return { text: cached.translatedText, confidence: 'cached' };
    }

    // 3. Try Groq AI (only if explicitly enabled)
    if (useAi && process.env.GROQ_API_KEY) {
        try {
            const translated = await translateWithGroq(text, lang);
            if (translated) {
                // MANDATORY: Store in cache
                setCached(text, translated, lang, 'ai');
                recordAiCall();
                return { text: translated, confidence: 'ai' };
            }
        } catch (e) {
            console.error('❌ Groq translation error:', e.message);
        }
    }

    // 4. Fallback to English
    return { text, confidence: 'fallback' };
}

/**
 * Translate with Groq AI
 * @param {string} text - Source text
 * @param {string} lang - Target language
 * @returns {Promise<string|null>}
 */
async function translateWithGroq(text, lang) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const systemPrompt = `You are a localization engine.
Translate to Indonesian.
Do not translate variables, numbers, IDs, or code.
Keep wording neutral and concise.
Preserve placeholders like {energy}, {stat}, {time} exactly as-is.
Output ONLY the translated text, nothing else.`;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.1,
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]?.message?.content) {
            const translated = data.choices[0].message.content.trim();

            // Validate placeholders are preserved
            if (validatePlaceholders(text, translated)) {
                return translated;
            }
            console.warn('⚠️ Translation failed placeholder validation');
        }
    } catch (e) {
        console.error('❌ Groq API error:', e.message);
    }

    return null;
}

/**
 * Validate that placeholders in source exist in translation
 */
function validatePlaceholders(source, translated) {
    const placeholderRegex = /\{[a-zA-Z_]+\}/g;
    const sourcePlaceholders = source.match(placeholderRegex) || [];

    for (const placeholder of sourcePlaceholders) {
        if (!translated.includes(placeholder)) {
            return false;
        }
    }
    return true;
}

/**
 * Apply template with variables
 * @param {string} templateKey - Template key from dictionary
 * @param {Object} vars - Variables to substitute
 * @returns {string}
 */
export function applyTemplate(templateKey, vars = {}) {
    let template = getTemplate(templateKey);

    if (!template) {
        // Fallback: return vars as string
        return Object.entries(vars)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
    }

    // Substitute variables
    for (const [key, value] of Object.entries(vars)) {
        template = template.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return template;
}

/**
 * Translate error message
 * @param {string} errorKey - Error key from dictionary
 * @param {string} fallback - Fallback text
 * @returns {string}
 */
export function translateError(errorKey, fallback = '') {
    const translated = dictionary.errors?.[errorKey];
    return translated || fallback || errorKey;
}

/**
 * Get localized action phrase
 * @param {string} actionKey - Action key (you_trained, you_bought, etc)
 * @returns {string}
 */
export function getAction(actionKey) {
    return dictionary.actions?.[actionKey] || actionKey;
}

/**
 * Get localized location name
 * @param {string} location - English location name
 * @returns {string}
 */
export function getLocation(location) {
    return dictionary.locations?.[location] || location;
}

/**
 * Get localized stat name
 * @param {string} stat - Stat key (strength, defense, etc)
 * @returns {string}
 */
export function getStat(stat) {
    return dictionary.stats?.[stat] || stat;
}

/**
 * Get localized UI text
 * @param {string} uiKey - UI key
 * @returns {string}
 */
export function getUi(uiKey) {
    return dictionary.ui?.[uiKey] || uiKey;
}

/**
 * Get localized time phrase
 * @param {string} timeKey - Time key (minutes, hours, ago, etc)
 * @returns {string}
 */
export function getTime(timeKey) {
    return dictionary.time?.[timeKey] || timeKey;
}

/**
 * Format relative time in Indonesian
 * @param {number} seconds - Time in seconds
 * @returns {string}
 */
export function formatTimeId(seconds) {
    if (!seconds) return 'tidak diketahui';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const jamText = dictionary.time?.hours || 'jam';
    const menitText = dictionary.time?.minutes || 'menit';

    if (hours > 0 && minutes > 0) return `${hours} ${jamText} ${minutes} ${menitText}`;
    if (hours > 0) return `${hours} ${jamText}`;
    return `${minutes} ${menitText}`;
}

/**
 * Format relative time ago in Indonesian
 * @param {number} timestamp - Unix timestamp
 * @returns {string}
 */
export function formatTimeAgoId(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    const baruSaja = dictionary.time?.just_now || 'baru saja';
    const yangLalu = dictionary.time?.ago || 'yang lalu';
    const menitText = dictionary.time?.minutes || 'menit';
    const jamText = dictionary.time?.hours || 'jam';
    const hariText = dictionary.time?.days || 'hari';

    if (diff < 60) return baruSaja;
    if (diff < 3600) return `${Math.floor(diff / 60)} ${menitText} ${yangLalu}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${jamText} ${yangLalu}`;
    return `${Math.floor(diff / 86400)} ${hariText} ${yangLalu}`;
}

export default {
    translate,
    fromDictionary,
    getTemplate,
    applyTemplate,
    translateError,
    getAction,
    getLocation,
    getStat,
    getUi,
    getTime,
    formatTimeId,
    formatTimeAgoId
};
