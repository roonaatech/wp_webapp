import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import BrandLogo from './BrandLogo';
import { getRoleDisplayName, canApproveLeave, canApproveOnDuty, canManageUsers, canViewBirthdays, canViewAnniversaries } from '../utils/roleUtils';
import { formatDateOnly } from '../utils/timezone.util';
import ChangePasswordModal from './ChangePasswordModal';

const Header = () => {
    const [showMenu, setShowMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [loadingCount, setLoadingCount] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [notifications, setNotifications] = useState({
        leaves: [],
        onDuty: [],
        incompleteProfiles: [],
        birthdays: [],
        pendingWishCount: 0,
        anniversaries: [],
        pendingAnniversaryWishCount: 0
    });
    const menuRef = useRef(null);
    const notificationsRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{"email":"Admin User"}');

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        if (showMenu || showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu, showNotifications]);

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
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            if (!token) return;

            // Get pending leaves count and details if allowed
            let pendingLeaves = 0;
            let leaves = [];
            if (canApproveLeave(user.role)) {
                try {
                    const response = await axios.get(`${API_BASE_URL}/api/leave/requests`,
                        {
                            params: { status: 'Pending', limit: 5, page: 1 },
                            headers: { 'x-access-token': token }
                        }
                    );
                    leaves = response.data.data || [];
                    pendingLeaves = response.data.pagination?.totalCount || 0;
                } catch (e) { console.error('Error fetching leave count:', e); }
            }

            // Get pending on-duty count and details if allowed
            let pendingOnDuty = 0;
            let onDuty = [];
            if (canApproveOnDuty(user.role)) {
                try {
                    const onDutyResponse = await axios.get(`${API_BASE_URL}/api/onduty`,
                        {
                            params: { status: 'Pending', limit: 5, page: 1 },
                            headers: { 'x-access-token': token }
                        }
                    );
                    onDuty = onDutyResponse.data.data || [];
                    pendingOnDuty = onDutyResponse.data.pagination?.totalCount || 0;
                } catch (e) { console.error('Error fetching on-duty count:', e); }
            }

            // Get incomplete profiles if allowed
            let incompleteProfiles = [];
            if (canManageUsers(user.role)) {
                try {
                    const response = await axios.get(`${API_BASE_URL}/api/admin/incomplete-profiles`, {
                        headers: { 'x-access-token': token }
                    });
                    incompleteProfiles = response.data || [];
                } catch (error) {
                    console.error('Error fetching incomplete profiles:', error);
                }
            }

            // Get birthdays if allowed
            let birthdays = [];
            let pendingWishCount = 0;
            if (canViewBirthdays(user.role)) {
                try {
                    const response = await axios.get(`${API_BASE_URL}/api/admin/dashboard/birthdays`, {
                        headers: { 'x-access-token': token }
                    });
                    birthdays = response.data.birthdays || [];
                    pendingWishCount = birthdays.filter(
                        b => !b.wish_sent && (b.wish_recipients || []).length > 0
                    ).length;
                } catch (error) {
                    console.error('Error fetching birthdays:', error);
                }
            }

            // Get anniversaries if allowed
            let anniversaries = [];
            let pendingAnniversaryWishCount = 0;
            if (canViewAnniversaries(user.role)) {
                try {
                    const response = await axios.get(`${API_BASE_URL}/api/admin/dashboard/anniversaries`, {
                        headers: { 'x-access-token': token }
                    });
                    anniversaries = response.data.anniversaries || [];
                    pendingAnniversaryWishCount = anniversaries.filter(
                        a => !a.wish_sent && (a.wish_recipients || []).length > 0
                    ).length;
                } catch (error) {
                    console.error('Error fetching anniversaries:', error);
                }
            }

            setNotifications({
                leaves,
                onDuty,
                incompleteProfiles,
                birthdays,
                pendingWishCount,
                anniversaries,
                pendingAnniversaryWishCount
            });

            // Calculate total count (approvals count + 1 if there are incomplete profiles + 1 if there are birthdays + 1 if there are anniversaries)
            const approvalCount = pendingLeaves + pendingOnDuty;
            const incompleteCount = incompleteProfiles.length > 0 ? 1 : 0;
            const birthdayCount = birthdays.length > 0 ? 1 : 0;
            const anniversaryCount = anniversaries.length > 0 ? 1 : 0;
            setPendingCount(approvalCount + incompleteCount + birthdayCount + anniversaryCount);
        } catch (error) {
            console.error('Error fetching pending count:', error);
        } finally {
            setLoadingCount(false);
        }
    };

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
                    <div className="relative" ref={notificationsRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={`p-2 rounded-lg transition-colors relative group ${showNotifications ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            title="View notifications"
                        >
                            <svg className={`w-6 h-6 transition-colors ${pendingCount > 0 ? 'text-red-500' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {pendingCount > 0 && (
                                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-sm animate-pulse">
                                    {pendingCount > 99 ? '99+' : pendingCount}
                                </span>
                            )}
                        </button>

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 p-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Required Actions</h3>
                                    {pendingCount > 0 && (
                                        <span className="text-[10px] font-extrabold bg-red-50 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            {pendingCount} Pending
                                        </span>
                                    )}
                                </div>
                                <div className="max-h-96 overflow-y-auto py-1 divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {pendingCount === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                                            <span className="text-2xl mb-2">✨</span>
                                            <p className="text-xs font-bold text-slate-400">All caught up! No pending actions.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Incomplete Profiles Notification */}
                                            {notifications.incompleteProfiles.length > 0 && (
                                                <div 
                                                    onClick={() => {
                                                        navigate('/users?status=incomplete');
                                                        setShowNotifications(false);
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex gap-3 items-start"
                                                >
                                                    <span className="text-lg bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg flex-shrink-0">⚠️</span>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">Incomplete Profiles</p>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                            {notifications.incompleteProfiles.length} active user(s) missing Role or Gender.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Birthdays Today Notification */}
                                            {notifications.birthdays.length > 0 && (
                                                <div 
                                                    onClick={() => {
                                                        navigate('/');
                                                        setShowNotifications(false);
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex gap-3 items-start"
                                                >
                                                    <span className="text-lg bg-pink-50 dark:bg-pink-950/30 p-1.5 rounded-lg flex-shrink-0">🎂</span>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">{notifications.birthdays.length} Birthday{notifications.birthdays.length > 1 ? 's' : ''} Today</p>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                            {notifications.pendingWishCount > 0 
                                                                ? `${notifications.pendingWishCount} wish${notifications.pendingWishCount > 1 ? 'es' : ''} still to send.` 
                                                                : 'All wishes have been sent. 🎉'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Anniversaries Today Notification */}
                                            {notifications.anniversaries.length > 0 && (
                                                <div 
                                                    onClick={() => {
                                                        navigate('/');
                                                        setShowNotifications(false);
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex gap-3 items-start"
                                                >
                                                    <span className="text-lg bg-teal-50 dark:bg-teal-950/30 p-1.5 rounded-lg flex-shrink-0">🏆</span>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">{notifications.anniversaries.length} Work Anniversary{notifications.anniversaries.length > 1 ? 'ies' : ''} Today</p>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                            {notifications.pendingAnniversaryWishCount > 0 
                                                                ? `${notifications.pendingAnniversaryWishCount} wish${notifications.pendingAnniversaryWishCount > 1 ? 'es' : ''} still to send.` 
                                                                : 'All wishes have been sent. 🎉'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Pending Leaves requests */}
                                            {notifications.leaves.map((item) => (
                                                <div 
                                                    key={`leave-${item.id}`}
                                                    onClick={() => {
                                                        navigate('/approvals');
                                                        setShowNotifications(false);
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex gap-3 items-start"
                                                >
                                                    <span className="text-lg bg-blue-50 dark:bg-blue-950/30 p-1.5 rounded-lg flex-shrink-0">🌴</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                                                            <span className="text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded flex-shrink-0 uppercase">Leave</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                                                            {item.leave_type} Request
                                                        </p>
                                                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                                                            Starts {formatDateOnly(item.start_date)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Pending On Duty requests */}
                                            {notifications.onDuty.map((item) => (
                                                <div 
                                                    key={`onduty-${item.id}`}
                                                    onClick={() => {
                                                        navigate('/approvals');
                                                        setShowNotifications(false);
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex gap-3 items-start"
                                                >
                                                    <span className="text-lg bg-teal-50 dark:bg-teal-950/30 p-1.5 rounded-lg flex-shrink-0">⚡</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                                                            <span className="text-[9px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/20 px-1.5 py-0.5 rounded flex-shrink-0 uppercase">On-Duty</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                                                            {item.title}
                                                        </p>
                                                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                                                            Date: {formatDateOnly(item.start_date)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                                    <button 
                                        onClick={() => {
                                            navigate('/approvals');
                                            setShowNotifications(false);
                                        }}
                                        className="w-full py-2 bg-slate-900 dark:bg-slate-800 hover:bg-[#0ea5e9] dark:hover:bg-[#0ea5e9] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all text-center"
                                    >
                                        Go To Approvals
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative" ref={menuRef}>
                        <div className="flex items-center gap-3 pl-4 border-l border-[var(--border-color)] cursor-pointer group" onClick={() => setShowMenu(!showMenu)}>
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-[var(--text-main)] group-hover:text-[#0ea5e9] transition-colors uppercase tracking-tight">{user.firstname || 'Admin'}</p>
                                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9] animate-pulse"></span>
                                    <p className="text-[11px] text-[var(--text-muted)] font-medium">{getRoleDisplayName(user.role)}</p>
                                </div>
                            </div>
                            <button className="w-10 h-10 bg-[#1e1b4b] flex items-center justify-center rounded-xl text-[#0ea5e9] font-black border border-[#0ea5e9]/30 shadow-md group-hover:shadow-[#0ea5e9]/20 transition-all transform group-hover:scale-105 active:scale-95 uppercase tracking-tighter">
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

                                {/* My Requests */}
                                <button
                                    onClick={() => {
                                        navigate('/my-requests');
                                        setShowMenu(false);
                                    }}
                                    className="w-full text-left px-3 py-2.5 text-sm text-[var(--text-main)] hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-all flex items-center gap-3 font-medium"
                                >
                                    <span className="text-lg">📋</span>
                                    <span>My Requests</span>
                                </button>

                                {/* Change Password - Only for WorkPulse-only users */}
                                {user.userid == null && (
                                    <button
                                        onClick={() => {
                                            setShowChangePasswordModal(true);
                                            setShowMenu(false);
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm text-[var(--text-main)] hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition-all flex items-center gap-3 font-medium"
                                    >
                                        <span className="text-lg">🔑</span>
                                        <span>Change Password</span>
                                    </button>
                                )}

                                {/* Sign Out */}
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
                        )}
                    </div>
                </div>
            </div>

            {/* Change Password Modal */}
            {showChangePasswordModal && (
                <ChangePasswordModal
                    onClose={() => setShowChangePasswordModal(false)}
                />
            )}
        </header>
    );
};

export default Header;
