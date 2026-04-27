/**
 * Timezone Utility for Frontend
 * Provides timezone conversion and formatting utilities
 */

// Common timezone options for the UI
export const TIMEZONE_OPTIONS = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'UTC', label: 'UTC' }
];

/**
 * Get the application's configured timezone from localStorage
 * @returns {string} Timezone string
 */
export const getAppTimezone = () => {
    try {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        // Default to Asia/Kolkata (IST) as it's the primary region for this app
        return settings.application_timezone || 'Asia/Kolkata';
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

/**
 * Helper to mirror an absolute Date object into a target timezone's numbers.
 * Returns a local Date object where local hours/minutes/etc match the target timezone.
 */
export const mirrorToTimezone = (absoluteDate, timezone) => {
    if (!absoluteDate || isNaN(absoluteDate.getTime())) return absoluteDate;

    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
        }).formatToParts(absoluteDate);

        const p = {};
        parts.forEach(part => { p[part.type] = part.value; });

        // Construct a Date object whose local time represents the numbers from the target timezone
        return new Date(
            parseInt(p.year),
            parseInt(p.month) - 1,
            parseInt(p.day),
            parseInt(p.hour),
            parseInt(p.minute),
            parseInt(p.second)
        );
    } catch (e) {
        console.error('Error mirroring date:', e);
        return absoluteDate;
    }
};

/**
 * Get the application's configured date format
 */
export const getAppDateFormat = () => {
    try {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        return settings.application_date_format || 'MMM DD, YYYY';
    } catch (e) {
        return 'MMM DD, YYYY';
    }
};

/**
 * Get the application's configured time format
 */
export const getAppTimeFormat = () => {
    try {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        return settings.application_time_format || '12h';
    } catch (e) {
        return '12h';
    }
};

/**
 * Format a date/time in the application's configured timezone.
 * Uses Numerical Mirroring to ensure consistent display across all browsers.
 */
export const formatInTimezone = (date, timezone = null, customOptions = null) => {
    try {
        if (!date) return '—';
        const targetTimezone = timezone || getAppTimezone();

        // Always parse into a mirrored local date first
        const mirrored = parseAppTimezone(date, targetTimezone);
        if (!mirrored || isNaN(mirrored.getTime())) return String(date);

        // If custom options are passed (like {month: 'short', day: 'numeric'}), just use Intl
        if (customOptions && Object.keys(customOptions).length > 0) {
            return new Intl.DateTimeFormat('en-US', customOptions).format(mirrored);
        }

        const dateFmt = getAppDateFormat();
        const timeFmt = getAppTimeFormat();

        const year = mirrored.getFullYear();
        const month = String(mirrored.getMonth() + 1).padStart(2, '0');
        const day = String(mirrored.getDate()).padStart(2, '0');
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const shortMonthStr = shortMonths[mirrored.getMonth()];

        let dateString = `${shortMonthStr} ${day}, ${year}`; // Fallback Default
        if (dateFmt === 'DD/MM/YYYY') dateString = `${day}/${month}/${year}`;
        if (dateFmt === 'MM/DD/YYYY') dateString = `${month}/${day}/${year}`;
        if (dateFmt === 'YYYY-MM-DD') dateString = `${year}-${month}-${day}`;
        if (dateFmt === 'MMM DD, YYYY') dateString = `${shortMonthStr} ${day}, ${year}`;

        const hr = mirrored.getHours();
        const mn = String(mirrored.getMinutes()).padStart(2, '0');

        let timeString = '';
        if (timeFmt === '24h') {
            timeString = `${String(hr).padStart(2, '0')}:${mn}`;
        } else {
            const hr12 = hr % 12 || 12;
            const ampm = hr >= 12 ? 'PM' : 'AM';
            timeString = `${String(hr12).padStart(2, '0')}:${mn} ${ampm}`;
        }

        return `${dateString}, ${timeString}`;
    } catch (error) {
        console.error('Error in formatInTimezone:', error);
        return String(date);
    }
};

