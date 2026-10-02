import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import DateFilterInput from '../components/DateFilterInput';
import { canManageManualAttendance, getCachedRoles, getRoleById, fetchRoles } from '../utils/roleUtils';
import { getCurrentInAppTimezone, formatDateOnly, formatInTimezone } from '../utils/timezone.util';
import { usePageHeader } from '../context/PageHeaderContext';
import { getAttendanceConfig } from '../utils/attendanceConfig';
import {
    LuCalendar,
    LuClock,
    LuCheck,
    LuCheckCheck,
    LuFilter,
    LuSearch,
    LuUser,
    LuRefreshCw,
    LuCircleAlert,
    LuSparkles,
    LuPlus,
    LuHistory,
    LuListFilter,
    LuX,
    LuBriefcase,
    LuCalendarCheck,
    LuCalendarOff,
    LuChevronDown
} from 'react-icons/lu';

const REASON_OPTIONS = [
    { value: 'Work From Home', label: 'Work From Home (WFH)' },
    { value: 'Missed Punch', label: 'Missed / Forgot to Punch' },
    { value: 'On-Duty Regularization', label: 'On-Duty / Client Visit' },
    { value: 'Biometric / Kiosk Issue', label: 'Biometric / Kiosk Issue' },
    { value: 'Late Punch Regularization', label: 'Half-Day / Late Regularization' },
    { value: 'Other', label: 'Other (Specify in Notes)' }
];

