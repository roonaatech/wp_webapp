import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { calculateLeaveDays } from '../utils/dateUtils';
import { fetchRoles, canViewReports } from '../utils/roleUtils';

const Reports = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [reports, setReports] = useState([]);
    const [filteredReports, setFilteredReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [dateFilter, setDateFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('both');
    const [expandedRows, setExpandedRows] = useState({});
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Check permission first
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

    useEffect(() => {
        if (hasPermission) {
            fetchReports();
        }
    }, [hasPermission]);

    // Extract unique users from reports for the dropdown
    useEffect(() => {
        if (reports && reports.length > 0) {
            const uniqueUsers = new Map();
            reports.forEach(report => {
                const staffId = report.staff_id || report.tblstaff?.staffid;
                const firstName = report.tblstaff?.firstname || 'Unknown';
                const lastName = report.tblstaff?.lastname || '';
                
                if (staffId && !uniqueUsers.has(staffId)) {
                    uniqueUsers.set(staffId, {
                        staffid: staffId,
                        firstname: firstName,
                        lastname: lastName
                    });
                }
            });
            // Convert map to array and sort by name
            const usersList = Array.from(uniqueUsers.values())
                .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`));
            setUsers(usersList);
        }
    }, [reports]);

    useEffect(() => {
        filterReports();
    }, [reports, users, selectedUserId, dateFilter, statusFilter, typeFilter]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found. Please login first.');
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/api/admin/reports`, {
                headers: { 'x-access-token': token }
            });
            setReports(response.data);
        } catch (error) {
            console.error('Error fetching reports:', error);
            setError(error.response?.data?.message || error.message || 'Failed to fetch reports');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        // Don't fetch users separately - we'll extract unique users from reports
        // This ensures the dropdown shows all users with reports visible to the current user
        // based on their can_view_reports permission
    };

    const filterReports = () => {
        try {
            let filtered = [...reports];

            // Type filter (leave, on-duty, or both)
            if (typeFilter !== 'both') {
                filtered = filtered.filter(report => {
                    if (typeFilter === 'leave' && !report.on_duty) return true;
                    if (typeFilter === 'on_duty' && report.on_duty) return true;
                    return false;
                });
            }

            // User filter
            if (selectedUserId) {
                console.log('Filtering active. Selected User ID:', selectedUserId);
                filtered = filtered.filter(report => {
                    const reportStaffId = report.staff_id || report.tblstaff?.staffid;
                    // Force string comparison
                    const match = String(reportStaffId) === String(selectedUserId);
                    return match;
                });
            }

            // Date filter
            if (dateFilter !== 'all') {
                const today = new Date();
                const startDate = new Date();

                switch (dateFilter) {
                    case '7days':
                        startDate.setDate(today.getDate() - 7);
                        break;
                    case '30days':
                        startDate.setDate(today.getDate() - 30);
                        break;
                    case '90days':
                        startDate.setDate(today.getDate() - 90);
                        break;
                    default:
                        break;
                }

                filtered = filtered.filter(report => {
                    const reportDate = new Date(report.date);
                    return reportDate >= startDate;
                });
            }

            // Status filter based on record type and approval status
            if (statusFilter !== 'all') {
                filtered = filtered.filter(report => {
                    if (report.on_duty) {
                        // On-duty record - filter by completion status
                        if (statusFilter === 'approved' || statusFilter === 'completed') return report.check_out_time !== null;
                        if (statusFilter === 'pending' || statusFilter === 'active') return report.check_out_time === null;
                        if (statusFilter === 'rejected') return false; // On-duty can't be rejected
                    } else {
                        // Leave record - filter by approval status
                        if (statusFilter === 'approved') return report.status === 'Approved';
                        if (statusFilter === 'pending') return report.status === 'Pending';
                        if (statusFilter === 'rejected') return report.status === 'Rejected';
                        if (statusFilter === 'completed' || statusFilter === 'active') return false; // Leave doesn't have these statuses
                    }
                    return false;
                });
            }

            setFilteredReports(filtered);
        } catch (err) {
            console.error('Error in filterReports:', err);
        }
    };

    const calculateDuration = (checkIn, checkOut) => {
        if (!checkIn) return '—';
        if (!checkOut) return 'In Progress';

        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffMs = end - start;
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;

        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const downloadCSV = () => {
        if (filteredReports.length === 0) {
            alert('No data to export');
            return;
        }

        const headers = ['Date', 'Staff Name', 'Email', 'Type', 'Start', 'End', 'Duration', 'Status', 'Approved/Rejected By'];
        const rows = filteredReports.map(report => {
            const isLeave = report.start_date && !report.on_duty;
            const duration = calculateDuration(report.check_in_time, report.check_out_time);
            const status = isLeave ? report.status : (report.check_out_time ? 'Completed' : 'Active');
            const approver = report.approver
                ? `${report.approver.firstname} ${report.approver.lastname} (${report.approver.email})`
                : 'N/A';
            return [
                report.date || 'N/A',
                `${report.tblstaff?.firstname || ''} ${report.tblstaff?.lastname || ''}`.trim() || 'Unknown',
                report.tblstaff?.email || 'N/A',
                isLeave ? 'Leave' : 'On-Duty',
                isLeave ? report.start_date : (report.check_in_time ? new Date(report.check_in_time).toLocaleString() : 'N/A'),
                isLeave ? report.end_date : (report.check_out_time ? new Date(report.check_out_time).toLocaleString() : 'N/A'),
                duration,
                status,
                approver
            ];
        });

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const getStatusBadge = (report) => {
        if (report.on_duty) {
            if (report.check_out_time) {
                return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">Completed</span>;
            }
            return <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">Active</span>;
        }
        // For leave records
        if (report.start_date) {
            if (report.status === 'Approved') {
                return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Approved</span>;
            }
            if (report.status === 'Rejected') {
                return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Rejected</span>;
            }
            return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">Pending</span>;
        }
        // For other attendance records
        if (!report.check_in_time) {
            return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Absent</span>;
        }
        if (report.check_out_time) {
            return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Checked Out</span>;
        }
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Checked In</span>;
    };

    const stats = {
        total: filteredReports.length,
        leaveCount: filteredReports.filter(r => r.start_date && !r.on_duty).length,
        onDutyCount: filteredReports.filter(r => r.on_duty).length,
        approved: filteredReports.filter(r => (r.start_date && r.status === 'Approved') || (r.on_duty && r.check_out_time)).length
    };

    // Show loading while checking permissions
    if (!permissionChecked) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <ModernLoader />
            </div>
        );
    }

    // Don't render if no permission
    if (!hasPermission) {
        return null;
    }

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
                        disabled={filteredReports.length === 0}
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                    <p className="text-gray-500 text-sm font-medium">Total Records</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                    <p className="text-gray-500 text-sm font-medium">Leave Requests</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{stats.leaveCount}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                    <p className="text-gray-500 text-sm font-medium">On-Duty Logs</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{stats.onDutyCount}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                    <p className="text-gray-500 text-sm font-medium">Approved</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{stats.approved}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Record Type</label>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                        >
                            <option value="both">Both (Leave & On-Duty)</option>
                            <option value="leave">Leave Only</option>
                            <option value="on_duty">On-Duty Only</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by User</label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
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
                            onChange={(e) => setDateFilter(e.target.value)}
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
                            onChange={(e) => setStatusFilter(e.target.value)}
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
                    <ModernLoader size="lg" message="Loading Reports..." fullScreen={true} />
                ) : filteredReports.length > 0 ? (
                    filteredReports.map((report) => {
                        const isLeave = report.start_date && !report.on_duty;
                        const uniqueKey = `${isLeave ? 'lv' : 'od'}_${report.id}`;
                        const staffName = `${report.tblstaff?.firstname || 'Unknown'} ${report.tblstaff?.lastname || ''}`;
                        const isExpanded = expandedRows[uniqueKey];

                        // Prepare summary line based on type
                        let summaryText = '';
                        if (isLeave) {
                            const days = calculateLeaveDays(report.start_date, report.end_date);
                            summaryText = `${report.start_date} → ${report.end_date} (${days} days, ${report.leave_type || 'N/A'})`;
                        } else {
                            const startTime = report.check_in_time ? new Date(report.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
                            const duration = calculateDuration(report.check_in_time, report.check_out_time);
                            summaryText = `${report.date} | ${startTime} | ${duration} | ${report.client_name || 'N/A'}`;
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
                                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isLeave ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {isLeave ? 'Leave' : 'On-Duty'}
                                                </span>
                                                {getStatusBadge(report)}
                                            </div>

                                            {/* Summary Line */}
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <p className="text-xs text-gray-600 truncate">{summaryText}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedRows(prev => ({
                                                        ...prev,
                                                        [uniqueKey]: !prev[uniqueKey]
                                                    }))}
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
                                                                    {report.approver.email && <p className="text-blue-600 text-xs">{report.approver.email}</p>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2 pt-2 border-t">
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Start</p>
                                                                <p className="text-gray-900">
                                                                    {report.check_in_time ? new Date(report.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 font-medium">End</p>
                                                                <p className="text-gray-900">
                                                                    {report.check_out_time ? new Date(report.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Duration</p>
                                                                <p className="text-gray-900">{calculateDuration(report.check_in_time, report.check_out_time)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 font-medium">Date</p>
                                                                <p className="text-gray-900">{report.date}</p>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <p className="text-gray-500 font-medium">Client</p>
                                                                <p className="text-gray-700">{report.client_name || 'N/A'}</p>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <p className="text-gray-500 font-medium">Location</p>
                                                                <p className="text-gray-700">{report.location || 'N/A'}</p>
                                                            </div>
                                                            <div className="col-span-4">
                                                                <p className="text-gray-500 font-medium">Purpose</p>
                                                                <p className="text-gray-700">{report.purpose || 'N/A'}</p>
                                                            </div>
                                                            {report.approver && (
                                                                <div className="col-span-4 pt-2 border-t">
                                                                    <p className="text-gray-500 font-medium">
                                                                        {report.status === 'Approved' || report.check_out_time ? 'Approved By' : 'Rejected By'}
                                                                    </p>
                                                                    <p className="text-gray-700">{report.approver.firstname} {report.approver.lastname}</p>
                                                                    {report.approver.email && <p className="text-blue-600 text-xs">{report.approver.email}</p>}
                                                                </div>
                                                            )}
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

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-lg">
                <p className="text-sm text-gray-600">
                    Showing <span className="font-medium">{filteredReports.length}</span> of <span className="font-medium">{reports.length}</span> records
                </p>
            </div>
        </div>
    );
};

export default Reports;
