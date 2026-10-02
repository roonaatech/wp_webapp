export const calculateLeaveDays = (startDate, endDate, holidaysMapOrSet = null) => {
    if (!startDate || !endDate) return 0;

    // Parse the date strings (YYYY-MM-DD) manually to avoid timezone issues
    // Using new Date("YYYY-MM-DD") creates a UTC date, which might shift to the previous day in local time.
    // We want to work with the dates exactly as they appear in the concept of "days".

    const parseDate = (dateStr) => {
        if (typeof dateStr !== 'string') return new Date(dateStr);
        // Assuming YYYY-MM-DD format which is standard for input="date" and SQL DATE
        const parts = dateStr.split('T')[0].split(' ')[0].split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date(dateStr);
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 0;
    }

    // If start is after end, return 0
    if (start > end) return 0;

    const isHoliday = (dateStr) => {
        if (!holidaysMapOrSet) return false;
        if (holidaysMapOrSet instanceof Set) return holidaysMapOrSet.has(dateStr);
        if (holidaysMapOrSet instanceof Map) return holidaysMapOrSet.has(dateStr);
        if (typeof holidaysMapOrSet === 'object') return Boolean(holidaysMapOrSet[dateStr]);
        return false;
    };

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        // In JavaScript: Sunday = 0. Exclude Sunday and holidays
        if (current.getDay() !== 0 && !isHoliday(dateStr)) {
            count++;
        }
        // Add 1 day
        current.setDate(current.getDate() + 1);
    }

    return count;
};

/**
 * Formats a leave duration (in days) for display.
 * A half-day leave (0.5 days) is shown as "Half Day" instead of "0.5 Days".
 *
 * @param {number} days - The leave duration in days (e.g. 0.5, 1, 2.5).
 * @param {Object} [options]
 * @param {boolean} [options.lowercase=false] - Use lowercase wording ("half day" / "day(s)").
 * @returns {string} e.g. "Half Day", "1 Day", "3 Days".
 */
export const formatLeaveDuration = (days, options = {}) => {
    const { lowercase = false } = options;
    const numeric = Number(days);

    if (numeric === 0.5) {
        return lowercase ? 'half day' : 'Half Day';
    }

    const unit = lowercase ? 'day' : 'Day';
    return `${numeric} ${unit}${numeric === 1 ? '' : 's'}`;
};
