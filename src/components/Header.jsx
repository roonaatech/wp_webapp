import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import BrandLogo from './BrandLogo';

const Header = () => {
    const [showMenu, setShowMenu] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [loadingCount, setLoadingCount] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{"email":"Admin User"}');

    useEffect(() => {
        fetchPendingCount();
        // Refresh pending count every 30 seconds
        const interval = setInterval(fetchPendingCount, 30000);

        // Listen for approval events to refresh count immediately
        const handleApprovalChange = () => {
            fetchPendingCount();
        };
        window.addEventListener('approvalStatusChanged', handleApprovalChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('approvalStatusChanged', handleApprovalChange);
        };
    }, []);

    // Refetch count whenever route changes
    useEffect(() => {
        fetchPendingCount();
    }, [location.pathname]);

    const fetchPendingCount = async () => {
        try {
            setLoadingCount(true);
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.get(`${API_BASE_URL}/api/leave/requests`,
                {
                    params: { status: 'Pending', limit: 1, page: 1 },
                    headers: { 'x-access-token': token }
                }
            );

            // Get pending leaves count
            const pendingLeaves = response.data.pagination?.totalCount || 0;

            // Get pending on-duty count
            const onDutyResponse = await axios.get(`${API_BASE_URL}/api/onduty`,
                {
                    params: { status: 'Pending', limit: 1, page: 1 },
                    headers: { 'x-access-token': token }
                }
            );

            const pendingOnDuty = onDutyResponse.data.pagination?.totalCount || 0;
            setPendingCount(pendingLeaves + pendingOnDuty);
        } catch (error) {
            console.error('Error fetching pending count:', error);
        } finally {
            setLoadingCount(false);
        }
    };

    const handleNotificationClick = () => {
        navigate('/approvals');
    }

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            const token = localStorage.getItem('token');
            // Call backend logout endpoint to log activity
            if (token) {
                await axios.post(
                    `${API_BASE_URL}/api/auth/logout`,
                    {},
                    { headers: { 'x-access-token': token } }
                );
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Continue with logout even if logging fails
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            toast.success('Logged out. See you soon!', {
                style: {
                    background: '#4b5563',
                    color: '#fff'
                }
            });
            navigate('/session-expired', { state: { reason: 'logout' } });
        }
    };

    return (
        <header className="bg-[var(--header-bg)] border-b border-[var(--border-color)] shadow-sm transition-colors duration-300">
            <div className="flex items-center justify-between px-8 py-4">
                <div className="flex items-center gap-3">
                    <BrandLogo showText={false} iconSize="w-10 h-10" />
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-main)] transition-colors">WorkPulse</h1>
                        <p className="text-sm text-[var(--text-muted)]">Leave and On-Duty Management System</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <button
                            onClick={handleNotificationClick}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative group"
                            title="View pending approvals"
                        >
                            <svg className={`w-6 h-6 transition-colors ${pendingCount > 0 ? 'text-red-500' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {pendingCount > 0 && (
                                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                                    {pendingCount > 99 ? '99+' : pendingCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="relative">
                        <div className="flex items-center gap-3 pl-4 border-l border-[var(--border-color)] cursor-pointer group" onClick={() => setShowMenu(!showMenu)}>
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-[var(--text-main)] group-hover:text-blue-500 transition-colors uppercase tracking-tight">{user.firstname || 'Admin'}</p>
                                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <p className="text-[11px] text-[var(--text-muted)] font-medium">{user.role === 1 ? 'Administrator' : 'Manager'}</p>
                                </div>
                            </div>
                            <button className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-all transform group-hover:scale-105 active:scale-95">
                                {(user.firstname || 'A').charAt(0)}
                            </button>
                        </div>

                        {/* Dropdown Menu */}
                        {showMenu && (
                            <div className="absolute right-0 mt-3 w-56 bg-[var(--header-bg)] rounded-xl shadow-2xl border border-[var(--border-color)] z-50 p-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-[var(--border-color)] mb-1 block sm:hidden">
                                    <p className="text-sm font-bold text-[var(--text-main)] uppercase">{user.firstname || 'Admin'}</p>
                                    <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                                </div>
                                <button className="w-full text-left px-3 py-2.5 text-sm text-[var(--text-main)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-3">
                                    <span className="text-lg">⚙️</span>
                                    <span className="font-medium">Settings</span>
                                </button>
                                <button className="w-full text-left px-3 py-2.5 text-sm text-[var(--text-main)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-3">
                                    <span className="text-lg">❓</span>
                                    <span className="font-medium">Support</span>
                                </button>
                                <div className="border-t border-[var(--border-color)] my-1 pt-1">
                                    <button
                                        onClick={handleLogout}
                                        disabled={isLoggingOut}
                                        className="w-full text-left px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all disabled:opacity-60 flex items-center gap-3 font-bold"
                                    >
                                        {isLoggingOut ? (
                                            <>
                                                <span className="inline-block w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                                                <span>Logging out...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-lg">🚪</span>
                                                <span>Sign Out</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
