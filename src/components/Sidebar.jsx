import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';

const Sidebar = () => {
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 1;
    const [activeOnDutyCount, setActiveOnDutyCount] = useState(0);
    const [approvalsCount, setApprovalsCount] = useState(0);

    useEffect(() => {
        fetchActiveOnDutyCount();
        fetchApprovalsCount();
        // Refresh every 30 seconds
        const interval = setInterval(() => {
            fetchActiveOnDutyCount();
            fetchApprovalsCount();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchActiveOnDutyCount = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.get(
                `${API_BASE_URL}/api/onduty/active-all`,
                { headers: { 'x-access-token': token } }
            );

            const count = (response.data.items || []).length;
            setActiveOnDutyCount(count);
        } catch (err) {
            console.error('Error fetching active on-duty count:', err);
        }
    };

    const fetchApprovalsCount = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.get(
                `${API_BASE_URL}/api/leave/requests?status=Pending&limit=1000`,
                { headers: { 'x-access-token': token } }
            );

            const count = (response.data.items || []).length;
            setApprovalsCount(count);
        } catch (err) {
            console.error('Error fetching approvals count:', err);
        }
    };

    const isActive = (path) => {
        return location.pathname === path;
    };

    const NavLink = ({ to, icon, label, badge }) => (
        <Link
            to={to}
            className={`
                flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200
                ${isActive(to)
                    ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-md'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }
            `}
        >
            <span className="text-xl">{icon}</span>
            <span className="font-medium flex-1">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className={`
                    px-2 py-1 rounded-full text-xs font-bold
                    ${isActive(to)
                        ? 'bg-red-500 text-white'
                        : 'bg-red-500 text-white'
                    }
                `}>
                    {badge}
                </span>
            )}
        </Link>
    );

    return (
        <div className="w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white min-h-screen shadow-xl flex flex-col">
            {/* Logo Section */}
            <div className="p-6 border-b border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-700 rounded-lg flex items-center justify-center">
                        <img src="/abis_icon.png" alt="WorkPulse" className="w-10 h-10" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">WorkPulse</h1>
                        <p className="text-xs text-gray-400">Leave & On-Duty</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1">
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Main</p>
                    <NavLink to="/" icon="📊" label="Dashboard" />
                </div>

                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2 mt-4">Management</p>
                    {/* Users - Admin Only */}
                    {isAdmin && (
                        <NavLink to="/users" icon="👥" label="Users" />
                    )}
                    {/* Approvals - Both Admin and Manager */}
                    <NavLink to="/approvals" icon="✓" label="Approvals" badge={approvalsCount} />
                    {/* Active On-Duty - Both Admin and Manager */}
                    <NavLink to="/active-onduty" icon="🚗" label="Active On-Duty" badge={activeOnDutyCount} />
                    {/* Calendar - Both Admin and Manager */}
                    <NavLink to="/calendar" icon="📆" label="Calendar" />
                    {/* Leave Types - Admin Only */}
                    {isAdmin && (
                        <NavLink to="/leave-types" icon="📅" label="Leave Types" />
                    )}
                </div>

                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2 mt-4">Other</p>
                    <NavLink to="/reports" icon="📈" label="Reports" />
                    {/* Activities - Admin Only */}
                    {isAdmin && (
                        <NavLink to="/activities" icon="📋" label="Activities" />
                    )}
                </div>

                {/* Role Badge */}
                <div className="mt-8 px-4">
                    <div className="bg-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Current Role</p>
                        <p className="text-sm font-semibold text-blue-500">
                            {isAdmin ? '👑 Admin' : '🔐 Manager'}
                        </p>
                    </div>
                </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700">
                <p className="text-xs text-gray-500 px-2 text-center">Version 1.0</p>
            </div>
        </div>
    );
};

export default Sidebar;
