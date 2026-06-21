import React, { useState, useEffect, useRef } from 'react';
import '../hide-scrollbar.css';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import OnDutyLocationMap from '../components/OnDutyLocationMap';
import { calculateLeaveDays } from '../utils/dateUtils';
import { formatInTimezone, formatTimeOnly, formatDateOnly, getCurrentInAppTimezone, parseAppTimezone } from '../utils/timezone.util';
import { canApproveLeave, canApproveOnDuty, canManageUsers } from '../utils/roleUtils';

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

            // Optionally, refresh stats
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

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Open details modal when clicking a card
    const handleOpenDetails = (item, isLeave) => {
        setDetailsModal({
            show: true,
            item: item,
            isLeave: isLeave
        });
    };

    const [stats, setStats] = useState({
        pendingLeaves: 0,
        approvedLeaves: 0,
        rejectedLeaves: 0,
        pendingOnDuty: 0,
        approvedOnDuty: 0,
        rejectedOnDuty: 0,
        activeOnDuty: 0,
        pendingTimeOff: 0,
        approvedTimeOff: 0,
        rejectedTimeOff: 0
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

    useEffect(() => {
        console.log('Dashboard mounted');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        // Always fetch stats (it's protected by verifyToken only, so accessible to all logged-in users)
        fetchDashboardStats();

        // Conditionally fetch pending approvals
        fetchPendingApprovals();

        // Only fetch incomplete profiles if user has permission to manage users
        if (canManageUsers(user.role)) {
            fetchIncompleteProfiles();
        }

        // Fetch on-leave status for managers/approvers
        if (canApproveLeave(user.role)) {
            fetchOnLeaveData();
        }
    }, []);

    useEffect(() => {
        // Fetch trend data when duration changes
        fetchTrendData(trendDuration);
    }, [trendDuration]);

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

    const fetchTrendData = async (days, startDate = null, endDate = null) => {
        try {
            setTrendLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                return;
            }

            let url = `${API_BASE_URL}/api/admin/dashboard/daily-trend`;
            if (startDate && endDate) {
                // Use custom date range
                url += `?startDate=${startDate}&endDate=${endDate}`;
            } else {
                // Use days parameter
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

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found. Please login first.');
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/api/admin/dashboard/stats`, {
                headers: { 'x-access-token': token }
            });

            // Ensure all values are numbers, default to 0
            const cleanedData = {
                pendingLeaves: Number(response.data.pendingLeaves) || 0,
                approvedLeaves: Number(response.data.approvedLeaves) || 0,
                rejectedLeaves: Number(response.data.rejectedLeaves) || 0,
                pendingOnDuty: Number(response.data.pendingOnDuty) || 0,
                approvedOnDuty: Number(response.data.approvedOnDuty) || 0,
                rejectedOnDuty: Number(response.data.rejectedOnDuty) || 0,
                activeOnDuty: Number(response.data.activeOnDuty) || 0,
                pendingTimeOff: Number(response.data.pendingTimeOff) || 0,
                approvedTimeOff: Number(response.data.approvedTimeOff) || 0,
                rejectedTimeOff: Number(response.data.rejectedTimeOff) || 0
            };
            setStats(cleanedData);

            // Fetch real trend data from backend
            fetchTrendData(trendDuration);
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            setError(error.response?.data?.message || error.message || 'Failed to fetch dashboard stats');
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingApprovals = async () => {
        try {
            setPendingApprovalsLoading(true);
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            if (!token) {
                return;
            }

            // Check permissions before making the call
            const hasLeavePermission = canApproveLeave(user.role);
            const hasOnDutyPermission = canApproveOnDuty(user.role);

            // If user has no approval permissions, don't fetch
            if (!hasLeavePermission && !hasOnDutyPermission) {
                setPendingApprovals([]);
                setPendingApprovalsLoading(false);
                return;
            }

            const response = await axios.get(
                `${API_BASE_URL}/api/leave/requests?status=Pending&page=1&limit=5`,
                { headers: { 'x-access-token': token } }
            );

            const allRequests = response.data.items || [];
            const pendingItems = allRequests.map(item => {
                // Get name from tblstaff - try multiple fields
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
                    // Additional fields for modal
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

        // Time-Off: Show time range and duration in hours
        if (item.type === 'time_off') {
            const date = item.date ? formatDateOnly(item.date) : '';
            const startTime = item.start_time ? formatTimeOnly(item.start_time) : '';
            const endTime = item.end_time ? formatTimeOnly(item.end_time) : '';
            const duration = calculateTimeOffDuration(item.start_time, item.end_time);

            return (
                <span>
                    {startTime} - {endTime} (On {date}) <span className="text-red-600 font-bold ml-1">( {duration} )</span>
                </span>
            );
        }

        // Leave: Show date range with days
        if (item.type === 'leave') {
            const startFormatted = formatDateOnly(item.start_date);
            const endFormatted = formatDateOnly(item.end_date);
            const daysCount = calculateLeaveDays(item.start_date, item.end_date) - (item.is_half_day === true || item.is_half_day === 1 ? 0.5 : 0);
            const daysText = `${daysCount} ${daysCount === 1 ? 'day' : 'days'}`;

            if (startFormatted !== endFormatted) {
                return (
                    <span>
                        {startFormatted} - {endFormatted} <span className="text-red-600 font-bold ml-1">( {daysText} )</span>
                    </span>
                );
            } else {
                return (
                    <span>
                        {startFormatted} <span className="text-red-600 font-bold ml-1">( {daysText} )</span>
                    </span>
                );
            }
        }

        // On-Duty: Show date-time range
        const startFormatted = formatInTimezone(item.start_time);
        return startFormatted;
    };

    const generateTrendData = (statsData, days = 7) => {
        const today = getCurrentInAppTimezone().full;
        const trendDays = [];

        // Generate dates for the selected duration in DD/MM/YY format
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2); // Get last 2 digits of year
            const dateStr = `${day}/${month}/${year}`;
            trendDays.push(dateStr);
        }

        const trends = [];
        const totalApprovalsLeaves = statsData.approvedLeaves || 0;
        const totalApprovalsOnDuty = statsData.approvedOnDuty || 0;
        const totalApprovals = totalApprovalsLeaves + totalApprovalsOnDuty;

        // Only create actual data points - no mock data for future dates
        // Limit to actual days with data
        const dataPoints = Math.min(days, 7); // Show max 7 days or less if selected fewer

        // Distribute approved items evenly across available data points
        let baseLeaves = totalApprovals > 0 ? Math.floor(totalApprovalsLeaves / dataPoints) : 0;
        let baseOnDuty = totalApprovals > 0 ? Math.floor(totalApprovalsOnDuty / dataPoints) : 0;

        let totalDistributedLeaves = 0;
        let totalDistributedOnDuty = 0;

        for (let i = 0; i < days; i++) {
            if (i < dataPoints && totalApprovals > 0) {
                // Actual data points
                // On the last data point, ensure we reach the total
                const variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
                let dailyLeaves = Math.max(0, baseLeaves + variance);
                let dailyOnDuty = Math.max(0, baseOnDuty + variance);

                // On the last data point, ensure we reach the total
                if (i === dataPoints - 1) {
                    dailyLeaves = Math.max(0, totalApprovalsLeaves - totalDistributedLeaves);
                    dailyOnDuty = Math.max(0, totalApprovalsOnDuty - totalDistributedOnDuty);
                }

                totalDistributedLeaves += dailyLeaves;
                totalDistributedOnDuty += dailyOnDuty;

                trends.push({
                    day: trendDays[i],
                    leaves: dailyLeaves,
                    onDuty: dailyOnDuty,
                    timeOff: 0, // Simplified for now
                    total: dailyLeaves + dailyOnDuty
                });
            } else {
                // No data for future dates
                trends.push({
                    day: trendDays[i],
                    leaves: 0,
                    onDuty: 0,
                    total: 0
                });
            }
        }

        return trends;
    };

    const StatCard = ({ title, value, icon, color, footer, gradient }) => (
        <div className={`relative overflow-hidden bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group`}>
            {/* Background Decorative Gradient Circle */}
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 ${gradient}`}></div>

            <div className="flex items-start justify-between relative z-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${gradient} text-white`}>
                            {icon}
                        </div>
                        <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase">{title}</p>
                    </div>
                    <div>
                        <p className={`text-4xl font-black ${color} tracking-tight`}>{value}</p>
                        {footer && (
                            <div className="flex items-center gap-1.5 mt-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{footer}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // Chart.js Data Configurations
    // Prepare trend data for Recharts bar chart
    const trendBarChartData = trendData && trendData.length > 0 ? trendData : [
        { day: 'Mon', leaves: 0, onDuty: 0 },
        { day: 'Tue', leaves: 0, onDuty: 0 },
        { day: 'Wed', leaves: 0, onDuty: 0 },
        { day: 'Thu', leaves: 0, onDuty: 0 },
        { day: 'Fri', leaves: 0, onDuty: 0 },
        { day: 'Sat', leaves: 0, onDuty: 0 },
        { day: 'Sun', leaves: 0, onDuty: 0 }
    ];

    const leaveDoughnutData = {
        labels: ['Pending', 'Approved', 'Rejected'],
        datasets: [{
            data: [stats.pendingLeaves, stats.approvedLeaves, stats.rejectedLeaves],
            backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
            borderColor: '#fff',
            borderWidth: 3,
            hoverBorderWidth: 4,
            hoverOffset: 5
        }]
    };

    const onDutyDoughnutData = {
        labels: ['Active', 'Pending', 'Approved', 'Rejected'],
        datasets: [{
            data: [stats.activeOnDuty, stats.pendingOnDuty, stats.approvedOnDuty, stats.rejectedOnDuty],
            backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
            borderColor: '#fff',
            borderWidth: 3,
            hoverBorderWidth: 4,
            hoverOffset: 5
        }]
    };

    const timeOffDoughnutData = {
        labels: ['Pending', 'Approved', 'Rejected'],
        datasets: [{
            data: [stats.pendingTimeOff, stats.approvedTimeOff, stats.rejectedTimeOff],
            backgroundColor: ['#f59e0b', '#14b8a6', '#ef4444'],
            borderColor: '#fff',
            borderWidth: 3,
            hoverBorderWidth: 4,
            hoverOffset: 5
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
                    padding: 20,
                    font: { size: 12, weight: '600' },
                    color: '#4B5563'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.9)',
                padding: 12,
                cornerRadius: 12,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                callbacks: {
                    label: function (context) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        return `  ${label}: ${value}`;
                    }
                }
            }
        },
        cutout: '70%'
    };

    // Prepare chart data - filter out zero values
    const leaveChartData = [
        { name: 'Pending', value: stats.pendingLeaves, fill: '#f59e0b' },
        { name: 'Approved', value: stats.approvedLeaves, fill: '#10b981' },
        { name: 'Rejected', value: stats.rejectedLeaves, fill: '#ef4444' }
    ].filter(item => item.value > 0);

    const onDutyChartData = [
        { name: 'Active', value: stats.activeOnDuty, fill: '#3b82f6' },
        { name: 'Pending', value: stats.pendingOnDuty, fill: '#f59e0b' },
        { name: 'Approved', value: stats.approvedOnDuty, fill: '#10b981' },
        { name: 'Rejected', value: stats.rejectedOnDuty, fill: '#ef4444' }
    ].filter(item => item.value > 0);

    const comparisonChartData = [
        {
            category: 'Leave',
            Pending: stats.pendingLeaves,
            Approved: stats.approvedLeaves,
            Rejected: stats.rejectedLeaves
        },
        {
            category: 'On-Duty',
            Pending: stats.pendingOnDuty,
            Approved: stats.approvedOnDuty,
            Rejected: stats.rejectedOnDuty
        }
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            <div className="max-w-7xl mx-auto px-6 py-10 relative">
                <div className="mb-10">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Dashboard Overview</h1>
                    <p className="text-gray-500 mt-2 text-lg font-medium">Real-time attendance and leave insights.</p>
                </div>

                {error && (
                    <div className="mb-8 bg-red-50 border-l-4 border-red-500 rounded-r-2xl p-4 shadow-sm">
                        <p className="text-red-800 font-semibold flex items-center gap-2">
                            <span className="text-xl">⚠️</span> {error}
                        </p>
                    </div>
                )}

                {incompleteProfiles.length > 0 && (
                    <div className="mb-8 bg-[#f0f9ff] border-l-4 border-[#1e1b4b] rounded-r-2xl p-6 shadow-sm transform transition-all hover:scale-[1.01] duration-300">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-black text-[#1e1b4b] mb-2 flex items-center gap-2 uppercase tracking-tighter">
                                    <span className="animate-pulse text-[#0ea5e9]">●</span> Action Required: Incomplete Profiles
                                </h3>
                                <p className="text-gray-600 mb-4 font-medium text-sm">
                                    {incompleteProfiles.length} active user(s) have not been assigned a Role or Gender. They will be unable to log in until this is resolved.
                                </p>
                                <Link
                                    to="/users?status=incomplete"
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1e1b4b] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-950/20 hover:shadow-[#0ea5e9]/20 hover:-translate-y-0.5 transition-all"
                                >
                                    Review & Update Profiles →
                                </Link>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#1e1b4b]/5">
                                <span className="text-3xl">⚠️</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="relative min-h-[400px]">
                    {loading && (
                        <ModernLoader size="container" message="Fetching dashboard stats..." />
                    )}
                    <div className={`transition-all duration-300 ${(approveModal.show || rejectModal.show) ? 'blur-sm' : ''}`}>
                        <>
                            {/* On Leave Today / Tomorrow Section */}
                            {!onLeaveLoading && (onLeaveData.today.length > 0 || onLeaveData.tomorrow.length > 0) && (
                                <div className="mb-8">
                                    <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden">
                                        {/* Decorative background element */}
                                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-2xl opacity-60 -translate-y-1/2 translate-x-1/3"></div>
                                        
                                        <div className="flex items-center justify-between mb-5 relative z-10">
                                            <div>
                                                <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                                                    <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base shadow-sm">
                                                        🌴
                                                    </span>
                                                    Who's Out
                                                </h2>
                                                <p className="text-gray-500 text-xs font-medium mt-0.5">See who is away today and tomorrow.</p>
                                            </div>
                                            <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-xs">
                                                {onLeaveData.today.length + onLeaveData.tomorrow.length} Absent Total
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 relative z-10">
                                            {/* Today Column */}
                                            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="relative flex h-2.5 w-2.5">
                                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                        </span>
                                                        <h3 className="text-base font-black text-gray-900 tracking-tight">Today</h3>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
                                                        {onLeaveData.today.length} Out
                                                    </span>
                                                </div>

                                                <div className="space-y-2.5">
                                                    {onLeaveData.today.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-6 text-center bg-white rounded-lg border border-dashed border-gray-200">
                                                            <span className="text-xl mb-1.5">✨</span>
                                                            <p className="text-xs font-bold text-gray-400">Everyone is in today</p>
                                                        </div>
                                                    ) : (
                                                        onLeaveData.today.map((emp) => (
                                                            <div key={emp.id} onClick={() => setOnLeaveDetailModal({ show: true, emp, dayLabel: 'Today' })} className="group bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shadow-inner flex-shrink-0 ${emp.is_time_off ? 'bg-gradient-to-br from-teal-400 to-emerald-500' : 'bg-gradient-to-br from-red-400 to-rose-500'}`}>
                                                                    {emp.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{emp.name}</h4>
                                                                    <p className="text-[10px] text-gray-500 truncate mt-0.5 font-medium">{emp.leave_type}</p>
                                                                </div>
                                                                <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm ${emp.is_time_off ? 'bg-teal-50 text-teal-700' : (emp.is_half_day ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700')}`}>
                                                                    {emp.is_time_off ? 'Time Off' : (emp.is_half_day ? 'Half Day' : 'Full Day')}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Tomorrow Column */}
                                            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                                                        <h3 className="text-base font-black text-gray-900 tracking-tight">Tomorrow</h3>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
                                                        {onLeaveData.tomorrow.length} Out
                                                    </span>
                                                </div>

                                                <div className="space-y-2.5">
                                                    {onLeaveData.tomorrow.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-6 text-center bg-white rounded-lg border border-dashed border-gray-200">
                                                            <span className="text-xl mb-1.5">🌟</span>
                                                            <p className="text-xs font-bold text-gray-400">Everyone is in tomorrow</p>
                                                        </div>
                                                    ) : (
                                                        onLeaveData.tomorrow.map((emp) => (
                                                            <div key={emp.id} onClick={() => setOnLeaveDetailModal({ show: true, emp, dayLabel: 'Tomorrow' })} className="group bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shadow-inner flex-shrink-0 ${emp.is_time_off ? 'bg-gradient-to-br from-teal-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                                                                    {emp.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{emp.name}</h4>
                                                                    <p className="text-[10px] text-gray-500 truncate mt-0.5 font-medium">{emp.leave_type}</p>
                                                                </div>
                                                                <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm ${emp.is_time_off ? 'bg-teal-50 text-teal-700' : (emp.is_half_day ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-700')}`}>
                                                                    {emp.is_time_off ? 'Time Off' : (emp.is_half_day ? 'Half Day' : 'Full Day')}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Pending Approvals Section - Redesigned */}
                            {!pendingApprovalsLoading && pendingApprovals.length > 0 && (
                                <div className="mb-12 animate-fadeInUp">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl shadow-sm">
                                                ⚡
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Pending Requests</h2>
                                                <p className="text-gray-500 text-sm font-medium">Review pending leave and on-duty applications.</p>
                                            </div>
                                        </div>
                                        <Link
                                            to="/approvals"
                                            className="group flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-orange-600 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm hover:shadow-md"
                                        >
                                            View All
                                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                                        </Link>
                                    </div>

                                    <div className="relative group/container">
                                        {/* Left Navigation Button - Modern Floating Style */}
                                        <button
                                            onClick={scrollLeft}
                                            className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-[#1e1b4b] rounded-full flex items-center justify-center text-[#0ea5e9] shadow-xl shadow-indigo-950/20 hover:shadow-[#0ea5e9]/20 hover:scale-110 active:scale-95 transition-all duration-300 opacity-0 group-hover/container:opacity-100 border border-[#0ea5e9]/10"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                            </svg>
                                        </button>

                                        {/* Horizontal Scroll Container */}
                                        <div
                                            ref={scrollContainerRef}
                                            className="flex gap-6 overflow-x-auto hide-scrollbar px-6 py-2 scroll-smooth"
                                        >
                                            {pendingApprovals.map((item) => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleOpenDetails(item, item.type === 'leave')}
                                                    className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group min-w-[280px] max-w-[280px] flex-shrink-0 cursor-pointer"
                                                >
                                                    <div className="flex justify-between items-start mb-4">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${item.type === 'leave'
                                                            ? 'bg-blue-50 text-blue-600'
                                                            : (item.type === 'time_off' ? 'bg-teal-50 text-teal-600' : 'bg-purple-50 text-purple-600')
                                                            }`}>
                                                            {item.type}
                                                        </span>
                                                        <span className="text-[11px] font-bold text-gray-400">
                                                            {item.type === 'leave' ? (
                                                                <span className="text-red-500">
                                                                    {(() => {
                                                                        const count = calculateLeaveDays(item.start_date, item.end_date) - (item.is_half_day === true || item.is_half_day === 1 ? 0.5 : 0);
                                                                        return `${count} Day${count === 1 ? '' : 's'}`;
                                                                    })()}
                                                                </span>
                                                            ) : (
                                                                formatDateOnly(item.start_date)
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="mb-4">
                                                        <h3 className="text-base font-bold text-gray-900 leading-snug mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                                            {item.name}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 font-medium line-clamp-2 italic">
                                                            "{item.title}"
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-2 pt-4 border-t border-gray-50">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleApprove(item, item.type === 'leave'); }}
                                                            className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-all flex items-center justify-center gap-2 group-hover:shadow-lg"
                                                        >
                                                            <span>Approve</span>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleReject(item, item.type === 'leave'); }}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Reject"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Right Navigation Button - Modern Floating Style */}
                                        <button
                                            onClick={scrollRight}
                                            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-[#1e1b4b] rounded-full flex items-center justify-center text-[#0ea5e9] shadow-xl shadow-indigo-950/20 hover:shadow-[#0ea5e9]/20 hover:scale-110 active:scale-95 transition-all duration-300 opacity-0 group-hover/container:opacity-100 border border-[#0ea5e9]/10"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Summary Section */}
                            <div className="mb-12">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-2 h-8 bg-[#1e1b4b] rounded-full"></div>
                                    <h2 className="text-2xl font-black text-[#1e1b4b] tracking-tight uppercase tracking-tighter">System Summary</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <StatCard
                                        title="Total Requests"
                                        value={stats.pendingLeaves + stats.approvedLeaves + stats.rejectedLeaves + stats.pendingTimeOff + stats.approvedTimeOff + stats.rejectedTimeOff}
                                        icon="📄"
                                        color="text-[#1e1b4b]"
                                        footer="Engagement overview"
                                        gradient="bg-[#1e1b4b]"
                                    />
                                    <StatCard
                                        title="Total On-Duty Logs"
                                        value={stats.pendingOnDuty + stats.approvedOnDuty + stats.rejectedOnDuty + stats.activeOnDuty}
                                        icon="📍"
                                        color="text-[#0ea5e9]"
                                        footer="Operational overview"
                                        gradient="bg-[#0ea5e9]"
                                    />
                                </div>
                            </div>

                            {/* Leave Section */}
                            <div className="mb-12">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Leave Management</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <StatCard
                                        title="Pending Review"
                                        value={stats.pendingLeaves}
                                        icon="⏳"
                                        color="text-orange-600"
                                        footer="Action Required"
                                        gradient="bg-gradient-to-br from-orange-400 to-amber-500"
                                    />
                                    <StatCard
                                        title="Success Rate"
                                        value={stats.approvedLeaves}
                                        icon="✨"
                                        color="text-green-600"
                                        footer="Total approved"
                                        gradient="bg-gradient-to-br from-green-400 to-emerald-600"
                                    />
                                    <StatCard
                                        title="Exceptions"
                                        value={stats.rejectedLeaves}
                                        icon="🚨"
                                        color="text-red-600"
                                        footer="Total rejected"
                                        gradient="bg-gradient-to-br from-red-400 to-rose-600"
                                    />
                                </div>
                            </div>

                            {/* On-Duty Section */}
                            <div className="mb-12">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">On-Duty Operations</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    <StatCard
                                        title="Currently In Field"
                                        value={stats.activeOnDuty}
                                        icon="🛰️"
                                        color="text-blue-600"
                                        footer="Live active status"
                                        gradient="bg-gradient-to-br from-blue-400 to-cyan-500"
                                    />
                                    <StatCard
                                        title="Verification Queue"
                                        value={stats.pendingOnDuty}
                                        icon="🔎"
                                        color="text-orange-600"
                                        footer="Pending checks"
                                        gradient="bg-gradient-to-br from-orange-400 to-amber-500"
                                    />
                                    <StatCard
                                        title="Verified Tasks"
                                        value={stats.approvedOnDuty}
                                        icon="🛡️"
                                        color="text-green-600"
                                        footer="System confirmed"
                                        gradient="bg-gradient-to-br from-green-400 to-emerald-600"
                                    />
                                    <StatCard
                                        title="Declined Tasks"
                                        value={stats.rejectedOnDuty}
                                        icon="🚫"
                                        color="text-red-600"
                                        footer="Policy violation"
                                        gradient="bg-gradient-to-br from-red-400 to-rose-600"
                                    />
                                </div>
                            </div>

                            {/* Time-Off Section */}
                            <div className="mb-12">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-2 h-8 bg-teal-500 rounded-full"></div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Time-Off Management</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <StatCard
                                        title="Pending Review"
                                        value={stats.pendingTimeOff}
                                        icon="⏳"
                                        color="text-orange-600"
                                        footer="Action Required"
                                        gradient="bg-gradient-to-br from-orange-400 to-amber-500"
                                    />
                                    <StatCard
                                        title="Approved"
                                        value={stats.approvedTimeOff}
                                        icon="✨"
                                        color="text-teal-600"
                                        footer="Total approved"
                                        gradient="bg-gradient-to-br from-teal-400 to-emerald-600"
                                    />
                                    <StatCard
                                        title="Rejected"
                                        value={stats.rejectedTimeOff}
                                        icon="🚨"
                                        color="text-red-600"
                                        footer="Total rejected"
                                        gradient="bg-gradient-to-br from-red-400 to-rose-600"
                                    />
                                </div>
                            </div>

                            {/* Charts Section */}
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Analytics</h2>

                                {/* Trend Bar Chart (Recharts) */}
                                <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                                    <div className="flex flex-col gap-4 mb-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-gray-900">Daily Approval Trend</h3>
                                            <button
                                                onClick={() => setShowCustomDateRange(!showCustomDateRange)}
                                                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                                {showCustomDateRange ? 'Use Quick Select' : 'Custom Range'}
                                            </button>
                                        </div>

                                        {showCustomDateRange ? (
                                            <div className="flex gap-3 items-end">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={trendStartDate || ''}
                                                        onChange={(e) => setTrendStartDate(e.target.value)}
                                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                                    <input
                                                        type="date"
                                                        value={trendEndDate || ''}
                                                        onChange={(e) => setTrendEndDate(e.target.value)}
                                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (trendStartDate && trendEndDate) {
                                                            fetchTrendData(null, trendStartDate, trendEndDate);
                                                            setShowCustomDateRange(false);
                                                        }
                                                    }}
                                                    disabled={!trendStartDate || !trendEndDate || trendLoading}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 flex-wrap">
                                                {[7, 14, 30, 60, 90].map((days) => (
                                                    <button
                                                        key={days}
                                                        onClick={() => {
                                                            setTrendDuration(days);
                                                            setTrendStartDate(null);
                                                            setTrendEndDate(null);
                                                            fetchTrendData(days);
                                                        }}
                                                        disabled={trendLoading}
                                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${trendDuration === days && !showCustomDateRange
                                                            ? 'bg-blue-700 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            } ${trendLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {days}d
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4">Shows the number of leave and on-duty approvals for each day. Select a predefined period or use custom date range.</p>
                                    <div className="relative w-full h-96">
                                        {trendLoading && (
                                            <ModernLoader size="container" message="Updating trend data..." />
                                        )}
                                        <ResponsiveContainer width="100%" height={400}>
                                            <BarChart data={trendBarChartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                <XAxis
                                                    dataKey="day"
                                                    stroke="#6b7280"
                                                    style={{ fontSize: '12px' }}
                                                    label={{ value: 'Day', position: 'insideBottomRight', offset: -10 }}
                                                />
                                                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                                    cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                                                    formatter={(value, name) => {
                                                        const nameMap = { leaves: 'Leave Approvals', onDuty: 'On-Duty Approvals' };
                                                        return [value, nameMap[name] || name];
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                <Bar dataKey="leaves" fill="#10b981" radius={[8, 8, 0, 0]} name="Leave Approvals" />
                                                <Bar dataKey="onDuty" fill="#3b82f6" radius={[8, 8, 0, 0]} name="On-Duty Approvals" />
                                                <Bar dataKey="timeOff" fill="#14b8a6" radius={[8, 8, 0, 0]} name="Time-Off Approvals" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Doughnut Charts Grid (Chart.js) */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                    {/* Leave Distribution Doughnut Chart */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">Leave Request Distribution</h3>
                                        <p className="text-sm text-gray-600 mb-4">Breakdown of all leave requests by status - shows how many are pending, approved, or rejected.</p>
                                        <div style={{ height: '350px', position: 'relative' }}>
                                            <Doughnut data={leaveDoughnutData} options={doughnutOptions} />
                                        </div>
                                    </div>

                                    {/* On-Duty Distribution Doughnut Chart */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">On-Duty Distribution</h3>
                                        <p className="text-sm text-gray-600 mb-4">Breakdown of all on-duty logs by status - shows active, pending, approved, and rejected entries.</p>
                                        <div style={{ height: '350px', position: 'relative' }}>
                                            <Doughnut data={onDutyDoughnutData} options={doughnutOptions} />
                                        </div>
                                    </div>

                                    {/* Time-Off Distribution Doughnut Chart */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">Time-Off Distribution</h3>
                                        <p className="text-sm text-gray-600 mb-4">Breakdown of all time-off requests by status - shows pending, approved, and rejected entries.</p>
                                        <div style={{ height: '350px', position: 'relative' }}>
                                            <Doughnut data={timeOffDoughnutData} options={doughnutOptions} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
                                <Link to="/approvals" className="inline-block px-6 py-3 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors">
                                    Go to All Approvals
                                </Link>
                            </div>
                        </>
                    </div>
                </div>

                {/* Modals - Outside blurred content */}
                {approveModal.show && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                            <div className="bg-green-50 border-b border-green-200 px-6 py-4">
                                <h2 className="text-lg font-bold text-green-900">Approve {approveModal.item?.type === 'leave' ? 'Leave' : (approveModal.item?.type === 'time_off' ? 'Time-Off' : 'On-Duty')} Request</h2>
                                <p className="text-sm text-green-700 mt-1">Are you sure you want to approve this request?</p>
                            </div>
                            <div className="p-6">
                                <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                                    <p className="text-sm text-gray-600"><strong>Name:</strong> {approveModal.item?.name}</p>
                                    <p className="text-sm text-gray-600"><strong>Title:</strong> {approveModal.item?.title}</p>
                                    <p className="text-sm text-gray-600"><strong>Date:</strong> {formatDateForModal(approveModal.item)}</p>
                                </div>
                                {modalError && (
                                    <div className="mb-3 flex items-center gap-3 rounded-lg border-l-[5px] border-red-500 bg-gradient-to-r from-red-50 to-white px-4 py-3 shadow-sm">
                                        <svg className="h-5 w-5 flex-shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                        </svg>
                                        <p className="text-[13px] font-semibold text-red-700">{modalError}</p>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setApproveModal({ show: false, item: null, isLeave: false })}
                                        disabled={!!processingId}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => await performStatusUpdate(approveModal.item, 'approved', approveModal.isLeave)}
                                        disabled={!!processingId}
                                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                                    >
                                        {!!processingId ? (
                                            <>
                                                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            'Confirm Approval'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {rejectModal.show && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                            <div className="bg-red-50 border-b border-red-200 px-6 py-4">
                                <h2 className="text-lg font-bold text-red-900">Reject {rejectModal.item?.type === 'leave' ? 'Leave' : (rejectModal.item?.type === 'time_off' ? 'Time-Off' : 'On-Duty')} Request</h2>
                                <p className="text-sm text-red-700 mt-1">Please provide a reason for rejection</p>
                            </div>
                            <div className="p-6">
                                <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                                    <p className="text-sm text-gray-600"><strong>Name:</strong> {rejectModal.item?.name}</p>
                                    <p className="text-sm text-gray-600"><strong>Title:</strong> {rejectModal.item?.title}</p>
                                    <p className="text-sm text-gray-600"><strong>Date:</strong> {formatDateForModal(rejectModal.item)}</p>
                                </div>
                                <textarea
                                    value={rejectModal.reason}
                                    onChange={e => setRejectModal(r => ({ ...r, reason: e.target.value }))}
                                    placeholder="Enter the reason for rejection..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                                    rows="4"
                                />
                                {modalError && (
                                    <div className="mb-3 flex items-center gap-3 rounded-lg border-l-[5px] border-red-500 bg-gradient-to-r from-red-50 to-white px-4 py-3 shadow-sm">
                                        <svg className="h-5 w-5 flex-shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                        </svg>
                                        <p className="text-[13px] font-semibold text-red-700">{modalError}</p>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setRejectModal({ show: false, item: null, isLeave: false, reason: '' })}
                                        disabled={!!processingId}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium"
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
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                                    >
                                        {!!processingId ? (
                                            <>
                                                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            'Confirm Rejection'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Details Modal */}
                {detailsModal.show && detailsModal.item && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scaleIn border border-gray-200">
                            {/* Header Panel */}
                            <div className="p-6 bg-[#2E5090] text-white relative">
                                <button
                                    onClick={() => setDetailsModal({ ...detailsModal, show: false })}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>

                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-bold shadow-inner border border-white/20">
                                        {detailsModal.isLeave ? '📄' : (detailsModal.item.type === 'time_off' ? '⏱️' : '📍')}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{detailsModal.isLeave ? 'Leave Request Details' : (detailsModal.item.type === 'time_off' ? 'Time-Off Details' : 'On-Duty Details')}</h2>
                                        <p className="text-white/80 text-xs font-semibold tracking-wide">
                                            {detailsModal.isLeave ? 'Leave Application Details' : (detailsModal.item.type === 'time_off' ? 'Hourly Permission Details' : 'On-Duty Transaction Details')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-4">
                                    <span className="px-3 py-1 rounded-md text-[10px] font-bold tracking-wide border bg-orange-500/20 border-orange-400/30 text-orange-100">
                                        Pending Approval
                                    </span>
                                    <span className="text-[10px] font-semibold text-white/70 tracking-wide">
                                        System ID: {detailsModal.item.id}
                                    </span>
                                </div>
                            </div>

                            {/* Content Scrollable */}
                            <div className="p-8 overflow-y-auto hide-scrollbar space-y-8">
                                {/* Employee Header */}
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-[#2E5090]/10 flex items-center justify-center text-xl font-bold text-[#2E5090]">
                                        {detailsModal.item.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{detailsModal.item.name}</h3>
                                        <p className="text-sm text-gray-500 font-medium">Employee ID: {detailsModal.item.staff_id}</p>
                                    </div>
                                </div>

                                {/* Main Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 border-t border-b border-gray-100 py-8">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-[#2E5090] tracking-wide">Category Type</p>
                                        <p className="text-base font-semibold text-gray-900">
                                            {detailsModal.isLeave ? detailsModal.item.title : (detailsModal.item.type === 'time_off' ? 'Time-Off' : detailsModal.item.title)}
                                        </p>
                                        {!detailsModal.isLeave && detailsModal.item.type !== 'time_off' && detailsModal.item.location && (
                                            <p className="text-sm text-[#2E5090] font-medium flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                    <path fillRule="evenodd" d="m9.69 18.94.027.013a2.358 2.358 0 0 0 2.566-.013l.027-.013c.12-.058.214-.144.3-.23.111-.11.23-.235.343-.352l.006-.006c.928-.971 1.636-1.742 2.146-2.583.506-.833.76-1.614.76-2.345 0-2.433-2.029-4.409-4.528-4.409-2.5 0-4.528 1.976-4.528 4.409 0 .731.254 1.512.759 2.345.51.841 1.218 1.612 2.147 2.583l.006.006c.113.117.232.243.343.352.086.086.18.172.3.23ZM10 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                                </svg>
                                                {detailsModal.item.location}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-[#2E5090] tracking-wide">Application Period</p>
                                        <p className="text-base font-semibold text-gray-900">
                                            {detailsModal.isLeave
                                                ? `${calculateLeaveDays(detailsModal.item.start_date, detailsModal.item.end_date) - (detailsModal.item.is_half_day === true || detailsModal.item.is_half_day === 1 ? 0.5 : 0)} Day(s)`
                                                : (detailsModal.item.type === 'time_off'
                                                    ? calculateTimeOffDuration(detailsModal.item.start_time, detailsModal.item.end_time)
                                                    : calculateOnDutyDuration(detailsModal.item.start_time, detailsModal.item.end_time))
                                            }
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-[#2E5090] tracking-wide">Effective Start</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-base font-semibold text-gray-900">
                                                {detailsModal.isLeave 
                                                    ? formatDateOnly(detailsModal.item.start_date) 
                                                    : (detailsModal.item.type === 'time_off' 
                                                        ? `${formatTimeOnly(detailsModal.item.start_time)} (On ${formatDateOnly(detailsModal.item.date)})` 
                                                        : formatInTimezone(detailsModal.item.start_time))}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-[#2E5090] tracking-wide">Effective End</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-base font-semibold text-gray-900">
                                                {detailsModal.isLeave 
                                                    ? formatDateOnly(detailsModal.item.end_date) 
                                                    : (detailsModal.item.type === 'time_off' 
                                                        ? formatTimeOnly(detailsModal.item.end_time) 
                                                        : (detailsModal.item.end_time ? formatInTimezone(detailsModal.item.end_time) : '—'))}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Reason Section */}
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-[#2E5090] tracking-wide">Applied Reason / Purpose</p>
                                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 text-gray-700 leading-relaxed font-medium">
                                        {detailsModal.isLeave 
                                            ? detailsModal.item.reason 
                                            : (detailsModal.item.type === 'time_off' 
                                                ? detailsModal.item.reason 
                                                : detailsModal.item.purpose || 'Task documentation provided.')}
                                    </div>
                                </div>

                                {/* Location Map for On-Duty */}
                                {!detailsModal.isLeave && detailsModal.item.type !== 'time_off' && (
                                    <div className="space-y-3">
                                        <p className="text-xs font-bold text-[#2E5090] tracking-wide">Location Tracking</p>
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

                            {/* Footer Controls */}
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                                <div className="text-[10px] font-semibold text-gray-500 tracking-wide">
                                    Logged: {formatApprovalDate(detailsModal.item.createdAt)}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setDetailsModal({ ...detailsModal, show: false })}
                                        className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-all shadow-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDetailsModal({ ...detailsModal, show: false });
                                            handleReject(detailsModal.item, detailsModal.isLeave);
                                        }}
                                        className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all shadow-md"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDetailsModal({ ...detailsModal, show: false });
                                            handleApprove(detailsModal.item, detailsModal.isLeave);
                                        }}
                                        className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-green-700 transition-all shadow-md shadow-green-100"
                                    >
                                        Approve Request
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* On Leave Detail Modal */}
            {onLeaveDetailModal.show && onLeaveDetailModal.emp && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]"
                    onClick={() => setOnLeaveDetailModal({ show: false, emp: null, dayLabel: '' })}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-[#1e1b4b] p-6 relative">
                            <button
                                onClick={() => setOnLeaveDetailModal({ show: false, emp: null, dayLabel: '' })}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white flex-shrink-0 ${onLeaveDetailModal.dayLabel === 'Today' ? 'bg-red-500' : 'bg-amber-400'}`}>
                                    {onLeaveDetailModal.emp.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white">{onLeaveDetailModal.emp.name}</h2>
                                    <p className="text-white/50 text-xs font-semibold mt-0.5">
                                        {onLeaveDetailModal.emp.email || `Staff ID: ${onLeaveDetailModal.emp.staff_id}`}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${onLeaveDetailModal.dayLabel === 'Today' ? 'bg-red-500/20 text-red-200 border-red-400/30' : 'bg-amber-400/20 text-amber-200 border-amber-400/30'}`}>
                                    On Leave {onLeaveDetailModal.dayLabel}
                                </span>
                                <span className="text-[10px] font-semibold text-white/40 tracking-wide">
                                    #{onLeaveDetailModal.emp.id}
                                </span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {/* Leave Type */}
                            <div className="flex items-center justify-between p-4 bg-[#eef2ff] rounded-xl border border-[#1e1b4b]/10">
                                <div>
                                    <p className="text-[10px] font-black text-[#1e1b4b]/50 uppercase tracking-widest mb-1">Leave Type</p>
                                    <p className="text-base font-black text-[#1e1b4b]">{onLeaveDetailModal.emp.leave_type}</p>
                                </div>
                                {onLeaveDetailModal.emp.is_half_day && (
                                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                                        Half Day
                                    </span>
                                )}
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">From</p>
                                    <p className="text-sm font-bold text-gray-800">{formatDateOnly(onLeaveDetailModal.emp.start_date)}</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">To</p>
                                    <p className="text-sm font-bold text-gray-800">{formatDateOnly(onLeaveDetailModal.emp.end_date)}</p>
                                </div>
                            </div>

                            {/* Duration */}
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Duration</p>
                                <p className="text-sm font-black text-[#1e1b4b]">
                                    {(() => {
                                        if (onLeaveDetailModal.emp.is_time_off) {
                                            return 'Partial Day';
                                        }
                                        const days = calculateLeaveDays(onLeaveDetailModal.emp.start_date, onLeaveDetailModal.emp.end_date) - (onLeaveDetailModal.emp.is_half_day ? 0.5 : 0);
                                        return `${days} ${days === 1 ? 'Day' : 'Days'}`;
                                    })()}
                                </p>
                            </div>

                            {/* Approved By */}
                            <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-xl border border-green-100">
                                <p className="text-xs font-black text-green-700/60 uppercase tracking-widest">Approved By</p>
                                <div className="flex items-center gap-2">
                                    {onLeaveDetailModal.emp.approved_by ? (
                                        <>
                                            <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-[9px] font-black text-white flex-shrink-0">
                                                {onLeaveDetailModal.emp.approved_by.charAt(0).toUpperCase()}
                                            </div>
                                            <p className="text-sm font-bold text-green-800">{onLeaveDetailModal.emp.approved_by}</p>
                                        </>
                                    ) : (
                                        <p className="text-sm font-bold text-gray-400">—</p>
                                    )}
                                </div>
                            </div>

                            {/* Reason */}
                            {onLeaveDetailModal.emp.reason && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-[#1e1b4b]/50 uppercase tracking-widest">Reason</p>
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-700 text-sm font-medium leading-relaxed">
                                        {onLeaveDetailModal.emp.reason}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6">
                            <button
                                onClick={() => setOnLeaveDetailModal({ show: false, emp: null, dayLabel: '' })}
                                className="w-full py-3 bg-[#1e1b4b] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#2d2a6e] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const calculateOnDutyDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'In Progress';
    const start = parseAppTimezone(startTime);
    const end = parseAppTimezone(endTime);
    if (!start || !end) return 'In Progress';

    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
};

const formatApprovalDate = (dateString) => {
    if (!dateString) return '—';
    return formatInTimezone(dateString);
};

export default Dashboard;
