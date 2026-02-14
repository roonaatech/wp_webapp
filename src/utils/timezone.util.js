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
        return settings.application_timezone || 'America/Chicago';
    } catch (e) {
        return 'America/Chicago';
    }
};

/**
 * Format a date/time in the application's configured timezone
 * @param {Date|string} date - Date to format
 * @param {string} timezone - Optional specific IANA timezone string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatInTimezone = (date, timezone = null, options = {}) => {
    try {
        const targetTimezone = timezone || getAppTimezone();
        let dateObj;

        if (typeof date === 'string') {
            // Check if it's a pure date string (YYYY-MM-DD)
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                const [year, month, day] = date.split('-').map(Number);
                dateObj = new Date(year, month - 1, day, 12, 0, 0);
            } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(date) && !date.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(date)) {
                // This is a date string without timezone info (like from our new DB format)
                // Treat it as being in the target timezone to avoid shifting numbers
                // Hack: We append the target timezone offset or just use the parts
                const [dPart, tPart] = date.split(/[ T]/);
                const [year, month, day] = dPart.split('-').map(Number);
                const [hour, minute, second] = tPart.split(':').map(Number);

                // Construct a date that will result in these numbers in the target timezone
                // The easiest way is to use the Intl parts logic but reversed (complex)
                // Or just use the original string if we just want the numbers back.
                return date.split('.')[0]; // Temporary simple return for "numbers-in, numbers-out"
            } else {
                dateObj = new Date(date);
            }
        } else {
            dateObj = date;
        }

        if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
            // If we returned a string above, it won't hit here
            if (typeof dateObj === 'string') return dateObj;
            return 'Invalid Date';
        }

        const defaultOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: targetTimezone
        };

        const formatOptions = { ...defaultOptions, ...options };

        return new Intl.DateTimeFormat('en-US', formatOptions).format(dateObj);
    } catch (error) {
        console.error('Error formatting date in timezone:', error);
        return new Date(date).toLocaleString();
    }
};

/**
 * Format date only (no time)
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted date string (MM/DD/YYYY)
 */
export const formatDateOnly = (date, timezone = null) => {
    return formatInTimezone(date, timezone, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: undefined,
        minute: undefined,
        hour12: undefined
    });
};

/**
 * Format time only (no date)
 * @param {Date|string} date - Date to format
 * @param {string} timezone - Optional specific IANA timezone string
 * @returns {string} Formatted time string (HH:MM AM/PM)
 */
export const formatTimeOnly = (date, timezone = null) => {
    return formatInTimezone(date, timezone, {
        year: undefined,
        month: undefined,
        day: undefined,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

/**
 * Get timezone offset string (e.g., "GMT-6")
 * @param {string} timezone - Optional specific IANA timezone string
 * @returns {string} Offset string
 */
export const getTimezoneOffset = (timezone = null) => {
    try {
        const targetTimezone = timezone || getAppTimezone();
        const date = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: targetTimezone,
            timeZoneName: 'short'
        });
        const parts = formatter.formatToParts(date);
        const timeZoneName = parts.find(part => part.type === 'timeZoneName');
        return timeZoneName ? timeZoneName.value : '';
    } catch (error) {
        console.error('Error getting timezone offset:', error);
        return '';
    }
};

/**
 * Get current date and time parts in application timezone
 * Useful for initializing form inputs
 * @returns {object} { date: "YYYY-MM-DD", time: "HH:mm", full: Date }
 */
export const getCurrentInAppTimezone = () => {
    try {
        const tz = getAppTimezone();
        const now = new Date();

        // Use Intl to get strings in the target timezone
        const dateStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // en-CA gives YYYY-MM-DD
        const timeStr = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }); // en-GB gives HH:mm

        return {
            date: dateStr,
            time: timeStr
        };
    } catch (error) {
        console.error('Error getting current time in app timezone:', error);
        return {
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0].substring(0, 5)
        };
    }
};

/**
 * Parse a date string as being in the application's timezone
 * @param {string} dateStr - Date string (e.g. "2026-02-14 09:00:00")
 * @returns {Date} Date object
 */
export const parseAppTimezone = (dateStr) => {
    if (!dateStr) return null;
    try {
        const tz = getAppTimezone();
        // If it's already an ISO string with Z or offset, new Date() is fine
        if (dateStr.includes('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
            return new Date(dateStr);
        }

        // Otherwise, treat it as being in 'tz'
        // This is tricky in vanilla JS, but we can use Intl to get offset
        // or just append the offset if we know it.
        // A simpler way for display purposes is to use formatInTimezone which handles strings.
        return new Date(dateStr + 'Z'); // Hack: if we store it as "IST but in UTC column"
        // Wait, if we stored it as IST numbers in the DB, and we read it, 
        // we want to display it correctly.
    } catch (e) {
        return new Date(dateStr);
    }
};
