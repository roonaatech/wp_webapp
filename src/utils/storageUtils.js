/**
 * Safe LocalStorage & Storage Parsing Utility
 * Prevents JSON.parse crashes from invalid, null, undefined, or URL-encoded strings in localStorage.
 */

/**
 * Safely parse a JSON string from localStorage with a guaranteed fallback.
 * Never throws an exception and never returns null when a fallback object is provided.
 *
 * @param {string} key - localStorage key
 * @param {any} [fallback={}] - Default value if key is missing or invalid
 * @returns {any}
 */
export const safeGetStoredJson = (key, fallback = {}) => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return fallback;
        }

        const raw = localStorage.getItem(key);
        if (!raw || raw === 'undefined' || raw === 'null') {
            return fallback;
        }

        // Handle potential URL encoding (e.g. %7B%22id%22%3A1%7D)
        let toParse = raw;
        if (typeof raw === 'string' && (raw.startsWith('%7B') || raw.startsWith('%7b') || raw.startsWith('%5B') || raw.startsWith('%5b'))) {
            try {
                toParse = decodeURIComponent(raw);
            } catch (_) {
                toParse = raw;
            }
        }

        const parsed = JSON.parse(toParse);
        // If parsed result is primitive null, return fallback
        if (parsed === null && fallback !== null) {
            return fallback;
        }
        return parsed;
    } catch (e) {
        console.warn(`[storageUtils] Error parsing localStorage key "${key}":`, e);
        return fallback;
    }
};

/**
 * Safely retrieve the current user object from localStorage.
 * Guarantees a non-null object with expected properties to prevent `user.role` TypeError.
 *
 * @returns {object}
 */
export const safeGetStoredUser = () => {
    const user = safeGetStoredJson('user', {});
    if (!user || typeof user !== 'object') {
        return { firstname: '', lastname: '', email: '', role: null };
    }
    return user;
};

/**
 * Safely retrieve the system settings object from localStorage.
 *
 * @returns {object}
 */
export const safeGetStoredSettings = () => {
    const settings = safeGetStoredJson('settings', {});
    if (!settings || typeof settings !== 'object') {
        return {};
    }
    return settings;
};

/**
 * Safely write JSON to localStorage with quota protection.
 *
 * @param {string} key - localStorage key
 * @param {any} value - Value to serialize
 * @returns {boolean} true if successful, false otherwise
 */
export const safeSetStoredJson = (key, value) => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        if (value === undefined || value === null) {
            localStorage.removeItem(key);
            return true;
        }
        const stringified = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, stringified);
        return true;
    } catch (e) {
        console.warn(`[storageUtils] Error saving localStorage key "${key}":`, e);
        return false;
    }
};

export default {
    safeGetStoredJson,
    safeGetStoredUser,
    safeGetStoredSettings,
    safeSetStoredJson
};
