import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiPlusCircle, FiMinusCircle } from 'react-icons/fi';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { calculateLeaveDays } from '../utils/dateUtils';
import { fetchRoles, canViewReports } from '../utils/roleUtils';
import { formatInTimezone, formatTimeOnly, formatDateOnly, getCurrentInAppTimezone, parseAppTimezone } from '../utils/timezone.util';

import TableSortIcon from '../components/TableSortIcon';
import MonthlySummaryReport from '../components/MonthlySummaryReport';

const Reports = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [activeTab, setActiveTab] = useState('monthly'); // 'detailed' | 'monthly'

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
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
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
    const [datePreset, setDatePreset] = useState('thismonth');
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);
    const [statusFilter, setStatusFilter] = useState('approved');
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

            // Date range handling: pass pre-calculated dates to backend directly for any preset
            if (datePreset !== 'all' && startDate && endDate) {
                params.startDate = startDate;
                params.endDate = endDate;
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

    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };



    // Sort reports
    const sortedReports = React.useMemo(() => {
        const sorted = [...reports];
        sorted.sort((a, b) => {
            let aValue, bValue;

            switch (sortConfig.key) {
                case 'date':
                    aValue = a.createdAt || a.created_at || a.created_on || a.created || a.date_created || a.date || '';
                    bValue = b.createdAt || b.created_at || b.created_on || b.created || b.date_created || b.date || '';
                    break;
                case 'staffName':
                    aValue = `${a.tblstaff?.firstname || ''} ${a.tblstaff?.lastname || ''}`;
                    bValue = `${b.tblstaff?.firstname || ''} ${b.tblstaff?.lastname || ''}`;
                    break;
                case 'type':
                    aValue = a.type || '';
                    bValue = b.type || '';
                    break;
                case 'status':
                    aValue = a.status || '';
                    bValue = b.status || '';
                    break;
                default:
                    aValue = a[sortConfig.key] || '';
                    bValue = b[sortConfig.key] || '';
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [reports, sortConfig]);

    const downloadCSV = async () => {
        // Feature upgrade: Download ALL filtered data, not just current page
        try {
            const token = localStorage.getItem('token');
            const params = {
                page: 1,
                limit: 1000, // Reasonable limit for export
                type: typeFilter,
                userId: selectedUserId,
                status: statusFilter
            };

            // Date range handling: pass pre-calculated dates to backend directly for any preset
            if (datePreset !== 'all' && startDate && endDate) {
                params.startDate = startDate;
                params.endDate = endDate;
            }

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
                // Calculate duration based on type - Clamp to selected range for consistency with Summary
                let duration;
                if (isLeave) {
                    const effectiveStart = (startDate && report.start_date < startDate) ? startDate : report.start_date;
                    const effectiveEnd = (endDate && report.end_date > endDate) ? endDate : report.end_date;
                    const days = calculateLeaveDays(effectiveStart, effectiveEnd);
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
                    report.date ? formatDateOnly(report.date) : 'N/A',
                    report.tblstaff?.staffid || report.staff_id || 'N/A',
                    `${report.tblstaff?.firstname || ''} ${report.tblstaff?.lastname || ''}`.trim() || 'Unknown',
                    report.tblstaff?.email || 'N/A',
                    typeName,
                    isLeave ? (report.leave_type || 'N/A') : isTimeOff ? 'N/A' : (report.client_name || 'N/A'),
                    isLeave ? formatDateOnly(report.start_date) : isTimeOff ? `${formatDateOnly(report.date)}, ${formatTimeOnly(report.start_time)}` : (report.check_in_time ? formatInTimezone(report.check_in_time) : 'N/A'),
                    isLeave ? formatDateOnly(report.end_date) : isTimeOff ? `${formatDateOnly(report.date)}, ${formatTimeOnly(report.end_time)}` : (report.check_out_time ? formatInTimezone(report.check_out_time) : 'N/A'),
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
            // Generate filename using Monthly Report convention
            const dateObj = new Date();
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yy = String(dateObj.getFullYear()).slice(-2);
            const hh = String(dateObj.getHours()).padStart(2, '0');
            const mmm = String(dateObj.getMinutes()).padStart(2, '0');
            const sss = String(dateObj.getSeconds()).padStart(2, '0');
            const formattedDate = `${dd}-${mm}-${yy}_${hh}${mmm}${sss}`;

            a.download = `WorkPulse_Detailed_Report_${formattedDate}.csv`;
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
                        <h1 className="text-3xl font-black text-[#1e1b4b] tracking-tight">Reports</h1>
                        <p className="text-gray-500 mt-1 text-sm">View and export leave, on-duty and time-off records</p>
                    </div>
                </div>
            </div>

            {/* Tab Switcher (Sliding Pill) */}
            <div className="mb-8 flex justify-center w-full" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="relative flex bg-gray-100 rounded-full p-1 border border-gray-200 shadow-inner">
                    <div
                        className="absolute top-1 bottom-1 w-1/2 bg-[#1e1b4b] rounded-full shadow-lg transition-transform duration-300 ease-in-out"
                        style={{ transform: activeTab === 'detailed' ? 'translateX(100%)' : 'translateX(0)' }}
                    />
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`relative z-10 px-6 py-3 text-sm font-semibold capitalize tracking-wider transition-colors duration-300 w-56 text-center rounded-full focus:outline-none ${
                            activeTab === 'monthly' ? 'text-white' : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        📊 Monthly Summary
                    </button>
                    <button
                        onClick={() => setActiveTab('detailed')}
                        className={`relative z-10 px-6 py-3 text-sm font-semibold capitalize tracking-wider transition-colors duration-300 w-56 text-center rounded-full focus:outline-none ${
                            activeTab === 'detailed' ? 'text-white' : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        📋 Detailed Reports
                    </button>
                </div>
            </div>

            {activeTab === 'monthly' ? (
                <MonthlySummaryReport />
            ) : (
            <>

            {/* Export Button for Detailed */}
            <div className="mb-4 flex justify-end">
                <button
                    onClick={downloadCSV}
                    disabled={reports.length === 0}
                    className="group relative overflow-hidden px-6 py-2.5 bg-white text-[#1e1b4b] border-2 border-[#1e1b4b] rounded-xl font-black text-xs uppercase tracking-widest hover:text-white hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow-lg flex items-center gap-2 z-10"
                >
                    <div className="absolute inset-0 bg-[#1e1b4b] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out -z-10" />
                    <div className="w-2 h-2 bg-[#0ea5e9] rounded-full animate-pulse" />
                    📥 Export to CSV
                </button>
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
                                        const now = getCurrentInAppTimezone().full;
                                        const d = now.toISOString().slice(0, 10);
                                        setStartDate(d); setEndDate(d);
                                    } else if (val === 'thismonth') {
                                        const now = getCurrentInAppTimezone().full;
                                        const s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                                        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'lastmonth') {
                                        const now = getCurrentInAppTimezone().full;
                                        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
                                        const e = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'thisyear') {
                                        const now = getCurrentInAppTimezone().full;
                                        const s = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
                                        const e = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'lastyear') {
                                        const now = getCurrentInAppTimezone().full;
                                        const s = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0, 10);
                                        const e = new Date(now.getFullYear() - 1, 11, 31).toISOString().slice(0, 10);
                                        setStartDate(s); setEndDate(e);
                                    } else if (val === 'thisquarter' || val === 'lastquarter') {
                                        const now = getCurrentInAppTimezone().full;
                                        let qStartMonth = Math.floor(now.getMonth() / 3) * 3;
                                        let year = now.getFullYear();
                                        if (val === 'lastquarter') {
                                            qStartMonth -= 3;
                                            if (qStartMonth < 0) { qStartMonth += 12; year -= 1; }
                                        }
                                        const s = new Date(year, qStartMonth, 1).toISOString().slice(0, 10);
                                        const e = new Date(year, qStartMonth + 3, 0).toISOString().slice(0, 10);
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

            <div className="relative overflow-x-auto bg-white rounded-lg border border-gray-100 min-h-[400px]">
                {loading && (
                    <ModernLoader size="container" message="Updating reports..." fullScreen={false} />
                )}
                {reports.length === 0 && !loading ? (
                    <div className="p-6 text-center text-gray-500">No reports found</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[#1e1b4b] text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Details</th>
                                <th className="px-4 py-3 text-left">
                                    <button
                                        onClick={() => handleSort('date')}
                                        className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                    >
                                        Created Date <TableSortIcon column="date" sortConfig={sortConfig} />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                    <button
                                        onClick={() => handleSort('staffName')}
                                        className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                    >
                                        Staff <TableSortIcon column="staffName" sortConfig={sortConfig} />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                    <button
                                        onClick={() => handleSort('type')}
                                        className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                    >
                                        Type <TableSortIcon column="type" sortConfig={sortConfig} />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Detail</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Start</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">End</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Duration</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Location</th>
                                <th className="px-4 py-3 text-left">
                                    <button
                                        onClick={() => handleSort('status')}
                                        className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                    >
                                        Status <TableSortIcon column="status" sortConfig={sortConfig} />
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {sortedReports.map((report) => {
                                const isLeave = report.type === 'leave';
                                const isTimeOff = report.type === 'timeoff';
                                const isOnDuty = report.type === 'onduty';
                                const uniqueKey = `${isLeave ? 'lv' : isTimeOff ? 'to' : 'od'}_${report.id}`;
                                const staffName = `${report.tblstaff?.firstname || 'Unknown'} ${report.tblstaff?.lastname || ''}`.trim();
                                const isExpanded = !!expandedRows[uniqueKey];

                                // compute primary cells
                                const createdAtVal = report.createdAt || report.created_at || report.created_on || report.created || report.date_created || null;
                                const dateCell = createdAtVal ? formatDateOnly(createdAtVal) : 'N/A';
                                const staffId = report.tblstaff?.staffid || report.staff_id || 'N/A';
                                const detail = isLeave ? (report.leave_type || 'N/A') : isTimeOff ? 'Time-Off' : (report.client_name || 'N/A');
                                const startCell = isLeave ? formatDateOnly(report.start_date) : isTimeOff ? `${formatDateOnly(report.date)}, ${formatTimeOnly(report.start_time)}` : (report.check_in_time ? formatInTimezone(report.check_in_time) : 'N/A');
                                const endCell = isLeave ? formatDateOnly(report.end_date) : isTimeOff ? `${formatDateOnly(report.date)}, ${formatTimeOnly(report.end_time)}` : (report.check_out_time ? formatInTimezone(report.check_out_time) : 'N/A');
                                const durationCell = isLeave ? (report.start_date && report.end_date ? (() => {
                                    const effectiveStart = (startDate && report.start_date < startDate) ? startDate : report.start_date;
                                    const effectiveEnd = (endDate && report.end_date > endDate) ? endDate : report.end_date;
                                    const days = calculateLeaveDays(effectiveStart, effectiveEnd);
                                    return `${days} day(s)`;
                                })() : 'N/A') : isTimeOff ? calculateTimeOffDuration(report.start_time, report.end_time) : calculateDuration(report.check_in_time, report.check_out_time);
                                const locationCell = isLeave || isTimeOff ? 'N/A' : (report.location || report.client_name || 'N/A');
                                const statusCell = (report.type === 'leave' || report.type === 'timeoff') ? (report.status || 'N/A') : (report.check_out_time ? 'Completed' : 'Active');

                                // Timestamps: backend may return camelCase or snake_case fields
                                const updatedAtVal = report.updatedAt || report.updated_at || report.decision_at || report.updated || report.date_updated || null;

                                return (
                                    <React.Fragment key={uniqueKey}>
                                        <tr className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-2 py-2 text-sm">
                                                <button
                                                    onClick={() => toggleRow(uniqueKey)}
                                                    className="text-gray-400 hover:text-blue-600 transition-colors"
                                                >
                                                    {isExpanded ? <FiMinusCircle size={16} /> : <FiPlusCircle size={16} />}
                                                </button>
                                            </td>
                                            <td className="px-2 py-2 text-sm text-gray-700 whitespace-nowrap">{dateCell}</td>
                                            <td className="px-2 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{staffName}</td>
                                            <td className="px-2 py-2 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border ${isLeave ? 'bg-blue-50 text-blue-700 border-blue-200' : isTimeOff ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                                    {isLeave ? 'Leave' : isTimeOff ? 'Time-Off' : 'On-Duty'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-sm text-gray-700 max-w-[150px] truncate" title={detail}>{detail}</td>
                                            <td className="px-2 py-2 text-sm text-gray-700 whitespace-nowrap">{startCell}</td>
                                            <td className="px-2 py-2 text-sm text-gray-700 whitespace-nowrap">{endCell}</td>
                                            <td className="px-2 py-2 text-sm text-gray-700 whitespace-nowrap">{durationCell}</td>
                                            <td className="px-2 py-2 text-sm text-gray-700 max-w-[150px] truncate" title={locationCell}>{locationCell}</td>
                                            <td className="px-2 py-2 text-sm">{getStatusBadge(report)}</td>
                                        </tr>

                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={10} className="bg-blue-50 px-6 py-4 text-sm text-gray-700">
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                                            <p className="text-sm text-gray-900">{createdAtVal ? formatInTimezone(createdAtVal) : 'N/A'}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500">Decision</p>
                                                            {report.status && (report.status === 'Approved' || report.status === 'Rejected') ? (
                                                                <p className="text-sm text-gray-900">{`${report.status === 'Approved' ? 'Approved At' : 'Rejected At'}: ${updatedAtVal ? formatInTimezone(updatedAtVal) : 'N/A'}`}</p>
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
                                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${page === i
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
                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${page === 1
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
                                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${page === i
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
                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${page === totalPages
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
            </>
            )}
        </div>
    );
};

export default Reports;
