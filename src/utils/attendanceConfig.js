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
        
        // Priority 1: Use explicit attendance_compliance_hours configured in system settings
        if (stored.attendance_compliance_hours !== undefined && stored.attendance_compliance_hours !== null && stored.attendance_compliance_hours !== '') {
            const parsed = parseFloat(stored.attendance_compliance_hours);
            if (!isNaN(parsed) && parsed > 0) {
                complianceHours = parsed;
            }
        }

        // Priority 2: Fallback to difference between office start & end times
        if (!complianceHours && stored.office_start_time && stored.office_end_time) {
            const [sh, sm] = stored.office_start_time.split(':').map(Number);
            const [eh, em] = stored.office_end_time.split(':').map(Number);
            const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            if (diff > 0) {
                complianceHours = Math.round((diff / 60) * 100) / 100;
            }
        }
        
        // Priority 3: Fallback calculation
        if (isNaN(complianceHours) || !complianceHours || complianceHours <= 0) {
            complianceHours = 9;
        }

        let allowedLeavePerMonth = parseFloat(stored.allowed_leave_per_month);
        if (isNaN(allowedLeavePerMonth) || allowedLeavePerMonth < 0) {
            allowedLeavePerMonth = 1;
        }

        let allowedTimeOffPerMonth = parseFloat(stored.allowed_time_off_per_month);
        if (isNaN(allowedTimeOffPerMonth) || allowedTimeOffPerMonth < 0) {
            allowedTimeOffPerMonth = 2;
        }

        let complianceHoursPartTime = parseFloat(stored.attendance_compliance_hours_part_time);
        if (isNaN(complianceHoursPartTime) || complianceHoursPartTime <= 0) {
            complianceHoursPartTime = complianceHours ? Math.round((complianceHours / 2) * 100) / 100 : 4.5;
        }

        return {
            complianceHours,
            complianceHoursFullTime: complianceHours,
            complianceHoursPartTime,
            allowedLeavePerMonth,
            allowedTimeOffPerMonth,
            startTime,
            endTime
        };
    } catch (e) {
        return {
            complianceHours: 9,
            complianceHoursFullTime: 9,
            complianceHoursPartTime: 4.5,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2,
            startTime: '09:30',
            endTime: '18:30'
        };
    }
};

export const getComplianceHours = (settingsMap = null, employmentType = 'Full-time') => {
    const config = getAttendanceConfig(settingsMap);
    const isPartTime = employmentType && String(employmentType).trim().toLowerCase().replace(/[\s_-]+/g, '') === 'parttime';
    return isPartTime ? (config.complianceHoursPartTime || 4.5) : (config.complianceHoursFullTime || config.complianceHours || 9);
};

export const getFullTimeComplianceHours = (settingsMap = null) => {
    return getAttendanceConfig(settingsMap).complianceHoursFullTime;
};

export const getPartTimeComplianceHours = (settingsMap = null) => {
    return getAttendanceConfig(settingsMap).complianceHoursPartTime;
};

export const getAllowedLeavePerMonth = (settingsMap = null) => {
    return getAttendanceConfig(settingsMap).allowedLeavePerMonth;
};

export const getAllowedTimeOffPerMonth = (settingsMap = null) => {
    return getAttendanceConfig(settingsMap).allowedTimeOffPerMonth;
};

export const isAttendanceEnabled = (settingsMap = null) => {
    try {
        const stored = settingsMap || JSON.parse(localStorage.getItem('settings') || '{}');
        const val = stored.module_attendance_enabled;
        if (val === undefined || val === null) return true; // default enabled
        return String(val).toLowerCase() !== 'false';
    } catch (e) {
        return true;
    }
};

