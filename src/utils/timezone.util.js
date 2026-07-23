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

// ─── Date Input Utilities ───────────────────────────────────────────────────
// These functions provide format-aware date input handling based on the
// application's configured date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.)

/**
 * Get the placeholder string for date input fields based on system date format.
 * @returns {string} e.g. "dd/mm/yyyy", "mm/dd/yyyy", "yyyy-mm-dd"
 */
export const getDateInputPlaceholder = () => {
    const fmt = getAppDateFormat();
    if (fmt === 'MM/DD/YYYY') return 'mm/dd/yyyy';
    if (fmt === 'YYYY-MM-DD') return 'yyyy-mm-dd';
    // DD/MM/YYYY and MMM DD, YYYY both use dd/mm/yyyy for input
    return 'dd/mm/yyyy';
};

/**
 * Get the separator character used in the date format.
 */
const getDateSeparator = () => {
    const fmt = getAppDateFormat();
    if (fmt === 'YYYY-MM-DD') return '-';
    return '/';
};

/**
 * Convert an ISO date string (YYYY-MM-DD) to the system's display format for input fields.
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string (e.g. "25/06/2026" or "06/25/2026" or "2026-06-25")
 */
export const isoToDisplayDate = (isoDate) => {
    if (!isoDate) return '';
    const parts = isoDate.substring(0, 10).split('-');
    if (parts.length !== 3) return isoDate;
    const [y, m, d] = parts;
    const fmt = getAppDateFormat();
    const sep = getDateSeparator();
    if (fmt === 'MM/DD/YYYY') return `${m}${sep}${d}${sep}${y}`;
    if (fmt === 'YYYY-MM-DD') return `${y}${sep}${m}${sep}${d}`;
    // DD/MM/YYYY (default)
    return `${d}${sep}${m}${sep}${y}`;
};

/**
 * Auto-format raw user input for a date field based on the system date format.
 * Inserts separators as the user types digits.
 * @param {string} rawValue - The raw input value
 * @returns {string} Auto-formatted string with separators
 */
export const autoFormatDateInput = (rawValue) => {
    const fmt = getAppDateFormat();
    const sep = getDateSeparator();
    let digits = rawValue.replace(/\D/g, '');

    if (fmt === 'YYYY-MM-DD') {
        // Format: YYYY-MM-DD (4-2-2 grouping)
        if (digits.length > 8) digits = digits.substring(0, 8);
        if (digits.length > 4 && digits.length <= 6) {
            return `${digits.substring(0, 4)}${sep}${digits.substring(4)}`;
        } else if (digits.length > 6) {
            return `${digits.substring(0, 4)}${sep}${digits.substring(4, 6)}${sep}${digits.substring(6)}`;
        }
        return digits;
    }

    // DD/MM/YYYY or MM/DD/YYYY (2-2-4 grouping)
    if (digits.length > 8) digits = digits.substring(0, 8);
    if (digits.length > 2 && digits.length <= 4) {
        return `${digits.substring(0, 2)}${sep}${digits.substring(2)}`;
    } else if (digits.length > 4) {
        return `${digits.substring(0, 2)}${sep}${digits.substring(2, 4)}${sep}${digits.substring(4)}`;
    }
    return digits;
};

/**
 * Get the expected total length of a fully typed date string.
 */
export const getDateInputMaxLength = () => {
    return 10; // All formats: XX/XX/XXXX or XXXX-XX-XX
};

/**
 * Parse a formatted display date string into its day, month, year components
 * based on the system date format.
 * @param {string} displayDate - The formatted date string
 * @returns {{ day: number, month: number, year: number } | null}
 */
