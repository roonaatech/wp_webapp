import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { canViewActivities, fetchRoles } from '../utils/roleUtils';
import { formatInTimezone, getCurrentInAppTimezone } from '../utils/timezone.util';
import TableSortIcon from '../components/TableSortIcon';

const Activities = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    // Get today's date in YYYY-MM-DD format
    const getTodayDate = () => {
        return getCurrentInAppTimezone().date;
    };

    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

    // Filters - default to today's date
    const [actionFilter, setActionFilter] = useState('');
    const [entityFilter, setEntityFilter] = useState('');
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [adminIdFilter, setAdminIdFilter] = useState('');

    // Employee filter UI
    const [users, setUsers] = useState([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
    const employeeDropdownRef = useRef(null);

    // Summary data
    const [summary, setSummary] = useState(null);
    const [showSummary, setShowSummary] = useState(false);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Check permission first
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const hasActivityPermission = canViewActivities(user.role);
                if (!hasActivityPermission) {
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
        if (!hasPermission) return;

        // Fetch users for the employee filter
        const fetchUsers = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(
                    `${API_BASE_URL}/api/admin/users?limit=all&status=all`,
                    { headers: { 'x-access-token': token } }
                );
                if (res.data.users) setUsers(res.data.users);
                else if (Array.isArray(res.data)) setUsers(res.data);
            } catch (e) {
                console.error('Failed to fetch users for filter:', e);
            }
        };
        fetchUsers();

        // Fetch with today's date by default
        fetchActivities(1, {
            action: '',
            entity: '',
            startDate: getTodayDate(),
            endDate: getTodayDate(),
            adminId: ''
        });
        fetchSummary({ startDate: getTodayDate(), endDate: getTodayDate() });
    }, [hasPermission]);

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
        setEmployeeSearch('');
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
            link.setAttribute('download', `activity_logs_${getCurrentInAppTimezone().date}.csv`);
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

    const formatDescription = (activity) => {
        if (!activity.description) return '—';
        if (activity.action === 'APPROVE' && activity.affected_user) {
            const name = `${activity.affected_user.firstname} ${activity.affected_user.lastname}`.trim();
            if (name && !activity.description.toLowerCase().includes('requested by')) {
                return `${activity.description} requested by ${name}`;
            }
        }
        return activity.description;
    };

    const extractIPv4 = (ip) => {
        if (!ip) return null;
        // IPv4-mapped IPv6: ::ffff:1.2.3.4
        const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
        if (mapped) return mapped[1];
        // Pure IPv4
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
        // Pure IPv6 — hide it
        return null;
    };

    const getEntityBadgeColor = (entity) => {
        const colors = {
            'User': 'bg-indigo-100 text-indigo-800',
            'LeaveRequest': 'bg-blue-100 text-blue-800',
            'OnDutyLog': 'bg-purple-100 text-purple-800',
            'TimeOffRequest': 'bg-orange-100 text-orange-800',
            'LeaveType': 'bg-blue-100 text-blue-800',
            'Approval': 'bg-green-100 text-green-800',
            'Setting': 'bg-yellow-100 text-yellow-800'
        };
        return colors[entity] || 'bg-gray-100 text-gray-800';
    };

    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Close employee dropdown on outside click
    useEffect(() => {
        if (!showEmployeeDropdown) return;
        const handleOutside = (e) => {
            if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target)) {
                setShowEmployeeDropdown(false);
                setEmployeeSearch('');
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [showEmployeeDropdown]);



    // Sort activities
    const sortedActivities = React.useMemo(() => {
        const sorted = [...activities];
        sorted.sort((a, b) => {
            let aValue, bValue;

            switch (sortConfig.key) {
                case 'performedBy':
                    aValue = a.admin ? `${a.admin.firstname} ${a.admin.lastname}` : '';
                    bValue = b.admin ? `${b.admin.firstname} ${b.admin.lastname}` : '';
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
    }, [activities, sortConfig]);

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
                            <option value="TimeOffRequest">Time-Off Request</option>
                            <option value="LeaveType">Leave Type</option>
                            <option value="Approval">Approval</option>
                            <option value="Setting">System Setting</option>
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

                    {/* Employee Filter */}
                    <div ref={employeeDropdownRef} className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                        <div
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white flex items-center gap-2"
                            onClick={() => setShowEmployeeDropdown(v => !v)}
                        >
                            {adminIdFilter ? (
                                (() => {
                                    const sel = users.find(u => String(u.staffid) === String(adminIdFilter));
                                    return sel ? (
                                        <>
                                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                                {sel.firstname?.[0]}{sel.lastname?.[0]}
                                            </span>
                                            <span className="text-sm text-gray-900 truncate flex-1">{sel.firstname} {sel.lastname}</span>
                                        </>
                                    ) : <span className="text-sm text-gray-400 flex-1">All Employees</span>;
                                })()
                            ) : (
                                <span className="text-sm text-gray-400 flex-1">All Employees</span>
                            )}
                            <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showEmployeeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>

                        {showEmployeeDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                                {/* Search input */}
                                <div className="p-2 border-b border-gray-100">
                                    <input
                                        type="text"
                                        placeholder="Search employees..."
                                        value={employeeSearch}
                                        onChange={e => setEmployeeSearch(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        autoFocus
                                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                                <div className="max-h-52 overflow-y-auto py-1">
                                    {/* All option */}
                                    <button
                                        onClick={() => {
                                            const newId = '';
                                            setAdminIdFilter(newId);
                                            setEmployeeSearch('');
                                            setShowEmployeeDropdown(false);
                                            setCurrentPage(1);
                                            fetchActivities(1, { action: actionFilter, entity: entityFilter, startDate, endDate, adminId: newId });
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${!adminIdFilter ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                    >
                                        <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">All</span>
                                        All Employees
                                    </button>
                                    {/* Filtered list */}
                                    {users
                                        .filter(u => {
                                            if (!employeeSearch) return true;
                                            const name = `${u.firstname} ${u.lastname}`.toLowerCase();
                                            return name.includes(employeeSearch.toLowerCase());
                                        })
                                        .map(u => (
                                            <button
                                                key={u.staffid}
                                                onClick={() => {
                                                    const newId = String(u.staffid);
                                                    setAdminIdFilter(newId);
                                                    setEmployeeSearch('');
                                                    setShowEmployeeDropdown(false);
                                                    setCurrentPage(1);
                                                    fetchActivities(1, { action: actionFilter, entity: entityFilter, startDate, endDate, adminId: newId });
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                                                    String(adminIdFilter) === String(u.staffid) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                                                }`}
                                            >
                                                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                                    {u.firstname?.[0]}{u.lastname?.[0]}
                                                </span>
                                                <span className="truncate">{u.firstname} {u.lastname}</span>
                                            </button>
                                        ))
                                    }
                                    {users.filter(u => {
                                        if (!employeeSearch) return false;
                                        const name = `${u.firstname} ${u.lastname}`.toLowerCase();
                                        return !name.includes(employeeSearch.toLowerCase());
                                    }).length === users.length && (
                                        <div className="px-3 py-4 text-center text-sm text-gray-400">No employees found</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Page Size */}
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative min-h-[400px]">
                {loading && (
                    <ModernLoader size="container" message="Updating activities..." fullScreen={false} />
                )}
                {activities.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#1e1b4b] text-white">
                                        <tr>
                                            <th className="px-4 py-3 text-left">
                                                <button
                                                    onClick={() => handleSort('createdAt')}
                                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                                >
                                                    Timestamp <TableSortIcon column="createdAt" sortConfig={sortConfig} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                <button
                                                    onClick={() => handleSort('action')}
                                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                                >
                                                    Action <TableSortIcon column="action" sortConfig={sortConfig} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                <button
                                                    onClick={() => handleSort('entity')}
                                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                                >
                                                    Entity <TableSortIcon column="entity" sortConfig={sortConfig} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                <button
                                                    onClick={() => handleSort('performedBy')}
                                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                                >
                                                    Performed By <TableSortIcon column="performedBy" sortConfig={sortConfig} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Description</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">IP Address</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {sortedActivities.map((activity) => (
                                            <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                    {formatInTimezone(activity.createdAt)}
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
                                                <td className="px-4 py-3 text-sm text-gray-700 max-w-sm">
                                                    <div className="whitespace-normal break-words leading-relaxed">
                                                        {formatDescription(activity)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-xs">
                                                    {extractIPv4(activity.ip_address) || <span className="text-gray-400">—</span>}
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
                                <div className="flex gap-2 items-center">
                                    {/* Previous Button */}
                                    <button
                                        onClick={() => fetchActivities(currentPage - 1)}
                                        disabled={currentPage === 1}
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
                                                            onClick={() => fetchActivities(i)}
                                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${currentPage === i
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
                                                        onClick={() => fetchActivities(1)}
                                                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${currentPage === 1
                                                                ? 'bg-blue-600 text-white font-semibold'
                                                                : 'border border-gray-300 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        1
                                                    </button>
                                                );

                                                // Left ellipsis
                                                if (currentPage > 3) {
                                                    pageNumbers.push(
                                                        <span key="left-ellipsis" className="px-2 text-gray-500">
                                                            ...
                                                        </span>
                                                    );
                                                }

                                                // Pages around current
                                                const start = Math.max(2, currentPage - 1);
                                                const end = Math.min(totalPages - 1, currentPage + 1);

                                                for (let i = start; i <= end; i++) {
                                                    pageNumbers.push(
                                                        <button
                                                            key={i}
                                                            onClick={() => fetchActivities(i)}
                                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${currentPage === i
                                                                    ? 'bg-blue-600 text-white font-semibold'
                                                                    : 'border border-gray-300 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            {i}
                                                        </button>
                                                    );
                                                }

                                                // Right ellipsis
                                                if (currentPage < totalPages - 2) {
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
                                                        onClick={() => fetchActivities(totalPages)}
                                                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${currentPage === totalPages
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
        </div>
    );
};

export default Activities;
