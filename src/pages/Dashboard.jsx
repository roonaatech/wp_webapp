import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../hide-scrollbar.css';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import OnDutyLocationMap from '../components/OnDutyLocationMap';
import { calculateLeaveDays, formatLeaveDuration } from '../utils/dateUtils';
import { formatInTimezone, formatTimeOnly, formatDateOnly, getCurrentInAppTimezone, parseAppTimezone } from '../utils/timezone.util';
import { canApproveLeave, canApproveOnDuty, canManageUsers, canViewBirthdays, canViewAnniversaries, canViewDashboard, fetchRoles } from '../utils/roleUtils';
import {
    FiAlertTriangle, FiGift, FiSend, FiAward, FiCalendar, FiZap,
    FiFileText, FiMapPin, FiClock, FiAlertCircle, FiRadio, FiSearch,
    FiShield, FiSlash, FiUsers, FiTrendingUp, FiCheckCircle, FiActivity,
    FiLayers, FiFilter, FiChevronRight, FiCamera, FiUserCheck, FiUserPlus,
    FiBriefcase, FiRefreshCw
} from 'react-icons/fi';
import { LuSparkles, LuLayoutDashboard, LuBuilding2, LuLaptop, LuCalendarDays } from 'react-icons/lu';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

const Dashboard = () => {
    // Approve/Reject API call for pending approvals
    const performStatusUpdate = async (item, status, isLeave, rejectionReason = null) => {
        const typeKey = item.type === 'leave' ? 'leave' : (item.type === 'time_off' ? 'timeoff' : 'onduty');
        const itemKey = `${typeKey}-${item.id}-${status}`;
        setProcessingId(itemKey);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setModalError('No authentication token found.');
                setProcessingId(null);
                return;
            }

            let endpoint = '';
            if (item.type === 'leave') {
                endpoint = `${API_BASE_URL}/api/leave/${item.id}/status`;
            } else if (item.type === 'time_off') {
                endpoint = `${API_BASE_URL}/api/timeoff/${item.id}/status`;
            } else {
                endpoint = `${API_BASE_URL}/api/onduty/${item.id}/status`;
            }

            let statusStr = 'Pending';
            if (status === 'approved') statusStr = 'Approved';
            else if (status === 'rejected') statusStr = 'Rejected';

            const requestBody = { status: statusStr };
            if (statusStr === 'Rejected' && rejectionReason) {
                requestBody.rejection_reason = rejectionReason;
            }

            await axios.put(endpoint, requestBody, { headers: { 'x-access-token': token } });

            // Remove from local state
            setPendingApprovals(prev => prev.filter(a => a.id !== item.id));

            // Close modals
            setApproveModal({ show: false, item: null, isLeave: false });
            setRejectModal({ show: false, item: null, isLeave: false, reason: '' });
            setModalError('');

            // Refresh stats
            fetchDashboardStats();
            const typeLabel = item.type === 'leave' ? 'leave' : (item.type === 'time_off' ? 'time-off' : 'on-duty');
            const employeeName = item.name || 'Request';
            toast.success(`${employeeName}'s ${typeLabel} ${statusStr.toLowerCase()} successfully`, {
                style: {
                    background: statusStr === 'Approved' ? '#059669' : '#dc2626',
                    color: '#fff'
                }
            });
        } catch (error) {
            console.error('Error updating status:', error);
            const errorMsg = error.response?.data?.message || 'Failed to update request';
            setModalError(errorMsg);
        } finally {
            setProcessingId(null);
        }
    };

    // Show approve modal for quick approve
    const handleApprove = (item, isLeave) => {
        setApproveModal({ show: true, item, isLeave });
        setModalError('');
    };

    // Show reject modal for quick reject
    const handleReject = (item, isLeave) => {
        setRejectModal({ show: true, item, isLeave, reason: '' });
        setModalError('');
    };

    // Modal state for approve/reject actions
    const [approveModal, setApproveModal] = useState({ show: false, item: null, isLeave: false });
    const [rejectModal, setRejectModal] = useState({ show: false, item: null, isLeave: false, reason: '' });
    const [detailsModal, setDetailsModal] = useState({ show: false, item: null, isLeave: false });
    const [modalError, setModalError] = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [, setSettingsVersion] = useState(0);

    // Active Dashboard Lens (Filter view for HR & Leadership)
    // 'overview' | 'workforce' | 'attendance' | 'leaves'
    const [activeLens, setActiveLens] = useState('overview');

    // Work Mode Filter: 'all' | 'Office' | 'Work from home' | 'Hybrid'
    const [workModeFilter, setWorkModeFilter] = useState('all');

    // Chart metric view: 'all' | 'attendance' | 'approvals'
    const [chartMetric, setChartMetric] = useState('all');

    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const onSettingsLoaded = () => setSettingsVersion(v => v + 1);
        window.addEventListener('settingsLoaded', onSettingsLoaded);
        return () => window.removeEventListener('settingsLoaded', onSettingsLoaded);
    }, []);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Open details modal when clicking a card
    const handleOpenDetails = (item, isLeave) => {
        setDetailsModal({
            show: true,
            item: item,
            isLeave: isLeave
        });
    };

    const [stats, setStats] = useState({
        totalUsers: 0,
        usersTrend: 0,
        presentToday: 0,
        presentYesterday: 0,
        presentTrend: 0,
        onDuty: 0,
        pendingLeaves: 0,
        approvedLeaves: 0,
        rejectedLeaves: 0,
        pendingOnDuty: 0,
        approvedOnDuty: 0,
        rejectedOnDuty: 0,
        activeOnDuty: 0,
        pendingTimeOff: 0,
        approvedTimeOff: 0,
        rejectedTimeOff: 0,
        workforce: null
    });

    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [trendLoading, setTrendLoading] = useState(false);
    const [error, setError] = useState(null);
    const [trendDuration, setTrendDuration] = useState(7); // Default 7 days
    const [trendStartDate, setTrendStartDate] = useState(null); // Custom start date
    const [trendEndDate, setTrendEndDate] = useState(null); // Custom end date
    const [showCustomDateRange, setShowCustomDateRange] = useState(false); // Toggle custom date range
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [pendingApprovalsLoading, setPendingApprovalsLoading] = useState(false);
    const [incompleteProfiles, setIncompleteProfiles] = useState([]);
    const [onLeaveData, setOnLeaveData] = useState({ today: [], tomorrow: [], today_date: '', tomorrow_date: '' });
    const [onLeaveLoading, setOnLeaveLoading] = useState(false);
    const [onLeaveDetailModal, setOnLeaveDetailModal] = useState({ show: false, emp: null, dayLabel: '' });
    const [birthdays, setBirthdays] = useState([]);
    const [birthdaysLoading, setBirthdaysLoading] = useState(false);
    const [sendingWish, setSendingWish] = useState(null);
    const [anniversaries, setAnniversaries] = useState([]);
    const [anniversariesLoading, setAnniversariesLoading] = useState(false);
    const [sendingAnniversaryWish, setSendingAnniversaryWish] = useState(null);
    const [holidays, setHolidays] = useState([]);

    const scrollContainerRef = useRef(null);

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
    };

    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasDashboardPermission, setHasDashboardPermission] = useState(false);

    useEffect(() => {
        const initDashboard = async () => {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            try {
                // Force-fetch fresh roles from backend to reflect permission changes immediately
                await fetchRoles(true);
                const allowed = canViewDashboard(user.role);
                setHasDashboardPermission(allowed);

                if (allowed) {
                    // Fetch stats and approval items only if role has permission
                    fetchDashboardStats();
                    fetchPendingApprovals();
                    fetchHolidays();

                    if (canManageUsers(user.role)) {
                        fetchIncompleteProfiles();
                    }
                    if (canApproveLeave(user.role)) {
                        fetchOnLeaveData();
                    }
                    if (canViewBirthdays(user.role)) {
                        fetchBirthdays();
                    }
                    if (canViewAnniversaries(user.role)) {
                        fetchAnniversaries();
                    }
                } else {
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error initializing dashboard permissions:', err);
                setLoading(false);
            } finally {
                setPermissionChecked(true);
            }
        };

        initDashboard();

        const handleRolesUpdated = async () => {
            try {
                await fetchRoles(true);
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const allowed = canViewDashboard(user.role);
                setHasDashboardPermission(allowed);
                if (!allowed) {
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error refreshing roles on event:', err);
            }
        };

        window.addEventListener('rolesUpdated', handleRolesUpdated);
        return () => window.removeEventListener('rolesUpdated', handleRolesUpdated);
    }, []);

    useEffect(() => {
        if (hasDashboardPermission) {
            fetchTrendData(trendDuration);
        }
    }, [trendDuration, hasDashboardPermission]);

    const fetchHolidays = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_BASE_URL}/api/holidays`, {
                headers: { 'x-access-token': token }
            });
            const list = Array.isArray(res.data) ? res.data : (res.data.holidays || []);
            const todayStr = getCurrentInAppTimezone().date || new Date().toISOString().split('T')[0];
            const upcoming = list
                .filter(h => (h.status === 1 || h.status === true) && h.holiday_date >= todayStr)
                .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
                .slice(0, 4);
            setHolidays(upcoming);
        } catch (e) {
            console.error('Error fetching holidays:', e);
        }
    };

    const fetchIncompleteProfiles = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get(`${API_BASE_URL}/api/admin/incomplete-profiles`, {
                headers: { 'x-access-token': token }
            });
            setIncompleteProfiles(response.data);
        } catch (error) {
            console.error('Error fetching incomplete profiles:', error);
        }
    };

    const fetchOnLeaveData = async () => {
        try {
            setOnLeaveLoading(true);
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get(`${API_BASE_URL}/api/leave/on-leave`, {
                headers: { 'x-access-token': token }
            });
            setOnLeaveData(response.data);
        } catch (error) {
            console.error('Error fetching on-leave status:', error);
        } finally {
            setOnLeaveLoading(false);
        }
    };

    const fetchBirthdays = async () => {
        try {
            setBirthdaysLoading(true);
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get(`${API_BASE_URL}/api/admin/dashboard/birthdays`, {
                headers: { 'x-access-token': token }
            });
            setBirthdays(response.data.birthdays || []);
        } catch (error) {
            console.error('Error fetching birthdays:', error);
        } finally {
            setBirthdaysLoading(false);
        }
    };

    const fetchAnniversaries = async () => {
        try {
            setAnniversariesLoading(true);
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get(`${API_BASE_URL}/api/admin/dashboard/anniversaries`, {
                headers: { 'x-access-token': token }
            });
            setAnniversaries(response.data.anniversaries || []);
        } catch (error) {
            console.error('Error fetching anniversaries:', error);
        } finally {
            setAnniversariesLoading(false);
        }
    };

    const fetchTrendData = async (days, startDate = null, endDate = null) => {
        try {
            setTrendLoading(true);
            const token = localStorage.getItem('token');
            if (!token) return;

            let url = `${API_BASE_URL}/api/admin/dashboard/daily-trend`;
            if (startDate && endDate) {
                url += `?startDate=${startDate}&endDate=${endDate}`;
            } else {
                url += `?days=${days}`;
            }

            const response = await axios.get(url, {
                headers: { 'x-access-token': token }
            });
            setTrendData(response.data);
        } catch (error) {
            console.error('Error fetching trend data:', error.message);
        } finally {
            setTrendLoading(false);
        }
    };

    const fetchDashboardStats = async (isManualRefresh = false) => {
        try {
            if (isManualRefresh) setIsRefreshing(true);
            else setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found. Please login first.');
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/api/admin/dashboard/stats`, {
                headers: { 'x-access-token': token }
            });

            const cleanedData = {
                totalUsers: Number(response.data.totalUsers) || 0,
                usersTrend: Number(response.data.usersTrend) || 0,
                presentToday: Number(response.data.presentToday) || 0,
                presentYesterday: Number(response.data.presentYesterday) || 0,
                presentTrend: Number(response.data.presentTrend) || 0,
                onDuty: Number(response.data.onDuty) || 0,
                pendingLeaves: Number(response.data.pendingLeaves) || 0,
                approvedLeaves: Number(response.data.approvedLeaves) || 0,
                rejectedLeaves: Number(response.data.rejectedLeaves) || 0,
                pendingOnDuty: Number(response.data.pendingOnDuty) || 0,
                approvedOnDuty: Number(response.data.approvedOnDuty) || 0,
                rejectedOnDuty: Number(response.data.rejectedOnDuty) || 0,
                activeOnDuty: Number(response.data.activeOnDuty) || 0,
                pendingTimeOff: Number(response.data.pendingTimeOff) || 0,
                approvedTimeOff: Number(response.data.approvedTimeOff) || 0,
                rejectedTimeOff: Number(response.data.rejectedTimeOff) || 0,
                workforce: response.data.workforce || null
            };
            setStats(cleanedData);

            if (isManualRefresh) {
                toast.success('Dashboard metrics refreshed');
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            setError(error.response?.data?.message || error.message || 'Failed to fetch dashboard stats');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleRefreshAll = () => {
        fetchDashboardStats(true);
        fetchTrendData(trendDuration, trendStartDate, trendEndDate);
        fetchPendingApprovals();
        fetchOnLeaveData();
        fetchHolidays();
    };

    const fetchPendingApprovals = async () => {
        try {
            setPendingApprovalsLoading(true);
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (!token) return;

            const hasLeavePermission = canApproveLeave(user.role);
            const hasOnDutyPermission = canApproveOnDuty(user.role);

            if (!hasLeavePermission && !hasOnDutyPermission) {
                setPendingApprovals([]);
                setPendingApprovalsLoading(false);
                return;
            }

            const response = await axios.get(
                `${API_BASE_URL}/api/leave/requests?status=Pending&page=1&limit=8`,
                { headers: { 'x-access-token': token } }
            );

            const allRequests = response.data.items || [];
            const pendingItems = allRequests.map(item => {
                let name = 'Unknown';
                if (item.tblstaff) {
                    if (item.tblstaff.firstname && item.tblstaff.lastname) {
                        name = `${item.tblstaff.firstname} ${item.tblstaff.lastname}`;
                    } else if (item.tblstaff.name) {
                        name = item.tblstaff.name;
                    } else if (item.tblstaff.firstname) {
                        name = item.tblstaff.firstname;
                    }
                }
                return {
                    id: item.id,
                    type: item.type,
                    name: name,
                    staff_id: item.staff_id,
                    title: item.type === 'leave' ? item.title : (item.type === 'time_off' ? 'Time-Off' : item.title.replace('On-Duty: ', '')),
                    start_date: item.start_date,
                    end_date: item.end_date,
                    is_half_day: item.is_half_day,
                    status: item.status,
                    createdAt: item.createdAt,
                    reason: item.reason,
                    purpose: item.purpose,
                    start_time: item.start_time,
                    end_time: item.end_time,
                    location: item.location,
                    start_lat: item.start_lat,
                    start_long: item.start_long,
                    end_lat: item.end_lat,
                    end_long: item.end_long,
                    date: item.date
                };
            });

            setPendingApprovals(pendingItems);
        } catch (error) {
            console.error('Error fetching pending approvals:', error);
        } finally {
            setPendingApprovalsLoading(false);
        }
    };

    const calculateTimeOffDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return '-';
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const start = startH * 60 + startM;
        const end = endH * 60 + endM;
        const diff = end - start;
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const formatDateForModal = (item) => {
        if (!item) return 'N/A';
        if (item.type === 'time_off') {
            const date = item.date ? formatDateOnly(item.date) : '';
            const startTime = item.start_time ? formatTimeOnly(item.start_time) : '';
            const endTime = item.end_time ? formatTimeOnly(item.end_time) : '';
            const duration = calculateTimeOffDuration(item.start_time, item.end_time);

            return (
                <span>
                    {startTime} - {endTime} (On {date}) <span className="text-red-600 font-bold ml-1">({duration})</span>
                </span>
            );
        }

        if (item.type === 'leave') {
            const startFormatted = formatDateOnly(item.start_date);
            const endFormatted = formatDateOnly(item.end_date);
            const daysCount = calculateLeaveDays(item.start_date, item.end_date) - (item.is_half_day === true || item.is_half_day === 1 ? 0.5 : 0);
            const daysText = formatLeaveDuration(daysCount, { lowercase: true });

            if (startFormatted !== endFormatted) {
                return (
                    <span>
                        {startFormatted} - {endFormatted} <span className="text-red-600 font-bold ml-1">({daysText})</span>
                    </span>
                );
            } else {
                return (
                    <span>
                        {startFormatted} <span className="text-red-600 font-bold ml-1">({daysText})</span>
                    </span>
                );
            }
        }

        return formatInTimezone(item.start_time);
    };

    const BirthdayAvatar = ({ person, className }) => (
        person.image_path ? (
            <img
                src={`${API_BASE_URL}/${person.image_path.replace(/\\/g, '/')}`}
                alt={person.name}
                className={`object-cover ${className}`}
            />
        ) : (
            <div className={`flex items-center justify-center bg-gradient-to-br from-pink-400 to-rose-500 font-black text-white ${className}`}>
                {person.name.charAt(0).toUpperCase()}
            </div>
        )
    );

    const AnniversaryAvatar = ({ person, className }) => (
        person.image_path ? (
            <img
                src={`${API_BASE_URL}/${person.image_path.replace(/\\/g, '/')}`}
                alt={person.name}
                className={`object-cover ${className}`}
            />
        ) : (
            <div className={`flex items-center justify-center bg-gradient-to-br from-teal-400 to-emerald-500 font-black text-white ${className}`}>
                {person.name.charAt(0).toUpperCase()}
            </div>
        )
    );

    const BirthdayWishStatus = ({ person }) => {
        if (person.wish_sent) {
            return (
                <span
                    title={`Sent ${person.wish_sent_at ? formatInTimezone(person.wish_sent_at) : ''} to ${person.wish_sent_to || ''}${person.wish_source === 'cron' ? ' (scheduled)' : ''}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-green-700 border border-green-200"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    Email Sent
                </span>
            );
        }

        if (person.wish_status === 'Failed') {
            return (
                <span
                    title={person.wish_error || 'Sending failed'}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-700 border border-red-200"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                    Failed
                </span>
            );
        }

        if ((person.wish_recipients || []).length === 0) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500 border border-gray-200">
                    No Email
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                Pending
            </span>
        );
    };

    const AnniversaryWishStatus = ({ person }) => {
        if (person.wish_sent) {
            return (
                <span
                    title={`Sent ${person.wish_sent_at ? formatInTimezone(person.wish_sent_at) : ''} to ${person.wish_sent_to || ''}${person.wish_source === 'cron' ? ' (scheduled)' : ''}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-green-700 border border-green-200"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    Email Sent
                </span>
            );
        }

        if (person.wish_status === 'Failed') {
            return (
                <span
                    title={person.wish_error || 'Sending failed'}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-700 border border-red-200"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                    Failed
                </span>
            );
        }

        if ((person.wish_recipients || []).length === 0) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500 border border-gray-200">
                    No Email
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                Pending
            </span>
        );
    };

    const pendingWishCount = birthdays.filter(
        b => !b.wish_sent && (b.wish_recipients || []).length > 0
    ).length;

    const pendingAnniversaryWishCount = anniversaries.filter(
        a => !a.wish_sent && (a.wish_recipients || []).length > 0
    ).length;

    const sendBirthdayWishes = async (staffIds, key) => {
        try {
            setSendingWish(key);
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.post(
                `${API_BASE_URL}/api/admin/dashboard/birthdays/send-wishes`,
                staffIds ? { staff_ids: staffIds } : {},
                { headers: { 'x-access-token': token } }
            );

            const { sent = 0, failed = 0 } = response.data;
            if (sent > 0) {
                toast.success(`${sent} birthday wish${sent > 1 ? 'es' : ''} sent`, {
                    style: { background: '#059669', color: '#fff' }
                });
            }
            if (failed > 0) {
                toast.error(`${failed} birthday wish${failed > 1 ? 'es' : ''} failed to send`);
            }

            await fetchBirthdays();
        } catch (error) {
            console.error('Error sending birthday wishes:', error);
            toast.error(error.response?.data?.message || 'Failed to send birthday wishes');
        } finally {
            setSendingWish(null);
        }
    };

    const sendAnniversaryWishes = async (staffIds, key) => {
        try {
            setSendingAnniversaryWish(key);
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.post(
                `${API_BASE_URL}/api/admin/dashboard/anniversaries/send-wishes`,
                staffIds ? { staff_ids: staffIds } : {},
                { headers: { 'x-access-token': token } }
            );

            const { sent = 0, failed = 0 } = response.data;
            if (sent > 0) {
                toast.success(`${sent} work anniversary wish${sent > 1 ? 'es' : ''} sent`, {
                    style: { background: '#059669', color: '#fff' }
                });
            }
            if (failed > 0) {
                toast.error(`${failed} work anniversary wish${failed > 1 ? 'es' : ''} failed to send`);
            }

            await fetchAnniversaries();
        } catch (error) {
            console.error('Error sending anniversary wishes:', error);
            toast.error(error.response?.data?.message || 'Failed to send work anniversary wishes');
        } finally {
            setSendingAnniversaryWish(null);
        }
    };

    // Calculate days until holiday
    const getDaysUntilHoliday = (dateStr) => {
        if (!dateStr) return '';
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const cleanDate = String(dateStr).split('T')[0].split(' ')[0];
            const target = new Date(cleanDate + 'T00:00:00');
            if (isNaN(target.getTime())) return '';
            const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Today 🎉';
            if (diffDays === 1) return 'Tomorrow';
            if (diffDays < 0) return 'Passed';
            return `In ${diffDays} days`;
        } catch (e) {
            return '';
        }
    };

    // Trend chart data
    const trendBarChartData = trendData && trendData.length > 0 ? trendData : [];

    // Filter trend data if work mode filter is selected
    const filteredTrendData = useMemo(() => {
        return trendBarChartData;
    }, [trendBarChartData, workModeFilter]);

    // Workforce metrics helpers
    const workforce = stats.workforce || {};
    const totalHeadcount = workforce.totalHeadcount || stats.totalUsers || 0;
    const activeStaff = workforce.activeStaff || totalHeadcount;
    const attendanceRate = workforce.attendanceRate || (activeStaff > 0 ? Math.round((stats.presentToday / activeStaff) * 100) : 0);
    const activeSessions = workforce.activeSessions || stats.presentToday || 0;
    const workModes = workforce.workModes || { Office: totalHeadcount, 'Work from home': 0, Hybrid: 0 };
    const genderDist = workforce.genderDistribution || { Male: 0, Female: 0, Other: 0, Unassigned: 0 };
    const faceReg = workforce.faceRegistration || { registered: 0, pending: totalHeadcount, rate: 0 };
    const onboarding = workforce.onboardingPipeline || { Completed: 0, Pending_Candidate: 0, Pending_HR_Approval: 0, Total: 0 };
    const roleDistribution = workforce.roleDistribution || [];
    const punchSources = workforce.punchSources || [];
    const leaveTypesList = workforce.leaveTypes || [];
    const recentActivity = workforce.recentActivity || [];
    const upcomingHolidaysList = holidays.length > 0 ? holidays : (workforce.upcomingHolidays || []);

    const totalActionPending = stats.pendingLeaves + stats.pendingOnDuty + stats.pendingTimeOff;

    // Chart.js Doughnut configs
    const leaveDoughnutData = {
        labels: ['Pending', 'Approved', 'Rejected'],
        datasets: [{
            data: [stats.pendingLeaves, stats.approvedLeaves, stats.rejectedLeaves],
            backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
            borderColor: '#fff',
            borderWidth: 3,
            hoverOffset: 6
        }]
    };

    const onDutyDoughnutData = {
        labels: ['Active', 'Pending', 'Approved', 'Rejected'],
        datasets: [{
            data: [stats.activeOnDuty, stats.pendingOnDuty, stats.approvedOnDuty, stats.rejectedOnDuty],
            backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
            borderColor: '#fff',
            borderWidth: 3,
            hoverOffset: 6
        }]
    };

    const timeOffDoughnutData = {
        labels: ['Pending', 'Approved', 'Rejected'],
        datasets: [{
            data: [stats.pendingTimeOff, stats.approvedTimeOff, stats.rejectedTimeOff],
            backgroundColor: ['#f59e0b', '#14b8a6', '#ef4444'],
            borderColor: '#fff',
            borderWidth: 3,
            hoverOffset: 6
        }]
    };

    const punchSourceDoughnutData = {
        labels: punchSources.length > 0 ? punchSources.map(p => p.source) : ['Kiosk QR', 'Remote / Mobile'],
        datasets: [{
            data: punchSources.length > 0 ? punchSources.map(p => p.count) : [1, 0],
            backgroundColor: ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'],
            borderColor: '#fff',
            borderWidth: 3,
            hoverOffset: 6
        }]
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 16,
                    font: { size: 11, weight: '600' },
                    color: '#475569'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                padding: 10,
                cornerRadius: 10,
                titleFont: { size: 12, weight: 'bold' },
                bodyFont: { size: 12 }
            }
        },
        cutout: '72%'
    };

    // Diversity Doughnut (Gender)
    const genderDoughnutData = {
        labels: ['Male', 'Female', 'Other / Pending'],
        datasets: [{
            data: [
                genderDist.Male || 0,
                genderDist.Female || 0,
                (genderDist.Other || 0) + (genderDist.Unassigned || 0)
            ],
            backgroundColor: ['#3b82f6', '#ec4899', '#94a3b8'],
            borderColor: '#fff',
            borderWidth: 3,
            hoverOffset: 6
        }]
    };

    if (!permissionChecked) {
        return (
            <div className="min-h-screen bg-[#F8FAFC]">
                <ModernLoader size="page" message="Loading leadership dashboard..." />
            </div>
        );
    }

    if (permissionChecked && !hasDashboardPermission) {
        return (
            <div className="min-h-screen bg-[#F8FAFC]">
                <div className="max-w-7xl mx-auto px-6 py-12">
                    <div className="rounded-3xl border border-dashed border-slate-200/90 bg-white/70 backdrop-blur-xs p-12 text-center max-w-lg mx-auto shadow-sm">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200/80 shadow-xs">
                            <LuLayoutDashboard className="w-8 h-8 text-slate-400" />
                        </div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight mb-2">Executive Dashboard</h2>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed">
                            No dashboard items are configured for your role. Contact your administrator for dashboard view permissions.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-16">
            <style>{`
                @keyframes floatCard {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-4px); }
                }
                @keyframes pulseGlow {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.08); }
                }
                @keyframes shimmerEffect {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .hero-pulse-dot {
                    animation: pulseGlow 2.5s infinite ease-in-out;
                }
                .shimmer-badge {
                    background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.25), rgba(255,255,255,0));
                    background-size: 200% 100%;
                    animation: shimmerEffect 2.8s infinite linear;
                }
            `}</style>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 relative">

                {/* Top Enterprise Header with Lens Navigator */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#1e293b] text-white p-6 sm:p-8 mb-8 shadow-xl shadow-indigo-950/20 border border-slate-800/80">
                    <div className="absolute -right-16 -top-16 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2.5 mb-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                    Live Workforce Pulse
                                </span>
                                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                                    • {formatInTimezone(new Date())}
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                                People & Operations Dashboard
                            </h1>
                            <p className="text-slate-300 text-xs sm:text-sm font-medium mt-1 max-w-xl">
                                Real-time executive metrics, workforce distribution, attendance compliance, and operational requests.
                            </p>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={handleRefreshAll}
                                disabled={isRefreshing}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10 backdrop-blur-md active:scale-95 disabled:opacity-50"
                                title="Refresh metrics"
                            >
                                <FiRefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
                                {isRefreshing ? 'Refreshing…' : 'Refresh'}
                            </button>

                            <Link
                                to="/approvals"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-cyan-500/20 active:scale-95"
                            >
                                <FiZap className="w-3.5 h-3.5" />
                                Action Queue ({totalActionPending})
                            </Link>

                            {canManageUsers(currentUser.role) && (
                                <Link
                                    to="/users"
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-bold transition-all border border-slate-700 active:scale-95"
                                >
                                    <FiUsers className="w-3.5 h-3.5" />
                                    Manage Staff
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Lens Selector Tabs */}
                    <div className="mt-8 pt-6 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
                            {[
                                { key: 'overview', label: 'Executive Overview', icon: <LuLayoutDashboard className="w-3.5 h-3.5" /> },
                                { key: 'workforce', label: 'Workforce & People', icon: <FiUsers className="w-3.5 h-3.5" /> },
                                { key: 'attendance', label: 'Attendance & Operations', icon: <FiActivity className="w-3.5 h-3.5" /> },
                                { key: 'leaves', label: 'Leave & Availability', icon: <FiCalendar className="w-3.5 h-3.5" /> }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveLens(tab.key)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all duration-200 whitespace-nowrap ${
                                        activeLens === tab.key
                                            ? 'bg-cyan-500 text-[#0f172a] shadow-md shadow-cyan-500/25 scale-102 font-black'
                                            : 'text-slate-300 hover:text-white hover:bg-white/5 font-semibold'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Work Mode Quick Filter */}
                        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                            <span className="text-slate-400 px-2 flex items-center gap-1">
                                <FiFilter className="w-3 h-3 text-cyan-400" /> Mode:
                            </span>
                            {['all', 'Office', 'Work from home', 'Hybrid'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setWorkModeFilter(mode)}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                        workModeFilter === mode
                                            ? 'bg-white/20 text-white font-black'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {mode === 'all' ? 'All' : mode === 'Work from home' ? 'Remote' : mode}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-r-2xl p-4 shadow-sm animate-fadeIn">
                        <p className="text-red-800 font-semibold flex items-center gap-2 text-sm">
                            <FiAlertTriangle className="w-5 h-5 text-red-600 shrink-0" /> {error}
                        </p>
                    </div>
                )}

                {/* Incomplete Profiles Banner */}
                {incompleteProfiles.length > 0 && (
                    <div className="mb-8 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                                <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-200 shrink-0">
                                    <FiAlertTriangle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-amber-900 flex items-center gap-2 tracking-tight">
                                        Action Required: Incomplete Profiles
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200 text-amber-900">
                                            {incompleteProfiles.length} Staff
                                        </span>
                                    </h3>
                                    <p className="text-amber-800/80 text-xs font-medium mt-0.5">
                                        Active profiles are missing mandatory Role or Gender assignments. These team members will be blocked from logging in.
                                    </p>
                                </div>
                            </div>
                            <Link
                                to="/users?status=incomplete"
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all whitespace-nowrap active:scale-95"
                            >
                                Review & Assign Profiles →
                            </Link>
                        </div>
                    </div>
                )}

                <div className="relative min-h-[400px]">
                    {loading && (
                        <ModernLoader size="container" message="Analyzing people management metrics..." />
                    )}

                    <div className={`transition-all duration-300 ${(approveModal.show || rejectModal.show) ? 'blur-sm' : ''}`}>

                        {/* HERO METRICS RIBBON (Top Executive KPI Cards) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                            {/* Card 1: Total Headcount */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Workforce</span>
                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FiUsers className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-slate-900 tracking-tight">
                                    {totalHeadcount}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2 pt-2 border-t border-slate-50">
                                    <span className="text-emerald-600 font-bold">{activeStaff} Active</span>
                                    <span>{totalHeadcount - activeStaff} Inactive</span>
                                </div>
                            </div>

                            {/* Card 2: Today's Attendance Rate */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Attendance Rate</span>
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FiCheckCircle className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-emerald-600 tracking-tight">
                                        {attendanceRate}%
                                    </span>
                                    <span className="text-xs text-slate-400 font-bold">
                                        ({stats.presentToday} / {activeStaff})
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, attendanceRate)}%` }}></div>
                                </div>
                            </div>

                            {/* Card 3: Live In-Office / Active Sessions */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live Active</span>
                                    <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform relative">
                                        <FiActivity className="w-4 h-4" />
                                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-cyan-600 tracking-tight">
                                    {activeSessions}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2 pt-2 border-t border-slate-50">
                                    <span className="text-cyan-700 font-bold">Clocked-in now</span>
                                    <span>{workforce.completedSessions || 0} Out</span>
                                </div>
                            </div>

                            {/* Card 4: Mobility & Remote WFH */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Remote & Field</span>
                                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FiRadio className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-purple-600 tracking-tight">
                                    {(workModes['Work from home'] || 0) + (stats.activeOnDuty || 0)}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2 pt-2 border-t border-slate-50">
                                    <span>{workModes['Work from home'] || 0} WFH</span>
                                    <span className="text-purple-700 font-bold">{stats.activeOnDuty || 0} On-Duty</span>
                                </div>
                            </div>

                            {/* Card 5: Who's Away Today */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Out Today</span>
                                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FiCalendar className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-rose-600 tracking-tight">
                                    {onLeaveData.today?.length || 0}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2 pt-2 border-t border-slate-50">
                                    <span className="text-rose-600 font-bold">Approved Leaves</span>
                                    <span>{onLeaveData.tomorrow?.length || 0} Tomorrow</span>
                                </div>
                            </div>

                            {/* Card 6: Action Queue (Pending) */}
                            <div className="bg-white rounded-2xl p-5 border border-orange-100 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-500">Action Queue</span>
                                    <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FiZap className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-orange-600 tracking-tight">
                                    {totalActionPending}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2 pt-2 border-t border-orange-50">
                                    <span>{stats.pendingLeaves} L</span>
                                    <span>{stats.pendingOnDuty} OD</span>
                                    <span>{stats.pendingTimeOff} TO</span>
                                </div>
                            </div>
                        </div>

                        {/* Birthdays Today Hero Banner (if any) */}
                        {!birthdaysLoading && birthdays.length > 0 && (
                            <div className="mb-8">
                                <div className="overflow-hidden rounded-2xl border-2 border-pink-200/60 bg-white shadow-sm hover:shadow-md transition-all">
                                    <div className="relative overflow-hidden bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 px-6 py-4 text-white">
                                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3.5">
                                                <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                                                    <FiGift className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                                                        {birthdays.length} Birthday{birthdays.length > 1 ? 's' : ''} Today! 🎉
                                                    </h2>
                                                    <p className="text-xs text-pink-100 font-medium">
                                                        {pendingWishCount > 0
                                                            ? `${pendingWishCount} celebration wish${pendingWishCount > 1 ? 'es' : ''} pending to send.`
                                                            : 'All birthday greetings delivered.'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => sendBirthdayWishes(null, 'all')}
                                                disabled={pendingWishCount === 0 || sendingWish !== null}
                                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-rose-600 font-black text-xs uppercase tracking-wider shadow-md hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <FiSend className="w-3.5 h-3.5" />
                                                {sendingWish === 'all' ? 'Sending All…' : 'Send All Wishes'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-pink-50/30 text-pink-900/70 uppercase text-[10px] font-black border-b border-pink-100/50">
                                                <tr>
                                                    <th className="px-6 py-3">Employee</th>
                                                    <th className="px-6 py-3">Role</th>
                                                    <th className="px-6 py-3">Celebration</th>
                                                    <th className="px-6 py-3">Status</th>
                                                    <th className="px-6 py-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-pink-50">
                                                {birthdays.map(b => (
                                                    <tr key={b.staff_id} className="hover:bg-pink-50/20 transition-colors">
                                                        <td className="px-6 py-3 font-bold text-slate-800 flex items-center gap-3">
                                                            <BirthdayAvatar person={b} className="w-8 h-8 rounded-full" />
                                                            <span>{b.name}</span>
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-600 font-medium">{b.role_name || 'Staff'}</td>
                                                        <td className="px-6 py-3 font-semibold text-pink-600">
                                                            {b.turning_age ? `Turns ${b.turning_age}` : b.day_month}
                                                        </td>
                                                        <td className="px-6 py-3"><BirthdayWishStatus person={b} /></td>
                                                        <td className="px-6 py-3 text-right">
                                                            <button
                                                                onClick={() => sendBirthdayWishes([b.staff_id], b.staff_id)}
                                                                disabled={b.wish_sent || sendingWish !== null}
                                                                className="px-3 py-1.5 rounded-lg bg-[#1e1b4b] text-white text-[10px] font-black uppercase tracking-wider hover:bg-pink-600 transition-colors disabled:opacity-40"
                                                            >
                                                                {sendingWish === b.staff_id ? 'Sending…' : 'Send Wish'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Work Anniversaries Today Hero Banner (if any) */}
                        {!anniversariesLoading && anniversaries.length > 0 && (
                            <div className="mb-8">
                                <div className="overflow-hidden rounded-2xl border-2 border-emerald-200/60 bg-white shadow-sm hover:shadow-md transition-all">
                                    <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 px-6 py-4 text-white">
                                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3.5">
                                                <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                                                    <FiAward className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                                                        {anniversaries.length} Work Anniversary{anniversaries.length > 1 ? 'ies' : ''} Today! 🌟
                                                    </h2>
                                                    <p className="text-xs text-emerald-100 font-medium">
                                                        {pendingAnniversaryWishCount > 0
                                                            ? `${pendingAnniversaryWishCount} anniversary wish${pendingAnniversaryWishCount > 1 ? 'es' : ''} pending.`
                                                            : 'All anniversary greetings delivered.'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => sendAnniversaryWishes(null, 'all')}
                                                disabled={pendingAnniversaryWishCount === 0 || sendingAnniversaryWish !== null}
                                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-emerald-600 font-black text-xs uppercase tracking-wider shadow-md hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <FiSend className="w-3.5 h-3.5" />
                                                {sendingAnniversaryWish === 'all' ? 'Sending All…' : 'Send All Wishes'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-emerald-50/30 text-emerald-900/70 uppercase text-[10px] font-black border-b border-emerald-100/50">
                                                <tr>
                                                    <th className="px-6 py-3">Employee</th>
                                                    <th className="px-6 py-3">Role</th>
                                                    <th className="px-6 py-3">Tenure</th>
                                                    <th className="px-6 py-3">Status</th>
                                                    <th className="px-6 py-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-emerald-50">
                                                {anniversaries.map(a => (
                                                    <tr key={a.staff_id} className="hover:bg-emerald-50/20 transition-colors">
                                                        <td className="px-6 py-3 font-bold text-slate-800 flex items-center gap-3">
                                                            <AnniversaryAvatar person={a} className="w-8 h-8 rounded-full" />
                                                            <span>{a.name}</span>
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-600 font-medium">{a.role_name || 'Staff'}</td>
                                                        <td className="px-6 py-3 font-semibold text-emerald-600">
                                                            {a.years_of_service ? `${a.years_of_service} Year${a.years_of_service > 1 ? 's' : ''}` : 'Milestone'}
                                                        </td>
                                                        <td className="px-6 py-3"><AnniversaryWishStatus person={a} /></td>
                                                        <td className="px-6 py-3 text-right">
                                                            <button
                                                                onClick={() => sendAnniversaryWishes([a.staff_id], a.staff_id)}
                                                                disabled={a.wish_sent || sendingAnniversaryWish !== null}
                                                                className="px-3 py-1.5 rounded-lg bg-[#1e1b4b] text-white text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-colors disabled:opacity-40"
                                                            >
                                                                {sendingAnniversaryWish === a.staff_id ? 'Sending…' : 'Send Wish'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PENDING APPROVALS CAROUSEL */}
                        {!pendingApprovalsLoading && pendingApprovals.length > 0 && (
                            <div className="mb-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                                            <FiZap className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Pending Approvals Action Queue</h2>
                                            <p className="text-slate-500 text-xs font-medium">Quick review and instant 1-click authorization.</p>
                                        </div>
                                    </div>
                                    <Link
                                        to="/approvals"
                                        className="inline-flex items-center gap-1.5 text-xs font-black text-orange-600 hover:text-orange-700 bg-orange-50 px-3.5 py-1.5 rounded-xl border border-orange-200 transition-all"
                                    >
                                        View All ({pendingApprovals.length}) →
                                    </Link>
                                </div>

                                <div className="relative group/carousel">
                                    <button
                                        onClick={scrollLeft}
                                        className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-[#1e1b4b] text-cyan-400 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/carousel:opacity-100"
                                        aria-label="Scroll left"
                                    >
                                        ←
                                    </button>

                                    <div
                                        ref={scrollContainerRef}
                                        className="flex gap-4 overflow-x-auto hide-scrollbar py-2 px-1 scroll-smooth"
                                    >
                                        {pendingApprovals.map(item => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleOpenDetails(item, item.type === 'leave')}
                                                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 min-w-[280px] max-w-[280px] shrink-0 cursor-pointer flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-3">
                                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                                            item.type === 'leave'
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                : item.type === 'time_off'
                                                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                                        }`}>
                                                            {item.type}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            {item.type === 'leave'
                                                                ? `${calculateLeaveDays(item.start_date, item.end_date) - (item.is_half_day ? 0.5 : 0)}d`
                                                                : formatDateOnly(item.start_date || item.date)}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-sm font-black text-slate-900 truncate mb-1">
                                                        {item.name}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 font-medium line-clamp-2 italic mb-4">
                                                        "{item.title}"
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleApprove(item, item.type === 'leave'); }}
                                                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-xs"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReject(item, item.type === 'leave'); }}
                                                        className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl text-xs font-bold transition-all"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={scrollRight}
                                        className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-[#1e1b4b] text-cyan-400 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/carousel:opacity-100"
                                        aria-label="Scroll right"
                                    >
                                        →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* =========================================================================
                            LENS 1: EXECUTIVE OVERVIEW (Analytics Trend + Who's Out + Live Stream)
                        ========================================================================= */}
                        {(activeLens === 'overview' || activeLens === 'attendance') && (
                            <div className="mb-10">
                                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm mb-8">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Workforce Multi-Metric Trends</h2>
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700">
                                                    Attendance vs Approvals
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-xs font-medium mt-0.5">
                                                Tracking actual staff attendance alongside leave and on-duty requests over time.
                                            </p>
                                        </div>

                                        {/* Chart Controls */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Time range buttons */}
                                            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                                                {[7, 14, 30, 90].map(d => (
                                                    <button
                                                        key={d}
                                                        onClick={() => {
                                                            setTrendDuration(d);
                                                            setTrendStartDate(null);
                                                            setTrendEndDate(null);
                                                            fetchTrendData(d);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg transition-all ${
                                                            trendDuration === d && !showCustomDateRange
                                                                ? 'bg-white text-indigo-900 shadow-xs font-black'
                                                                : 'text-slate-500 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        {d}d
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setShowCustomDateRange(!showCustomDateRange)}
                                                    className={`px-3 py-1.5 rounded-lg transition-all ${
                                                        showCustomDateRange
                                                            ? 'bg-white text-indigo-900 shadow-xs font-black'
                                                            : 'text-slate-500 hover:text-slate-900'
                                                    }`}
                                                >
                                                    Custom
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {showCustomDateRange && (
                                        <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                            <div>
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={trendStartDate || ''}
                                                    onChange={e => setTrendStartDate(e.target.value)}
                                                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    value={trendEndDate || ''}
                                                    onChange={e => setTrendEndDate(e.target.value)}
                                                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (trendStartDate && trendEndDate) {
                                                        fetchTrendData(null, trendStartDate, trendEndDate);
                                                    }
                                                }}
                                                disabled={!trendStartDate || !trendEndDate || trendLoading}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50"
                                            >
                                                Apply Range
                                            </button>
                                        </div>
                                    )}

                                    <div className="relative w-full h-80">
                                        {trendLoading && (
                                            <ModernLoader size="container" message="Refreshing trend curves..." />
                                        )}
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={filteredTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorLeaves" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorOnDuty" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: '#0f172a',
                                                        borderRadius: '12px',
                                                        border: 'none',
                                                        color: '#fff',
                                                        fontSize: '12px',
                                                        padding: '10px 14px'
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '14px', fontSize: '12px', fontWeight: 'bold' }} />
                                                <Area type="monotone" dataKey="attendance" name="Staff Present" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAttendance)" />
                                                <Area type="monotone" dataKey="leaves" name="Approved Leaves" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorLeaves)" />
                                                <Area type="monotone" dataKey="onDuty" name="On-Duty Approvals" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorOnDuty)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* =========================================================================
                            LENS 2: PEOPLE & WORKFORCE (Work Modes, Gender Diversity, Face ID, Onboarding)
                        ========================================================================= */}
                        {(activeLens === 'overview' || activeLens === 'workforce') && (
                            <div className="mb-10">
                                <div className="flex items-center gap-2.5 mb-5">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                        <FiUsers className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">People & Workforce Dynamics</h2>
                                        <p className="text-slate-500 text-xs font-medium">Headcount distribution, biometric compliance, and talent pipeline.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                                    {/* Work Mode Card */}
                                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Work Mode Distribution</span>
                                                <LuBuilding2 className="w-4 h-4 text-indigo-500" />
                                            </div>
                                            <div className="space-y-2.5 mt-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Office (In-Person)
                                                    </span>
                                                    <span className="font-black text-slate-900">{workModes['Office'] || 0}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${totalHeadcount > 0 ? ((workModes['Office'] || 0) / totalHeadcount) * 100 : 0}%` }}></div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs pt-1">
                                                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Remote (WFH)
                                                    </span>
                                                    <span className="font-black text-slate-900">{workModes['Work from home'] || 0}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${totalHeadcount > 0 ? ((workModes['Work from home'] || 0) / totalHeadcount) * 100 : 0}%` }}></div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs pt-1">
                                                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span> Hybrid Office
                                                    </span>
                                                    <span className="font-black text-slate-900">{workModes['Hybrid'] || 0}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${totalHeadcount > 0 ? ((workModes['Hybrid'] || 0) / totalHeadcount) * 100 : 0}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gender Diversity Card */}
                                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Gender & Diversity</span>
                                                <span className="text-[10px] font-bold text-slate-500">{totalHeadcount} Staff</span>
                                            </div>
                                            <div className="h-36 relative mt-1">
                                                <Doughnut data={genderDoughnutData} options={doughnutOptions} />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-around text-center text-[11px] pt-3 border-t border-slate-50">
                                            <div>
                                                <span className="text-blue-600 font-black">{genderDist.Male || 0}</span>
                                                <p className="text-slate-400 font-bold">Male</p>
                                            </div>
                                            <div>
                                                <span className="text-pink-600 font-black">{genderDist.Female || 0}</span>
                                                <p className="text-slate-400 font-bold">Female</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 font-black">{genderDist.Unassigned || 0}</span>
                                                <p className="text-slate-400 font-bold">Pending</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Biometric & Face ID Adoption */}
                                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Face ID Enrollment</span>
                                                <FiCamera className="w-4 h-4 text-cyan-600" />
                                            </div>
                                            <div className="flex items-baseline gap-2 mb-2">
                                                <span className="text-3xl font-black text-cyan-600 tracking-tight">
                                                    {faceReg.rate}%
                                                </span>
                                                <span className="text-xs text-slate-400 font-bold">enrolled</span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
                                                <div className="bg-gradient-to-r from-cyan-400 to-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, faceReg.rate)}%` }}></div>
                                            </div>
                                            <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                                                Required for facial biometric kiosks. {faceReg.registered} staff registered, {faceReg.pending} pending capture.
                                            </p>
                                        </div>
                                        {canManageUsers(currentUser.role) && (
                                            <Link
                                                to="/users"
                                                className="mt-3 text-center py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-[11px] font-black transition-colors"
                                            >
                                                View Face ID Status →
                                            </Link>
                                        )}
                                    </div>

                                    {/* Talent Onboarding Pipeline */}
                                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Onboarding Pipeline</span>
                                                <FiUserPlus className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div className="space-y-2 mt-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-600 font-bold">Completed & Active</span>
                                                    <span className="font-black text-emerald-600">{onboarding.Completed || 0}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-600 font-bold">Candidate In-Progress</span>
                                                    <span className="font-black text-amber-600">{onboarding.Pending_Candidate || 0}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-600 font-bold">Pending HR Verification</span>
                                                    <span className="font-black text-indigo-600">{onboarding.Pending_HR_Approval || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                            <span className="text-slate-400 font-bold">Total Enrolled</span>
                                            <span className="font-black text-slate-800">{onboarding.Total || 0} Candidates</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Role & Department Workforce Spread */}
                                {roleDistribution.length > 0 && (
                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mb-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-base font-black text-slate-900 tracking-tight">Workforce Distribution by Role & Hierarchy</h3>
                                            <span className="text-xs text-slate-400 font-bold">{roleDistribution.length} Active Roles</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {roleDistribution.map(item => (
                                                <div key={item.role} className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex items-center justify-between">
                                                    <span className="text-xs font-bold text-slate-700 truncate pr-2">{item.role}</span>
                                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-100/60 text-indigo-800 font-black text-xs shrink-0">
                                                        {item.count}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* =========================================================================
                            LENS 3: ATTENDANCE, OPERATIONS & LIVE PUNCH STREAM
                        ========================================================================= */}
                        {(activeLens === 'overview' || activeLens === 'attendance') && (
                            <div className="mb-10">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                    {/* Punch Sources Breakdown */}
                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-base font-black text-slate-900 tracking-tight">Attendance Punch Channels</h3>
                                                <FiRadio className="w-4 h-4 text-indigo-500" />
                                            </div>
                                            <p className="text-slate-500 text-xs font-medium mb-3">Methods used by staff to record presence.</p>
                                            <div className="h-48 relative">
                                                <Doughnut data={punchSourceDoughnutData} options={doughnutOptions} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Live Activity Pulse (Recent Check-ins) */}
                                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="relative flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                                                </span>
                                                <h3 className="text-base font-black text-slate-900 tracking-tight">Live Attendance Activity Stream</h3>
                                            </div>
                                            <span className="text-xs text-slate-400 font-bold">Latest Punches</span>
                                        </div>

                                        {recentActivity.length === 0 ? (
                                            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                                                No attendance logs recorded today yet.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-100">
                                                {recentActivity.map(log => (
                                                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                                                                {log.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="truncate">
                                                                <p className="font-black text-slate-800 truncate">{log.name}</p>
                                                                <p className="text-[10px] text-slate-400 font-semibold">{log.phone_model || 'WorkPulse Terminal'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-100 text-slate-700">
                                                                {log.punch_source || 'KIOSK_QR'}
                                                            </span>
                                                            <span className="font-bold text-slate-600">
                                                                {log.check_in_time ? formatTimeOnly(log.check_in_time) : '—'}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${log.check_out_time ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                {log.check_out_time ? 'Closed' : 'Active'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* =========================================================================
                            LENS 4: LEAVE & ABSENCE INSIGHTS (Who's Out + Upcoming Holidays)
                        ========================================================================= */}
                        {(activeLens === 'overview' || activeLens === 'leaves') && (
                            <div className="mb-10">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                    {/* Who's Out Today / Tomorrow */}
                                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                                                    <FiCalendar className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-black text-slate-900 tracking-tight">Who's Out (Leaves & Time-Off)</h3>
                                                    <p className="text-slate-500 text-xs font-medium">Approved absences today and tomorrow.</p>
                                                </div>
                                            </div>
                                            <span className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 text-xs font-black">
                                                {onLeaveData.today.length + onLeaveData.tomorrow.length} Away
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Today Column */}
                                            <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-rose-500"></span> Today
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded shadow-xs">
                                                        {onLeaveData.today.length} Out
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {onLeaveData.today.length === 0 ? (
                                                        <div className="py-6 text-center text-slate-400 text-xs font-bold bg-white rounded-xl border border-dashed border-slate-200">
                                                            Everyone is present today ✨
                                                        </div>
                                                    ) : (
                                                        onLeaveData.today.map(emp => (
                                                            <div
                                                                key={emp.id}
                                                                onClick={() => setOnLeaveDetailModal({ show: true, emp, dayLabel: 'Today' })}
                                                                className="p-2.5 bg-white rounded-xl border border-slate-200/70 hover:border-indigo-200 shadow-xs hover:shadow-sm cursor-pointer transition-all flex items-center justify-between text-xs"
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0">
                                                                        {emp.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="truncate">
                                                                        <p className="font-bold text-slate-800 truncate">{emp.name}</p>
                                                                        <p className="text-[10px] text-slate-400">{emp.leave_type}</p>
                                                                    </div>
                                                                </div>
                                                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-50 text-rose-700">
                                                                    {emp.is_time_off ? 'Time-Off' : (emp.is_half_day ? 'Half Day' : 'Full Day')}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Tomorrow Column */}
                                            <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-amber-500"></span> Tomorrow
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded shadow-xs">
                                                        {onLeaveData.tomorrow.length} Scheduled
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {onLeaveData.tomorrow.length === 0 ? (
                                                        <div className="py-6 text-center text-slate-400 text-xs font-bold bg-white rounded-xl border border-dashed border-slate-200">
                                                            Everyone is scheduled in tomorrow ✨
                                                        </div>
                                                    ) : (
                                                        onLeaveData.tomorrow.map(emp => (
                                                            <div
                                                                key={emp.id}
                                                                onClick={() => setOnLeaveDetailModal({ show: true, emp, dayLabel: 'Tomorrow' })}
                                                                className="p-2.5 bg-white rounded-xl border border-slate-200/70 hover:border-indigo-200 shadow-xs hover:shadow-sm cursor-pointer transition-all flex items-center justify-between text-xs"
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-black text-xs flex items-center justify-center shrink-0">
                                                                        {emp.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="truncate">
                                                                        <p className="font-bold text-slate-800 truncate">{emp.name}</p>
                                                                        <p className="text-[10px] text-slate-400">{emp.leave_type}</p>
                                                                    </div>
                                                                </div>
                                                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-50 text-amber-700">
                                                                    {emp.is_time_off ? 'Time-Off' : (emp.is_half_day ? 'Half Day' : 'Full Day')}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Upcoming Holidays Calendar Widget */}
                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-base font-black text-slate-900 tracking-tight">Upcoming Company Holidays</h3>
                                                <LuCalendarDays className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <p className="text-slate-500 text-xs font-medium mb-4">Official observed company holidays.</p>

                                            {upcomingHolidaysList.length === 0 ? (
                                                <div className="py-8 text-center text-slate-400 text-xs font-bold">
                                                    No holidays scheduled in near term.
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {upcomingHolidaysList.map(h => (
                                                        <div key={h.date || h.holiday_date} className="p-3 bg-gradient-to-r from-indigo-50/50 to-purple-50/30 rounded-xl border border-indigo-100/60 flex items-center justify-between">
                                                            <div>
                                                                <p className="text-xs font-black text-indigo-950">{h.name || h.holiday_name}</p>
                                                                <p className="text-[10px] text-slate-500 font-semibold">{formatDateOnly(h.date || h.holiday_date)}</p>
                                                            </div>
                                                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-600 text-white shadow-xs">
                                                                {getDaysUntilHoliday(h.date || h.holiday_date)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <Link
                                            to="/holidays"
                                            className="mt-4 text-center py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all border border-slate-200"
                                        >
                                            View Full Holiday Calendar →
                                        </Link>
                                    </div>
                                </div>

                                {/* Leave Distribution by Category */}
                                {leaveTypesList.length > 0 && (
                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mb-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-base font-black text-slate-900 tracking-tight">Leave Consumption by Leave Category</h3>
                                            <span className="text-xs text-slate-400 font-bold">{leaveTypesList.length} Categories Recorded</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                            {leaveTypesList.map(item => (
                                                <div key={item.type} className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-col justify-between">
                                                    <span className="text-xs font-bold text-slate-600 truncate mb-1">{item.type}</span>
                                                    <div className="flex items-baseline justify-between">
                                                        <span className="text-xl font-black text-indigo-900">{item.count}</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold">requests</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Leave & On-Duty Doughnut Breakdowns */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-2">Leave Request Status</h3>
                                <div className="h-56 relative">
                                    <Doughnut data={leaveDoughnutData} options={doughnutOptions} />
                                </div>
                            </div>
                            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-2">On-Duty Operations Status</h3>
                                <div className="h-56 relative">
                                    <Doughnut data={onDutyDoughnutData} options={doughnutOptions} />
                                </div>
                            </div>
                            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-2">Time-Off Requests Status</h3>
                                <div className="h-56 relative">
                                    <Doughnut data={timeOffDoughnutData} options={doughnutOptions} />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Approve Modal */}
                {approveModal.show && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                            <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4">
                                <h2 className="text-lg font-black text-emerald-950">
                                    Approve {approveModal.item?.type === 'leave' ? 'Leave' : (approveModal.item?.type === 'time_off' ? 'Time-Off' : 'On-Duty')} Request
                                </h2>
                                <p className="text-xs text-emerald-800 mt-0.5">Are you sure you want to approve this request?</p>
                            </div>
                            <div className="p-6">
                                <div className="mb-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                                    <p className="text-slate-600"><strong>Employee:</strong> {approveModal.item?.name}</p>
                                    <p className="text-slate-600"><strong>Title:</strong> {approveModal.item?.title}</p>
                                    <p className="text-slate-600"><strong>Period:</strong> {formatDateForModal(approveModal.item)}</p>
                                </div>
                                {modalError && (
                                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">
                                        {modalError}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setApproveModal({ show: false, item: null, isLeave: false })}
                                        disabled={!!processingId}
                                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => await performStatusUpdate(approveModal.item, 'approved', approveModal.isLeave)}
                                        disabled={!!processingId}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        {processingId ? 'Processing…' : 'Confirm Approval'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reject Modal */}
                {rejectModal.show && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                            <div className="bg-red-50 border-b border-red-100 px-6 py-4">
                                <h2 className="text-lg font-black text-red-950">
                                    Reject {rejectModal.item?.type === 'leave' ? 'Leave' : (rejectModal.item?.type === 'time_off' ? 'Time-Off' : 'On-Duty')} Request
                                </h2>
                                <p className="text-xs text-red-800 mt-0.5">Please provide a reason for the rejection.</p>
                            </div>
                            <div className="p-6">
                                <div className="mb-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                                    <p className="text-slate-600"><strong>Employee:</strong> {rejectModal.item?.name}</p>
                                    <p className="text-slate-600"><strong>Title:</strong> {rejectModal.item?.title}</p>
                                </div>
                                <textarea
                                    value={rejectModal.reason}
                                    onChange={e => setRejectModal(r => ({ ...r, reason: e.target.value }))}
                                    placeholder="Enter rejection reason..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none mb-3"
                                    rows="3"
                                />
                                {modalError && (
                                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">
                                        {modalError}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setRejectModal({ show: false, item: null, isLeave: false, reason: '' })}
                                        disabled={!!processingId}
                                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!rejectModal.reason.trim()) {
                                                setModalError('Please provide a reason for rejection');
                                                return;
                                            }
                                            await performStatusUpdate(rejectModal.item, 'rejected', rejectModal.isLeave, rejectModal.reason);
                                        }}
                                        disabled={!!processingId}
                                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        {processingId ? 'Processing…' : 'Confirm Rejection'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Details Modal */}
                {detailsModal.show && detailsModal.item && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
                            <div className="p-6 bg-gradient-to-r from-[#0f172a] to-[#1e1b4b] text-white relative">
                                <button
                                    onClick={() => setDetailsModal({ ...detailsModal, show: false })}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                >
                                    ✕
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-bold border border-white/20">
                                        {detailsModal.isLeave ? <FiFileText className="w-6 h-6 text-white" /> : (detailsModal.item.type === 'time_off' ? <FiClock className="w-6 h-6 text-white" /> : <FiMapPin className="w-6 h-6 text-white" />)}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{detailsModal.isLeave ? 'Leave Request Details' : (detailsModal.item.type === 'time_off' ? 'Time-Off Details' : 'On-Duty Details')}</h2>
                                        <p className="text-white/70 text-xs font-semibold">
                                            System ID: #{detailsModal.item.id} • Employee: {detailsModal.item.name}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto hide-scrollbar space-y-6">
                                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 text-xs">
                                    <div>
                                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Category</p>
                                        <p className="text-sm font-black text-slate-800 mt-0.5">{detailsModal.item.title}</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Period</p>
                                        <p className="text-sm font-bold text-slate-800 mt-0.5">{formatDateForModal(detailsModal.item)}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">Reason / Purpose</p>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
                                        {detailsModal.item.reason || detailsModal.item.purpose || 'No additional note provided.'}
                                    </div>
                                </div>

                                {/* On-Duty Location Map */}
                                {!detailsModal.isLeave && detailsModal.item.type !== 'time_off' && (
                                    <div>
                                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-2">Location Map</p>
                                        <OnDutyLocationMap
                                            startLat={detailsModal.item.start_lat}
                                            startLong={detailsModal.item.start_long}
                                            endLat={detailsModal.item.end_lat}
                                            endLong={detailsModal.item.end_long}
                                            clientName={detailsModal.item.title}
                                            location={detailsModal.item.location}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                    onClick={() => setDetailsModal({ ...detailsModal, show: false })}
                                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setDetailsModal({ ...detailsModal, show: false });
                                        handleReject(detailsModal.item, detailsModal.isLeave);
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => {
                                        setDetailsModal({ ...detailsModal, show: false });
                                        handleApprove(detailsModal.item, detailsModal.isLeave);
                                    }}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 transition-all"
                                >
                                    Approve Request
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* On Leave Detail Modal */}
                {onLeaveDetailModal.show && onLeaveDetailModal.emp && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-fadeIn"
                        onClick={() => setOnLeaveDetailModal({ show: false, emp: null, dayLabel: '' })}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="bg-[#1e1b4b] p-6 relative text-white">
                                <button
                                    onClick={() => setOnLeaveDetailModal({ show: false, emp: null, dayLabel: '' })}
                                    className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
                                >
                                    ✕
                                </button>
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-full bg-rose-500 flex items-center justify-center font-black text-lg">
                                        {onLeaveDetailModal.emp.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-white">{onLeaveDetailModal.emp.name}</h2>
                                        <p className="text-white/60 text-xs">{onLeaveDetailModal.emp.email || `Staff #${onLeaveDetailModal.emp.staff_id}`}</p>
                                    </div>
                                </div>
                                <span className="inline-block mt-3 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-400/30">
                                    On Leave {onLeaveDetailModal.dayLabel}
                                </span>
                            </div>

                            <div className="p-5 space-y-3 text-xs">
                                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-center justify-between">
                                    <span className="font-bold text-slate-500">Leave Type</span>
                                    <span className="font-black text-indigo-900">{onLeaveDetailModal.emp.leave_type}</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span className="font-bold text-slate-500">Duration</span>
                                    <span className="font-black text-slate-900">
                                        {formatDateOnly(onLeaveDetailModal.emp.start_date)} - {formatDateOnly(onLeaveDetailModal.emp.end_date)}
                                    </span>
                                </div>
                                {onLeaveDetailModal.emp.reason && (
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="font-bold text-slate-400 text-[10px] uppercase mb-1">Reason</p>
                                        <p className="text-slate-700 font-medium">{onLeaveDetailModal.emp.reason}</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 pt-0">
                                <button
                                    onClick={() => setOnLeaveDetailModal({ show: false, emp: null, dayLabel: '' })}
                                    className="w-full py-2.5 bg-[#1e1b4b] hover:bg-indigo-900 text-white rounded-xl font-black text-xs transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Dashboard;