export const formatDateOnly = (date, timezone = null) => {
    try {
        if (!date) return '—';
        const targetTimezone = timezone || getAppTimezone();
        const mirrored = parseAppTimezone(date, targetTimezone);
        if (!mirrored || isNaN(mirrored.getTime())) return String(date);

        const dateFmt = getAppDateFormat();
        const year = mirrored.getFullYear();
        const month = String(mirrored.getMonth() + 1).padStart(2, '0');
        const day = String(mirrored.getDate()).padStart(2, '0');
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const shortMonthStr = shortMonths[mirrored.getMonth()];

        if (dateFmt === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
        if (dateFmt === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
        if (dateFmt === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
        return `${shortMonthStr} ${day}, ${year}`;
    } catch (e) {
        return String(date);
    }
};

export const formatTimeOnly = (date, timezone = null) => {
    try {
        if (!date) return '—';
        const timeFmt = getAppTimeFormat();

        // Used by pure string regex matching below to avoid local variable scope duplication
        const extractTimeString = (h, m) => {
            if (timeFmt === '24h') {
                return `${String(h).padStart(2, '0')}:${m}`;
            } else {
                const hour12 = h % 12 || 12;
                const ampm = h >= 12 ? 'PM' : 'AM';
                return `${String(hour12).padStart(2, '0')}:${m} ${ampm}`;
            }
        };

        // Check if this is a timezone-formatted string from backend (YYYY-MM-DD HH:mm:ss)
        if (typeof date === 'string') {
            const match = date.match(/^\d{4}-\d{2}-\d{2}\s(\d{2}):(\d{2}):(\d{2})/);;
            if (match) {
                return extractTimeString(parseInt(match[1], 10), match[2]);
            }

            // Handle pure time strings from DB TIME columns (e.g. "14:30:00" or "14:30")
            const timeOnlyMatch = date.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
            if (timeOnlyMatch) {
                return extractTimeString(parseInt(timeOnlyMatch[1], 10), timeOnlyMatch[2]);
            }
        }

        // Otherwise use the standard timezone conversion (for Date objects and other formats)
        const targetTimezone = timezone || getAppTimezone();
        const mirrored = parseAppTimezone(date, targetTimezone);
        if (!mirrored || isNaN(mirrored.getTime())) return String(date);

        return extractTimeString(mirrored.getHours(), String(mirrored.getMinutes()).padStart(2, '0'));
    } catch (e) {
        return String(date);
    }
};

export const getTimezoneOffset = (timezone = null) => {
    try {
        const targetTimezone = timezone || getAppTimezone();
        return new Intl.DateTimeFormat('en-US', {
            timeZone: targetTimezone,
            timeZoneName: 'short'
        }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
    } catch (e) { return ''; }
};

/**
 * Get current date and time parts in application timezone.
 * Returns a mirrored Date object for safe UI use and duration math.
 */
export const getCurrentInAppTimezone = () => {
    try {
        const tz = getAppTimezone();
        const now = new Date();
        const mirrored = mirrorToTimezone(now, tz);

        return {
            date: `${mirrored.getFullYear()}-${String(mirrored.getMonth() + 1).padStart(2, '0')}-${String(mirrored.getDate()).padStart(2, '0')}`,
            time: `${String(mirrored.getHours()).padStart(2, '0')}:${String(mirrored.getMinutes()).padStart(2, '0')}`,
            full: mirrored
        };
    } catch (error) {
        console.error('Error in getCurrentInAppTimezone:', error);
        const now = new Date();
        return {
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0].substring(0, 5),
            full: now
        };
    }
};

/**
 * Parse a date string into a "mirrored" Date object.
 * Handles ISO strings (absolute) and DB strings (naked numbers).
 */
/**
 * Parse a date string into a "mirrored" Date object.
 * CRITICAL: We aggressively strip 'Z', 'T' and offsets to prevent browser timezone shifting.
 * We treat ALL inputs as "Application Timezone Numbers" by default.
 * This is necessary because the backend creates strings in the target timezone (e.g. IST)
 * but the DB/ORM layer often appends 'Z', causing a "Double Shift" if parsed as UTC.
 */
export const parseAppTimezone = (dateStr, timezone = null) => {
    if (!dateStr) return null;
    const targetTz = timezone || getAppTimezone();

    try {
        if (dateStr instanceof Date) return mirrorToTimezone(dateStr, targetTz);

        const str = String(dateStr);

        // If it's explicitly marked as UTC or has an offset, treat it as absolute time
        if (str.includes('Z') || /([+\-]\d{2}:\d{2})$/.test(str)) {
            const absoluteDate = new Date(str);
            return mirrorToTimezone(absoluteDate, targetTz);
        }

        // For "naked" strings (e.g., '2026-02-14 15:30:00'), assume they are ALREADY in the target numbers.
        // Robust Regex Cleanup: Keep only Digits, Space, Colon, Dash
        let cleanStr = str.replace(/[TZ]/g, ' ').split('.')[0].trim();

        const parts = cleanStr.split(/[ :\-]/);
        if (parts.length >= 3) {
            const [y, m, d, hh, mm, ss] = parts.map(val => parseInt(val, 10));
            // Construct as local Date using the numbers exactly as they are.
            return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
        }

        // Fallback
        return mirrorToTimezone(new Date(str), targetTz);
    } catch (e) {
        console.error('Error in parseAppTimezone:', e);
        return new Date(dateStr);
    }
};
