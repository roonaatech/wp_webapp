import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import DateFilterInput from '../components/DateFilterInput';
import { fetchRoles, canViewAttendanceReport, canManageAttendance } from '../utils/roleUtils';
import { formatDateOnly, formatTimeOnly, getCurrentInAppTimezone } from '../utils/timezone.util';
import { LuFilter, LuUser, LuInfo, LuChevronLeft, LuChevronRight, LuChevronDown, LuEye, LuX, LuPencil, LuTrash2 } from 'react-icons/lu';

const AttendanceReport = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    // Filter States
    const [selectedUserId, setSelectedUserId] = useState('');

    const getThisMonthRange = () => {
        const now = getCurrentInAppTimezone().full;
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { start, end };
    };
    const { start: defaultStart, end: defaultEnd } = getThisMonthRange();
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);

    // Data States
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    // UI States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSnapshot, setSelectedSnapshot] = useState(null); // Modal viewer state

    // Edit Modal States
    const [editingLog, setEditingLog] = useState(null);
    const [editDate, setEditDate] = useState('');
    const [editCheckInTime, setEditCheckInTime] = useState('');
    const [editCheckOutTime, setEditCheckOutTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Delete Confirmation Modal State
    const [deletingLogId, setDeletingLogId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);


    // Grouped Rows State
    const [expandedUsers, setExpandedUsers] = useState({});
    
    // Clear expanded list on logs refresh
    useEffect(() => {
        setExpandedUsers({});
    }, [logs]);

    const toggleUserExpand = (userId) => {
        setExpandedUsers(prev => ({
            ...prev,
            [userId]: !prev[userId]
        }));
    };

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canManage = canManageAttendance(user.role);

    // 1. Check Permissions on Mount
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const canView = canViewAttendanceReport(user.role);
                if (!canView) {
                    navigate('/unauthorized', { replace: true });
                } else {
                    setHasPermission(true);
                }
            } catch (err) {
                console.error('Error checking permissions:', err);
                navigate('/unauthorized', { replace: true });
            } finally {
                setPermissionChecked(true);
            }
        };
        checkPermission();
    }, [user.role, navigate]);

    // 2. Fetch Users List for dropdown
    useEffect(() => {
        if (hasPermission) {
            fetchUsersList();
        }
    }, [hasPermission]);

    // 3. Fetch logs whenever page, limit, filters change
    useEffect(() => {
        if (hasPermission) {
            fetchAttendanceLogs();
        }
    }, [hasPermission, selectedUserId, startDate, endDate, page, limit]);

    const fetchUsersList = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/admin/users?limit=all&status=active`, {
                headers: { 'x-access-token': token }
            });
            if (response.data && response.data.users) {
                setUsers(response.data.users);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const fetchAttendanceLogs = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) return;

            const params = {
                page,
                limit,
                userId: selectedUserId,
                startDate,
                endDate
            };

            const response = await axios.get(`${API_BASE_URL}/api/admin/attendance-logs`, {
                headers: { 'x-access-token': token },
                params
            });

            setLogs(response.data.reports || []);
            setTotalItems(response.data.totalItems || 0);
            setTotalPages(response.data.totalPages || 1);
        } catch (err) {
            console.error('Error fetching attendance logs:', err);
            setError(err.response?.data?.message || err.message || 'Failed to retrieve attendance logs.');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const calculateDuration = (checkInStr, checkOutStr) => {
        if (!checkInStr) return '-';
        if (!checkOutStr) return 'Active Check-In';

        try {
            const checkIn = new Date(checkInStr);
            const checkOut = new Date(checkOutStr);
            const diffMs = checkOut.getTime() - checkIn.getTime();
            if (diffMs <= 0) return '-';

            const diffMins = Math.floor(diffMs / 60000);
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;

            if (hours > 0) return `${hours}h ${mins}m`;
            return `${mins}m`;
        } catch (e) {
            return '-';
        }
    };

    const calculateTotalDuration = (userLogs) => {
        let totalMs = 0;
        let hasActive = false;
        userLogs.forEach(log => {
            if (log.check_in_time && log.check_out_time) {
                const diff = new Date(log.check_out_time).getTime() - new Date(log.check_in_time).getTime();
                if (diff > 0) totalMs += diff;
            } else if (log.check_in_time && !log.check_out_time) {
                hasActive = true;
            }
        });

        if (totalMs === 0) {
            return hasActive ? 'Active' : '-';
        }

        const diffMins = Math.floor(totalMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        
        let timeStr = '';
        if (hours > 0) timeStr += `${hours}h ${mins}m`;
        else timeStr += `${mins}m`;

        if (hasActive) timeStr += ' + Active';
        return timeStr;
    };



    const handleClearFilters = () => {
        setSelectedUserId('');
        const range = getThisMonthRange();
        setStartDate(range.start);
        setEndDate(range.end);
        setPage(1);
    };

    const handleEditClick = (log) => {
        setEditingLog(log);
        setEditDate(log.date);
        
        // Parse check-in time
        if (log.check_in_time) {
            const timePart = log.check_in_time.split(' ')[1]; // "09:30:15"
            if (timePart) {
                setEditCheckInTime(timePart.substring(0, 5)); // "09:30"
            } else {
                setEditCheckInTime('');
            }
        } else {
            setEditCheckInTime('');
        }

        // Parse check-out time
        if (log.check_out_time) {
            const timePart = log.check_out_time.split(' ')[1];
            if (timePart) {
                setEditCheckOutTime(timePart.substring(0, 5)); // "17:45"
            } else {
                setEditCheckOutTime('');
            }
        } else {
            setEditCheckOutTime('');
        }
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingLog) return;

        try {
            setIsSaving(true);
            const token = localStorage.getItem('token');

            const payload = {
                date: editDate,
                check_in_time: editCheckInTime ? `${editDate} ${editCheckInTime}:00` : null,
                check_out_time: editCheckOutTime ? `${editDate} ${editCheckOutTime}:00` : null
            };

            const res = await axios.put(`${API_BASE_URL}/api/admin/attendance-logs/${editingLog.id}`, payload, {
                headers: { 'x-access-token': token }
            });

            if (res.data.success) {
                toast.success("Attendance log updated successfully.");
                setEditingLog(null);
                fetchAttendanceLogs(); // Refresh the list!
            }
        } catch (err) {
            console.error("Error updating log:", err);
            toast.error(err.response?.data?.message || "Failed to update attendance log.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (id) => {
        setDeletingLogId(id);
    };

    const handleConfirmDelete = async () => {
        if (!deletingLogId) return;
        setIsDeleting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.delete(`${API_BASE_URL}/api/admin/attendance-logs/${deletingLogId}`, {
                headers: { 'x-access-token': token }
            });

            if (res.data.success) {
                toast.success("Attendance record deleted successfully.");
                fetchAttendanceLogs();
            }
        } catch (err) {
            console.error("Error deleting log:", err);
            toast.error(err.response?.data?.message || "Failed to delete attendance record.");
        } finally {
            setIsDeleting(false);
            setDeletingLogId(null);
        }
    };

    if (!permissionChecked || (loading && logs.length === 0 && users.length === 0)) {
        return <ModernLoader message="Loading attendance reports..." fullScreen={true} />;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-4">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Attendance Review</h1>
                    <p className="text-sm text-slate-500 mt-1">Review check-in/out records, location verification, and face snapshots.</p>
                </div>
            </div>

            {/* Filter Panel */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold border-b border-slate-50 pb-2.5">
                    <LuFilter size={16} className="text-indigo-600" />
                    <span className="uppercase tracking-wider text-sm">Filter Reports</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Employee Filter */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</label>
                        <div className="relative">
                            <select
                                value={selectedUserId}
                                onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none"
                            >
                                <option value="">All Employees</option>
                                {users.map(u => (
                                    <option key={u.staffid} value={u.staffid}>
                                        {u.firstname} {u.lastname}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <LuUser size={16} />
                            </div>
                        </div>
                    </div>

                    {/* Date Filters */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">From Date</label>
                        <DateFilterInput
                            value={startDate}
                            onChange={(iso) => { setStartDate(iso); setPage(1); }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-9 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">To Date</label>
                        <DateFilterInput
                            value={endDate}
                            onChange={(iso) => { setEndDate(iso); setPage(1); }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-9 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                        />
                    </div>

                    {/* Clear Filters — shares the row with the filter inputs, aligned to the bottom */}
                    <div className="flex items-end justify-end">
                        <button
                            onClick={handleClearFilters}
                            className="px-4 py-2 border border-rose-200 bg-rose-50 rounded-xl hover:bg-rose-100 text-rose-600 text-xs font-bold transition uppercase tracking-wider"
                        >
                            Clear Filters
                        </button>
                    </div>

                </div>
            </div>

            {/* Error alerts */}
            {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 font-semibold text-sm">
                    <LuInfo size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Attendance Table Panel */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 font-medium space-y-2">
                        <LuUser size={48} className="mx-auto text-slate-300" />
                        <p className="text-base font-bold text-slate-600">No attendance logs found matching filters.</p>
                        <p className="text-xs text-slate-400">Try adjusting your date range or selecting a different employee.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Check-In</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Check-Out</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Duration</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Face Capture</th>
                                    {canManage && <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    // Group logs by user
                                    const groupedLogs = [];
                                    logs.forEach(log => {
                                        const userId = log.user?.staffid || log.staff_id;
                                        let group = groupedLogs.find(g => g.userId === userId);
                                        if (!group) {
                                            group = {
                                                userId,
                                                user: log.user || {},
                                                logs: []
                                            };
                                            groupedLogs.push(group);
                                        }
                                        group.logs.push(log);
                                    });

                                    return groupedLogs.map((group) => {
                                        const emp = group.user || {};
                                        const profile = emp.profile_info || {};
                                        const initials = emp.firstname ? `${emp.firstname[0]}${emp.lastname[0]}`.toUpperCase() : 'EE';
                                        const isExpanded = !!expandedUsers[group.userId];
                                        const hasMultiple = group.logs.length >= 2;

                                        if (!hasMultiple) {
                                            const log = group.logs[0];
                                            return (
                                                <tr key={log.id} className="hover:bg-slate-50/50 transition">
                                                    {/* Employee info */}
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-3">
                                                            {profile.image_path ? (
                                                                <img
                                                                    src={`${API_BASE_URL}/${profile.image_path}`}
                                                                    alt=""
                                                                    className="w-8 h-8 rounded-full object-cover border border-slate-100"
                                                                    onError={(e) => { e.target.src = ''; e.target.className = 'w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-slate-100'; }}
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-slate-100">
                                                                    {initials}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-bold text-slate-800 leading-tight">
                                                                    {emp.firstname} {emp.lastname}
                                                                </p>
                                                                <p className="text-xs text-slate-400 mt-0.5">{emp.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-600">
                                                        {formatDateOnly(log.date)}
                                                    </td>

                                                    {/* Check-In */}
                                                    <td className="px-4 py-2.5">
                                                        <p className="text-sm font-semibold text-slate-700">
                                                            {log.check_in_time ? formatTimeOnly(log.check_in_time) : '-'}
                                                        </p>
                                                    </td>

                                                    {/* Check-Out */}
                                                    <td className="px-4 py-2.5">
                                                        <p className="text-sm font-semibold text-slate-700">
                                                            {log.check_out_time ? formatTimeOnly(log.check_out_time) : '-'}
                                                        </p>
                                                    </td>

                                                    {/* Work Duration */}
                                                    <td className="px-4 py-2.5">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black ${
                                                            log.check_out_time 
                                                                ? 'bg-slate-100 text-slate-700' 
                                                                : 'bg-indigo-50 text-indigo-700 animate-pulse'
                                                        }`}>
                                                            {calculateDuration(log.check_in_time, log.check_out_time)}
                                                        </span>
                                                    </td>

                                                    {/* Verification Snapshot */}
                                                    <td className="px-4 py-2.5 text-center">
                                                        {log.snapshot_url ? (
                                                            <div 
                                                                onClick={() => setSelectedSnapshot(log.snapshot_url)}
                                                                className="group relative w-12 h-12 mx-auto rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-500 transition"
                                                            >
                                                                <img
                                                                    src={`${API_BASE_URL}/${log.snapshot_url}`}
                                                                    alt="Audit match"
                                                                    className="w-full h-full object-cover transform group-hover:scale-110 transition duration-300"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition duration-200">
                                                                    <LuEye size={14} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">No snapshot</span>
                                                        )}
                                                    </td>
                                                    {canManage && (
                                                        <td className="px-4 py-2.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleEditClick(log)}
                                                                    className="p-2 bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-xl transition shadow-sm font-semibold"
                                                                    title="Edit Log"
                                                                >
                                                                    <LuPencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteClick(log.id)}
                                                                    className="p-2 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl transition shadow-sm font-semibold"
                                                                    title="Delete Log"
                                                                >
                                                                    <LuTrash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        } else {
                                            return (
                                                <React.Fragment key={group.userId}>
                                                    {/* Parent Row */}
                                                    <tr 
                                                        onClick={() => toggleUserExpand(group.userId)}
                                                        className="bg-indigo-50/20 hover:bg-indigo-50/40 transition cursor-pointer font-medium"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-indigo-600 p-0.5 hover:bg-indigo-100/50 rounded transition">
                                                                    {isExpanded ? <LuChevronDown size={16} /> : <LuChevronRight size={16} />}
                                                                </div>
                                                                {profile.image_path ? (
                                                                    <img
                                                                        src={`${API_BASE_URL}/${profile.image_path}`}
                                                                        alt=""
                                                                        className="w-8 h-8 rounded-full object-cover border border-slate-100"
                                                                        onError={(e) => { e.target.src = ''; e.target.className = 'w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-slate-100'; }}
                                                                    />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-slate-100">
                                                                        {initials}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-bold text-slate-800 leading-tight">
                                                                            {emp.firstname} {emp.lastname}
                                                                        </p>
                                                                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                                                                            {group.logs.length} entries
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-400 mt-0.5">{emp.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-slate-400 font-semibold italic">
                                                            Multiple Dates
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-350">—</td>
                                                        <td className="px-4 py-3 text-slate-350">—</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-100/60 text-indigo-800">
                                                                {calculateTotalDuration(group.logs)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-slate-350">—</td>
                                                    </tr>

                                                    {/* Child Rows */}
                                                    {isExpanded && group.logs.map((log, index) => {
                                                        const isLast = index === group.logs.length - 1;
                                                        return (
                                                            <tr key={log.id} className="bg-slate-50/20 hover:bg-slate-50/50 border-l-2 border-indigo-500/30 transition">
                                                                <td className="px-4 py-2.5 pl-10">
                                                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                                                                        <span className="font-mono text-slate-300">{isLast ? '└─' : '├─'}</span>
                                                                        <span>Log #{index + 1}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2.5 text-sm font-semibold text-slate-600">
                                                                    {formatDateOnly(log.date)}
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <p className="text-sm font-semibold text-slate-700">
                                                                        {log.check_in_time ? formatTimeOnly(log.check_in_time) : '-'}
                                                                    </p>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <p className="text-sm font-semibold text-slate-700">
                                                                        {log.check_out_time ? formatTimeOnly(log.check_out_time) : '-'}
                                                                    </p>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black ${
                                                                        log.check_out_time 
                                                                            ? 'bg-slate-100 text-slate-700' 
                                                                            : 'bg-indigo-50 text-indigo-700 animate-pulse'
                                                                    }`}>
                                                                        {calculateDuration(log.check_in_time, log.check_out_time)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    {log.snapshot_url ? (
                                                                        <div 
                                                                            onClick={() => setSelectedSnapshot(log.snapshot_url)}
                                                                            className="group relative w-10 h-10 mx-auto rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-500 transition"
                                                                        >
                                                                            <img
                                                                                src={`${API_BASE_URL}/${log.snapshot_url}`}
                                                                                alt="Audit match"
                                                                                className="w-full h-full object-cover transform group-hover:scale-110 transition duration-300"
                                                                            />
                                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition duration-200">
                                                                                <LuEye size={12} />
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-400 italic">No snapshot</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    {canManage ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => handleEditClick(log)}
                                                                                className="p-2 bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-xl transition shadow-sm"
                                                                                title="Edit Log"
                                                                            >
                                                                                <LuPencil size={13} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteClick(log.id)}
                                                                                className="p-2 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl transition shadow-sm"
                                                                                title="Delete Log"
                                                                            >
                                                                                <LuTrash2 size={13} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-350">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        }
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Table Footer: Pagination controls */}
                {!loading && logs.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 border-t border-slate-100 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-bold uppercase">Rows per page:</span>
                            <select
                                value={limit}
                                onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                                className="bg-white border rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                            <span className="text-xs text-slate-400 font-medium ml-3">
                                Showing {logs.length} of {totalItems} records
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                disabled={page === 1}
                                className="p-2 border bg-white rounded-lg hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <LuChevronLeft size={16} />
                            </button>
                            
                            <span className="text-xs text-slate-600 font-bold px-3">
                                Page {page} of {totalPages}
                            </span>

                            <button
                                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={page === totalPages}
                                className="p-2 border bg-white rounded-lg hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <LuChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Snapshot Zoom Viewer */}
            {selectedSnapshot && (
                <div 
                    className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedSnapshot(null)}
                >
                    <div 
                        className="relative bg-[#0f172a] p-2.5 rounded-3xl max-w-xl w-full border border-slate-700/50 shadow-2xl flex flex-col items-center animate-modal-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedSnapshot(null)}
                            className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-800 text-white rounded-full transition"
                        >
                            <LuX size={18} />
                        </button>
                        
                        <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 mt-1">
                            <img
                                src={`${API_BASE_URL}/${selectedSnapshot}`}
                                alt="Face recognition audit verification snapshot"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div className="py-4 text-center">
                            <p className="text-sm font-semibold text-slate-300">Facial Verification Audit Snapshot</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Captured automatically during verification log trigger.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Log Modal */}
            {editingLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full border border-slate-100 shadow-2xl p-6 relative flex flex-col space-y-4 animate-modal-in animate-duration-200">
                        <button
                            onClick={() => setEditingLog(null)}
                            className="absolute top-4 right-4 p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-full transition"
                        >
                            <LuX size={18} />
                        </button>

                        <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Edit Attendance Record</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                For {editingLog.user?.firstname} {editingLog.user?.lastname}
                            </p>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
                            {/* Date */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition w-full"
                                />
                            </div>

                            {/* Check-In */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Check-In Time</label>
                                <input
                                    type="time"
                                    required
                                    value={editCheckInTime}
                                    onChange={(e) => setEditCheckInTime(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition w-full"
                                />
                            </div>

                            {/* Check-Out */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Check-Out Time</label>
                                    {!editCheckOutTime && (
                                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                                            Currently Checked In
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="time"
                                        value={editCheckOutTime}
                                        onChange={(e) => setEditCheckOutTime(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition w-full"
                                    />
                                    {editCheckOutTime && (
                                        <button
                                            type="button"
                                            onClick={() => setEditCheckOutTime('')}
                                            className="px-3 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition"
                                            title="Clear checkout time (Currently checked in)"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400">Leave checkout blank if the employee is still active today.</p>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setEditingLog(null)}
                                    className="px-4 py-2 border hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50"
                                >
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}



            {/* Delete Confirmation Modal */}
            {deletingLogId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-100 shadow-2xl p-6 relative flex flex-col items-center text-center space-y-4">
                        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                            <LuTrash2 className="w-7 h-7 text-red-500" />
                        </div>

                        <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Delete Record</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Are you sure you want to delete this attendance record? This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2 w-full">
                            <button
                                onClick={() => setDeletingLogId(null)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition uppercase tracking-wider disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 uppercase tracking-wider disabled:opacity-50"
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceReport;
