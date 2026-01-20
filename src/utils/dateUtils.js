export const calculateLeaveDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    
    // Parse the date strings (YYYY-MM-DD) manually to avoid timezone issues
    // Using new Date("YYYY-MM-DD") creates a UTC date, which might shift to the previous day in local time.
    // We want to work with the dates exactly as they appear in the concept of "days".
    
    const parseDate = (dateStr) => {
        if (typeof dateStr !== 'string') return new Date(dateStr);
        // Assuming YYYY-MM-DD format which is standard for input="date" and SQL DATE
        const parts = dateStr.split('-');
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

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        // In JavaScript: Sunday = 0, Monday = 1, ..., Saturday = 6
        // Exclude Sunday (0)
        if (current.getDay() !== 0) {
            count++;
        }
        // Add 1 day
        current.setDate(current.getDate() + 1);
    }

    return count;
};
