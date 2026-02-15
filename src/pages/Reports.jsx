import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { calculateLeaveDays } from '../utils/dateUtils';
import { fetchRoles, canViewReports } from '../utils/roleUtils';
import { formatInTimezone, getCurrentInAppTimezone, parseAppTimezone } from '../utils/timezone.util';

const Reports = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    // Data States
    const [reports, setReports] = useState([]);
    const [users, setUsers] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // UI States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});

    // Filter & Pagination States
    const [selectedUserId, setSelectedUserId] = useState('');
    const [dateFilter, setDateFilter] = useState('all');
    const getThisMonthRange = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
        return { start, end };
    };
    const { start: defaultStart, end: defaultEnd } = getThisMonthRange();
    const [datePreset, setDatePreset] = useState('thismonth');
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('both');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // 1. Check Permissions on Mount
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const canView = canViewReports(user.role);
                if (!canView) {
                    navigate('/unauthorized', { replace: true });
                } else {
                    setHasPermission(true);
                }
            } catch (error) {
                console.error('Error checking permissions:', error);
                navigate('/unauthorized', { replace: true });
            } finally {
                setPermissionChecked(true);
            }
        };
        checkPermission();
    }, [user.role, navigate]);

    // 2. Fetch Users (Once permission is granted)
    useEffect(() => {
        if (hasPermission) {
            fetchUsersList();
        }
    }, [hasPermission]);

    // 3. Fetch Reports (When filters or page change)
    useEffect(() => {
        if (hasPermission) {
            fetchReports();
        }
    }, [hasPermission, selectedUserId, datePreset, startDate, endDate, statusFilter, typeFilter, page, limit]);

    const fetchUsersList = async () => {
        try {
            const token = localStorage.getItem('token');
            // Use limit=all to get all users for the dropdown
            const response = await axios.get(`${API_BASE_URL}/api/admin/users?limit=all&status=active`, {
                headers: { 'x-access-token': token }
            });
            if (response.data && response.data.users) {
                setUsers(response.data.users);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchReports = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) return;

            const params = {
                page,
                limit,
                type: typeFilter,
                userId: selectedUserId,
                status: statusFilter
            };

            // Date range handling: custom start/end takes precedence
            if (datePreset === 'custom' && startDate && endDate) {
                params.startDate = startDate;
                params.endDate = endDate;
            } else {
                params.dateFilter = datePreset || 'all';
            }

            const response = await axios.get(`${API_BASE_URL}/api/admin/reports`, {
                headers: { 'x-access-token': token },
                params
            });

            setReports(response.data.reports || []);
            setTotalItems(response.data.totalItems || 0);
            setTotalPages(response.data.totalPages || 1);

            // Stats usually need full dataset or specific endpoint. 
            // For now, we will hide stats/charts or calculate based on current page if acceptable, 
            // OR fetch stats separately. The current implementation calculated stats from active reports.
            // Since we are paginating, client-side stats on "all" data is no longer possible without a separate API.
            // We will omit the stats cards for now or they will show only current page stats. 
            // (User instruction was just pagination, so this is acceptable tradeoff for performance).

        } catch (error) {
            console.error('Error fetching reports:', error);
            setError(error.response?.data?.message || error.message || 'Failed to fetch reports');
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    // Reset page when filters change
    const handleFilterChange = (setter, value) => {
        setter(value);
        setPage(1); // Reset to first page
    };

    const handleLimitChange = (e) => {
        setLimit(parseInt(e.target.value));
        setPage(1);
    };

    const calculateDuration = (checkIn, checkOut) => {
        if (!checkIn) return '-';
        if (!checkOut) return 'In Progress';

        const start = parseAppTimezone(checkIn);
        const end = parseAppTimezone(checkOut);
        if (!start || !end) return '-';

        const diffMs = end.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;

        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    // Calculate duration from time strings in HH:MM format
    const calculateTimeOffDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return '-';

        try {
            // Parse HH:MM format
            const [startHour, startMin] = startTime.split(':').map(Number);
            const [endHour, endMin] = endTime.split(':').map(Number);

            // Convert to minutes
            const startTotalMins = startHour * 60 + startMin;
            const endTotalMins = endHour * 60 + endMin;

            // Calculate difference
            const diffMins = endTotalMins - startTotalMins;

            if (diffMins <= 0) return '-';

            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;

            if (hours > 0 && mins > 0) {
                return `${hours}hrs ${mins}mins`;
            } else if (hours > 0) {
                return `${hours}hrs`;
            } else {
                return `${mins}mins`;
            }
        } catch (err) {
            return '-';
        }
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const downloadCSV = async () => {
        // Feature upgrade: Download ALL filtered data, not just current page
        try {
            const token = localStorage.getItem('token');
            const params = {
                page: 1,
                limit: 1000, // Reasonable limit for export
                type: typeFilter,
                userId: selectedUserId,
                dateFilter,
                status: statusFilter
            };

            const response = await axios.get(`${API_BASE_URL}/api/admin/reports`, {
                headers: { 'x-access-token': token },
                params
            });

            const exportData = response.data.reports || [];
            if (exportData.length === 0) {
                alert('No data to export');
                return;
            }

            const headers = [
                'Date',
                'Staff ID',
                'Staff Name',
                'Email',
                'Type',
                'Leave Type / Client',
                'Start',
                'End',
                'Duration',
                'Location',
                'Reason / Purpose',
                'Status',
                'Approval Status',
                'Approved/Rejected By',
                'Rejection Reason'
            ];
            const rows = exportData.map(report => {
                const isLeave = report.type === 'leave';
                const isTimeOff = report.type === 'timeoff';
                // Calculate duration based on type
                let duration;
                if (isLeave) {
                    const days = calculateLeaveDays(report.start_date, report.end_date);
                    duration = days + ' day' + (days > 1 ? 's' : '');
                } else if (isTimeOff) {
                    duration = calculateTimeOffDuration(report.start_time, report.end_time);
                } else {
                    duration = calculateDuration(report.check_in_time, report.check_out_time);
                }
                const activityStatus = isLeave || isTimeOff ? 'N/A' : (report.check_out_time ? 'Completed' : 'Active');
                const approvalStatus = report.status || 'N/A';
                const approver = report.approver
                    ? `${report.approver.firstname} ${report.approver.lastname} (${report.approver.email})`
                    : 'N/A';

                let typeName = 'On-Duty';
                if (isLeave) typeName = 'Leave';
                if (isTimeOff) typeName = 'Time-Off';

                return [
                    report.date || 'N/A',
                    report.tblstaff?.staffid || report.staff_id || 'N/A',
                    `${report.tblstaff?.firstname || ''} ${report.tblstaff?.lastname || ''}`.trim() || 'Unknown',
                    report.tblstaff?.email || 'N/A',
                    typeName,
                    isLeave ? (report.leave_type || 'N/A') : isTimeOff ? 'N/A' : (report.client_name || 'N/A'),
                    isLeave ? report.start_date : isTimeOff ? report.start_time : (report.check_in_time ? formatInTimezone(report.check_in_time) : 'N/A'),
                    isLeave ? report.end_date : isTimeOff ? report.end_time : (report.check_out_time ? formatInTimezone(report.check_out_time) : 'N/A'),
                    duration,
                    isLeave || isTimeOff ? 'N/A' : (report.location || 'N/A'),
                    isLeave ? (report.reason || 'N/A') : isTimeOff ? (report.reason || 'N/A') : (report.purpose || 'N/A'),
                    activityStatus,
                    approvalStatus,
                    approver,
                    report.rejection_reason || 'N/A'
                ];
            });

            const csv = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            // Add UTF-8 BOM for proper Excel compatibility
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance-report-${getCurrentInAppTimezone().date}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export data');
        }
    };

    const getStatusBadge = (report) => {
        if (report.on_duty) { // Backend still sends on_duty boolean
            // For on-duty, show both activity status and approval status
            const activityBadge = report.check_out_time
                ? <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">Completed</span>
                : <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">Active</span>;

            // Show approval status if not approved yet
            let approvalBadge = null;
            if (report.status === 'Pending') {
                approvalBadge = <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">Pending Approval</span>;
            } else if (report.status === 'Approved') {
                approvalBadge = <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Approved</span>;
            } else if (report.status === 'Rejected') {
                approvalBadge = <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Rejected</span>;
            }

            return (
                <div className="flex gap-1 flex-wrap">
                    {activityBadge}
                    {approvalBadge}
                </div>
            );
        }
        // For leave and time-off records
        if (report.type === 'leave' || report.type === 'timeoff') {
            if (report.status === 'Approved') {
                return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Approved</span>;
            }
            if (report.status === 'Rejected') {
                return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Rejected</span>;
            }
            return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">Pending</span>;
        }
        return null;
    };

    // Show loading while checking permissions
    if (!permissionChecked) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <ModernLoader />
            </div>
        );
    }

    if (!hasPermission) return null;

    return (
        <div>
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
                        <p className="text-gray-600 mt-1">View and export the report for leave, on-duty and time-off records</p>
                    </div>
                    <button
                        onClick={downloadCSV}
                        disabled={reports.length === 0}
                        className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        📥 Export to CSV
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium">⚠️ {error}</p>
                </div>
            )}

            {/* Summary Stats moved to Page Info due to pagination */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700">Total Records Found:</span> {totalItems}
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Rows per page:</label>
                    <select
                        value={limit}
                        onChange={handleLimitChange}
                        className="px-2 py-1 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Record Type</label>
                        <select
                            value={typeFilter}
                            onChange={(e) => handleFilterChange(setTypeFilter, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                        >
                            <option value="both">All (Leave, On-Duty & Time-Off)</option>
                            <option value="leave">Leave Only</option>
                            <option value="onduty">On-Duty Only</option>
                            <option value="timeoff">Time-Off Only</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by User</label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => handleFilterChange(setSelectedUserId, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                        >
                            <option value="">All Users</option>
                            {users.map(user => (
                                <option key={user.staffid} value={user.staffid}>
                                    {user.firstname} {user.lastname}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                        <div>
                            <select
                                value={datePreset}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setDatePreset(val);
                                    setPage(1);
                                    if (val === 'today') {
                                        const d = new Date().toISOString().slice(0,10);
                                        setStartDate(d); setEndDate(d);
                                    } else if (val === 'thismonth') {
                                        const now = new Date();
                                        const s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
                                        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'lastmonth') {
                                        const now = new Date();
                                        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0,10);
                                        const e = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0,10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'thisyear') {
                                        const now = new Date();
                                        const s = new Date(now.getFullYear(), 0, 1).toISOString().slice(0,10);
                                        const e = new Date(now.getFullYear(), 11, 31).toISOString().slice(0,10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'lastyear') {
                                        const now = new Date();
                                        const s = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0,10);
                                        const e = new Date(now.getFullYear() - 1, 11, 31).toISOString().slice(0,10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'thisquarter' || val === 'lastquarter') {
                                        const now = new Date();
                                        let qStartMonth = Math.floor(now.getMonth() / 3) * 3;
                                        let year = now.getFullYear();
                                        if (val === 'lastquarter') {
                                            qStartMonth -= 3;
                                            if (qStartMonth < 0) { qStartMonth += 12; year -= 1; }
                                        }
                                        const s = new Date(year, qStartMonth, 1).toISOString().slice(0,10);
                                        const e = new Date(year, qStartMonth + 3, 0).toISOString().slice(0,10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'custom') {
                                        setStartDate(''); setEndDate('');
                                    } else {
                                        setStartDate(''); setEndDate('');
                                    }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                            >
                                <option value="today">Today</option>
                                <option value="7days">Last 7 Days</option>
                                <option value="30days">Last 30 Days</option>
                                <option value="90days">Last 90 Days</option>
                                <option value="thismonth">This Month</option>
                                <option value="lastmonth">Last Month</option>
                                <option value="thisquarter">This Quarter</option>
                                <option value="lastquarter">Last Quarter</option>
                                <option value="thisyear">This Year</option>
                                <option value="lastyear">Last Year</option>
                                <option value="custom">Custom Range</option>
                            </select>

                            {datePreset === 'custom' && (
                                <div className="flex gap-2 mt-2">
                                    <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-1/2 px-2 py-1 border border-gray-300 rounded" />
                                    <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-1/2 px-2 py-1 border border-gray-300 rounded" />
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                        >
                            <option value="all">All Status</option>
                            <option value="approved">Approved</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                            <option value="completed">Completed</option>
                            <option value="active">Active</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Reports Table */}
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-100">
                {loading ? (
                    <div className="p-6"><ModernLoader size="lg" message="Loading Reports..." fullScreen={false} /></div>
                ) : reports.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No reports found</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"> </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Staff ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Detail</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Start</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">End</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Duration</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Location</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {reports.map((report) => {
                                const isLeave = report.type === 'leave';
                                const isTimeOff = report.type === 'timeoff';
                                const isOnDuty = report.type === 'onduty';
                                const uniqueKey = `${isLeave ? 'lv' : isTimeOff ? 'to' : 'od'}_${report.id}`;
                                const staffName = `${report.tblstaff?.firstname || 'Unknown'} ${report.tblstaff?.lastname || ''}`.trim();
                                const isExpanded = !!expandedRows[uniqueKey];

                                // compute primary cells
                                const dateCell = report.date || report.start_date || (report.check_in_time ? formatInTimezone(report.check_in_time, null, { year: 'numeric', month: 'short', day: '2-digit' }) : 'N/A');
                                const staffId = report.tblstaff?.staffid || report.staff_id || 'N/A';
                                const detail = isLeave ? (report.leave_type || 'N/A') : isTimeOff ? 'Time-Off' : (report.client_name || 'N/A');
                                const startCell = isLeave ? report.start_date : isTimeOff ? (report.start_time || 'N/A') : (report.check_in_time ? formatInTimezone(report.check_in_time, null, { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A');
                                const endCell = isLeave ? report.end_date : isTimeOff ? (report.end_time || 'N/A') : (report.check_out_time ? formatInTimezone(report.check_out_time, null, { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A');
                                const durationCell = isLeave ? (report.start_date && report.end_date ? `${calculateLeaveDays(report.start_date, report.end_date)} day(s)` : 'N/A') : isTimeOff ? calculateTimeOffDuration(report.start_time, report.end_time) : calculateDuration(report.check_in_time, report.check_out_time);
                                const locationCell = isLeave || isTimeOff ? 'N/A' : (report.location || report.client_name || 'N/A');
                                const statusCell = (report.type === 'leave' || report.type === 'timeoff') ? (report.status || 'N/A') : (report.check_out_time ? 'Completed' : 'Active');

                                // Timestamps: backend may return camelCase or snake_case fields
                                const createdAtVal = report.createdAt || report.created_at || report.created_on || report.created || report.date_created || null;
                                const updatedAtVal = report.updatedAt || report.updated_at || report.decision_at || report.updated || report.date_updated || null;

                                return (
                                    <React.Fragment key={uniqueKey}>
                                        <tr className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                <button onClick={() => toggleRow(uniqueKey)} className="text-blue-600 font-bold">{isExpanded ? '- ' : '+ '}</button>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{dateCell}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{staffId}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{staffName}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{report.tblstaff?.email || 'N/A'}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${isLeave ? 'bg-blue-100 text-blue-700' : isTimeOff ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{isLeave ? 'Leave' : isTimeOff ? 'Time-Off' : 'On-Duty'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{detail}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{startCell}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{endCell}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{durationCell}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{locationCell}</td>
                                            <td className="px-4 py-3 text-sm">{getStatusBadge(report)}</td>
                                        </tr>

                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={12} className="bg-gray-50 px-4 py-3 text-sm text-gray-700">
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                                        <div>
                                                            <p className="text-xs text-gray-500">Full Name</p>
                                                            <p className="text-sm text-gray-900">{staffName}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500">Email</p>
                                                            <p className="text-sm text-gray-900">{report.tblstaff?.email || 'N/A'}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500">Type / Detail</p>
                                                            <p className="text-sm text-gray-900">{detail}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500">Location</p>
                                                            <p className="text-sm text-gray-900">{locationCell}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500">Reason / Purpose</p>
                                                            <p className="text-sm text-gray-900">{report.reason || report.purpose || 'N/A'}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500">Approver</p>
                                                            <p className="text-sm text-gray-900">{report.approver ? `${report.approver.firstname} ${report.approver.lastname} (${report.approver.email})` : 'N/A'}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500">Submitted</p>
                                                            <p className="text-sm text-gray-900">{createdAtVal ? formatInTimezone(createdAtVal, null, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500">Decision</p>
                                                            {report.status && (report.status === 'Approved' || report.status === 'Rejected') ? (
                                                                <p className="text-sm text-gray-900">{`${report.status === 'Approved' ? 'Approved At' : 'Rejected At'}: ${updatedAtVal ? formatInTimezone(updatedAtVal, null, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}`}</p>
                                                            ) : (
                                                                <p className="text-sm text-gray-900">{report.status || 'N/A'}</p>
                                                            )}

                                                            {report.rejection_reason && (
                                                                <>
                                                                    <p className="text-xs text-red-500 mt-2">Rejection Reason</p>
                                                                    <p className="text-sm text-red-700">{report.rejection_reason}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination Controls */}
            {reports.length > 0 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 mt-4 rounded-b-lg">
                    <div className="text-sm text-gray-600">
                        Showing page {page} of {totalPages} ({totalItems} total records)
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* Previous Button */}
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>

                        {/* Page Numbers with Smart Ellipsis */}
                        <div className="flex items-center gap-1">
                            {(() => {
                                const pageNumbers = [];
                                const showEllipsis = totalPages > 7;

                                if (!showEllipsis) {
                                    // Show all pages if <= 7
                                    for (let i = 1; i <= totalPages; i++) {
                                        pageNumbers.push(
                                            <button
                                                key={i}
                                                onClick={() => setPage(i)}
                                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                                                    page === i
                                                        ? 'bg-blue-600 text-white font-semibold'
                                                        : 'border border-gray-300 hover:bg-gray-200'
                                                }`}
                                            >
                                                {i}
                                            </button>
                                        );
                                    }
                                } else {
                                    // Always show first page
                                    pageNumbers.push(
                                        <button
                                            key={1}
                                            onClick={() => setPage(1)}
                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                                                page === 1
                                                    ? 'bg-blue-600 text-white font-semibold'
                                                    : 'border border-gray-300 hover:bg-gray-200'
                                            }`}
                                        >
                                            1
                                        </button>
                                    );

                                    // Left ellipsis
                                    if (page > 3) {
                                        pageNumbers.push(
                                            <span key="left-ellipsis" className="px-2 text-gray-500">
                                                ...
                                            </span>
                                        );
                                    }

                                    // Pages around current
                                    const start = Math.max(2, page - 1);
                                    const end = Math.min(totalPages - 1, page + 1);

                                    for (let i = start; i <= end; i++) {
                                        pageNumbers.push(
                                            <button
                                                key={i}
                                                onClick={() => setPage(i)}
                                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                                                    page === i
                                                        ? 'bg-blue-600 text-white font-semibold'
                                                        : 'border border-gray-300 hover:bg-gray-200'
                                                }`}
                                            >
                                                {i}
                                            </button>
                                        );
                                    }

                                    // Right ellipsis
                                    if (page < totalPages - 2) {
                                        pageNumbers.push(
                                            <span key="right-ellipsis" className="px-2 text-gray-500">
                                                ...
                                            </span>
                                        );
                                    }

                                    // Always show last page
                                    pageNumbers.push(
                                        <button
                                            key={totalPages}
                                            onClick={() => setPage(totalPages)}
                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                                                page === totalPages
                                                    ? 'bg-blue-600 text-white font-semibold'
                                                    : 'border border-gray-300 hover:bg-gray-200'
                                            }`}
                                        >
                                            {totalPages}
                                        </button>
                                    );
                                }

                                return pageNumbers;
                            })()}
                        </div>

                        {/* Next Button */}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
