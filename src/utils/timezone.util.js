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
            // Check if it's a pure date string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
            // If it's just YYYY-MM-DD, we want to treat it as a local date in the target timezone
            // Standard new Date('YYYY-MM-DD') treats it as UTC midnight, which shifts.
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                const [year, month, day] = date.split('-').map(Number);
                // We create a date at noon in that day to avoid DST shifts usually, 
                // but the best way to get "that day" in a specific timezone is complex.
                // However, for "Date Only" displays, we usually just want to see the numbers.
                // If the user wants it to EXACTLY follow the timezone, we should be careful.
                dateObj = new Date(year, month - 1, day, 12, 0, 0);
            } else {
                dateObj = new Date(date);
            }
        } else {
            dateObj = date;
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
