/**
 * WorkPulse Device Fingerprinting & Single Device Identity Utility
 * Generates and persists a stable client-side device identifier for attendance security.
 * Uses dual-layer persistence (LocalStorage + Long-Lived Cookie + Hardware Hash Seed)
 * to ensure device ID is never lost upon logout or storage clears.
 */

const STORAGE_KEY = 'wp_device_id';
const COOKIE_NAME = 'wp_dev_id';

/**
 * Read cookie by name
 */
function getCookie(name) {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

/**
 * Set long-lived cookie (10 years)
 */
function setCookie(name, value) {
    if (typeof document === 'undefined') return;
    try {
        const maxAge = 10 * 365 * 24 * 60 * 60; // 10 years in seconds
        document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
    } catch (_) {}
}

/**
 * Generate a simple hash string from hardware attributes for stable seed
 */
function generateHardwareHash() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return '';
    const screen = window.screen || {};
    const nav = navigator || {};
    const raw = [
        nav.userAgent || '',
        nav.platform || '',
        nav.language || '',
        screen.width || '',
        screen.height || '',
        screen.colorDepth || '',
        screen.pixelDepth || '',
        window.devicePixelRatio || '',
        nav.hardwareConcurrency || ''
    ].join('###');

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

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
 * Get or create persistent device ID (dual-layer persistence)
 * @returns {string} Unique persistent device ID (e.g. "wp-dev-xxxx-xxxx")
 */
export function getOrCreateDeviceId() {
    try {
        // 1. Check LocalStorage
        let deviceId = localStorage.getItem(STORAGE_KEY);
        if (deviceId && deviceId.length >= 16) {
            // Self-heal cookie if missing
            if (!getCookie(COOKIE_NAME)) {
                setCookie(COOKIE_NAME, deviceId);
            }
            return deviceId;
        }

        // 2. Check Persistent Cookie (recovers ID if localStorage was cleared on logout)
        const cookieId = getCookie(COOKIE_NAME);
        if (cookieId && cookieId.length >= 16) {
            localStorage.setItem(STORAGE_KEY, cookieId);
            return cookieId;
        }

        // 3. Generate a new hardware-seeded device UUID
        const hwHash = generateHardwareHash();
        const newUuid = generateUUID();
        deviceId = `wp-dev-${hwHash}-${newUuid}`;

        localStorage.setItem(STORAGE_KEY, deviceId);
        setCookie(COOKIE_NAME, deviceId);

        return deviceId;
    } catch (e) {
        console.warn('Storage not available for device ID generation:', e);
        const cookieId = getCookie(COOKIE_NAME);
        if (cookieId) return cookieId;
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
 * Check if the current device is a mobile browser / phone / tablet
 * @returns {boolean}
 */
export function isMobileClient() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    // Standard mobile UA pattern
    const isStandardMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    if (isStandardMobile) return true;

    // Check for iPadOS (which often identifies as Macintosh with touch support)
    const isIPadOS = /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
    if (isIPadOS) return true;

    return false;
}