export const parseDisplayDateParts = (displayDate) => {
    if (!displayDate || displayDate.length < 10) return null;
    const fmt = getAppDateFormat();
    const sep = getDateSeparator();
    const parts = displayDate.split(sep);
    if (parts.length !== 3) return null;

    if (fmt === 'YYYY-MM-DD') {
        return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
    }
    if (fmt === 'MM/DD/YYYY') {
        return { month: parseInt(parts[0], 10), day: parseInt(parts[1], 10), year: parseInt(parts[2], 10) };
    }
    // DD/MM/YYYY (default)
    return { day: parseInt(parts[0], 10), month: parseInt(parts[1], 10), year: parseInt(parts[2], 10) };
};

/**
 * Validate partial input while the user is typing (inline feedback).
 * Returns an error string or null if valid so far.
 * @param {string} formatted - The auto-formatted input string
 * @returns {string|null} Error message or null
 */
export const validatePartialDateInput = (formatted) => {
    const fmt = getAppDateFormat();
    const sep = getDateSeparator();

    if (fmt === 'YYYY-MM-DD') {
        // Validate year prefix (first 4 digits)
        if (formatted.length >= 4) {
            const year = parseInt(formatted.substring(0, 4), 10);
            if (year < 1900) return "Year must be 1900 or later";
        }
        // Validate month (positions 5-6)
        if (formatted.length >= 7) {
            const month = parseInt(formatted.substring(5, 7), 10);
            if (month < 1 || month > 12) return "Month must be between 01 and 12";
        }
        // Validate day (positions 8-9)
        if (formatted.length >= 10) {
            const day = parseInt(formatted.substring(8, 10), 10);
            if (day < 1 || day > 31) return "Day must be between 01 and 31";
        }
    } else if (fmt === 'MM/DD/YYYY') {
        if (formatted.length >= 2) {
            const month = parseInt(formatted.substring(0, 2), 10);
            if (month < 1 || month > 12) return "Month must be between 01 and 12";
        }
        if (formatted.length >= 5) {
            const day = parseInt(formatted.substring(3, 5), 10);
            if (day < 1 || day > 31) return "Day must be between 01 and 31";
        }
    } else {
        // DD/MM/YYYY
        if (formatted.length >= 2) {
            const day = parseInt(formatted.substring(0, 2), 10);
            if (day < 1 || day > 31) return "Day must be between 01 and 31";
        }
        if (formatted.length >= 5) {
            const month = parseInt(formatted.substring(3, 5), 10);
            if (month < 1 || month > 12) return "Month must be between 01 and 12";
        }
    }
    return null;
};

/**
 * Fully validate and parse a complete date input string.
 * Returns { parsed: 'YYYY-MM-DD', error: null } on success,
 * or { parsed: '', error: 'message' } on failure.
 * @param {string} formatted - The fully entered date string (length === 10)
 * @param {{ allowFuture?: boolean, maxAge?: number }} options
 * @returns {{ parsed: string, error: string|null }}
 */
export const validateAndParseDate = (formatted, options = {}) => {
    const { allowFuture = true, maxAge = null } = options;
    const dateParts = parseDisplayDateParts(formatted);
    if (!dateParts) return { parsed: '', error: 'Invalid date format' };

    const { day: d, month: m, year: y } = dateParts;

    if (y < 1900) return { parsed: '', error: "Year must be 1900 or later" };

    const currentYear = new Date().getFullYear();
    if (!allowFuture && y > currentYear) {
        return { parsed: '', error: "Date cannot be in the future" };
    }

    const daysInMonth = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (m < 1 || m > 12) return { parsed: '', error: "Month must be between 01 and 12" };
    if (d < 1 || d > daysInMonth[m - 1]) {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return { parsed: '', error: `${monthNames[m - 1]} ${y} only has ${daysInMonth[m - 1]} days` };
    }

    if (!allowFuture) {
        const dateObj = new Date(y, m - 1, d);
        const today = new Date();
        if (dateObj > today) return { parsed: '', error: "Date cannot be in the future" };
    }

    if (maxAge && (new Date().getFullYear() - y > maxAge)) {
        return { parsed: '', error: "Please enter a realistic year" };
    }

    const parsed = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    return { parsed, error: null };
};

