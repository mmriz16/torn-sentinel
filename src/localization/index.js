/**
 * Localization Module Index
 * Export all localization utilities
 */

export {
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
} from './localizationResolver.js';

export {
    getCached,
    setCached,
    getCacheStats,
    recordAiCall,
    clearCache
} from './translationCache.js';
