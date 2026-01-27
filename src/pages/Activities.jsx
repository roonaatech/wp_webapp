import React, { useEffect, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { hasAdminPermission } from '../utils/roleUtils';

const Activities = () => {
    // Get today's date in YYYY-MM-DD format
    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Filters - default to today's date
    const [actionFilter, setActionFilter] = useState('');
    const [entityFilter, setEntityFilter] = useState('');
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [adminIdFilter, setAdminIdFilter] = useState('');

    // Summary data
    const [summary, setSummary] = useState(null);
    const [showSummary, setShowSummary] = useState(false);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = hasAdminPermission(user.role);

    useEffect(() => {
        // Check if user is admin
        if (!isAdmin) {
            setError('Unauthorized: Only admins can view activity logs');
            setLoading(false);
            return;
        }
        
        // Fetch with today's date by default
        fetchActivities(1, {
            action: '',
            entity: '',
            startDate: getTodayDate(),
            endDate: getTodayDate(),
            adminId: ''
        });
        fetchSummary({ startDate: getTodayDate(), endDate: getTodayDate() });
    }, [user.role]);

    const fetchActivities = async (page = 1, filters = {}) => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');

            // Use provided filters or fall back to state
            const action = filters.action !== undefined ? filters.action : actionFilter;
            const entity = filters.entity !== undefined ? filters.entity : entityFilter;
            const start = filters.startDate !== undefined ? filters.startDate : startDate;
            const end = filters.endDate !== undefined ? filters.endDate : endDate;
            const adminId = filters.adminId !== undefined ? filters.adminId : adminIdFilter;

            const params = new URLSearchParams({
                page,
                limit: pageSize,
                ...(action && { action }),
                ...(entity && { entity }),
                ...(start && { startDate: start }),
                ...(end && { endDate: end }),
                ...(adminId && { admin_id: adminId })
            });

            console.log('Fetching activities with filters:', {
                action, entity, start, end, adminId,
                url: `${API_BASE_URL}/api/activities?${params}`
            });

            const response = await axios.get(
                `${API_BASE_URL}/api/activities?${params}`,
                { headers: { 'x-access-token': token } }
            );

            if (response.data.success) {
                setActivities(response.data.data);
                setCurrentPage(response.data.pagination.page);
                setTotalPages(response.data.pagination.totalPages);
                setTotalCount(response.data.pagination.total);
            }
        } catch (err) {
            console.error('Error fetching activities:', err);
            setError('Failed to fetch activity logs');
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async (filters = {}) => {
        try {
            const token = localStorage.getItem('token');
            const start = filters.startDate !== undefined ? filters.startDate : startDate;
            const end = filters.endDate !== undefined ? filters.endDate : endDate;
            const params = new URLSearchParams({
                ...(start && { startDate: start }),
                ...(end && { endDate: end })
            });

            const response = await axios.get(
                `${API_BASE_URL}/api/activities/summary?${params}`,
                { headers: { 'x-access-token': token } }
            );

            if (response.data.success) {
                setSummary(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching summary:', err);
        }
    };

    const handleFilterChange = () => {
        setCurrentPage(1);
        fetchActivities(1);
        fetchSummary();
    };

    const handleClearFilters = () => {
        setActionFilter('');
        setEntityFilter('');
        setStartDate('');
        setEndDate('');
        setAdminIdFilter('');
        setCurrentPage(1);
        fetchActivities(1, { action: '', entity: '', startDate: '', endDate: '', adminId: '' });
        fetchSummary({ startDate: '', endDate: '' });
    };

    const handleExportCSV = async () => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                ...(actionFilter && { action: actionFilter }),
                ...(entityFilter && { entity: entityFilter }),
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
                ...(adminIdFilter && { admin_id: adminIdFilter })
            });

            const response = await axios.get(
                `${API_BASE_URL}/api/activities/export/csv?${params}`,
                {
                    headers: { 'x-access-token': token },
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error exporting CSV:', err);
            alert('Failed to export activity logs');
        }
    };

    const getActionBadgeColor = (action) => {
        const colors = {
            'CREATE': 'bg-blue-100 text-blue-800',
            'UPDATE': 'bg-yellow-100 text-yellow-800',
            'DELETE': 'bg-red-100 text-red-800',
            'APPROVE': 'bg-green-100 text-green-800',
            'REJECT': 'bg-orange-100 text-orange-800',
            'LOGIN': 'bg-purple-100 text-purple-800',
            'LOGOUT': 'bg-gray-100 text-gray-800'
        };
        return colors[action] || 'bg-gray-100 text-gray-800';
    };

    const getEntityBadgeColor = (entity) => {
        const colors = {
            'User': 'bg-indigo-100 text-indigo-800',
            'LeaveRequest': 'bg-blue-100 text-blue-800',
            'OnDutyLog': 'bg-purple-100 text-purple-800',
            'LeaveType': 'bg-blue-100 text-blue-800',
            'Approval': 'bg-green-100 text-green-800'
        };
        return colors[entity] || 'bg-gray-100 text-gray-800';
    };

    if (!isAdmin) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    <h2 className="font-bold mb-2">Access Denied</h2>
                    <p>Only administrators can view activity logs.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
                    <p className="text-gray-600 mt-1">Track all admin, manager, and employee operations</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSummary(!showSummary)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        {showSummary ? 'Hide' : 'Show'} Summary
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                        📥 Export CSV
                    </button>
                </div>
            </div>

            {/* Summary Section */}
            {showSummary && summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Action Summary */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <h3 className="font-bold text-gray-900 mb-3">Actions</h3>
                        <div className="space-y-2">
                            {summary.actionCounts.map((item) => (
                                <div key={item.action} className="flex justify-between items-center">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getActionBadgeColor(item.action)}`}>
                                        {item.action}
                                    </span>
                                    <span className="font-bold text-gray-900">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Entity Summary */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <h3 className="font-bold text-gray-900 mb-3">Entities</h3>
                        <div className="space-y-2">
                            {summary.entityCounts.map((item) => (
                                <div key={item.entity} className="flex justify-between items-center">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getEntityBadgeColor(item.entity)}`}>
                                        {item.entity}
                                    </span>
                                    <span className="font-bold text-gray-900">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Total Activities */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-4">
                        <h3 className="font-bold text-gray-900 mb-3">Total Activities</h3>
                        <div className="text-4xl font-bold text-blue-700">{totalCount}</div>
                        <p className="text-sm text-gray-600 mt-2">activities logged</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <h3 className="font-bold text-gray-900 mb-4">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                        <select
                            value={actionFilter}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setActionFilter(newValue);
                                setCurrentPage(1);
                                fetchActivities(1, {
                                    action: newValue,
                                    entity: entityFilter,
                                    startDate: startDate,
                                    endDate: endDate,
                                    adminId: adminIdFilter
                                });
                                fetchSummary({ startDate: startDate, endDate: endDate });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Actions</option>
                            <option value="CREATE">CREATE</option>
                            <option value="UPDATE">UPDATE</option>
                            <option value="DELETE">DELETE</option>
                            <option value="APPROVE">APPROVE</option>
                            <option value="REJECT">REJECT</option>
                            <option value="LOGIN">LOGIN</option>
                            <option value="LOGOUT">LOGOUT</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
                        <select
                            value={entityFilter}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setEntityFilter(newValue);
                                setCurrentPage(1);
                                fetchActivities(1, {
                                    action: actionFilter,
                                    entity: newValue,
                                    startDate: startDate,
                                    endDate: endDate,
                                    adminId: adminIdFilter
                                });
                                fetchSummary({ startDate: startDate, endDate: endDate });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Entities</option>
                            <option value="User">User</option>
                            <option value="LeaveRequest">Leave Request</option>
                            <option value="OnDutyLog">On-Duty Log</option>
                            <option value="LeaveType">Leave Type</option>
                            <option value="Approval">Approval</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setStartDate(newValue);
                                setCurrentPage(1);
                                fetchActivities(1, {
                                    action: actionFilter,
                                    entity: entityFilter,
                                    startDate: newValue,
                                    endDate: endDate,
                                    adminId: adminIdFilter
                                });
                                fetchSummary({ startDate: newValue, endDate: endDate });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setEndDate(newValue);
                                setCurrentPage(1);
                                fetchActivities(1, {
                                    action: actionFilter,
                                    entity: entityFilter,
                                    startDate: startDate,
                                    endDate: newValue,
                                    adminId: adminIdFilter
                                });
                                fetchSummary({ startDate: startDate, endDate: newValue });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Page Size</label>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(parseInt(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 mt-4">
                    <button
                        onClick={handleFilterChange}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Apply Filters
                    </button>
                    <button
                        onClick={handleClearFilters}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Activities Table */}
            {loading ? (
                <ModernLoader size="lg" message="Loading activities..." fullScreen={true} />
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {activities.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#2E5090] text-white">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">Timestamp</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">Entity</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">Performed By</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">IP Address</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {activities.map((activity) => (
                                            <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                    {new Date(activity.createdAt).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getActionBadgeColor(activity.action)}`}>
                                                        {activity.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getEntityBadgeColor(activity.entity)}`}>
                                                        {activity.entity}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {activity.admin ? (
                                                        <div className="font-medium text-gray-900">
                                                            {activity.admin.firstname} {activity.admin.lastname}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">Unknown</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 max-w-md truncate">
                                                    {activity.description || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-xs">
                                                    {activity.ip_address || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                                <div className="text-sm text-gray-600">
                                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} activities
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fetchActivities(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                            <button
                                                key={page}
                                                onClick={() => fetchActivities(page)}
                                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                                                    currentPage === page
                                                        ? 'bg-blue-600 text-white'
                                                        : 'border border-gray-300 hover:bg-gray-200'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => fetchActivities(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-lg font-medium">No activities found</p>
                            <p className="text-sm mt-1">Try adjusting your filters</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Activities;
