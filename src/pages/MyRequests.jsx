import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import { getRoleDisplayName } from '../utils/roleUtils';

// ─── Helper Functions ───────────────────────────────────
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime12 = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
};

const calculateLeaveDaysExcludingSunday = (start, end) => {
    if (!start || !end) return 0;
    let count = 0;
    let current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
        if (current.getDay() !== 0) count++; // 0 = Sunday
        current.setDate(current.getDate() + 1);
    }
    return count;
};

const statusColor = (status) => {
    switch (status) {
        case 'Approved': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'Rejected': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
        case 'Pending':
        default: return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
    }
};

// ─── Status Badge ───────────────────────────────────
const StatusBadge = ({ status }) => {
    const c = statusColor(status);
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${c.bg} ${c.text} ${c.border} border`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
            {status}
        </span>
    );
};

// ─── Main Component ───────────────────────────────────
const MyRequests = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');

    // Tab State
    const [activeTab, setActiveTab] = useState('leave'); // 'leave' | 'onduty' | 'timeoff'
    const [activeView, setActiveView] = useState('apply'); // 'apply' | 'history'

    // ── Confirm Delete Modal State ──
    const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, deleting: false });

    // ── Detail Bottom Sheet State ──
    const [selectedDetail, setSelectedDetail] = useState(null); // holds the full item object
    const [detailType, setDetailType] = useState(''); // 'leave' | 'onduty' | 'timeoff'

    const openDetail = (item, type) => {
        setSelectedDetail(item);
        setDetailType(type);
    };
    const closeDetail = () => {
        setSelectedDetail(null);
        setDetailType('');
    };

    // ── Leave State ──
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [leaveTypesLoading, setLeaveTypesLoading] = useState(false);
    const [selectedLeaveType, setSelectedLeaveType] = useState('');
    const [leaveStartDate, setLeaveStartDate] = useState('');
    const [leaveEndDate, setLeaveEndDate] = useState('');
    const [leaveReason, setLeaveReason] = useState('');
    const [leaveSubmitting, setLeaveSubmitting] = useState(false);
    const [myLeaves, setMyLeaves] = useState([]);
    const [leavesLoading, setLeavesLoading] = useState(false);

    // ── On-Duty State ──
    const [odClientName, setOdClientName] = useState('');
    const [odLocation, setOdLocation] = useState('');
    const [odPurpose, setOdPurpose] = useState('');
    const [odSubmitting, setOdSubmitting] = useState(false);
    const [isOnDuty, setIsOnDuty] = useState(false);
    const [activeOnDutyData, setActiveOnDutyData] = useState(null);
    const [odStartTime, setOdStartTime] = useState(null);
    const [myOnDuty, setMyOnDuty] = useState([]);
    const [onDutyLoading, setOnDutyLoading] = useState(false);

    // ── Time-Off State ──
    const [toDate, setToDate] = useState('');
    const [toStartTime, setToStartTime] = useState('');
    const [toEndTime, setToEndTime] = useState('');
    const [toReason, setToReason] = useState('');
    const [toSubmitting, setToSubmitting] = useState(false);
    const [myTimeOffs, setMyTimeOffs] = useState([]);
    const [timeOffLoading, setTimeOffLoading] = useState(false);

    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // ── Edit State ──
    const [editingLeave, setEditingLeave] = useState(null);
    const [editLeaveType, setEditLeaveType] = useState('');
    const [editLeaveStart, setEditLeaveStart] = useState('');
    const [editLeaveEnd, setEditLeaveEnd] = useState('');
    const [editLeaveReason, setEditLeaveReason] = useState('');
    const [editLeaveSubmitting, setEditLeaveSubmitting] = useState(false);

    const [editingOnDuty, setEditingOnDuty] = useState(null);
    const [editOdClient, setEditOdClient] = useState('');
    const [editOdLocation, setEditOdLocation] = useState('');
    const [editOdPurpose, setEditOdPurpose] = useState('');
    const [editOdSubmitting, setEditOdSubmitting] = useState(false);

    const [editingTimeOff, setEditingTimeOff] = useState(null);
    const [editToDate, setEditToDate] = useState('');
    const [editToStart, setEditToStart] = useState('');
    const [editToEnd, setEditToEnd] = useState('');
    const [editToReason, setEditToReason] = useState('');
    const [editToSubmitting, setEditToSubmitting] = useState(false);

    const headers = { 'x-access-token': token };

    // ─── Fetchers ───────────────────────────────────
    const fetchLeaveTypes = useCallback(async () => {
        setLeaveTypesLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/leavetypes/user/filtered`, { headers });
            setLeaveTypes(res.data || []);
        } catch (e) { console.error('Failed to fetch leave types', e); }
        finally { setLeaveTypesLoading(false); }
    }, []);

    const fetchMyLeaves = useCallback(async () => {
        setLeavesLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/leave/my-history`, { headers });
            setMyLeaves(res.data.items || []);
        } catch (e) { console.error('Failed to fetch leaves', e); }
        finally { setLeavesLoading(false); }
    }, []);

    const fetchActiveOnDuty = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/onduty/active`, { headers });
            if (res.data.active) {
                setIsOnDuty(true);
                setActiveOnDutyData(res.data.data);
                setOdClientName(res.data.data.client_name || '');
                setOdLocation(res.data.data.location || '');
                setOdPurpose(res.data.data.purpose || '');
                setOdStartTime(new Date(res.data.data.start_time));
            } else {
                setIsOnDuty(false);
                setActiveOnDutyData(null);
            }
        } catch (e) {
            setIsOnDuty(false);
            setActiveOnDutyData(null);
        }
    }, []);

    const fetchMyOnDuty = useCallback(async () => {
        setOnDutyLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/leave/my-history`, { headers });
            // Filter on-duty items from the combined history
            const onDutyItems = (res.data.items || []).filter(l => l.type === 'on_duty');
            setMyOnDuty(onDutyItems);
        } catch (e) { console.error('Failed to fetch on-duty logs', e); }
        finally { setOnDutyLoading(false); }
    }, []);

    const fetchMyTimeOffs = useCallback(async () => {
        setTimeOffLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/timeoff/my-history`, { headers });
            setMyTimeOffs(res.data.requests || res.data || []);
        } catch (e) { console.error('Failed to fetch time-off', e); }
        finally { setTimeOffLoading(false); }
    }, []);

    useEffect(() => {
        if (!token) { navigate('/login'); return; }
        fetchLeaveTypes();
        fetchActiveOnDuty();
        fetchMyLeaves(); // needed for calendar status colors
    }, []);

    useEffect(() => {
        if (activeView === 'history') {
            if (activeTab === 'leave') fetchMyLeaves();
            else if (activeTab === 'onduty') fetchMyOnDuty();
            else if (activeTab === 'timeoff') fetchMyTimeOffs();
        }
    }, [activeView, activeTab]);

    // ─── Submit Handlers ───────────────────────────────────
    const handleLeaveSubmit = async (e) => {
        e.preventDefault();
        if (!selectedLeaveType || !leaveStartDate || !leaveEndDate || !leaveReason.trim()) {
            toast.error('Please fill all fields');
            return;
        }
        setLeaveSubmitting(true);
        try {
            await axios.post(`${API_BASE_URL}/api/leave/apply`, {
                leave_type: selectedLeaveType,
                start_date: leaveStartDate,
                end_date: leaveEndDate,
                reason: leaveReason.trim()
            }, { headers });
            toast.success('Leave applied successfully!');
            setSelectedLeaveType('');
            setLeaveStartDate('');
            setLeaveEndDate('');
            setLeaveReason('');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to apply leave');
        } finally { setLeaveSubmitting(false); }
    };

    // Helper to get current coordinates
    const getCurrentLocation = () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.warn('Geolocation not supported');
                resolve({ latitude: 0, longitude: 0 });
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    resolve({ latitude: 0, longitude: 0 });
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    };

    const handleStartOnDuty = async (e) => {
        e.preventDefault();
        if (!odClientName.trim() || !odLocation.trim() || !odPurpose.trim()) {
            toast.error('Please fill all fields');
            return;
        }
        setOdSubmitting(true);
        try {
            const coords = await getCurrentLocation();
            await axios.post(`${API_BASE_URL}/api/onduty/start`, {
                client_name: odClientName.trim(),
                location: odLocation.trim(),
                purpose: odPurpose.trim(),
                latitude: coords.latitude,
                longitude: coords.longitude
            }, { headers });
            toast.success('On-Duty started!');
            setIsOnDuty(true);
            setOdStartTime(new Date());
            fetchActiveOnDuty();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to start on-duty');
        } finally { setOdSubmitting(false); }
    };

    const handleEndOnDuty = async () => {
        setOdSubmitting(true);
        try {
            const coords = await getCurrentLocation();
            await axios.post(`${API_BASE_URL}/api/onduty/end`, {
                latitude: coords.latitude,
                longitude: coords.longitude
            }, { headers });
            toast.success('On-Duty ended!');
            setIsOnDuty(false);
            setActiveOnDutyData(null);
            setOdClientName('');
            setOdLocation('');
            setOdPurpose('');
            setOdStartTime(null);
            fetchMyOnDuty(); // refresh history
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to end on-duty');
        } finally { setOdSubmitting(false); }
    };

    const handleTimeOffSubmit = async (e) => {
        e.preventDefault();
        if (!toDate || !toStartTime || !toEndTime || !toReason.trim()) {
            toast.error('Please fill all fields');
            return;
        }
        // Validate end > start
        if (toEndTime <= toStartTime) {
            toast.error('End time must be after start time');
            return;
        }
        setToSubmitting(true);
        try {
            await axios.post(`${API_BASE_URL}/api/timeoff/apply`, {
                date: toDate,
                start_time: toStartTime,
                end_time: toEndTime,
                reason: toReason.trim()
            }, { headers });
            toast.success('Time-off requested successfully!');
            setToDate('');
            setToStartTime('');
            setToEndTime('');
            setToReason('');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to apply time-off');
        } finally { setToSubmitting(false); }
    };

    const handleDeleteLeave = async (id) => {
        setConfirmModal({
            open: true,
            title: 'Delete Leave Request',
            message: 'Are you sure you want to delete this leave request? This action cannot be undone.',
            deleting: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, deleting: true }));
                try {
                    await axios.delete(`${API_BASE_URL}/api/leave/${id}`, { headers });
                    toast.success('Leave deleted');
                    fetchMyLeaves();
                } catch (e) {
                    toast.error(e.response?.data?.message || 'Failed to delete');
                } finally {
                    setConfirmModal({ open: false, title: '', message: '', onConfirm: null, deleting: false });
                }
            }
        });
    };

    const handleDeleteOnDuty = async (id) => {
        setConfirmModal({
            open: true,
            title: 'Delete On-Duty Log',
            message: 'Are you sure you want to delete this on-duty log? This action cannot be undone.',
            deleting: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, deleting: true }));
                try {
                    await axios.delete(`${API_BASE_URL}/api/onduty/${id}`, { headers });
                    toast.success('On-duty deleted');
                    fetchMyOnDuty();
                } catch (e) {
                    toast.error(e.response?.data?.message || 'Failed to delete');
                } finally {
                    setConfirmModal({ open: false, title: '', message: '', onConfirm: null, deleting: false });
                }
            }
        });
    };

    const handleDeleteTimeOff = async (id) => {
        setConfirmModal({
            open: true,
            title: 'Delete Time-Off Request',
            message: 'Are you sure you want to delete this time-off request? This action cannot be undone.',
            deleting: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, deleting: true }));
                try {
                    await axios.delete(`${API_BASE_URL}/api/timeoff/${id}`, { headers });
                    toast.success('Time-off deleted');
                    fetchMyTimeOffs();
                } catch (e) {
                    toast.error(e.response?.data?.message || 'Failed to delete');
                } finally {
                    setConfirmModal({ open: false, title: '', message: '', onConfirm: null, deleting: false });
                }
            }
        });
    };

    // ─── Edit Handlers ───────────────────────────────────
    const startEditLeave = (leave) => {
        setEditingLeave(leave.id);
        setEditLeaveType(leave.title || leave.leave_type || '');
        setEditLeaveStart(leave.start || leave.start_date || '');
        setEditLeaveEnd(leave.end || leave.end_date || '');
        setEditLeaveReason(leave.subtitle || leave.reason || '');
    };

    const handleEditLeave = async (id) => {
        if (!editLeaveType || !editLeaveStart || !editLeaveEnd || !editLeaveReason.trim()) {
            toast.error('Please fill all fields');
            return;
        }
        setEditLeaveSubmitting(true);
        try {
            await axios.put(`${API_BASE_URL}/api/leave/${id}`, {
                leave_type: editLeaveType,
                start_date: editLeaveStart,
                end_date: editLeaveEnd,
                reason: editLeaveReason.trim()
            }, { headers });
            toast.success('Leave updated!');
            setEditingLeave(null);
            fetchMyLeaves();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update');
        } finally { setEditLeaveSubmitting(false); }
    };

    const startEditOnDuty = (od) => {
        const clientName = od.title ? od.title.replace('On-Duty: ', '') : od.client_name || '';
        const parts = od.subtitle ? od.subtitle.split(' - ') : [];
        setEditingOnDuty(od.id);
        setEditOdClient(clientName);
        setEditOdLocation(parts[0] || od.location || '');
        setEditOdPurpose(parts.slice(1).join(' - ') || od.purpose || '');
    };

    const handleEditOnDuty = async (id) => {
        if (!editOdClient.trim() || !editOdLocation.trim() || !editOdPurpose.trim()) {
            toast.error('Please fill all fields');
            return;
        }
        setEditOdSubmitting(true);
        try {
            await axios.put(`${API_BASE_URL}/api/onduty/${id}`, {
                client_name: editOdClient.trim(),
                location: editOdLocation.trim(),
                purpose: editOdPurpose.trim()
            }, { headers });
            toast.success('On-Duty updated!');
            setEditingOnDuty(null);
            fetchMyOnDuty();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update');
        } finally { setEditOdSubmitting(false); }
    };

    const startEditTimeOff = (to) => {
        setEditingTimeOff(to.id);
        setEditToDate(to.date || '');
        setEditToStart(to.start_time || '');
        setEditToEnd(to.end_time || '');
        setEditToReason(to.reason || '');
    };

    const handleEditTimeOff = async (id) => {
        if (!editToDate || !editToStart || !editToEnd || !editToReason.trim()) {
            toast.error('Please fill all fields');
            return;
        }
        if (editToEnd <= editToStart) {
            toast.error('End time must be after start time');
            return;
        }
        setEditToSubmitting(true);
        try {
            await axios.put(`${API_BASE_URL}/api/timeoff/${id}`, {
                date: editToDate,
                start_time: editToStart,
                end_time: editToEnd,
                reason: editToReason.trim()
            }, { headers });
            toast.success('Time-Off updated!');
            setEditingTimeOff(null);
            fetchMyTimeOffs();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update');
        } finally { setEditToSubmitting(false); }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            if (token) {
                await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, { headers });
            }
        } catch (e) { console.error('Logout error', e); }
        finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            toast.success('Logged out');
            navigate('/login');
        }
    };

    // Duration formatter for active on-duty
    const formatDuration = (start) => {
        if (!start) return '';
        const diff = Date.now() - new Date(start).getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    // Calculate time-off duration
    const calcTimeOffDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return '';
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff <= 0) return 'Invalid';
        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;
        if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h`;
        return `${minutes}m`;
    };

    // Today's date in yyyy-mm-dd for min attribute
    const today = new Date().toISOString().split('T')[0];

    // ── Calendar Logic ──
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [rangeStep, setRangeStep] = useState(0); // 0 = pick start, 1 = pick end
    const [tempCalStart, setTempCalStart] = useState('');
    const [tempCalEnd, setTempCalEnd] = useState('');

    const openCalendar = () => {
        setTempCalStart(leaveStartDate);
        setTempCalEnd(leaveEndDate);
        setRangeStep(leaveStartDate && !leaveEndDate ? 1 : 0);
        setCalendarOpen(true);
    };
    const confirmCalendar = () => {
        setLeaveStartDate(tempCalStart);
        setLeaveEndDate(tempCalEnd || tempCalStart);
        setCalendarOpen(false);
    };
    const cancelCalendar = () => {
        setCalendarOpen(false);
    };

    // Build a map of date -> status from myLeaves (leave type only)
    const leaveDateStatusMap = React.useMemo(() => {
        const map = {};
        myLeaves.filter(l => l.type === 'leave' && l.status !== 'Rejected').forEach(leave => {
            const start = new Date(leave.start_date || leave.start);
            const end = new Date(leave.end_date || leave.end);
            const current = new Date(start);
            while (current <= end) {
                const key = current.toISOString().split('T')[0];
                map[key] = leave.status; // 'Approved' or 'Pending'
                current.setDate(current.getDate() + 1);
            }
        });
        return map;
    }, [myLeaves]);

    const calendarYear = calendarMonth.getFullYear();
    const calendarMon = calendarMonth.getMonth();
    const daysInMonth = new Date(calendarYear, calendarMon + 1, 0).getDate();
    const firstDayOfWeek = new Date(calendarYear, calendarMon, 1).getDay(); // 0=Sun
    const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const handleCalendarDayClick = (dateStr) => {
        if (rangeStep === 0) {
            setTempCalStart(dateStr);
            setTempCalEnd('');
            setRangeStep(1);
        } else {
            if (dateStr < tempCalStart) {
                setTempCalStart(dateStr);
                setTempCalEnd('');
                setRangeStep(1);
            } else {
                setTempCalEnd(dateStr);
                setRangeStep(0);
            }
        }
    };

    const isInSelectedRange = (dateStr) => {
        if (!tempCalStart) return false;
        if (!tempCalEnd) return dateStr === tempCalStart;
        return dateStr >= tempCalStart && dateStr <= tempCalEnd;
    };

    const isRangeStart = (dateStr) => dateStr === tempCalStart;
    const isRangeEnd = (dateStr) => dateStr === tempCalEnd;

    const calendarDays = [];
    // Empty cells for offset
    for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(calendarYear, calendarMon, d);
        const dateStr = `${calendarYear}-${String(calendarMon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        calendarDays.push({ day: d, dateStr, dateObj, isSunday: dateObj.getDay() === 0 });
    }

    const prevMonth = () => setCalendarMonth(new Date(calendarYear, calendarMon - 1, 1));
    const nextMonth = () => setCalendarMonth(new Date(calendarYear, calendarMon + 1, 1));

    // ─── TAB CONFIG ───────────────────────────────────
    const tabs = [
        { id: 'leave', label: 'Leave', icon: '📋', color: 'from-blue-500 to-blue-600' },
        { id: 'onduty', label: 'On-Duty', icon: '🚗', color: 'from-purple-500 to-purple-600' },
        { id: 'timeoff', label: 'Time-Off', icon: '⏰', color: 'from-teal-500 to-teal-600' },
    ];

    // ─── Render ───────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            {/* ── Top App Bar ── */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white sticky top-0 z-50 safe-area-top">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg font-black backdrop-blur-sm">
                            {(user.firstname || 'U').charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-base font-bold leading-tight">WorkPulse</h1>
                            <p className="text-[11px] text-white/70 font-medium">{user.firstname || 'User'} • {getRoleDisplayName(user.role)}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95"
                        title="Sign Out"
                    >
                        {isLoggingOut ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin block"></span>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Tab Selector ── */}
            <div className="bg-white border-b border-gray-100 sticky top-[60px] z-40 shadow-sm">
                <div className="flex">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setActiveView('apply'); }}
                            className={`flex-1 py-3 flex flex-col items-center gap-1 relative transition-all duration-300 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`}
                        >
                            <span className="text-lg">{tab.icon}</span>
                            <span className="text-[11px] font-bold tracking-wide">{tab.label}</span>
                            {activeTab === tab.id && (
                                <div className={`absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r ${tab.color} rounded-full`}></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Apply / History Toggle ── */}
            <div className="px-4 pt-4 pb-2">
                <div className="bg-gray-100 rounded-2xl p-1 flex">
                    <button
                        onClick={() => setActiveView('apply')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeView === 'apply'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500'
                            }`}
                    >
                        Apply New
                    </button>
                    <button
                        onClick={() => setActiveView('history')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeView === 'history'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500'
                            }`}
                    >
                        My Requests
                    </button>
                </div>
            </div>

            {/* ── Content Area ── */}
            <div className="px-4 pb-8">
                {/* ═══════════════════════════════════════════ */}
                {/* LEAVE TAB */}
                {/* ═══════════════════════════════════════════ */}
                {activeTab === 'leave' && activeView === 'apply' && (
                    <form onSubmit={handleLeaveSubmit} className="space-y-4 animate-fadeIn">
                        {/* Leave Type */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Leave Type</label>
                            {leaveTypesLoading ? (
                                <div className="h-12 bg-gray-50 rounded-xl animate-pulse"></div>
                            ) : (
                                <select
                                    value={selectedLeaveType}
                                    onChange={(e) => setSelectedLeaveType(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all appearance-none"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
                                >
                                    <option value="">Select leave type</option>
                                    {leaveTypes.map((lt) => (
                                        <option key={lt.id} value={lt.name}>{lt.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Leave Period - Tappable Fields */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Leave Period</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div onClick={openCalendar} className="cursor-pointer">
                                    <label className="text-[10px] text-gray-400 font-semibold mb-1 block">From</label>
                                    <div className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className={leaveStartDate ? 'text-gray-800' : 'text-gray-400'}>
                                            {leaveStartDate ? formatDate(leaveStartDate) : 'Select date'}
                                        </span>
                                    </div>
                                </div>
                                <div onClick={openCalendar} className="cursor-pointer">
                                    <label className="text-[10px] text-gray-400 font-semibold mb-1 block">To</label>
                                    <div className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className={leaveEndDate ? 'text-gray-800' : 'text-gray-400'}>
                                            {leaveEndDate ? formatDate(leaveEndDate) : 'Select date'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {leaveStartDate && leaveEndDate && (
                                <div className="mt-3 px-3 py-2 bg-blue-50 rounded-xl">
                                    <p className="text-xs font-bold text-blue-600">
                                        📅 {calculateLeaveDaysExcludingSunday(leaveStartDate, leaveEndDate)} day(s) <span className="text-blue-400 font-medium">(Sundays excluded)</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Reason */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Reason</label>
                            <textarea
                                value={leaveReason}
                                onChange={(e) => setLeaveReason(e.target.value)}
                                placeholder="Enter reason for leave..."
                                rows={3}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={leaveSubmitting}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-60 text-sm"
                        >
                            {leaveSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Submitting...
                                </span>
                            ) : 'Submit Leave Application'}
                        </button>
                    </form>
                )}

                {activeTab === 'leave' && activeView === 'history' && (
                    <div className="space-y-3 animate-fadeIn">
                        {leavesLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
                                        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3"></div>
                                        <div className="h-3 bg-gray-100 rounded w-2/3 mb-2"></div>
                                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                                    </div>
                                ))}
                            </div>
                        ) : myLeaves.filter(l => l.type === 'leave').length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-4xl mb-3 block">📋</span>
                                <p className="text-gray-400 font-semibold text-sm">No leave requests yet</p>
                            </div>
                        ) : (
                            myLeaves.filter(l => l.type === 'leave').map((leave) => (
                                <div key={leave.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer" onClick={() => editingLeave !== leave.id && openDetail(leave, 'leave')}>
                                    {editingLeave === leave.id ? (
                                        /* ── Inline Edit Form ── */
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Editing Leave</span>
                                                <button onClick={() => setEditingLeave(null)} className="text-xs text-gray-400 font-bold hover:text-gray-600">✕ Cancel</button>
                                            </div>
                                            <select
                                                value={editLeaveType}
                                                onChange={(e) => setEditLeaveType(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all appearance-none"
                                            >
                                                <option value="">Select leave type</option>
                                                {leaveTypes.map((lt) => (
                                                    <option key={lt.id} value={lt.name}>{lt.name}</option>
                                                ))}
                                            </select>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="date" value={editLeaveStart} onChange={(e) => setEditLeaveStart(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all" />
                                                <input type="date" value={editLeaveEnd} min={editLeaveStart} onChange={(e) => setEditLeaveEnd(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all" />
                                            </div>
                                            <textarea value={editLeaveReason} onChange={(e) => setEditLeaveReason(e.target.value)} rows={2} placeholder="Reason" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none" />
                                            <button
                                                onClick={() => handleEditLeave(leave.id)}
                                                disabled={editLeaveSubmitting}
                                                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-60"
                                            >
                                                {editLeaveSubmitting ? 'Saving...' : '💾 Save Changes'}
                                            </button>
                                        </div>
                                    ) : (
                                        /* ── Normal Display ── */
                                        <>
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="text-sm font-bold text-gray-900">{leave.title || leave.leave_type}</h4>
                                                <StatusBadge status={leave.status} />
                                            </div>
                                            <p className="text-xs text-gray-500 mb-1">
                                                📅 {formatDate(leave.start_date || leave.start)} → {formatDate(leave.end_date || leave.end)}
                                            </p>
                                            {(leave.reason || leave.subtitle) && <p className="text-xs text-gray-400 italic">"{leave.subtitle || leave.reason}"</p>}
                                            {leave.rejection_reason && (
                                                <p className="text-xs text-red-500 mt-1 font-medium">❌ {leave.rejection_reason}</p>
                                            )}
                                            {leave.status === 'Pending' && (
                                                <div className="mt-2 flex items-center gap-3">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startEditLeave(leave); }}
                                                        className="text-xs text-blue-500 font-bold hover:text-blue-700 transition-colors"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteLeave(leave.id); }}
                                                        className="text-xs text-red-500 font-bold hover:text-red-700 transition-colors"
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════ */}
                {/* ON-DUTY TAB */}
                {/* ═══════════════════════════════════════════ */}
                {activeTab === 'onduty' && activeView === 'apply' && (
                    <div className="space-y-4 animate-fadeIn">
                        {isOnDuty ? (
                            /* ── Active On-Duty View ── */
                            <>
                                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                                        <span className="text-sm font-bold">Currently On-Duty</span>
                                    </div>
                                    <div className="space-y-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">🏢</span>
                                            <div>
                                                <p className="text-[10px] text-white/60 font-semibold">Client</p>
                                                <p className="text-sm font-bold">{odClientName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">📍</span>
                                            <div>
                                                <p className="text-[10px] text-white/60 font-semibold">Location</p>
                                                <p className="text-sm font-bold">{odLocation}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">📝</span>
                                            <div>
                                                <p className="text-[10px] text-white/60 font-semibold">Purpose</p>
                                                <p className="text-sm font-bold">{odPurpose}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {odStartTime && (
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
                                        <div className="flex justify-between items-center">
                                            <div className="text-center flex-1">
                                                <p className="text-[10px] text-blue-500 font-bold mb-1">STARTED AT</p>
                                                <p className="text-2xl font-black text-blue-600">
                                                    {odStartTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </p>
                                            </div>
                                            <div className="w-px h-12 bg-blue-100"></div>
                                            <div className="text-center flex-1">
                                                <p className="text-[10px] text-blue-500 font-bold mb-1">DURATION</p>
                                                <p className="text-2xl font-black text-blue-600">{formatDuration(odStartTime)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleEndOnDuty}
                                    disabled={odSubmitting}
                                    className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-500/25 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-60 text-sm"
                                >
                                    {odSubmitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            Ending & Capturing Location...
                                        </span>
                                    ) : '⏹️ End On-Duty'}
                                </button>
                                <p className="text-[10px] text-gray-400 text-center mt-1">📍 Exact GPS location will be captured</p>
                            </>
                        ) : (
                            /* ── Start On-Duty Form ── */
                            <form onSubmit={handleStartOnDuty} className="space-y-4">
                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Client Name</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🏢</span>
                                        <input
                                            type="text"
                                            value={odClientName}
                                            onChange={(e) => setOdClientName(e.target.value)}
                                            placeholder="Enter client name"
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Location</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">📍</span>
                                        <input
                                            type="text"
                                            value={odLocation}
                                            onChange={(e) => setOdLocation(e.target.value)}
                                            placeholder="Enter location"
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Purpose of Visit</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-lg">📝</span>
                                        <textarea
                                            value={odPurpose}
                                            onChange={(e) => setOdPurpose(e.target.value)}
                                            placeholder="Enter purpose of visit"
                                            rows={2}
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all resize-none"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={odSubmitting}
                                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/25 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-60 text-sm"
                                >
                                    {odSubmitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            Starting & Capturing Location...
                                        </span>
                                    ) : '▶️ Start On-Duty'}
                                </button>
                                <p className="text-[10px] text-gray-400 text-center mt-1">📍 Exact GPS location will be captured</p>
                            </form>
                        )}
                    </div>
                )}

                {activeTab === 'onduty' && activeView === 'history' && (
                    <div className="space-y-3 animate-fadeIn">
                        {onDutyLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
                                        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3"></div>
                                        <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                                    </div>
                                ))}
                            </div>
                        ) : myOnDuty.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-4xl mb-3 block">🚗</span>
                                <p className="text-gray-400 font-semibold text-sm">No on-duty logs yet</p>
                            </div>
                        ) : (
                            myOnDuty.map((od) => (
                                <div key={od.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer" onClick={() => editingOnDuty !== od.id && openDetail(od, 'onduty')}>
                                    {editingOnDuty === od.id ? (
                                        /* ── Inline Edit Form ── */
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Editing On-Duty</span>
                                                <button onClick={() => setEditingOnDuty(null)} className="text-xs text-gray-400 font-bold hover:text-gray-600">✕ Cancel</button>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🏢</span>
                                                <input type="text" value={editOdClient} onChange={(e) => setEditOdClient(e.target.value)} placeholder="Client Name" className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">📍</span>
                                                <input type="text" value={editOdLocation} onChange={(e) => setEditOdLocation(e.target.value)} placeholder="Location" className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3 text-base">📝</span>
                                                <textarea value={editOdPurpose} onChange={(e) => setEditOdPurpose(e.target.value)} rows={2} placeholder="Purpose" className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all resize-none" />
                                            </div>
                                            <button
                                                onClick={() => handleEditOnDuty(od.id)}
                                                disabled={editOdSubmitting}
                                                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-60"
                                            >
                                                {editOdSubmitting ? 'Saving...' : '💾 Save Changes'}
                                            </button>
                                        </div>
                                    ) : (
                                        /* ── Normal Display ── */
                                        <>
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="text-sm font-bold text-gray-900">{od.title || `On-Duty: ${od.client_name || ''}`}</h4>
                                                <StatusBadge status={od.status} />
                                            </div>
                                            <p className="text-xs text-gray-500 mb-1">
                                                📅 {formatDate(od.start_date || od.start)} {od.end_date || od.end ? `→ ${formatDate(od.end_date || od.end)}` : ''}
                                            </p>
                                            {od.subtitle && <p className="text-xs text-gray-400 italic">"{od.subtitle}"</p>}
                                            {od.rejection_reason && (
                                                <p className="text-xs text-red-500 mt-1 font-medium">❌ {od.rejection_reason}</p>
                                            )}
                                            {od.status === 'Pending' && (
                                                <div className="mt-2 flex items-center gap-3">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startEditOnDuty(od); }}
                                                        className="text-xs text-purple-500 font-bold hover:text-purple-700 transition-colors"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteOnDuty(od.id); }}
                                                        className="text-xs text-red-500 font-bold hover:text-red-700 transition-colors"
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════ */}
                {/* TIME-OFF TAB */}
                {/* ═══════════════════════════════════════════ */}
                {activeTab === 'timeoff' && activeView === 'apply' && (
                    <form onSubmit={handleTimeOffSubmit} className="space-y-4 animate-fadeIn">
                        {/* Date */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Date</label>
                            <input
                                type="date"
                                value={toDate}
                                min={today}
                                onChange={(e) => setToDate(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                            />
                        </div>

                        {/* Time Selection */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Time Range</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-gray-400 font-semibold mb-1 block">Start Time</label>
                                    <input
                                        type="time"
                                        value={toStartTime}
                                        onChange={(e) => {
                                            setToStartTime(e.target.value);
                                            // Auto-set end time to +2 hours if not set
                                            if (!toEndTime && e.target.value) {
                                                const [h, m] = e.target.value.split(':');
                                                const endH = (parseInt(h) + 2) % 24;
                                                setToEndTime(`${String(endH).padStart(2, '0')}:${m}`);
                                            }
                                        }}
                                        className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-semibold mb-1 block">End Time</label>
                                    <input
                                        type="time"
                                        value={toEndTime}
                                        onChange={(e) => setToEndTime(e.target.value)}
                                        className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                                    />
                                </div>
                            </div>
                            {toStartTime && toEndTime && (
                                <div className="mt-3 px-3 py-2 bg-teal-50 rounded-xl">
                                    <p className="text-xs font-bold text-teal-600">
                                        ⏱️ Duration: {calcTimeOffDuration(toStartTime, toEndTime)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Reason */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Reason</label>
                            <textarea
                                value={toReason}
                                onChange={(e) => setToReason(e.target.value)}
                                placeholder="Enter reason for time-off..."
                                rows={3}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all resize-none"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={toSubmitting}
                            className="w-full py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-teal-500/25 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-60 text-sm"
                        >
                            {toSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Submitting...
                                </span>
                            ) : 'Submit Time-Off Request'}
                        </button>
                    </form>
                )}

                {activeTab === 'timeoff' && activeView === 'history' && (
                    <div className="space-y-3 animate-fadeIn">
                        {timeOffLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
                                        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3"></div>
                                        <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                                    </div>
                                ))}
                            </div>
                        ) : myTimeOffs.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-4xl mb-3 block">⏰</span>
                                <p className="text-gray-400 font-semibold text-sm">No time-off requests yet</p>
                            </div>
                        ) : (
                            myTimeOffs.map((to) => (
                                <div key={to.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer" onClick={() => editingTimeOff !== to.id && openDetail(to, 'timeoff')}>
                                    {editingTimeOff === to.id ? (
                                        /* ── Inline Edit Form ── */
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Editing Time-Off</span>
                                                <button onClick={() => setEditingTimeOff(null)} className="text-xs text-gray-400 font-bold hover:text-gray-600">✕ Cancel</button>
                                            </div>
                                            <input type="date" value={editToDate} onChange={(e) => setEditToDate(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all" />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="time" value={editToStart} onChange={(e) => setEditToStart(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all" />
                                                <input type="time" value={editToEnd} onChange={(e) => setEditToEnd(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all" />
                                            </div>
                                            <textarea value={editToReason} onChange={(e) => setEditToReason(e.target.value)} rows={2} placeholder="Reason" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all resize-none" />
                                            <button
                                                onClick={() => handleEditTimeOff(to.id)}
                                                disabled={editToSubmitting}
                                                className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-bold rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-60"
                                            >
                                                {editToSubmitting ? 'Saving...' : '💾 Save Changes'}
                                            </button>
                                        </div>
                                    ) : (
                                        /* ── Normal Display ── */
                                        <>
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="text-sm font-bold text-gray-900">Time-Off {to.start_time && to.end_time && <span className="text-teal-600 font-bold">· {calcTimeOffDuration(to.start_time, to.end_time)}</span>}</h4>
                                                <StatusBadge status={to.status} />
                                            </div>
                                            <p className="text-xs text-gray-500 mb-1">
                                                📅 {formatDate(to.date)} • {formatTime12(to.start_time)} - {formatTime12(to.end_time)}
                                            </p>
                                            {to.reason && <p className="text-xs text-gray-400 italic">"{to.reason}"</p>}
                                            {to.rejection_reason && (
                                                <p className="text-xs text-red-500 mt-1 font-medium">❌ {to.rejection_reason}</p>
                                            )}
                                            {to.status === 'Pending' && (
                                                <div className="mt-2 flex items-center gap-3">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startEditTimeOff(to); }}
                                                        className="text-xs text-teal-500 font-bold hover:text-teal-700 transition-colors"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteTimeOff(to.id); }}
                                                        className="text-xs text-red-500 font-bold hover:text-red-700 transition-colors"
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* ── Calendar Popup Modal ── */}
            {calendarOpen && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center confirm-backdrop" onClick={cancelCalendar}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 confirm-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-4 pb-2">
                            <h3 className="text-base font-bold text-gray-900">Select Leave Dates</h3>
                            <button onClick={cancelCalendar} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="px-4 pb-4">
                            {/* Month Header */}
                            <div className="flex items-center justify-between mb-3">
                                <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="text-sm font-bold text-gray-800">{monthName}</span>
                                <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>

                            {/* Day of Week Headers */}
                            <div className="grid grid-cols-7 gap-0 mb-1">
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                    <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase py-1">{d}</div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-0">
                                {calendarDays.map((cell, idx) => {
                                    if (!cell) return <div key={`empty-${idx}`} className="h-10"></div>;

                                    const { day, dateStr, isSunday } = cell;
                                    const isPast = dateStr < today;
                                    const disabled = isPast;
                                    const leaveStatus = leaveDateStatusMap[dateStr];
                                    const inRange = isInSelectedRange(dateStr);
                                    const isStart = isRangeStart(dateStr);
                                    const isEnd = isRangeEnd(dateStr);
                                    const isToday = dateStr === today;

                                    let bgClass = '';
                                    let textClass = 'text-gray-800';
                                    let ringClass = '';

                                    if (disabled) {
                                        textClass = 'text-gray-300';
                                    } else if (isStart || isEnd) {
                                        bgClass = 'bg-blue-600';
                                        textClass = 'text-white';
                                    } else if (inRange) {
                                        bgClass = 'bg-blue-500';
                                        textClass = 'text-white';
                                    } else if (leaveStatus === 'Approved') {
                                        bgClass = 'bg-emerald-100';
                                        textClass = 'text-emerald-800';
                                    } else if (leaveStatus === 'Pending') {
                                        bgClass = 'bg-amber-100';
                                        textClass = 'text-amber-800';
                                    } else if (isSunday) {
                                        textClass = 'text-red-400';
                                    }

                                    if (isToday && !isStart && !isEnd && !inRange) {
                                        ringClass = 'ring-2 ring-blue-400 ring-offset-1';
                                    }

                                    return (
                                        <button
                                            key={dateStr}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => handleCalendarDayClick(dateStr)}
                                            className={`h-10 w-full flex items-center justify-center text-xs font-semibold rounded-full transition-all
                                                ${bgClass} ${textClass} ${ringClass}
                                                ${!disabled && !inRange && !isStart && !isEnd ? 'hover:bg-blue-50' : ''} ${!disabled ? 'active:scale-95 cursor-pointer' : 'cursor-default'}
                                                ${(isStart || isEnd) ? 'shadow-sm' : ''}
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                    <span className="text-[10px] text-gray-500 font-semibold">Selected</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-200"></span>
                                    <span className="text-[10px] text-gray-500 font-semibold">Approved</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-200"></span>
                                    <span className="text-[10px] text-gray-500 font-semibold">Pending</span>
                                </div>
                            </div>

                            {/* Range hint */}
                            <p className="text-center text-[10px] text-gray-400 mt-2">
                                {rangeStep === 0
                                    ? (tempCalStart && tempCalEnd ? 'Tap a date to select a new range' : 'Tap to select start date')
                                    : 'Now tap to select end date'
                                }
                            </p>

                            {/* Selected range preview */}
                            {tempCalStart && (
                                <div className="mt-2 px-3 py-2 bg-blue-50 rounded-xl">
                                    <p className="text-xs font-bold text-blue-600">
                                        📅 {formatDate(tempCalStart)}{tempCalEnd ? ` → ${formatDate(tempCalEnd)} · ${calculateLeaveDaysExcludingSunday(tempCalStart, tempCalEnd)} day(s)` : ' — pick end date'}
                                    </p>
                                </div>
                            )}

                            {/* Confirm Button */}
                            <button
                                type="button"
                                onClick={confirmCalendar}
                                disabled={!tempCalStart}
                                className="w-full mt-3 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                Confirm Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Detail Bottom Sheet ── */}
            {selectedDetail && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center detail-backdrop" onClick={closeDetail}>
                    <div className="bg-white rounded-t-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto detail-sheet" onClick={(e) => e.stopPropagation()}>
                        {/* Handle Bar */}
                        <div className="sticky top-0 bg-white rounded-t-3xl pt-3 pb-2 px-6 z-10">
                            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto"></div>
                        </div>

                        <div className="px-6 pb-6 space-y-4">
                            {/* Title & Status */}
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="text-lg font-black text-gray-900">
                                    {detailType === 'leave' && (selectedDetail.title || selectedDetail.leave_type || 'Leave')}
                                    {detailType === 'onduty' && (selectedDetail.title || `On-Duty: ${selectedDetail.client_name || ''}`)}
                                    {detailType === 'timeoff' && (
                                        <>Time-Off {selectedDetail.start_time && selectedDetail.end_time && <span className="text-teal-600">· {calcTimeOffDuration(selectedDetail.start_time, selectedDetail.end_time)}</span>}</>
                                    )}
                                </h3>
                                <StatusBadge status={selectedDetail.status} />
                            </div>

                            {/* Request ID */}
                            {selectedDetail.id && (
                                <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2">
                                    <span className="text-gray-400 text-xs">#</span>
                                    <span className="text-xs text-gray-500 font-medium">Request ID: {selectedDetail.id}</span>
                                </div>
                            )}

                            {/* Date Range */}
                            <div className="bg-blue-50 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Date & Time</span>
                                </div>
                                {detailType === 'timeoff' ? (
                                    <p className="text-sm font-semibold text-gray-800">
                                        {formatDate(selectedDetail.date)} · {formatTime12(selectedDetail.start_time)} - {formatTime12(selectedDetail.end_time)}
                                    </p>
                                ) : (
                                    <p className="text-sm font-semibold text-gray-800">
                                        {formatDate(selectedDetail.start_date || selectedDetail.start)} → {formatDate(selectedDetail.end_date || selectedDetail.end)}
                                    </p>
                                )}
                            </div>

                            {/* Duration (Leave) */}
                            {detailType === 'leave' && (selectedDetail.start_date || selectedDetail.start) && (selectedDetail.end_date || selectedDetail.end) && (
                                <div className="bg-indigo-50 rounded-xl p-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span className="text-sm font-semibold text-indigo-700">
                                        Duration: {calculateLeaveDaysExcludingSunday(selectedDetail.start_date || selectedDetail.start, selectedDetail.end_date || selectedDetail.end)} day(s)
                                        <span className="text-xs font-normal text-indigo-400 ml-1">(excl. Sundays)</span>
                                    </span>
                                </div>
                            )}

                            {/* On-Duty Details */}
                            {detailType === 'onduty' && (
                                <div className="space-y-2">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Details</div>
                                    {(selectedDetail.client_name || selectedDetail.title) && (
                                        <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                                            <span className="text-base">🏢</span>
                                            <div>
                                                <div className="text-[10px] text-gray-400 font-semibold uppercase">Client</div>
                                                <div className="text-sm font-semibold text-gray-800">{selectedDetail.client_name || selectedDetail.title?.replace('On-Duty: ', '')}</div>
                                            </div>
                                        </div>
                                    )}
                                    {selectedDetail.location && (
                                        <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                                            <span className="text-base">📍</span>
                                            <div>
                                                <div className="text-[10px] text-gray-400 font-semibold uppercase">Location</div>
                                                <div className="text-sm font-semibold text-gray-800">{selectedDetail.location}</div>
                                            </div>
                                        </div>
                                    )}
                                    {selectedDetail.purpose && (
                                        <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                                            <span className="text-base">📝</span>
                                            <div>
                                                <div className="text-[10px] text-gray-400 font-semibold uppercase">Purpose</div>
                                                <div className="text-sm font-semibold text-gray-800">{selectedDetail.purpose}</div>
                                            </div>
                                        </div>
                                    )}
                                    {selectedDetail.subtitle && !selectedDetail.location && !selectedDetail.purpose && (
                                        <p className="text-sm text-gray-600">{selectedDetail.subtitle}</p>
                                    )}
                                </div>
                            )}

                            {/* Reason */}
                            {(selectedDetail.reason || (detailType !== 'onduty' && selectedDetail.subtitle)) && (
                                <div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reason</div>
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <p className="text-sm text-gray-700 leading-relaxed">{selectedDetail.reason || selectedDetail.subtitle}</p>
                                    </div>
                                </div>
                            )}

                            {/* Rejection Reason */}
                            {selectedDetail.rejection_reason && (
                                <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Rejection Reason</span>
                                    </div>
                                    <p className="text-sm text-red-700">{selectedDetail.rejection_reason}</p>
                                </div>
                            )}

                            {/* Approver Info */}
                            {selectedDetail.approver && selectedDetail.status !== 'Pending' && (
                                <div className={`rounded-xl p-3 border ${selectedDetail.status === 'Rejected'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-emerald-50 border-emerald-200'
                                    }`}>
                                    <div className="flex items-center gap-2">
                                        <svg className={`w-4 h-4 ${selectedDetail.status === 'Rejected' ? 'text-red-500' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {selectedDetail.status === 'Rejected'
                                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            }
                                        </svg>
                                        <div>
                                            <div className={`text-xs font-bold ${selectedDetail.status === 'Rejected' ? 'text-red-600' : 'text-emerald-600'
                                                }`}>
                                                {selectedDetail.status === 'Rejected' ? 'Rejected' : 'Approved'} by
                                            </div>
                                            <div className={`text-sm font-semibold ${selectedDetail.status === 'Rejected' ? 'text-red-700' : 'text-emerald-700'
                                                }`}>
                                                {selectedDetail.approver.firstname} {selectedDetail.approver.lastname}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Activity Timeline */}
                            {(selectedDetail.createdAt || selectedDetail.updatedAt) && (
                                <div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Activity Timeline</div>
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-3">
                                        {selectedDetail.createdAt && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase">Created</div>
                                                    <div className="text-xs text-gray-600 font-medium">{new Date(selectedDetail.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                                </div>
                                            </div>
                                        )}
                                        {selectedDetail.updatedAt && selectedDetail.updatedAt !== selectedDetail.createdAt && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase">Last Updated</div>
                                                    <div className="text-xs text-gray-600 font-medium">{new Date(selectedDetail.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                                </div>
                                            </div>
                                        )}
                                        {selectedDetail.status !== 'Pending' && selectedDetail.approver && (
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${selectedDetail.status === 'Rejected' ? 'bg-red-100' : 'bg-emerald-100'}`}>
                                                    <svg className={`w-3 h-3 ${selectedDetail.status === 'Rejected' ? 'text-red-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        {selectedDetail.status === 'Rejected'
                                                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        }
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase">{selectedDetail.status === 'Rejected' ? 'Rejected' : 'Approved'}</div>
                                                    <div className="text-xs text-gray-600 font-medium">By {selectedDetail.approver.firstname} {selectedDetail.approver.lastname}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Close Button */}
                            <button
                                onClick={closeDetail}
                                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-2xl text-sm shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Delete Modal ── */}
            {confirmModal.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 confirm-backdrop" onClick={() => !confirmModal.deleting && setConfirmModal({ open: false, title: '', message: '', onConfirm: null, deleting: false })}>
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 confirm-modal" onClick={(e) => e.stopPropagation()}>
                        {/* Warning Icon */}
                        <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        {/* Title */}
                        <h3 className="text-lg font-black text-gray-900 text-center mb-2">{confirmModal.title}</h3>
                        {/* Message */}
                        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">{confirmModal.message}</p>
                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: null, deleting: false })}
                                disabled={confirmModal.deleting}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl text-sm hover:bg-gray-200 active:scale-[0.97] transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => confirmModal.onConfirm && confirmModal.onConfirm()}
                                disabled={confirmModal.deleting}
                                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-red-500/25 hover:shadow-xl active:scale-[0.97] transition-all disabled:opacity-70"
                            >
                                {confirmModal.deleting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        Deleting...
                                    </span>
                                ) : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CSS Animation ── */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out forwards;
                }
                .safe-area-top {
                    padding-top: env(safe-area-inset-top, 0px);
                }
                /* Improve date/time input on mobile */
                input[type="date"], input[type="time"] {
                    -webkit-appearance: none;
                    min-height: 48px;
                }
                select {
                    min-height: 48px;
                }
                /* Confirm Modal Animations */
                @keyframes backdropFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .confirm-backdrop {
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    animation: backdropFadeIn 0.2s ease-out forwards;
                }
                .confirm-modal {
                    animation: modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                /* Detail Bottom Sheet Animations */
                @keyframes sheetSlideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .detail-backdrop {
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    animation: backdropFadeIn 0.2s ease-out forwards;
                }
                .detail-sheet {
                    animation: sheetSlideUp 0.35s cubic-bezier(0.33, 1, 0.68, 1) forwards;
                }
            `}</style>
        </div>
    );
};

export default MyRequests;
