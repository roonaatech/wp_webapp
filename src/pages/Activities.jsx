import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { canViewActivities, fetchRoles } from '../utils/roleUtils';
import { formatInTimezone, getCurrentInAppTimezone, formatTimeOnly, formatDateOnly } from '../utils/timezone.util';
import TableSortIcon from '../components/TableSortIcon';
import {
    LuMonitor,
    LuSmartphone,
    LuGlobe,
    LuCirclePlus,
    LuPencil,
    LuTrash2,
    LuCircleCheck,
    LuActivity,
    LuUsers,
    LuLayers,
    LuFilter,
    LuX,
    LuArrowUpRight,
    LuRotateCcw,
    LuCheck
} from 'react-icons/lu';

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

    const handleQuickFilter = (actionVal, entityVal) => {
        const newAction = actionVal !== undefined ? (actionFilter === actionVal ? '' : actionVal) : actionFilter;
        const newEntity = entityVal !== undefined ? (entityFilter === entityVal ? '' : entityVal) : entityFilter;

        if (actionVal !== undefined) setActionFilter(newAction);
        if (entityVal !== undefined) setEntityFilter(newEntity);
        setCurrentPage(1);
        fetchActivities(1, { action: newAction, entity: newEntity, startDate, endDate, adminId: adminIdFilter });
    };

    const handleQuickUserFilter = (userId) => {
        const newAdminId = String(adminIdFilter) === String(userId) ? '' : String(userId);
        setAdminIdFilter(newAdminId);
        setCurrentPage(1);
        fetchActivities(1, { action: actionFilter, entity: entityFilter, startDate, endDate, adminId: newAdminId });
    };

    const getActionBadgeColor = (action) => {
        const colors = {
            'CREATE': 'bg-blue-50 text-blue-700 border-blue-200',
            'UPDATE': 'bg-amber-50 text-amber-700 border-amber-200',
            'UPDATE_PROFILE': 'bg-violet-50 text-violet-700 border-violet-200',
            'DELETE': 'bg-rose-50 text-rose-700 border-rose-200',
            'APPROVE': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'REJECT': 'bg-orange-50 text-orange-700 border-orange-200',
            'LOGIN': 'bg-purple-50 text-purple-700 border-purple-200',
            'LOGOUT': 'bg-slate-100 text-slate-700 border-slate-200',
            'CHECK_IN': 'bg-teal-50 text-teal-700 border-teal-200',
            'CHECK_OUT': 'bg-sky-50 text-sky-700 border-sky-200',
            'BADGE_QR_CHECK_IN': 'bg-teal-50 text-teal-700 border-teal-200',
            'BADGE_QR_CHECK_OUT': 'bg-sky-50 text-sky-700 border-sky-200',
            'KIOSK_CHECK_IN': 'bg-teal-50 text-teal-700 border-teal-200',
            'KIOSK_CHECK_OUT': 'bg-sky-50 text-sky-700 border-sky-200',
            'REGISTER_FACE': 'bg-indigo-50 text-indigo-700 border-indigo-200',
            'REMOVE_FACE': 'bg-rose-50 text-rose-700 border-rose-200',
            'PASSWORD_RESET': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
            'PASSWORD_RESET_REQUESTED': 'bg-pink-50 text-pink-700 border-pink-200',
            'PASSWORD_CHANGE': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
        };
        return colors[action] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const getLoginDevice = (activity) => {
        if (!activity) return null;

        // 1. Check new_values if present
        const newVals = parseValues(activity.new_values);
        if (newVals?.login_device) return newVals.login_device;
        if (newVals?.device) return newVals.device;

        // 2. Check description text
        const desc = activity.description || '';
        if (desc.includes('(Mob App)') || desc.includes('via Mob App')) return 'Mob App';
        if (desc.includes('(Mob Browser)') || desc.includes('via Mob Browser')) return 'Mob Browser';
        if (desc.includes('(Web)') || desc.includes('via Web')) return 'Web';

        // 3. Detect from user agent for LOGIN/LOGOUT
        const ua = activity.user_agent || '';
        if (activity.action === 'LOGIN' || activity.action === 'LOGOUT') {
            if (/Dart|Flutter|WorkPulseMobile/i.test(ua)) return 'Mob App';
            if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mob Browser';
            return 'Web';
        }

        // For other activities, if user agent is known, classify or return null
        if (ua && ua !== 'unknown') {
            if (/Dart|Flutter|WorkPulseMobile/i.test(ua)) return 'Mob App';
            if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mob Browser';
            return 'Web';
        }

        return null;
    };

    const renderDeviceBadge = (activity) => {
        const device = getLoginDevice(activity);
        if (!device) return <span className="text-gray-400">—</span>;

        if (device === 'Mob App') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <LuSmartphone size={12} className="text-emerald-600 shrink-0" />
                    <span>Mob App</span>
                </span>
            );
        }
        if (device === 'Mob Browser') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                    <LuGlobe size={12} className="text-purple-600 shrink-0" />
                    <span>Mob Browser</span>
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
                <LuMonitor size={12} className="text-sky-600 shrink-0" />
                <span>Web</span>
            </span>
        );
    };

    const formatDescription = (activity) => {
        if (!activity.description) return '—';
        if (activity.action === 'APPROVE' && activity.affected_user) {
            const name = `${activity.affected_user.firstname} ${activity.affected_user.lastname}`.trim();
            if (name && !activity.description.toLowerCase().includes('requested by')) {
                return `${activity.description} requested by ${name}`;
            }
        }
        if (activity.action === 'LOGIN') {
            const device = getLoginDevice(activity);
            if (device && !activity.description.includes(`(${device})`) && !activity.description.includes(`via ${device}`)) {
                return `${activity.description} (${device})`;
            }
        }
        return activity.description;
    };

    // Human-readable labels for audited fields
    const CHANGE_FIELD_LABELS = {
        date: 'Date',
        check_in_time: 'Check-In',
        check_out_time: 'Check-Out'
    };

    const formatChangeValue = (key, value) => {
        if (value === null || value === undefined || value === '') return '—';
        if (key === 'date') return formatDateOnly(value);
        if (key === 'check_in_time' || key === 'check_out_time') return formatTimeOnly(value);
        return String(value);
    };

    // JSON columns may arrive parsed or as a raw string depending on the driver
    const parseValues = (val) => {
        if (!val) return null;
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return null; }
        }
        return val;
    };

    // Render "field: old → new" lines for entries that captured before/after values
    const renderChanges = (activity) => {
        const oldValues = parseValues(activity.old_values);
        const newValues = parseValues(activity.new_values);
        if (!newValues || typeof newValues !== 'object') return null;

        const changes = Object.keys(newValues)
            .map((key) => {
                const before = formatChangeValue(key, oldValues ? oldValues[key] : undefined);
                const after = formatChangeValue(key, newValues[key]);
                if (before === after) return null; // skip unchanged fields
                return { key, label: CHANGE_FIELD_LABELS[key] || key, before, after };
            })
            .filter(Boolean);

        if (changes.length === 0) return null;

        return (
            <div className="mt-1.5 space-y-0.5">
                {changes.map((c) => (
                    <div key={c.key} className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-600">{c.label}:</span>
                        <span className="line-through text-rose-500">{c.before}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-emerald-600">{c.after}</span>
                    </div>
                ))}
            </div>
        );
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
            'User': 'bg-indigo-50 text-indigo-700 border-indigo-200',
            'Role': 'bg-violet-50 text-violet-700 border-violet-200',
            'LeaveRequest': 'bg-blue-50 text-blue-700 border-blue-200',
            'OnDutyLog': 'bg-purple-50 text-purple-700 border-purple-200',
            'TimeOffRequest': 'bg-orange-50 text-orange-700 border-orange-200',
            'LeaveType': 'bg-cyan-50 text-cyan-700 border-cyan-200',
            'UserLeaveType': 'bg-cyan-50 text-cyan-700 border-cyan-200',
            'Approval': 'bg-green-50 text-green-700 border-green-200',
            'Setting': 'bg-yellow-50 text-yellow-700 border-yellow-200',
            'AttendanceLog': 'bg-teal-50 text-teal-700 border-teal-200',
            'ApkVersion': 'bg-amber-50 text-amber-700 border-amber-200',
            'EmailConfig': 'bg-sky-50 text-sky-700 border-sky-200',
            'EmailTemplate': 'bg-sky-50 text-sky-700 border-sky-200',
            'DeviceViolation': 'bg-rose-50 text-rose-700 border-rose-200',
            'UserOnboarding': 'bg-pink-50 text-pink-700 border-pink-200',
            'UserDeclaration': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'BirthdayWish': 'bg-pink-50 text-pink-700 border-pink-200',
            'AnniversaryWish': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
            'ServiceAccount': 'bg-slate-100 text-slate-700 border-slate-200'
        };
        return colors[entity] || 'bg-gray-100 text-gray-700 border-gray-200';
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

    // Compute summary numbers safely
    const writeCount = summary?.crudSummary?.writeCount ?? (summary?.actionCounts?.find(a => a.action === 'CREATE')?.count || 0);
    const updateCount = summary?.crudSummary?.updateCount ?? ((summary?.actionCounts?.find(a => a.action === 'UPDATE')?.count || 0) + (summary?.actionCounts?.find(a => a.action === 'UPDATE_PROFILE')?.count || 0));
    const deleteCount = summary?.crudSummary?.deleteCount ?? (summary?.actionCounts?.find(a => a.action === 'DELETE')?.count || 0);
    const approvalCount = summary?.crudSummary?.approvalCount ?? ((summary?.actionCounts?.find(a => a.action === 'APPROVE')?.count || 0) + (summary?.actionCounts?.find(a => a.action === 'REJECT')?.count || 0));
    const hasActiveFilters = Boolean(actionFilter || entityFilter || adminIdFilter || startDate || endDate);

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
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                    >
                        <LuActivity size={16} />
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
                <div className="bg-gradient-to-b from-gray-50/60 to-white rounded-2xl border border-gray-200/90 shadow-2xs p-5 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <LuActivity className="text-blue-600" size={18} />
                                Operations & Activity Overview
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Interactive breakdown of system operations. Click any KPI card or list item to filter logs below.
                            </p>
                        </div>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors w-fit shadow-2xs"
                            >
                                <LuRotateCcw size={12} />
                                Reset Filter ({[actionFilter, entityFilter, adminIdFilter, startDate, endDate].filter(Boolean).length})
                            </button>
                        )}
                    </div>

                    {/* Row 1: KPI Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                        {/* Write Card */}
                        <button
                            type="button"
                            onClick={() => handleQuickFilter('CREATE')}
                            className={`p-4 rounded-xl border text-left transition-all duration-150 shadow-2xs relative overflow-hidden group cursor-pointer ${
                                actionFilter === 'CREATE'
                                    ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                                    : 'bg-white hover:bg-blue-50/40 border-gray-200 hover:border-blue-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                    <LuCirclePlus size={18} />
                                </span>
                                {actionFilter === 'CREATE' ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
                                        Active <LuX size={10} />
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                        Filter <LuArrowUpRight size={11} />
                                    </span>
                                )}
                            </div>
                            <div className="mt-3">
                                <div className="text-2xl font-bold text-gray-900 tracking-tight">
                                    {writeCount.toLocaleString()}
                                </div>
                                <div className="text-xs font-bold text-blue-700 mt-0.5">
                                    Write (CREATE)
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">New records created</p>
                            </div>
                        </button>

                        {/* Update Card */}
                        <button
                            type="button"
                            onClick={() => handleQuickFilter('UPDATE')}
                            className={`p-4 rounded-xl border text-left transition-all duration-150 shadow-2xs relative overflow-hidden group cursor-pointer ${
                                actionFilter === 'UPDATE'
                                    ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/20 shadow-sm'
                                    : 'bg-white hover:bg-amber-50/40 border-gray-200 hover:border-amber-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="p-2 rounded-lg bg-amber-100 text-amber-700">
                                    <LuPencil size={18} />
                                </span>
                                {actionFilter === 'UPDATE' ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white flex items-center gap-1">
                                        Active <LuX size={10} />
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                        Filter <LuArrowUpRight size={11} />
                                    </span>
                                )}
                            </div>
                            <div className="mt-3">
                                <div className="text-2xl font-bold text-gray-900 tracking-tight">
                                    {updateCount.toLocaleString()}
                                </div>
                                <div className="text-xs font-bold text-amber-700 mt-0.5">
                                    Update (UPDATE)
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">Modifications & edits</p>
                            </div>
                        </button>

                        {/* Delete Card */}
                        <button
                            type="button"
                            onClick={() => handleQuickFilter('DELETE')}
                            className={`p-4 rounded-xl border text-left transition-all duration-150 shadow-2xs relative overflow-hidden group cursor-pointer ${
                                actionFilter === 'DELETE'
                                    ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-500/20 shadow-sm'
                                    : 'bg-white hover:bg-rose-50/40 border-gray-200 hover:border-rose-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="p-2 rounded-lg bg-rose-100 text-rose-700">
                                    <LuTrash2 size={18} />
                                </span>
                                {actionFilter === 'DELETE' ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1">
                                        Active <LuX size={10} />
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                        Filter <LuArrowUpRight size={11} />
                                    </span>
                                )}
                            </div>
                            <div className="mt-3">
                                <div className="text-2xl font-bold text-gray-900 tracking-tight">
                                    {deleteCount.toLocaleString()}
                                </div>
                                <div className="text-xs font-bold text-rose-700 mt-0.5">
                                    Delete (DELETE)
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">Records removed</p>
                            </div>
                        </button>

                        {/* Decisions Card */}
                        <button
                            type="button"
                            onClick={() => handleQuickFilter('APPROVE')}
                            className={`p-4 rounded-xl border text-left transition-all duration-150 shadow-2xs relative overflow-hidden group cursor-pointer ${
                                actionFilter === 'APPROVE'
                                    ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm'
                                    : 'bg-white hover:bg-emerald-50/40 border-gray-200 hover:border-emerald-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                                    <LuCircleCheck size={18} />
                                </span>
                                {actionFilter === 'APPROVE' ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                                        Active <LuX size={10} />
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                        Filter <LuArrowUpRight size={11} />
                                    </span>
                                )}
                            </div>
                            <div className="mt-3">
                                <div className="text-2xl font-bold text-gray-900 tracking-tight">
                                    {approvalCount.toLocaleString()}
                                </div>
                                <div className="text-xs font-bold text-emerald-700 mt-0.5">
                                    Approvals & Decisions
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">Leaves & approvals</p>
                            </div>
                        </button>

                        {/* Total Card */}
                        <button
                            type="button"
                            onClick={() => {
                                setActionFilter('');
                                fetchActivities(1, { action: '', entity: entityFilter, startDate, endDate, adminId: adminIdFilter });
                            }}
                            className={`p-4 rounded-xl border text-left transition-all duration-150 shadow-2xs relative overflow-hidden group cursor-pointer ${
                                !actionFilter
                                    ? 'bg-gradient-to-br from-indigo-50 to-blue-50/70 border-indigo-200 shadow-sm'
                                    : 'bg-white hover:bg-indigo-50/30 border-gray-200 hover:border-indigo-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                                    <LuActivity size={18} />
                                </span>
                                {!actionFilter && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                        All Actions
                                    </span>
                                )}
                            </div>
                            <div className="mt-3">
                                <div className="text-2xl font-bold text-indigo-900 tracking-tight">
                                    {totalCount.toLocaleString()}
                                </div>
                                <div className="text-xs font-bold text-indigo-700 mt-0.5">
                                    Total Activities
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">In selected range</p>
                            </div>
                        </button>
                    </div>

                    {/* Row 2: Detailed Breakdown Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* All Actions Breakdown */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4 flex flex-col">
                            <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                                        <LuLayers size={15} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-gray-900">All Logged Actions</h3>
                                        <p className="text-[11px] text-gray-400">Click to filter by action</p>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {summary.actionCounts?.length || 0}
                                </span>
                            </div>

                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {summary.actionCounts && summary.actionCounts.length > 0 ? (
                                    summary.actionCounts.map((item) => {
                                        const isSelected = actionFilter === item.action;
                                        return (
                                            <button
                                                key={item.action}
                                                type="button"
                                                onClick={() => handleQuickFilter(item.action)}
                                                className={`w-full flex justify-between items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-blue-50 text-blue-900 font-semibold ring-1 ring-blue-300'
                                                        : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border truncate ${getActionBadgeColor(item.action)}`}>
                                                        {item.action}
                                                    </span>
                                                    {isSelected && <LuCheck size={12} className="text-blue-600 shrink-0" />}
                                                </div>
                                                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-blue-200/70 text-blue-900' : 'bg-gray-100 text-gray-700'}`}>
                                                    {item.count}
                                                </span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-gray-400 py-4 text-center">No action records found</div>
                                )}
                            </div>
                        </div>

                        {/* Entities Breakdown */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4 flex flex-col">
                            <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-purple-50 text-purple-600">
                                        <LuLayers size={15} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-gray-900">Modified Entities</h3>
                                        <p className="text-[11px] text-gray-400">Click to filter by entity</p>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {summary.entityCounts?.length || 0}
                                </span>
                            </div>

                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {summary.entityCounts && summary.entityCounts.length > 0 ? (
                                    summary.entityCounts.map((item) => {
                                        const isSelected = entityFilter === item.entity;
                                        return (
                                            <button
                                                key={item.entity}
                                                type="button"
                                                onClick={() => handleQuickFilter(undefined, item.entity)}
                                                className={`w-full flex justify-between items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-purple-50 text-purple-900 font-semibold ring-1 ring-purple-300'
                                                        : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border truncate ${getEntityBadgeColor(item.entity)}`}>
                                                        {item.entity}
                                                    </span>
                                                    {isSelected && <LuCheck size={12} className="text-purple-600 shrink-0" />}
                                                </div>
                                                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-purple-200/70 text-purple-900' : 'bg-gray-100 text-gray-700'}`}>
                                                    {item.count}
                                                </span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-gray-400 py-4 text-center">No entity records found</div>
                                )}
                            </div>
                        </div>

                        {/* Top Active Users */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4 flex flex-col">
                            <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                                        <LuUsers size={15} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-gray-900">Top Active Users</h3>
                                        <p className="text-[11px] text-gray-400">Click to filter by user</p>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {summary.topUsers?.length || 0}
                                </span>
                            </div>

                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {summary.topUsers && summary.topUsers.length > 0 ? (
                                    summary.topUsers.map((item) => {
                                        const isSelected = String(adminIdFilter) === String(item.admin_id);
                                        const userObj = item.user;
                                        const displayName = userObj
                                            ? `${userObj.firstname} ${userObj.lastname}`.trim()
                                            : `Staff #${item.admin_id}`;
                                        const initials = userObj
                                            ? `${userObj.firstname?.[0] || ''}${userObj.lastname?.[0] || ''}`.toUpperCase()
                                            : `#${item.admin_id}`;

                                        return (
                                            <button
                                                key={item.admin_id}
                                                type="button"
                                                onClick={() => handleQuickUserFilter(item.admin_id)}
                                                className={`w-full flex justify-between items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-300'
                                                        : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
                                                        {initials || 'U'}
                                                    </span>
                                                    <div className="truncate">
                                                        <div className="font-medium text-gray-900 truncate flex items-center gap-1">
                                                            {displayName}
                                                            {isSelected && <LuCheck size={12} className="text-emerald-600 shrink-0" />}
                                                        </div>
                                                        {userObj?.role && (
                                                            <div className="text-[10px] text-gray-400 capitalize truncate">
                                                                {userObj.role}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ml-2 ${isSelected ? 'bg-emerald-200/70 text-emerald-900' : 'bg-gray-100 text-gray-700'}`}>
                                                    {item.count}
                                                </span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-gray-400 py-4 text-center">No active users recorded</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <LuFilter size={18} className="text-gray-500" />
                        Filters
                    </h3>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <LuRotateCcw size={12} />
                            Reset All Filters
                        </button>
                    )}
                </div>

                {/* Active Filter Pills */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg text-xs mb-4">
                        <span className="font-semibold text-blue-900 flex items-center gap-1 shrink-0">
                            Active:
                        </span>
                        {actionFilter && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 font-medium shadow-2xs">
                                Action: <strong className="font-bold">{actionFilter}</strong>
                                <button type="button" onClick={() => handleQuickFilter(actionFilter)} className="hover:text-rose-600 transition-colors cursor-pointer">
                                    <LuX size={12} />
                                </button>
                            </span>
                        )}
                        {entityFilter && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 font-medium shadow-2xs">
                                Entity: <strong className="font-bold">{entityFilter}</strong>
                                <button type="button" onClick={() => handleQuickFilter(undefined, entityFilter)} className="hover:text-rose-600 transition-colors cursor-pointer">
                                    <LuX size={12} />
                                </button>
                            </span>
                        )}
                        {adminIdFilter && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 font-medium shadow-2xs">
                                User: <strong className="font-bold">{users.find(u => String(u.staffid) === String(adminIdFilter)) ? `${users.find(u => String(u.staffid) === String(adminIdFilter)).firstname} ${users.find(u => String(u.staffid) === String(adminIdFilter)).lastname}` : `ID #${adminIdFilter}`}</strong>
                                <button type="button" onClick={() => handleQuickUserFilter(adminIdFilter)} className="hover:text-rose-600 transition-colors cursor-pointer">
                                    <LuX size={12} />
                                </button>
                            </span>
                        )}
                        {startDate && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 font-medium shadow-2xs">
                                From: <strong className="font-bold">{startDate}</strong>
                                <button type="button" onClick={() => { setStartDate(''); fetchActivities(1, { action: actionFilter, entity: entityFilter, startDate: '', endDate, adminId: adminIdFilter }); fetchSummary({ startDate: '', endDate }); }} className="hover:text-rose-600 transition-colors cursor-pointer">
                                    <LuX size={12} />
                                </button>
                            </span>
                        )}
                        {endDate && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 font-medium shadow-2xs">
                                To: <strong className="font-bold">{endDate}</strong>
                                <button type="button" onClick={() => { setEndDate(''); fetchActivities(1, { action: actionFilter, entity: entityFilter, startDate, endDate: '', adminId: adminIdFilter }); fetchSummary({ startDate, endDate: '' }); }} className="hover:text-rose-600 transition-colors cursor-pointer">
                                    <LuX size={12} />
                                </button>
                            </span>
                        )}
                    </div>
                )}

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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                        >
                            <option value="">All Actions</option>

                            <optgroup label="Data Modifications (CRUD)">
                                <option value="CREATE">CREATE (Write / Add)</option>
                                <option value="UPDATE">UPDATE (Edit / Modify)</option>
                                <option value="DELETE">DELETE (Remove)</option>
                                <option value="UPDATE_PROFILE">UPDATE PROFILE</option>
                            </optgroup>

                            <optgroup label="Approvals & Decisions">
                                <option value="APPROVE">APPROVE</option>
                                <option value="REJECT">REJECT</option>
                            </optgroup>

                            <optgroup label="Attendance & Kiosk">
                                <option value="CHECK_IN">CHECK IN</option>
                                <option value="CHECK_OUT">CHECK OUT</option>
                                <option value="BADGE_QR_CHECK_IN">BADGE QR CHECK IN</option>
                                <option value="BADGE_QR_CHECK_OUT">BADGE QR CHECK OUT</option>
                                <option value="KIOSK_CHECK_IN">KIOSK CHECK IN</option>
                                <option value="KIOSK_CHECK_OUT">KIOSK CHECK OUT</option>
                                <option value="REGISTER_FACE">REGISTER FACE</option>
                                <option value="REMOVE_FACE">REMOVE FACE</option>
                            </optgroup>

                            <optgroup label="Authentication & Security">
                                <option value="LOGIN">LOGIN</option>
                                <option value="LOGOUT">LOGOUT</option>
                                <option value="PASSWORD_RESET">PASSWORD RESET</option>
                                <option value="PASSWORD_RESET_REQUESTED">PASSWORD RESET REQUESTED</option>
                                <option value="PASSWORD_CHANGE">PASSWORD CHANGE</option>
                            </optgroup>

                            {/* Dynamic optgroup for any other action logged */}
                            {summary?.actionCounts && (() => {
                                const standardActions = new Set([
                                    'CREATE', 'UPDATE', 'DELETE', 'UPDATE_PROFILE',
                                    'APPROVE', 'REJECT',
                                    'CHECK_IN', 'CHECK_OUT', 'BADGE_QR_CHECK_IN', 'BADGE_QR_CHECK_OUT', 'KIOSK_CHECK_IN', 'KIOSK_CHECK_OUT', 'REGISTER_FACE', 'REMOVE_FACE',
                                    'LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_CHANGE'
                                ]);
                                const otherActions = summary.actionCounts.filter(a => a.action && !standardActions.has(a.action));
                                if (otherActions.length === 0) return null;
                                return (
                                    <optgroup label="Other Logged Actions">
                                        {otherActions.map(a => (
                                            <option key={a.action} value={a.action}>{a.action} ({a.count})</option>
                                        ))}
                                    </optgroup>
                                );
                            })()}
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                        >
                            <option value="">All Entities</option>

                            <optgroup label="Core & Organization">
                                <option value="User">User</option>
                                <option value="Role">Role & Permissions</option>
                                <option value="UserOnboarding">User Onboarding</option>
                                <option value="UserDeclaration">User Declaration</option>
                            </optgroup>

                            <optgroup label="Attendance & Leaves">
                                <option value="AttendanceLog">Attendance Log</option>
                                <option value="LeaveRequest">Leave Request</option>
                                <option value="OnDutyLog">On-Duty Log</option>
                                <option value="TimeOffRequest">Time-Off Request</option>
                                <option value="LeaveType">Leave Type</option>
                                <option value="UserLeaveType">User Leave Policy</option>
                                <option value="Approval">Approval Decision</option>
                            </optgroup>

                            <optgroup label="System & Administration">
                                <option value="Setting">System Setting</option>
                                <option value="ApkVersion">APK App Version</option>
                                <option value="EmailConfig">Email Configuration</option>
                                <option value="EmailTemplate">Email Template</option>
                                <option value="DeviceViolation">Device Violation</option>
                                <option value="BirthdayWish">Birthday Wish</option>
                                <option value="AnniversaryWish">Anniversary Wish</option>
                                <option value="ServiceAccount">Service Account</option>
                            </optgroup>

                            {/* Dynamic optgroup for any other entity logged */}
                            {summary?.entityCounts && (() => {
                                const standardEntities = new Set([
                                    'User', 'Role', 'UserOnboarding', 'UserDeclaration',
                                    'AttendanceLog', 'LeaveRequest', 'OnDutyLog', 'TimeOffRequest', 'LeaveType', 'UserLeaveType', 'Approval',
                                    'Setting', 'ApkVersion', 'EmailConfig', 'EmailTemplate', 'DeviceViolation', 'BirthdayWish', 'AnniversaryWish', 'ServiceAccount'
                                ]);
                                const otherEntities = summary.entityCounts.filter(e => e.entity && !standardEntities.has(e.entity));
                                if (otherEntities.length === 0) return null;
                                return (
                                    <optgroup label="Other Logged Entities">
                                        {otherEntities.map(e => (
                                            <option key={e.entity} value={e.entity}>{e.entity} ({e.count})</option>
                                        ))}
                                    </optgroup>
                                );
                            })()}
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
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Device</th>
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
                                                <td className="px-4 py-3 text-sm whitespace-nowrap">
                                                    {renderDeviceBadge(activity)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 max-w-sm">
                                                    <div className="whitespace-normal break-words leading-relaxed">
                                                        {formatDescription(activity)}
                                                    </div>
                                                    {renderChanges(activity)}
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
