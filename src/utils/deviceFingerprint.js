/**
 * WorkPulse Device Fingerprinting & Single Device Identity Utility
 * Generates and persists a stable client-side device identifier for attendance security.
 */

const STORAGE_KEY = 'wp_device_id';

/**
 * Generate a cryptographically strong UUID
 */
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback RFC4122 v4 UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Get or create persistent device ID
 * @returns {string} Unique persistent device ID (e.g. "wp-dev-xxxx-xxxx")
 */
export function getOrCreateDeviceId() {
    try {
        let deviceId = localStorage.getItem(STORAGE_KEY);
        if (deviceId && deviceId.length >= 16) {
            return deviceId;
        }

        // Generate a new hardware-keyed device UUID
        const newUuid = generateUUID();
        deviceId = `wp-dev-${newUuid}`;
        localStorage.setItem(STORAGE_KEY, deviceId);
        return deviceId;
    } catch (e) {
        console.warn('LocalStorage not available for device ID generation:', e);
        return 'wp-dev-fallback-' + Date.now();
    }
}

/**
 * Get a friendly device name and browser description
 * @returns {string} e.g. "iPhone (iOS) - Mobile Safari" or "Android Phone - Chrome Mobile"
 */
export function getDeviceName() {
    if (typeof navigator === 'undefined') return 'Unknown Device';

    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    let browser = 'Browser';

    // OS detection
    if (/iPad|iPhone|iPod/.test(ua)) {
        os = 'Apple iPhone/iPad (iOS)';
    } else if (/Android/.test(ua)) {
        os = 'Android Device';
    } else if (/Macintosh|Mac OS X/.test(ua)) {
        os = 'macOS';
    } else if (/Windows/.test(ua)) {
        os = 'Windows PC';
    } else if (/Linux/.test(ua)) {
        os = 'Linux';
    }

    // Browser detection
    if (/CriOS|Chrome/.test(ua) && !/Edge|Edg|OPR/.test(ua)) {
        browser = 'Chrome';
    } else if (/Safari/.test(ua) && !/Chrome|CriOS/.test(ua)) {
        browser = 'Safari';
    } else if (/Firefox|FxiOS/.test(ua)) {
        browser = 'Firefox';
    } else if (/Edg/.test(ua)) {
        browser = 'Edge';
    } else if (/OPR|Opera/.test(ua)) {
        browser = 'Opera';
    }

    const screenRes = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '';
    return `${os} - ${browser} (${screenRes})`;
}

/**
 * Check if the current device is a mobile browser / phone
 * @returns {boolean}
 */
export function isMobileClient() {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
