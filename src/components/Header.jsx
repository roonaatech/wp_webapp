import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';

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
            navigate('/session-expired', { state: { reason: 'logout' } });
        }
    };

    return (
        <header className="bg-white border-b border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-8 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">WorkPulse</h1>
                        <p className="text-sm text-gray-500">Leave and On-Duty Management System</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <button
                            onClick={handleNotificationClick}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative group"
                            title="View pending approvals"
                        >
                            <svg className={`w-6 h-6 transition-colors ${pendingCount > 0 ? 'text-red-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {pendingCount > 0 && (
                                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center text-xs">
                                    {pendingCount > 99 ? '99+' : pendingCount}
                                </span>
                            )}
                        </button>
                        {pendingCount > 0 && (
                            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <div className="flex items-center gap-3 pl-4 border-l border-gray-200 cursor-pointer" onClick={() => setShowMenu(!showMenu)}>
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{user.firstname || 'Admin'}</p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                            <button className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-700 rounded-full flex items-center justify-center text-white font-bold hover:shadow-lg transition-shadow">
                                {(user.firstname || 'A').charAt(0)}
                            </button>
                        </div>

                        {/* Dropdown Menu */}
                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                                <div className="px-4 py-3 border-b border-gray-100">
                                    <p className="text-sm font-medium text-gray-900">{user.firstname || 'Admin'}</p>
                                    <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                                    ⚙️ Settings
                                </button>
                                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                                    ❓ Help
                                </button>
                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 border-t border-gray-100 font-medium"
                                >
                                    {isLoggingOut ? (
                                        <>
                                            <span className="inline-block w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
                                            <span>Logging out...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>🚪</span>
                                            <span>Logout</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
