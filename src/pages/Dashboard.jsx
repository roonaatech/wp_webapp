import React, { useState, useEffect } from 'react';
import '../hide-scrollbar.css';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';

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
                    } catch (error) {
                        console.error('Error updating status:', error);
                        setModalError(error.response?.data?.message || 'Failed to update request');
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
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [pendingApprovalsLoading, setPendingApprovalsLoading] = useState(false);

    useEffect(() => {
        console.log('Dashboard mounted');
        fetchDashboardStats();
        fetchPendingApprovals();
    }, []);

    useEffect(() => {
        // Fetch trend data when duration changes
        fetchTrendData(trendDuration);
    }, [trendDuration]);

    const fetchTrendData = async (days) => {
        try {
            setTrendLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                return;
            }
            
            const url = `${API_BASE_URL}/api/admin/dashboard/daily-trend?days=${days}`;
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
            if (!token) {
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

    const StatCard = ({ title, value, icon, color, footer }) => (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-gray-500 text-sm font-medium">{title}</p>
                    <p className={`text-4xl font-bold mt-2 ${color}`}>{value}</p>
                    {footer && <p className="text-gray-400 text-xs mt-2">{footer}</p>}
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl bg-gray-50`}>
                    {icon}
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
            backgroundColor: ['#2E5090', '#8FA3D1', '#C1272D'],
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
            backgroundColor: ['#2E5090', '#8FA3D1', '#C1272D', '#E8E8E8'],
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
                    font: { size: 12, weight: '500' },
                    color: '#374151'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 10,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        return label + ': ' + value;
                    }
                }
            }
        }
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
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8 relative">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">On-Duty and Leave Dashboard</h1>
                    <p className="text-gray-600 mt-1">Overview of leave and on-duty management system.</p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-800 font-medium">⚠️ {error}</p>
                    </div>
                )}

                {loading ? (
                    <ModernLoader size="lg" message="Loading Dashboard..." />
                ) : (
                    <div className={`transition-all duration-300 ${(approveModal.show || rejectModal.show) ? 'blur-sm' : ''}`}>
                        <>
                        {/* Pending Approvals Section - Highlighted at Top (only shown if there are pending approvals) */}
                        {!pendingApprovalsLoading && pendingApprovals.length > 0 && (
                        <div className="mb-8 relative rounded-2xl overflow-visible flex flex-col md:flex-row items-stretch bg-orange-50/80 backdrop-blur-lg border border-orange-300/60 shadow-xl ring-2 ring-orange-400/20 animate-fadeInUp min-h-0" style={{boxShadow: '0 8px 32px 0 rgba(251, 146, 60, 0.18)'}}>
                            {/* Glassmorphism floating accent bar */}
                            <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-orange-500 via-orange-400 to-red-400 rounded-l-2xl animate-pulse"></div>
                            {/* Icon and header */}
                            <div className="flex flex-col justify-center py-2 md:py-0 pl-8 pr-0 md:pl-8 md:pr-0 z-10 min-w-[180px] min-h-0 h-auto">
                                <h2 className="text-xl font-extrabold text-orange-800 tracking-tight drop-shadow mb-1 text-left">Pending Approvals</h2>
                                <div className="flex justify-start mt-2 mb-2 w-full">
                                    <Link 
                                        to="/approvals" 
                                        className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-400 text-white rounded-full font-semibold text-sm shadow hover:from-orange-600 hover:to-red-500 transition-all"
                                    >
                                        View All →
                                    </Link>
                                </div>
                            </div>
                            {/* Horizontal scrollable row of pending approvals with arrows */}
                            <div className="flex-1 flex items-center px-4 py-2 md:py-0 md:px-8 relative overflow-x-hidden">
                                <button
                                    type="button"
                                    className="absolute left-2 z-20 bg-transparent hover:bg-transparent text-red-600 w-10 h-10 flex items-center justify-center focus:outline-none transition-all duration-200"
                                    style={{top: '50%', transform: 'translateY(-50%)'}}
                                    onClick={() => {
                                        const container = document.getElementById('pending-approvals-scroll');
                                        if (container) container.scrollBy({ left: -320, behavior: 'smooth' });
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" className="w-8 h-8">
                                        <circle cx="16" cy="16" r="14" stroke="red" strokeWidth="2" fill="none"/>
                                        <path d="M20 25L12 16L20 7" stroke="red" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </button>
                                <div
                                    id="pending-approvals-scroll"
                                    className="flex gap-6 px-2 md:px-6 lg:px-10 hide-scrollbar"
                                    style={{overflowX: 'auto', overflowY: 'hidden', scrollBehavior: 'smooth', minWidth: 0}}
                                >
                                    {pendingApprovals.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            className="bg-white/95 rounded-2xl border border-orange-300/60 shadow-lg px-6 py-4 my-2 hover:scale-[1.02] hover:shadow-2xl transition-all duration-200 relative overflow-hidden group min-h-[70px] min-w-[180px] max-w-[260px] w-fit flex-shrink-0 flex flex-col justify-start items-start text-left"
                                            style={{backdropFilter: 'blur(8px)', borderColor: '#fdba74'}}>
                                            {/* Animated accent dot */}
                                            <span className="absolute top-4 right-4 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-orange-400 to-red-400 animate-pulse"></span>
                                            <div className="flex items-center mb-2">
                                                <h3
                                                    className={`text-xs mb-1 font-semibold rounded px-1 py-0.5 max-w-[200px] overflow-x-auto whitespace-nowrap ${item.type === 'leave' ? 'text-blue-700 bg-blue-100/70' : 'text-purple-700 bg-purple-100/70'}`}
                                                    title={item.name}
                                                    style={{wordBreak: 'normal'}}
                                                >
                                                    {item.name}
                                                </h3>
                                            </div>
                                            <p className="text-xs text-orange-700 mb-1 font-normal whitespace-nowrap leading-tight bg-orange-50/60 rounded px-1 py-0.5 max-w-[200px] overflow-x-auto" title={item.title} style={{wordBreak: 'normal'}}>{item.title}</p>
                                            <p className="text-xs text-orange-400">
                                                {new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                            <div className="flex-1"></div>
                                            <div className="flex gap-2 mt-3 w-full justify-end">
                                                <button
                                                    className="p-0.5 rounded bg-green-500 hover:bg-green-600 text-white shadow transition-colors flex items-center justify-center min-w-0 min-h-0 h-7 w-7 pointer-events-auto"
                                                    title="Approve"
                                                    type="button"
                                                    style={{maxWidth:'28px',maxHeight:'28px'}}
                                                    onClick={e => { e.stopPropagation(); handleApprove(item, item.type === 'leave'); }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="p-0.5 rounded bg-red-500 hover:bg-red-600 text-white shadow transition-colors flex items-center justify-center min-w-0 min-h-0 h-7 w-7 pointer-events-auto"
                                                    title="Reject"
                                                    type="button"
                                                    style={{maxWidth:'28px',maxHeight:'28px'}}
                                                    onClick={e => { e.stopPropagation(); handleReject(item, item.type === 'leave'); }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <Link
                                                to="/approvals"
                                                className="absolute inset-0 z-0 pointer-events-none"
                                                tabIndex={-1}
                                                aria-label="View approval details"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="absolute right-2 z-20 bg-transparent hover:bg-transparent text-red-600 w-10 h-10 flex items-center justify-center focus:outline-none transition-all duration-200"
                                    style={{top: '50%', transform: 'translateY(-50%)'}}
                                    onClick={() => {
                                        const container = document.getElementById('pending-approvals-scroll');
                                        if (container) container.scrollBy({ left: 320, behavior: 'smooth' });
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" className="w-8 h-8">
                                        <circle cx="16" cy="16" r="14" stroke="red" strokeWidth="2" fill="none"/>
                                        <path d="M12 7L20 16L12 25" stroke="red" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </button>

                            </div>
                        </div>
                        )}

                        {/* Summary Section */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Summary</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <StatCard
                                title="Total Leave Requests"
                                value={stats.pendingLeaves + stats.approvedLeaves + stats.rejectedLeaves}
                                icon="📄"
                                color="text-blue-600"
                                footer="All leave requests"
                            />
                            <StatCard
                                title="Total On-Duty Logs"
                                value={stats.pendingOnDuty + stats.approvedOnDuty + stats.rejectedOnDuty + stats.activeOnDuty}
                                icon="📍"
                                color="text-purple-600"
                                footer="All on-duty logs"
                            />
                        </div>
                    </div>

                    {/* Leave Section */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Leave Requests</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard
                                title="Pending Leaves"
                                value={stats.pendingLeaves}
                                icon="⏳"
                                color="text-orange-600"
                                footer="Requires Attention"
                            />
                            <StatCard
                                title="Approved Leaves"
                                value={stats.approvedLeaves}
                                icon="✅"
                                color="text-green-600"
                                footer="Total approved"
                            />
                            <StatCard
                                title="Rejected Leaves"
                                value={stats.rejectedLeaves}
                                icon="❌"
                                color="text-red-600"
                                footer="Total rejected"
                            />
                        </div>
                    </div>

                    {/* On-Duty Section */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">On-Duty Logs</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                title="Active On-Duty"
                                value={stats.activeOnDuty}
                                icon="🟢"
                                color="text-blue-600"
                                footer="Currently active"
                            />
                            <StatCard
                                title="Pending On-Duty"
                                value={stats.pendingOnDuty}
                                icon="⏳"
                                color="text-orange-600"
                                footer="Awaiting approval"
                            />
                            <StatCard
                                title="Approved On-Duty"
                                value={stats.approvedOnDuty}
                                icon="✔️"
                                color="text-green-600"
                                footer="Total approved"
                            />
                            <StatCard
                                title="Rejected On-Duty"
                                value={stats.rejectedOnDuty}
                                icon="❌"
                                color="text-red-600"
                                footer="Total rejected"
                            />
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Analytics</h2>
                        
                        {/* Trend Bar Chart (Recharts) */}
                        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-gray-900">Daily Approval Trend</h3>
                                <div className="flex gap-2">
                                    {[7, 14, 30].map((days) => (
                                        <button
                                            key={days}
                                            onClick={() => setTrendDuration(days)}
                                            disabled={trendLoading}
                                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                                trendDuration === days
                                                    ? 'bg-blue-700 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            } ${trendLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {days}d
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">Shows the number of leave and on-duty approvals for each day. Select 7d, 14d, or 30d to view trends over different time periods.</p>
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