const ManualAttendance = () => {
    const navigate = useNavigate();
    const { setHeaderInfo } = usePageHeader();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Page Header setup
    useEffect(() => {
        setHeaderInfo({
            title: 'Manual Attendance',
            subtitle: 'Add and regularize missed employee attendance or work from home logs'
        });
    }, [setHeaderInfo]);

    // Active View Tab: 'missed' or 'history'
    const [activeTab, setActiveTab] = useState('missed');

    // Permissions check with dynamic refresh
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(() => canManageManualAttendance(user.role));

    useEffect(() => {
        const verifyRoleAndPermissions = async () => {
            try {
                await fetchRoles(true);
                setHasPermission(canManageManualAttendance(user.role));
            } catch (e) {
                console.error("Failed to refresh roles:", e);
            } finally {
                setPermissionChecked(true);
            }
        };
        verifyRoleAndPermissions();
    }, [user.role]);

    // Compliance hours & timezone dynamically from settings
    const [complianceHours, setComplianceHours] = useState(() => getAttendanceConfig().complianceHours);

    // Default office timings dynamically from settings (Attendance Configuration)
    const [defaultStartTime, setDefaultStartTime] = useState(() => getAttendanceConfig().startTime);
    const [defaultEndTime, setDefaultEndTime] = useState(() => getAttendanceConfig().endTime);

    // Helper to calculate end time given start time and hours
    const calculateEndTime = useCallback((startStr, hours) => {
        try {
            if (!startStr) return defaultEndTime || getAttendanceConfig().endTime;
            const [h, m] = startStr.split(':').map(Number);
            const totalMinutes = h * 60 + (m || 0) + Math.round((hours || complianceHours) * 60);
            const endH = Math.floor(totalMinutes / 60) % 24;
            const endM = totalMinutes % 60;
            return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        } catch (e) {
            return defaultEndTime || getAttendanceConfig().endTime;
        }
    }, [defaultEndTime, complianceHours]);

    // Date Range Filters
    const nowInApp = getCurrentInAppTimezone();
    const todayStr = nowInApp.date;
    const [datePreset, setDatePreset] = useState('today');
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'MISSING_ALL', 'MISSING_CHECKOUT'

    // Data State
    const [loading, setLoading] = useState(false);
    const [missedItems, setMissedItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkReason, setBulkReason] = useState('Work From Home');
    const [bulkNotes, setBulkNotes] = useState('');
    const [submittingBulk, setSubmittingBulk] = useState(false);
    const [submittingRowId, setSubmittingRowId] = useState(null);

    // Pending Leaves State (for filter notifications)
    const [pendingLeaves, setPendingLeaves] = useState([]);

    // History State
    const [recentLogs, setRecentLogs] = useState([]);
    const [loadingRecent, setLoadingRecent] = useState(false);

    // Manual Modal State for adding attendance for any employee
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [allStaffList, setAllStaffList] = useState([]);
    const [modalData, setModalData] = useState({
        staff_id: '',
        date: todayStr,
        check_in_time: defaultStartTime,
        check_out_time: defaultEndTime,
        reason: 'Work From Home',
        notes: ''
    });
    const [savingModal, setSavingModal] = useState(false);

    // Listen to settingsLoaded event when App.jsx fetches settings
    useEffect(() => {
        const handleSettingsLoaded = () => {
            const config = getAttendanceConfig();
            if (config.startTime) setDefaultStartTime(config.startTime);
            if (config.endTime) setDefaultEndTime(config.endTime);
            if (config.complianceHours) setComplianceHours(config.complianceHours);
        };
        window.addEventListener('settingsLoaded', handleSettingsLoaded);
        return () => window.removeEventListener('settingsLoaded', handleSettingsLoaded);
    }, []);

    // Load system settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get(`${API_BASE_URL}/api/settings`, {
                    headers: { 'x-access-token': token }
                });
                const config = getAttendanceConfig(res.data?.map);
                if (config.startTime) setDefaultStartTime(config.startTime);
                if (config.endTime) setDefaultEndTime(config.endTime);
                if (config.complianceHours) setComplianceHours(config.complianceHours);
            } catch (err) {
                console.error("Failed to load settings:", err);
            }
        };
        fetchSettings();
    }, []);

    // Preset Range Calculation
    const handlePresetChange = (presetKey) => {
        setDatePreset(presetKey);
        const toIso = (dateObj) => {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        if (presetKey === 'today') {
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (presetKey === 'yesterday') {
            const y = new Date(nowInApp.full);
            y.setDate(y.getDate() - 1);
            const yStr = toIso(y);
            setStartDate(yStr);
            setEndDate(yStr);
        } else if (presetKey === 'thisweek') {
            const d = new Date(nowInApp.full);
            const day = d.getDay();
            const diffToMonday = day === 0 ? 6 : day - 1;
            d.setDate(d.getDate() - diffToMonday);
            setStartDate(toIso(d));
            setEndDate(todayStr);
        } else if (presetKey === '7days') {
            const d = new Date(nowInApp.full);
            d.setDate(d.getDate() - 6);
            setStartDate(toIso(d));
            setEndDate(todayStr);
        }
    };

    // Fetch Missed Attendance Data
    const fetchMissedAttendance = useCallback(async () => {
        if (!hasPermission) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/attendance/missed`, {
                headers: { 'x-access-token': token },
                params: {
                    startDate,
                    endDate,
                    search: searchTerm
                }
            });

            if (res.data) {
                const configStart = res.data.default_check_in || defaultStartTime || getAttendanceConfig().startTime;
                const configEnd = res.data.default_check_out || defaultEndTime || getAttendanceConfig().endTime;
                const configHours = res.data.compliance_hours || complianceHours;

                if (res.data.default_check_in) setDefaultStartTime(res.data.default_check_in);
                if (res.data.default_check_out) setDefaultEndTime(res.data.default_check_out);
                if (res.data.compliance_hours) setComplianceHours(res.data.compliance_hours);

                let formatted = [];
                if (res.data.items) {
                    // Initialize editable row fields matching Attendance configuration from settings
                    formatted = res.data.items.map(item => ({
                        ...item,
                        in_time: item.check_in_time || configStart,
                        out_time: item.check_out_time || (item.existing_check_in_time ? calculateEndTime(item.existing_check_in_time, configHours) : configEnd),
                        row_reason: item.reason || 'Work From Home',
                        row_notes: item.notes || ''
                    }));
                    setMissedItems(formatted);
                    setSelectedIds(new Set()); // reset selections
                }

                // Collect pending leaves from response or formatted items
                const pending = res.data.pending_leaves || formatted
                    .filter(item => item.leave_info && (item.leave_info.is_pending || item.leave_info.status === 'Pending'))
                    .map(item => ({
                        staff_id: item.staff_id,
                        employee_name: item.employee_name,
                        date: item.date,
                        leave_type: item.leave_info.leave_type,
                        is_half_day: item.leave_info.is_half_day === true || item.leave_info.is_half_day === 1,
                        reason: item.leave_info.reason
                    }));

                setPendingLeaves(pending);

                // Show notification after selecting the filter if any employee has a pending leave
                if (pending.length > 0) {
                    const count = pending.length;
                    const names = Array.from(new Set(pending.map(p => p.employee_name)));
                    const namesText = names.length <= 2 
                        ? names.join(' and ') 
                        : `${names[0]}, ${names[1]}, and ${names.length - 2} other(s)`;

                    toast(
                        (t) => (
                            <div className="flex items-start gap-3 py-0.5">
                                <LuClock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <p className="font-bold text-amber-950">
                                        Leave Pending Approval ({count})
                                    </p>
                                    <p className="text-amber-800 mt-0.5 leading-normal">
                                        {namesText} {names.length > 1 ? 'have' : 'has'} leave request(s) awaiting approval for the filtered date(s).
                                    </p>
                                </div>
                            </div>
                        ),
                        {
                            id: 'pending-leaves-notification',
                            duration: 7000,
                            style: {
                                border: '1px solid #fcd34d',
                                background: '#fffbeb',
                                borderRadius: '14px',
                                padding: '12px 16px',
                                boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.2)'
                            }
                        }
                    );
                } else {
                    toast.dismiss('pending-leaves-notification');
                }
            }
        } catch (err) {
            console.error("Error fetching missed attendance:", err);
            toast.error(err.response?.data?.message || "Failed to load missed attendance data.");
        } finally {
            setLoading(false);
        }
    }, [hasPermission, startDate, endDate, searchTerm, defaultStartTime, defaultEndTime, calculateEndTime, complianceHours]);

    // Fetch on filter changes
    useEffect(() => {
        if (hasPermission && activeTab === 'missed') {
            fetchMissedAttendance();
        }
    }, [hasPermission, activeTab, fetchMissedAttendance]);

    // Fetch Recent Regularizations
    const fetchRecentRegularizations = async () => {
        if (!hasPermission) return;
        setLoadingRecent(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/attendance/manual-recent?limit=25`, {
                headers: { 'x-access-token': token }
            });
            if (res.data && res.data.recent) {
                setRecentLogs(res.data.recent);
            }
        } catch (err) {
            console.error("Error fetching recent logs:", err);
            toast.error("Failed to load recent regularizations.");
        } finally {
            setLoadingRecent(false);
        }
    };

    // Load staff list for the "Add Individual" modal (only active employees)
    const fetchStaffListForModal = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/admin/users?limit=all&status=active`, {
                headers: { 'x-access-token': token }
            });
            if (res.data?.users) {
                setAllStaffList(res.data.users);
            }
        } catch (err) {
            console.error("Failed to fetch staff list:", err);
        }
    };

    const openAddModal = () => {
        const effStart = defaultStartTime || getAttendanceConfig().startTime;
        const effEnd = defaultEndTime || getAttendanceConfig().endTime;
        setModalData({
            staff_id: allStaffList[0]?.staffid || '',
            date: todayStr,
            check_in_time: effStart,
            check_out_time: effEnd,
            reason: 'Work From Home',
            notes: ''
        });
        if (allStaffList.length === 0) {
            fetchStaffListForModal();
        }
        setIsAddModalOpen(true);
    };

    // Helper to check if item is on approved leave
    const isItemApprovedLeave = (item) => Boolean(item?.leave_info && (item.leave_info.is_approved || item.leave_info.status === 'Approved'));
    // Helper to check if item is pending leave
    const isItemPendingLeave = (item) => Boolean(item?.leave_info && (item.leave_info.is_pending || item.leave_info.status === 'Pending'));
    // Helper to check if item is half-day leave
    const isItemHalfDayLeave = (item) => Boolean(item?.leave_info && (item.leave_info.is_half_day === true || item.leave_info.is_half_day === 1));
    // Helper to check if item is on full-day leave (approved or pending approval)
    const isItemFullDayLeave = (item) => Boolean(item?.leave_info && !isItemHalfDayLeave(item));

    // Counts for actionable items vs approved leaves vs pending leaves vs full-day leaves
    const onApprovedLeaveCount = useMemo(() => missedItems.filter(i => isItemApprovedLeave(i)).length, [missedItems]);
    const onPendingLeaveCount = useMemo(() => missedItems.filter(i => isItemPendingLeave(i)).length, [missedItems]);
    const onFullDayLeaveCount = useMemo(() => missedItems.filter(i => isItemFullDayLeave(i)).length, [missedItems]);
    const actionableCount = useMemo(() => missedItems.filter(i => !isItemFullDayLeave(i)).length, [missedItems]);

    // Filter displayed items by statusFilter
    const filteredMissedItems = useMemo(() => {
        if (statusFilter === 'all') return missedItems;
        if (statusFilter === 'ACTION_REQUIRED') return missedItems.filter(item => !isItemFullDayLeave(item));
        if (statusFilter === 'PENDING_LEAVE') return missedItems.filter(item => isItemPendingLeave(item));
        if (statusFilter === 'ON_LEAVE') return missedItems.filter(item => isItemFullDayLeave(item) || isItemApprovedLeave(item));
        if (statusFilter === 'MISSING_ALL') return missedItems.filter(item => item.missed_type === 'MISSING_ALL' && !item.leave_info);
        if (statusFilter === 'MISSING_CHECKOUT') return missedItems.filter(item => item.missed_type === 'MISSING_CHECKOUT' && !item.leave_info);
        return missedItems.filter(item => item.missed_type === statusFilter);
    }, [missedItems, statusFilter]);

    // Actionable filtered items (excluding employees on full-day leave)
    const actionableFilteredItems = useMemo(() => {
        return filteredMissedItems.filter(item => !isItemFullDayLeave(item));
    }, [filteredMissedItems]);

    // Selection Handlers - Only actionable items can be selected
    const isAllSelected = actionableFilteredItems.length > 0 && actionableFilteredItems.every(i => selectedIds.has(i.id));

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            const next = new Set(actionableFilteredItems.map(i => i.id));
            setSelectedIds(next);
        }
    };

    const handleToggleRow = (id) => {
        const item = missedItems.find(i => i.id === id);
        if (isItemFullDayLeave(item)) return; // Do not allow selecting employees on full-day leave
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    // Row Time & Field Changes
    const handleRowFieldChange = (id, field, value) => {
        setMissedItems(prev => prev.map(item => {
            if (item.id !== id) return item;

            const updated = { ...item, [field]: value };

            // If check_in time changed, auto-recalculate checkout time if user hasn't explicitly set it
            if (field === 'in_time' && value) {
                if (value === defaultStartTime && defaultEndTime) {
                    updated.out_time = defaultEndTime;
                } else {
                    updated.out_time = calculateEndTime(value, complianceHours);
                }
            }

            return updated;
        }));
    };

    // Calculate duration in hours and minutes between two HH:mm strings
    const getDurationMeta = (inTime, outTime) => {
        if (!inTime || !outTime) return { text: '—', hours: 0, isCompliant: false };
        try {
            const [inH, inM] = inTime.split(':').map(Number);
            const [outH, outM] = outTime.split(':').map(Number);
            const startTotal = inH * 60 + (inM || 0);
            const endTotal = outH * 60 + (outM || 0);
            const diff = endTotal - startTotal;
            if (diff <= 0) return { text: 'Invalid', hours: 0, isCompliant: false };

            const h = Math.floor(diff / 60);
            const m = diff % 60;
            const hoursDec = diff / 60;
            const text = m > 0 ? `${h}h ${m}m` : `${h}h`;
            return {
                text,
                hours: hoursDec,
                isCompliant: hoursDec >= complianceHours
            };
        } catch (e) {
            return { text: '—', hours: 0, isCompliant: false };
        }
    };

    // Bulk Action: Apply Default Office Hours for Compliance from Settings
    const handleApplyDefaultToSelected = () => {
        if (selectedIds.size === 0) {
            toast.error("Please select at least one employee.");
            return;
        }

        const effStart = defaultStartTime || getAttendanceConfig().startTime;
        const effEnd = defaultEndTime || getAttendanceConfig().endTime;

        setMissedItems(prev => prev.map(item => {
            if (selectedIds.has(item.id) && !isItemFullDayLeave(item)) {
                return {
                    ...item,
                    in_time: effStart,
                    out_time: effEnd,
                    row_reason: bulkReason || item.row_reason
                };
            }
            return item;
        }));

        toast.success(`Applied default office hours (${effStart} – ${effEnd}) to ${selectedIds.size} employee(s).`);
    };

    // Bulk Action: Submit Selected Records
    const handleSaveSelected = async () => {
        const selectedList = missedItems.filter(i => selectedIds.has(i.id) && !isItemFullDayLeave(i));

        if (selectedList.length === 0) {
            toast.error("Please select at least one employee to regularize.");
            return;
        }

        // Validate all selected
        for (const item of selectedList) {
            if (!item.in_time || !item.out_time) {
                toast.error(`Please provide check-in and check-out time for ${item.employee_name}`);
                return;
            }
            const dur = getDurationMeta(item.in_time, item.out_time);
            if (dur.hours <= 0) {
                toast.error(`Check-out time must be after check-in time for ${item.employee_name}`);
                return;
            }
        }

        setSubmittingBulk(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                records: selectedList.map(item => ({
                    staff_id: item.staff_id,
                    date: item.date,
                    check_in_time: item.in_time,
                    check_out_time: item.out_time,
                    reason: item.row_reason || bulkReason || 'Work From Home',
                    notes: item.row_notes || bulkNotes || '',
                    existing_log_id: item.existing_log_id
                }))
            };

            const res = await axios.post(`${API_BASE_URL}/api/attendance/manual-regularize`, payload, {
                headers: { 'x-access-token': token }
            });

            if (res.data?.success) {
                toast.success(res.data.message || `Successfully regularized ${res.data.success_count} attendance records!`);
                // Refresh list
                await fetchMissedAttendance();
            } else {
                toast.error(res.data?.message || "Failed to regularize attendance.");
            }
        } catch (err) {
            console.error("Bulk save error:", err);
            toast.error(err.response?.data?.message || "Failed to regularize attendance.");
        } finally {
            setSubmittingBulk(false);
        }
    };

    // Single Row Save
    const handleSaveSingleRow = async (item) => {
        if (isItemFullDayLeave(item)) {
            const leaveType = item.leave_info?.leave_type || 'Leave';
            const leaveStatus = isItemApprovedLeave(item) ? 'Approved' : 'Pending Approval';
            toast.error(`${item.employee_name} is on full-day leave (${leaveType}, ${leaveStatus}). Attendance update is not allowed.`);
            return;
        }
        if (!item.in_time || !item.out_time) {
            toast.error("Please enter both check-in and check-out times.");
            return;
        }
        const dur = getDurationMeta(item.in_time, item.out_time);
        if (dur.hours <= 0) {
            toast.error("Check-out time must be after check-in time.");
            return;
        }

        setSubmittingRowId(item.id);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                records: [{
                    staff_id: item.staff_id,
                    date: item.date,
                    check_in_time: item.in_time,
                    check_out_time: item.out_time,
                    reason: item.row_reason || 'Work From Home',
                    notes: item.row_notes || '',
                    existing_log_id: item.existing_log_id
                }]
            };

            const res = await axios.post(`${API_BASE_URL}/api/attendance/manual-regularize`, payload, {
                headers: { 'x-access-token': token }
            });

            if (res.data?.success && res.data.success_count > 0) {
                if (isItemPendingLeave(item)) {
                    toast.success(`Attendance regularized for ${item.employee_name}! (Note: Leave was pending for this date)`);
                } else {
                    toast.success(`Attendance regularized for ${item.employee_name}!`);
                }
                // Remove item from missed list
                setMissedItems(prev => prev.filter(i => i.id !== item.id));
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                });
            } else {
                toast.error(res.data?.message || "Failed to save attendance.");
            }
        } catch (err) {
            console.error("Single save error:", err);
            toast.error(err.response?.data?.message || "Failed to save attendance.");
        } finally {
            setSubmittingRowId(null);
        }
    };

    // Modal Submit (Individual Ad-hoc entry)
    const handleModalSubmit = async (e) => {
        e.preventDefault();
        if (!modalData.staff_id) {
            toast.error("Please select an employee.");
            return;
        }
        if (!modalData.date) {
            toast.error("Please select a date.");
            return;
        }
        if (!modalData.check_in_time || !modalData.check_out_time) {
            toast.error("Please provide both check-in and check-out times.");
            return;
        }

        setSavingModal(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                records: [{
                    staff_id: parseInt(modalData.staff_id),
                    date: modalData.date,
                    check_in_time: modalData.check_in_time,
                    check_out_time: modalData.check_out_time,
                    reason: modalData.reason,
                    notes: modalData.notes
                }]
            };

            const res = await axios.post(`${API_BASE_URL}/api/attendance/manual-regularize`, payload, {
                headers: { 'x-access-token': token }
            });

            if (res.data?.success && res.data.success_count > 0) {
                toast.success("Attendance added successfully!");
                setIsAddModalOpen(false);
                fetchMissedAttendance();
            } else {
                toast.error(res.data?.message || "Failed to add attendance.");
            }
        } catch (err) {
            console.error("Modal save error:", err);
            toast.error(err.response?.data?.message || "Failed to add attendance.");
        } finally {
            setSavingModal(false);
        }
    };

    if (!permissionChecked && !hasPermission) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <ModernLoader text="Verifying permissions..." />
            </div>
        );
    }

    if (permissionChecked && !hasPermission) {
        return (
            <div className="p-8 max-w-2xl mx-auto text-center mt-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    <LuCircleAlert />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
                <p className="text-slate-600 mb-6">
                    You do not have permission to manage manual attendance or regularizations. This feature is restricted to authorized HR personnel and Administrators.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="px-5 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
            {/* Top Navigation & Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('missed')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                            activeTab === 'missed'
                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <LuListFilter className="text-base" />
                        <span>Missed Attendance</span>
                        {missedItems.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                activeTab === 'missed' ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'
                            }`}>
                                {missedItems.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('history');
                            fetchRecentRegularizations();
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                            activeTab === 'history'
                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <LuHistory className="text-base" />
                        <span>Recent Regularizations</span>
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={openAddModal}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm shadow-emerald-200 transition-colors"
                    >
                        <LuPlus className="text-lg" />
                        <span>Add Individual Entry</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: MISSED ATTENDANCE */}
            {activeTab === 'missed' && (
                <div className="space-y-6">
                    {/* Filter Bar */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            {/* Date Presets */}
                            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
                                {[
                                    { key: 'today', label: 'Today' },
                                    { key: 'yesterday', label: 'Yesterday' },
                                    { key: 'thisweek', label: 'This Week' },
                                    { key: '7days', label: 'Last 7 Days' },
                                    { key: 'custom', label: 'Custom Range' }
                                ].map(p => (
                                    <button
                                        key={p.key}
                                        onClick={() => handlePresetChange(p.key)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                            datePreset === p.key
                                                ? 'bg-white text-indigo-700 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Status Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500">Show:</span>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">All Records ({missedItems.length})</option>
                                    <option value="ACTION_REQUIRED">Action Required ({actionableCount})</option>
                                    {onPendingLeaveCount > 0 && (
                                        <option value="PENDING_LEAVE">Leave Pending Approval ({onPendingLeaveCount})</option>
                                    )}
                                    <option value="ON_LEAVE">On Leave ({onFullDayLeaveCount})</option>
                                    <option value="MISSING_ALL">Missed Both / No Punch</option>
                                    <option value="MISSING_CHECKOUT">Missed Check-Out Only</option>
                                </select>
                            </div>
                        </div>

                        {/* Search & Custom Date Range inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                            {/* Start Date */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Start Date
                                </label>
                                <DateFilterInput
                                    value={startDate}
                                    onChange={(val) => {
                                        setStartDate(val);
                                        setDatePreset('custom');
                                    }}
                                />
                            </div>

                            {/* End Date */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    End Date
                                </label>
                                <DateFilterInput
                                    value={endDate}
                                    onChange={(val) => {
                                        setEndDate(val);
                                        setDatePreset('custom');
                                    }}
                                />
                            </div>

                            {/* Search */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Search Employee
                                </label>
                                <div className="relative">
                                    <LuSearch className="absolute left-3 top-2.5 text-slate-400 text-sm" />
                                    <input
                                        type="text"
                                        placeholder="Name, email, or ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && fetchMissedAttendance()}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Refresh Button */}
                            <div className="flex items-end gap-2">
                                <button
                                    onClick={fetchMissedAttendance}
                                    disabled={loading}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl shadow-xs transition-colors"
                                >
                                    <LuRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
                                    <span>Filter Records</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pending Leave Notification Banner */}
                    {pendingLeaves.length > 0 && (
                        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-950 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                    <LuClock className="text-lg animate-pulse" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                                            {pendingLeaves.length} Employee Leave Request{pendingLeaves.length > 1 ? 's' : ''} Pending Approval
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-800 border border-amber-300">
                                            Action Pending
                                        </span>
                                    </div>
                                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                                        The following employee{pendingLeaves.length > 1 ? 's have' : ' has'} applied for leave on the selected date(s):{' '}
                                        <span className="font-semibold text-amber-950">
                                            {pendingLeaves.map(p => `${p.employee_name} (${p.leave_type} - ${p.date})`).join(', ')}
                                        </span>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                {statusFilter !== 'PENDING_LEAVE' ? (
                                    <button
                                        onClick={() => setStatusFilter('PENDING_LEAVE')}
                                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
                                    >
                                        <span>View Pending Only</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-amber-700 text-[10px] font-bold">
                                            {pendingLeaves.length}
                                        </span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className="px-3.5 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs rounded-xl transition-colors shadow-xs"
                                    >
                                        Show All Records
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Bulk Selection Sticky Toolbar */}
                    {selectedIds.size > 0 && (
                        <div className="sticky top-4 z-20 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-200">
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-indigo-500 text-white font-bold flex items-center justify-center text-sm">
                                    {selectedIds.size}
                                </span>
                                <div>
                                    <h4 className="text-sm font-bold text-white">
                                        {selectedIds.size} Employee{selectedIds.size > 1 ? 's' : ''} Selected
                                    </h4>
                                    <p className="text-xs text-slate-300">
                                        Apply compliance hours or regularize selected attendance in one batch.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Bulk Reason */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-300 font-medium">Reason:</span>
                                    <select
                                        value={bulkReason}
                                        onChange={(e) => setBulkReason(e.target.value)}
                                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    >
                                        {REASON_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Apply Default Hours Button */}
                                <button
                                    onClick={handleApplyDefaultToSelected}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <LuSparkles className="text-xs" />
                                    <span>Apply Default ({defaultStartTime} - {defaultEndTime})</span>
                                </button>

                                {/* Save Button */}
                                <button
                                    onClick={handleSaveSelected}
                                    disabled={submittingBulk}
                                    className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    {submittingBulk ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <LuCheck className="text-sm" />
                                            <span>Save All Selected ({selectedIds.size})</span>
                                        </>
                                    )}
                                </button>

                                {/* Clear Selection */}
                                <button
                                    onClick={() => setSelectedIds(new Set())}
                                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                                    title="Deselect all"
                                >
                                    <LuX className="text-base" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Table of Missed Employees */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-16 flex flex-col items-center justify-center">
                                <ModernLoader />
                                <p className="text-xs text-slate-500 mt-4 font-medium animate-pulse">
                                    Checking attendance logs across active staff...
                                </p>
                            </div>
                        ) : filteredMissedItems.length === 0 ? (
                            <div className="p-16 text-center">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm">
                                    <LuCheckCheck />
                                </div>
                                <h3 className="text-base font-bold text-slate-800 mb-1">
                                    No Missed Attendance Found!
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                                    All active employees have completed attendance logs for the selected date range ({startDate} to {endDate}), or no records match your search criteria.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="p-3.5 pl-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected}
                                                    onChange={handleToggleSelectAll}
                                                    disabled={actionableFilteredItems.length === 0}
                                                    className={`w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${
                                                        actionableFilteredItems.length === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                                    }`}
                                                    title={actionableFilteredItems.length === 0 ? "No actionable records to select" : "Select all actionable"}
                                                />
                                            </th>
                                            <th className="p-3.5 min-w-[200px]">Employee</th>
                                            <th className="p-3.5 min-w-[110px]">Date</th>
                                            <th className="p-3.5 min-w-[160px]">Missed Status</th>
                                            <th className="p-3.5 min-w-[120px]">Check-In</th>
                                            <th className="p-3.5 min-w-[120px]">Check-Out</th>
                                            <th className="p-3.5 min-w-[110px]">Duration</th>
                                            <th className="p-3.5 min-w-[170px]">Reason</th>
                                            <th className="p-3.5 min-w-[150px]">Notes</th>
                                            <th className="p-3.5 pr-4 text-right min-w-[90px]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {filteredMissedItems.map((item) => {
                                            const isSelected = selectedIds.has(item.id);
                                            const isApprovedLeave = isItemApprovedLeave(item);
                                            const isPendingLeave = isItemPendingLeave(item);
                                            const isHalfDayLeave = isItemHalfDayLeave(item);
                                            const isFullDayLeave = isItemFullDayLeave(item);
                                            const dur = getDurationMeta(item.in_time, item.out_time);
                                            const isRowSubmitting = submittingRowId === item.id;

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`transition-colors ${
                                                        isApprovedLeave
                                                            ? 'bg-purple-50/20 hover:bg-purple-50/30'
                                                            : isPendingLeave
                                                                ? 'bg-amber-50/25 hover:bg-amber-50/35 border-l-2 border-l-amber-400'
                                                                : isSelected
                                                                    ? 'bg-indigo-50/40 hover:bg-indigo-50/60'
                                                                    : 'hover:bg-slate-50/70'
                                                    }`}
                                                >
                                                    {/* Checkbox */}
                                                    <td className="p-3.5 pl-4 text-center">
                                                        {isFullDayLeave ? (
                                                            <span
                                                                className="text-slate-300 font-bold text-xs select-none block text-center"
                                                                title={isApprovedLeave 
                                                                    ? "Employee is on approved full-day leave — update not allowed" 
                                                                    : "Employee is on full-day leave (Pending Approval) — update not allowed"}
                                                            >
                                                                —
                                                            </span>
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleToggleRow(item.id)}
                                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            />
                                                        )}
                                                    </td>

                                                    {/* Employee Info */}
                                                    <td className="p-3.5">
                                                        <div className="flex items-center gap-3">
                                                            {item.avatar ? (
                                                                <img
                                                                    src={`${API_BASE_URL}/${item.avatar}`}
                                                                    alt={item.employee_name}
                                                                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                                                                    {item.employee_name.charAt(0) || 'U'}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-slate-900 truncate">
                                                                    {item.employee_name}
                                                                </p>
                                                                <p className="text-[11px] text-slate-500 truncate">
                                                                    {item.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="p-3.5 font-medium text-slate-700 whitespace-nowrap">
                                                        {item.date}
                                                    </td>

                                                    {/* Missed Status */}
                                                    <td className="p-3.5">
                                                        {isApprovedLeave ? (
                                                            <div>
                                                                <span
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap"
                                                                    title={item.leave_info?.reason ? `Reason: ${item.leave_info.reason}` : undefined}
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                                    <span>On Leave: {item.leave_info?.leave_type || 'Approved Leave'}</span>
                                                                </span>
                                                                {isHalfDayLeave && (
                                                                    <div className="text-[10px] text-purple-600 font-medium pl-1 mt-0.5">
                                                                        Half Day
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : isPendingLeave ? (
                                                            <div>
                                                                <span
                                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap"
                                                                    title={item.leave_info?.reason ? `Reason: ${item.leave_info.reason}` : undefined}
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                                    <span>Leave Pending Approval</span>
                                                                </span>
                                                                {isHalfDayLeave && (
                                                                    <div className="text-[10px] text-amber-700 font-semibold pl-1 mt-0.5">
                                                                        Half Day
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : item.missed_type === 'MISSING_CHECKOUT' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                                                <span>Check-Out Missing</span>
                                                                {item.existing_check_in_time && (
                                                                    <span className="text-[10px] text-blue-500">
                                                                        ({item.existing_check_in_time})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                                Missed In & Out
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* If on full-day leave (approved or pending): do not show update controls, show simple leave message */}
                                                    {isFullDayLeave ? (
                                                        <td colSpan={6} className="p-3.5 pr-4">
                                                            <span
                                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                                                                    isApprovedLeave
                                                                        ? 'bg-purple-50/70 text-purple-700 border-purple-200/80'
                                                                        : 'bg-amber-50/70 text-amber-800 border-amber-200/80'
                                                                }`}
                                                                title={item.leave_info?.reason ? `Reason: ${item.leave_info.reason}` : undefined}
                                                            >
                                                                <LuCalendarOff className="text-xs shrink-0" />
                                                                <span>
                                                                    {isApprovedLeave
                                                                        ? 'Full-day leave approved — Attendance update not required'
                                                                        : 'Full-day leave pending approval — Update disabled'}
                                                                </span>
                                                            </span>
                                                        </td>
                                                    ) : (
                                                        <>
                                                            {/* Check-In Input */}
                                                            <td className="p-3.5">
                                                                <input
                                                                    type="time"
                                                                    value={item.in_time}
                                                                    onChange={(e) => handleRowFieldChange(item.id, 'in_time', e.target.value)}
                                                                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                />
                                                            </td>

                                                            {/* Check-Out Input */}
                                                            <td className="p-3.5">
                                                                <input
                                                                    type="time"
                                                                    value={item.out_time}
                                                                    onChange={(e) => handleRowFieldChange(item.id, 'out_time', e.target.value)}
                                                                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                />
                                                            </td>

                                                            {/* Calculated Duration */}
                                                            <td className="p-3.5">
                                                                <span
                                                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                                                                        dur.isCompliant
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : dur.hours > 0
                                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                                : 'bg-slate-100 text-slate-400'
                                                                    }`}
                                                                    title={dur.isCompliant ? `Meets compliance (${complianceHours}h)` : `Below compliance threshold (${complianceHours}h)`}
                                                                >
                                                                    {dur.text}
                                                                </span>
                                                            </td>

                                                            {/* Reason Selector */}
                                                            <td className="p-3.5">
                                                                <select
                                                                    value={item.row_reason}
                                                                    onChange={(e) => handleRowFieldChange(item.id, 'row_reason', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                >
                                                                    {REASON_OPTIONS.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>
                                                                            {opt.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Notes */}
                                                            <td className="p-3.5">
                                                                <input
                                                                    type="text"
                                                                    placeholder={isPendingLeave ? `Leave pending (${item.leave_info.leave_type})...` : "Remarks / reference..."}
                                                                    value={item.row_notes}
                                                                    onChange={(e) => handleRowFieldChange(item.id, 'row_notes', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                />
                                                            </td>

                                                            {/* Action: Save Single */}
                                                            <td className="p-3.5 pr-4 text-right">
                                                                <button
                                                                    onClick={() => handleSaveSingleRow(item)}
                                                                    disabled={isRowSubmitting}
                                                                    className={`inline-flex items-center justify-center px-3 py-1 text-white font-medium text-xs rounded-lg transition-colors shadow-xs ${
                                                                        isPendingLeave ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'
                                                                    }`}
                                                                    title={isPendingLeave ? "Save attendance (Note: Employee has pending leave)" : "Save attendance for this employee"}
                                                                >
                                                                    {isRowSubmitting ? (
                                                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <span>Save</span>
                                                                    )}
                                                                </button>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: RECENT REGULARIZATIONS */}
            {activeTab === 'history' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">
                                Recently Regularized Records
                            </h3>
                            <p className="text-xs text-slate-500">
                                Audit history of manually regularized attendance entries.
                            </p>
                        </div>
                        <button
                            onClick={fetchRecentRegularizations}
                            disabled={loadingRecent}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                        >
                            <LuRefreshCw className={`text-xs ${loadingRecent ? 'animate-spin' : ''}`} />
                            <span>Refresh History</span>
                        </button>
                    </div>

                    {loadingRecent ? (
                        <div className="p-16 flex flex-col items-center justify-center">
                            <ModernLoader />
                        </div>
                    ) : recentLogs.length === 0 ? (
                        <div className="p-16 text-center text-slate-500 text-sm">
                            No manual attendance records found yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="p-3.5 pl-4">Employee</th>
                                        <th className="p-3.5">Attendance Date</th>
                                        <th className="p-3.5">Check-In</th>
                                        <th className="p-3.5">Check-Out</th>
                                        <th className="p-3.5">Duration</th>
                                        <th className="p-3.5">Reason / Comments</th>
                                        <th className="p-3.5">Status</th>
                                        <th className="p-3.5 pr-4 text-right">Regularized On</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {recentLogs.map((log) => {
                                        const dur = getDurationMeta(log.check_in_time, log.check_out_time);
                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-3.5 pl-4 font-bold text-slate-900">
                                                    {log.employee_name}
                                                    <span className="block font-normal text-[11px] text-slate-400">
                                                        {log.email}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 font-medium text-slate-700 whitespace-nowrap">
                                                    {log.date}
                                                </td>
                                                <td className="p-3.5 font-semibold text-slate-800">
                                                    {log.check_in_time || '—'}
                                                </td>
                                                <td className="p-3.5 font-semibold text-slate-800">
                                                    {log.check_out_time || '—'}
                                                </td>
                                                <td className="p-3.5">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                        dur.isCompliant ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                        {dur.text}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 max-w-xs text-slate-600 truncate" title={log.comments}>
                                                    {log.comments || 'Manual Regularization'}
                                                </td>
                                                <td className="p-3.5">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                        Approved
                                                    </span>
                                                </td>
                                                <td className="p-3.5 pr-4 text-right text-slate-500 whitespace-nowrap">
                                                    {formatDateOnly(log.updatedAt)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL: ADD INDIVIDUAL ATTENDANCE */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                                    <LuPlus className="text-lg" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Add Manual Attendance</h3>
                                    <p className="text-xs text-slate-500">Add an attendance log for an employee</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <LuX className="text-lg" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
                            {/* Employee */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Select Employee *
                                </label>
                                <select
                                    value={modalData.staff_id}
                                    onChange={(e) => setModalData({ ...modalData, staff_id: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">-- Choose Staff Member --</option>
                                    {allStaffList.map(s => (
                                        <option key={s.staffid} value={s.staffid}>
                                            {s.firstname} {s.lastname} ({s.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Attendance Date *
                                </label>
                                <input
                                    type="date"
                                    value={modalData.date}
                                    onChange={(e) => setModalData({ ...modalData, date: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Check-In & Check-Out Timings */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Check-In Time *
                                    </label>
                                    <input
                                        type="time"
                                        value={modalData.check_in_time}
                                        onChange={(e) => {
                                            const inT = e.target.value;
                                            setModalData({
                                                ...modalData,
                                                check_in_time: inT,
                                                check_out_time: (inT === defaultStartTime && defaultEndTime)
                                                    ? defaultEndTime
                                                    : calculateEndTime(inT, complianceHours)
                                            });
                                        }}
                                        required
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Check-Out Time *
                                    </label>
                                    <input
                                        type="time"
                                        value={modalData.check_out_time}
                                        onChange={(e) => setModalData({ ...modalData, check_out_time: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Compliance Helper Button */}
                            <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-200">
                                <span>Duration: <strong>{getDurationMeta(modalData.check_in_time, modalData.check_out_time).text}</strong></span>
                                <button
                                    type="button"
                                    onClick={() => setModalData({
                                        ...modalData,
                                        check_in_time: defaultStartTime || getAttendanceConfig().startTime,
                                        check_out_time: defaultEndTime || getAttendanceConfig().endTime
                                    })}
                                    className="font-bold text-emerald-700 underline hover:text-emerald-900"
                                >
                                    Apply Default ({defaultStartTime || getAttendanceConfig().startTime} - {defaultEndTime || getAttendanceConfig().endTime})
                                </button>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Reason *
                                </label>
                                <select
                                    value={modalData.reason}
                                    onChange={(e) => setModalData({ ...modalData, reason: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {REASON_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Remarks / Reference
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Optional explanation or reference number..."
                                    value={modalData.notes}
                                    onChange={(e) => setModalData({ ...modalData, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingModal}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2"
                                >
                                    {savingModal ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <span>Submit Attendance</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManualAttendance;
