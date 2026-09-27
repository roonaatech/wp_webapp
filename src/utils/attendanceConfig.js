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
        
        let complianceHours = null;
        
        // Priority 1: Calculate directly from office start & end times configured in system settings
        if (stored.office_start_time && stored.office_end_time) {
            const [sh, sm] = stored.office_start_time.split(':').map(Number);
            const [eh, em] = stored.office_end_time.split(':').map(Number);
            const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            if (diff > 0) {
                complianceHours = Math.round((diff / 60) * 100) / 100;
            }
        }
        
        // Priority 2: Use attendance_compliance_hours if start/end times were missing
        if (!complianceHours || isNaN(complianceHours) || complianceHours <= 0) {
            complianceHours = parseFloat(stored.attendance_compliance_hours);
        }
        
        // Priority 3: Fallback calculation
        if (isNaN(complianceHours) || complianceHours <= 0) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            complianceHours = diff > 0 ? Math.round((diff / 60) * 100) / 100 : 9;
        }

        let allowedLeavePerMonth = parseFloat(stored.allowed_leave_per_month);
        if (isNaN(allowedLeavePerMonth) || allowedLeavePerMonth < 0) {
            allowedLeavePerMonth = 1;
        }

        let allowedTimeOffPerMonth = parseFloat(stored.allowed_time_off_per_month);
        if (isNaN(allowedTimeOffPerMonth) || allowedTimeOffPerMonth < 0) {
            allowedTimeOffPerMonth = 2;
        }

        return {
            complianceHours,
            allowedLeavePerMonth,
            allowedTimeOffPerMonth,
            startTime,
            endTime
        };
    } catch (e) {
        return {
            complianceHours: 9,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2,
            startTime: '09:30',
            endTime: '18:30'
        };
    }
};

export const getComplianceHours = (settingsMap = null) => {
    return getAttendanceConfig(settingsMap).complianceHours;
};

export const getAllowedLeavePerMonth = (settingsMap = null) => {
    return getAttendanceConfig(settingsMap).allowedLeavePerMonth;
};

export const getAllowedTimeOffPerMonth = (settingsMap = null) => {
    return getAttendanceConfig(settingsMap).allowedTimeOffPerMonth;
};
