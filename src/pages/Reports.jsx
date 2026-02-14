import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { calculateLeaveDays } from '../utils/dateUtils';
import { fetchRoles, canViewReports } from '../utils/roleUtils';
import { formatInTimezone } from '../utils/timezone.util';

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
    }, [hasPermission, selectedUserId, dateFilter, statusFilter, typeFilter, page, limit]);

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
                dateFilter,
                status: statusFilter
            };

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

        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffMs = end - start;
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;

        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
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
                    duration = `${report.start_time || ''} - ${report.end_time || ''}`;
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
            a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
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
                        <h1 className="text-3xl font-bold text-gray-900">Attendance Reports</h1>
                        <p className="text-gray-600 mt-1">View and export attendance records</p>
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
                        <select
                            value={dateFilter}
                            onChange={(e) => handleFilterChange(setDateFilter, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                        >
                            <option value="all">All Time</option>
                            <option value="7days">Last 7 Days</option>
                            <option value="30days">Last 30 Days</option>
                            <option value="90days">Last 90 Days</option>
                        </select>
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

            {/* Reports Grid */}
            <div className="space-y-2">
                {loading ? (
                    <ModernLoader size="lg" message="Loading Reports..." fullScreen={false} />
                ) : reports.length > 0 ? (
                    reports.map((report) => {
                        const isLeave = report.type === 'leave';
                        const isTimeOff = report.type === 'timeoff';
                        const isOnDuty = report.type === 'onduty';
                        const uniqueKey = `${isLeave ? 'lv' : isTimeOff ? 'to' : 'od'}_${report.id}`;
                        const staffName = `${report.tblstaff?.firstname || 'Unknown'} ${report.tblstaff?.lastname || ''}`;
                        const isExpanded = expandedRows[uniqueKey];

                        // Prepare summary line based on type
                        let summaryText = '';
                        if (isLeave) {
                            const days = calculateLeaveDays(report.start_date, report.end_date);
                            summaryText = `${report.start_date} → ${report.end_date} (${days} days, ${report.leave_type || 'N/A'})`;
                        } else if (isTimeOff) {
                            summaryText = `${report.date} | ${report.start_time || ''} - ${report.end_time || ''}`;
                        } else {
                            const startTime = report.check_in_time ? formatInTimezone(report.check_in_time, null, { hour: '2-digit', minute: '2-digit', hour12: true, day: undefined, month: undefined, year: undefined }) : 'N/A';
                            const duration = calculateDuration(report.check_in_time, report.check_out_time);
                            summaryText = `${report.date} | ${startTime} | ${duration} | ${report.client_name || 'N/A'}`;
                        }

                        // Type badge style
                        let typeBadgeClass = 'bg-purple-100 text-purple-700';
                        let typeLabel = 'On-Duty';
                        if (isLeave) {
                            typeBadgeClass = 'bg-blue-100 text-blue-700';
                            typeLabel = 'Leave';
                        } else if (isTimeOff) {
                            typeBadgeClass = 'bg-orange-100 text-orange-700';
                            typeLabel = 'Time-Off';
                        }

                        return (
                            <div key={uniqueKey} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2 flex-1">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
                                            {report.tblstaff?.firstname?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h3 className="font-semibold text-gray-900 text-sm">{staffName}</h3>
                                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeBadgeClass}`}>
                                                    {typeLabel}
                                                </span>
                                                {getStatusBadge(report)}
                                            </div>

                                            {/* Summary Line */}
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <p className="text-xs text-gray-600 truncate">{summaryText}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRow(uniqueKey)}
                                                    className="text-xs text-blue-700 hover:text-blue-800 font-medium whitespace-nowrap ml-2 cursor-pointer bg-none border-none p-0"
                                                >
                                                    {isExpanded ? 'Show Less' : 'Show More'}
                                                </button>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <>
                                                    <p className="text-xs text-gray-500 mb-2">{report.tblstaff?.email || 'N/A'}</p>
                                                    {isLeave ? (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2 pt-2 border-t">
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Start</p>
                                                                <p className="text-gray-900">{report.start_date}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 font-medium">End</p>
                                                                <p className="text-gray-900">{report.end_date}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Days</p>
                                                                <p className="text-gray-900">
                                                                    {report.start_date && report.end_date
                                                                        ? calculateLeaveDays(report.start_date, report.end_date)
                                                                        : 'N/A'}
                                                                </p>
                                                            </div>
                                                            {/* ... rest of leave details ... */}
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Type</p>
                                                                <p className="text-gray-900">{report.leave_type || 'N/A'}</p>
                                                            </div>
                                                            <div className="col-span-2 md:col-span-4">
                                                                <p className="text-gray-500 font-medium">Reason</p>
                                                                <p className="text-gray-700">{report.reason || 'N/A'}</p>
                                                            </div>
                                                            {report.approver && (
                                                                <div className="col-span-2 md:col-span-4 pt-2 border-t">
                                                                    <p className="text-gray-500 font-medium">
                                                                        {report.status === 'Approved' ? 'Approved By' : 'Rejected By'}
                                                                    </p>
                                                                    <p className="text-gray-700">{report.approver.firstname} {report.approver.lastname}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : isTimeOff ? (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2 pt-2 border-t">
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Date</p>
                                                                <p className="text-gray-900">{report.date}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Start Time</p>
                                                                <p className="text-gray-900">{report.start_time || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 font-medium">End Time</p>
                                                                <p className="text-gray-900">{report.end_time || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Status</p>
                                                                <p className="text-gray-900">{report.status || 'N/A'}</p>
                                                            </div>
                                                            <div className="col-span-2 md:col-span-4">
                                                                <p className="text-gray-500 font-medium">Reason</p>
                                                                <p className="text-gray-700">{report.reason || 'N/A'}</p>
                                                            </div>
                                                            {report.rejection_reason && (
                                                                <div className="col-span-2 md:col-span-4">
                                                                    <p className="text-gray-500 font-medium">Rejection Reason</p>
                                                                    <p className="text-red-600">{report.rejection_reason}</p>
                                                                </div>
                                                            )}
                                                            {report.approver && (
                                                                <div className="col-span-2 md:col-span-4 pt-2 border-t">
                                                                    <p className="text-gray-500 font-medium">
                                                                        {report.status === 'Approved' ? 'Approved By' : 'Rejected By'}
                                                                    </p>
                                                                    <p className="text-gray-700">{report.approver.firstname} {report.approver.lastname}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2 pt-2 border-t">
                                                            {/* ... on duty details ... */}
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Start</p>
                                                                <p className="text-gray-900">
                                                                    {report.check_in_time ? formatInTimezone(report.check_in_time, null, { hour: '2-digit', minute: '2-digit', hour12: true, day: undefined, month: undefined, year: undefined }) : 'N/A'}
                                                                </p>
                                                            </div>
                                                            {/* ... */}
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Date</p>
                                                                <p className="text-gray-900">{report.date}</p>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <p className="text-gray-500 font-medium">Client</p>
                                                                <p className="text-gray-700">{report.client_name || 'N/A'}</p>
                                                            </div>
                                                            <div className="col-span-4">
                                                                <p className="text-gray-500 font-medium">Purpose</p>
                                                                <p className="text-gray-700">{report.purpose || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p className="text-gray-500 font-medium">No reports found</p>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {reports.length > 0 && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6 mt-4 rounded-b-lg">
                    <div className="flex flex-1 justify-between sm:hidden">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                            </p>
                        </div>
                        <div>
                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                >
                                    <span className="sr-only">Previous</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                    </svg>
                                </button>

                                {/* Page Numbers (simplified) */}
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    // Show a window of pages around current page
                                    let p = page;
                                    if (totalPages <= 5) p = i + 1;
                                    else if (page <= 3) p = i + 1;
                                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                                    else p = page - 2 + i;

                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${p === page
                                                ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}

                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                >
                                    <span className="sr-only">Next</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
