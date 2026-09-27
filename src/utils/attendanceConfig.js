/**
 * Utility to dynamically get attendance configuration from system settings.
 * Ensures working hours / compliance thresholds are never hardcoded and are always
 * derived from the "Attendance Configuration" in system settings.
 */

export const getAttendanceConfig = (settingsMap = null) => {
    try {
        const stored = settingsMap || JSON.parse(localStorage.getItem('settings') || '{}');
        
        const startTime = stored.office_start_time || '09:30';
        const endTime = stored.office_end_time || '18:30';
        
        let complianceHours = parseFloat(stored.attendance_compliance_hours);
        
        // If not directly present as a valid number, calculate from office start & end times
        if (isNaN(complianceHours) || complianceHours <= 0) {
            if (stored.office_start_time && stored.office_end_time) {
                const [sh, sm] = stored.office_start_time.split(':').map(Number);
                const [eh, em] = stored.office_end_time.split(':').map(Number);
                const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
                if (diff > 0) {
                    complianceHours = Math.round((diff / 60) * 100) / 100;
                }
            }
        }
        
        // Safe fallback if settings are uninitialized
        if (isNaN(complianceHours) || complianceHours <= 0) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            complianceHours = diff > 0 ? Math.round((diff / 60) * 100) / 100 : 8;
        }

        return {
            complianceHours,
            startTime,
            endTime
        };
    } catch (e) {
        return {
            complianceHours: 8,
            startTime: '09:30',
            endTime: '18:30'
        };
    }
};

export const getComplianceHours = (settingsMap = null) => {
    return getAttendanceConfig(settingsMap).complianceHours;
};
