import React, { useState, useEffect } from 'react';
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
import { canApproveLeave, canApproveOnDuty, canManageUsers } from '../utils/roleUtils';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

const Dashboard = () => {
    // Approve/Reject API call for pending approvals
    const performStatusUpdate = async (item, status, isLeave, rejectionReason = null) => {
        const itemKey = `${isLeave ? 'leave' : 'onduty'}-${item.id}-${status}`;
        setProcessingId(itemKey);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setModalError('No authentication token found.');
                setProcessingId(null);
                return;
            }

            const endpoint = isLeave
                ? `${API_BASE_URL}/api/leave/${item.id}/status`
                : `${API_BASE_URL}/api/onduty/${item.id}/status`;

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
            const employeeName = item.tblstaff ? `${item.tblstaff.firstname} ${item.tblstaff.lastname}` : 'Request';
            toast.success(`${employeeName}'s ${isLeave ? 'leave' : 'on-duty'} ${statusStr.toLowerCase()} successfully`, {
                style: {
                    background: statusStr === 'Approved' ? '#059669' : '#dc2626',
                    color: '#fff'
                }
            });
        } catch (error) {
            console.error('Error updating status:', error);
            const errorMsg = error.response?.data?.message || 'Failed to update request';
            setModalError(errorMsg);
            toast.error(errorMsg);
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
    const [modalError, setModalError] = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [stats, setStats] = useState({
        pendingLeaves: 0,
        approvedLeaves: 0,
        rejectedLeaves: 0,
        pendingOnDuty: 0,
        approvedOnDuty: 0,
        rejectedOnDuty: 0,
        activeOnDuty: 0
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
                activeOnDuty: Number(response.data.activeOnDuty) || 0
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
                    title: item.type === 'leave' ? item.title : item.title.replace('On-Duty: ', ''),
                    start_date: item.start_date,
                    end_date: item.end_date,
                    status: item.status,
                    createdAt: item.createdAt
                };
            });

            setPendingApprovals(pendingItems);
        } catch (error) {
            console.error('Error fetching pending approvals:', error);
        } finally {
            setPendingApprovalsLoading(false);
        }
    };

    const formatDateForModal = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const generateTrendData = (statsData, days = 7) => {
        const today = new Date();
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
                    <div className="mb-8 bg-orange-50 border-l-4 border-orange-500 rounded-r-2xl p-6 shadow-sm transform transition-all hover:scale-[1.01] duration-300">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-orange-900 mb-2 flex items-center gap-2">
                                    <span className="animate-pulse">●</span> Action Required: Incomplete Profiles
                                </h3>
                                <p className="text-orange-800 mb-4 font-medium">
                                    {incompleteProfiles.length} active user(s) have not been assigned a Role or Gender. They will be unable to log in until this is resolved.
                                </p>
                                <Link
                                    to="/users?status=incomplete"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-bold shadow-sm border border-orange-100 hover:bg-orange-50 hover:shadow-md transition-all"
                                >
                                    Review & Update Profiles →
                                </Link>
                            </div>
                            <div className="bg-orange-100 p-4 rounded-2xl shadow-inner">
                                <span className="text-3xl">⚠️</span>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <ModernLoader size="lg" message="Loading Dashboard..." />
                ) : (
                    <div className={`transition-all duration-300 ${(approveModal.show || rejectModal.show) ? 'blur-sm' : ''}`}>
                        <>
                            {/* Pending Approvals Section */}
                            {!pendingApprovalsLoading && pendingApprovals.length > 0 && (
                                <div className="mb-12 relative rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row items-stretch bg-white border border-gray-100 shadow-2xl animate-fadeInUp min-h-0">
                                    {/* Left Side Info Panel */}
                                    <div className="bg-gradient-to-br from-orange-500 to-red-500 p-10 flex flex-col justify-center min-w-[280px]">
                                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl mb-6 backdrop-blur-md border border-white/30 shadow-inner">
                                            ⚡
                                        </div>
                                        <h2 className="text-2xl font-black text-white leading-tight mb-2">Pending Actions</h2>
                                        <p className="text-orange-100 text-sm font-medium mb-8 leading-relaxed opacity-90">Quickly review and manage urgent employee requests.</p>
                                        <Link
                                            to="/approvals"
                                            className="inline-flex items-center justify-center px-6 py-3 bg-white text-orange-600 rounded-2xl font-bold text-sm shadow-xl hover:scale-105 transition-transform"
                                        >
                                            View All Requests
                                        </Link>
                                    </div>

                                    {/* Scrollable Requests Panel */}
                                    <div className="flex-1 flex items-center px-10 py-10 relative bg-gray-50/50">
                                        <button
                                            type="button"
                                            className="absolute left-4 z-20 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:scale-110 transition-all focus:outline-none"
                                            onClick={() => {
                                                const container = document.getElementById('pending-approvals-scroll');
                                                if (container) container.scrollBy({ left: -350, behavior: 'smooth' });
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                            </svg>
                                        </button>

                                        <div
                                            id="pending-approvals-scroll"
                                            className="flex gap-8 px-6 hide-scrollbar overflow-x-auto scroll-smooth"
                                            style={{ overflowY: 'hidden' }}
                                        >
                                            {pendingApprovals.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="bg-white rounded-[2rem] border border-gray-100 shadow-xl px-7 py-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative group min-w-[260px] max-w-[280px] flex-shrink-0 flex flex-col"
                                                >
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${item.type === 'leave' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                                                            {item.type}
                                                        </div>
                                                        <div className="text-[11px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                                                            {new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </div>
                                                    </div>

                                                    <h3 className="text-lg font-black text-gray-900 leading-tight mb-2 line-clamp-1">{item.name}</h3>
                                                    <p className="text-gray-500 text-sm font-medium line-clamp-2 mb-8 leading-relaxed italic">"{item.title}"</p>

                                                    <div className="mt-auto flex gap-3">
                                                        <button
                                                            onClick={() => handleApprove(item, item.type === 'leave')}
                                                            className="flex-1 py-3 bg-green-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-green-100 hover:bg-green-600 hover:scale-105 transition-all flex items-center justify-center"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(item, item.type === 'leave')}
                                                            className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl font-bold flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            className="absolute right-4 z-20 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:scale-110 transition-all focus:outline-none"
                                            onClick={() => {
                                                const container = document.getElementById('pending-approvals-scroll');
                                                if (container) container.scrollBy({ left: 350, behavior: 'smooth' });
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Summary Section */}
                            <div className="mb-12">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">System Summary</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <StatCard
                                        title="Total Leave Requests"
                                        value={stats.pendingLeaves + stats.approvedLeaves + stats.rejectedLeaves}
                                        icon="📄"
                                        color="text-blue-600"
                                        footer="Engagement overview"
                                        gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
                                    />
                                    <StatCard
                                        title="Total On-Duty Logs"
                                        value={stats.pendingOnDuty + stats.approvedOnDuty + stats.rejectedOnDuty + stats.activeOnDuty}
                                        icon="📍"
                                        color="text-purple-600"
                                        footer="Operational overview"
                                        gradient="bg-gradient-to-br from-purple-500 to-pink-600"
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
                                            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded-lg z-10">
                                                <ModernLoader />
                                            </div>
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
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Doughnut Charts Grid (Chart.js) */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
                )}

                {/* Modals - Outside blurred content */}
                {approveModal.show && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                            <div className="bg-green-50 border-b border-green-200 px-6 py-4">
                                <h2 className="text-lg font-bold text-green-900">Approve {approveModal.isLeave ? 'Leave' : 'On-Duty'} Request</h2>
                                <p className="text-sm text-green-700 mt-1">Are you sure you want to approve this request?</p>
                            </div>
                            <div className="p-6">
                                <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                                    <p className="text-sm text-gray-600"><strong>Name:</strong> {approveModal.item?.name}</p>
                                    <p className="text-sm text-gray-600"><strong>Title:</strong> {approveModal.item?.title}</p>
                                    <p className="text-sm text-gray-600"><strong>Date:</strong> {formatDateForModal(approveModal.item?.start_date)}</p>
                                </div>
                                {modalError && <div className="text-red-600 text-sm mb-2">{modalError}</div>}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setApproveModal({ show: false, item: null, isLeave: false })}
                                        disabled={processingId === `leave-${approveModal.item?.id}-approved` || processingId === `onduty-${approveModal.item?.id}-approved`}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => await performStatusUpdate(approveModal.item, 'approved', approveModal.isLeave)}
                                        disabled={processingId === `leave-${approveModal.item?.id}-approved` || processingId === `onduty-${approveModal.item?.id}-approved`}
                                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                                    >
                                        {processingId === `leave-${approveModal.item?.id}-approved` || processingId === `onduty-${approveModal.item?.id}-approved` ? (
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
                                <h2 className="text-lg font-bold text-red-900">Reject {rejectModal.isLeave ? 'Leave' : 'On-Duty'} Request</h2>
                                <p className="text-sm text-red-700 mt-1">Please provide a reason for rejection</p>
                            </div>
                            <div className="p-6">
                                <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                                    <p className="text-sm text-gray-600"><strong>Name:</strong> {rejectModal.item?.name}</p>
                                    <p className="text-sm text-gray-600"><strong>Title:</strong> {rejectModal.item?.title}</p>
                                    <p className="text-sm text-gray-600"><strong>Date:</strong> {formatDateForModal(rejectModal.item?.start_date)}</p>
                                </div>
                                <textarea
                                    value={rejectModal.reason}
                                    onChange={e => setRejectModal(r => ({ ...r, reason: e.target.value }))}
                                    placeholder="Enter the reason for rejection..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                                    rows="4"
                                />
                                {modalError && <div className="text-red-600 text-sm mb-2">{modalError}</div>}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setRejectModal({ show: false, item: null, isLeave: false, reason: '' })}
                                        disabled={processingId === `leave-${rejectModal.item?.id}-rejected` || processingId === `onduty-${rejectModal.item?.id}-rejected`}
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
                                        disabled={processingId === `leave-${rejectModal.item?.id}-rejected` || processingId === `onduty-${rejectModal.item?.id}-rejected`}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                                    >
                                        {processingId === `leave-${rejectModal.item?.id}-rejected` || processingId === `onduty-${rejectModal.item?.id}-rejected` ? (
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
            </div>
        </div>
    );
};

export default Dashboard;
