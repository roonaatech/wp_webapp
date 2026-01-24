import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    LuLayoutDashboard,
    LuUsers,
    LuClipboardCheck,
    LuCar,
    LuCalendarDays,
    LuLayers,
    LuFileText,
    LuActivity,
    LuSmartphone
} from "react-icons/lu";
import API_BASE_URL from '../config/api.config';
import BrandLogo from './BrandLogo';
import packageJson from '../../package.json';
import '../hide-scrollbar.css';

const Sidebar = () => {
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 1;
    const isManager = user.role === 2;
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
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mx-2
                ${isActive(to)
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-[var(--sidebar-muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--sidebar-text)]'
                }
            `}
        >
            <span className="text-xl">{icon}</span>
            <span className="font-medium flex-1 tracking-wide text-base">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className={`
                    px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm
                    ${isActive(to)
                        ? 'bg-white/20 text-white'
                        : 'bg-rose-500 text-white'
                    }
                `}>
                    {badge}
                </span>
            )}
        </Link>
    );

    return (
        <div className="w-72 bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] text-[var(--sidebar-text)] min-h-screen shadow-2xl flex flex-col font-sans transition-colors duration-300">
            <div className="p-8 pb-6">
                <Link to="/" className="hover:opacity-90 transition-opacity block">
                    <BrandLogo />
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 space-y-6 overflow-y-auto hide-scrollbar py-4">
                <div>
                    <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-3">Overview</p>
                    <NavLink to="/" icon={<LuLayoutDashboard />} label="Dashboard" />
                </div>

                <div>
                    <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-3 mt-6">Management</p>
                    {/* Users - Admin & Manager */}
                    {(isAdmin || isManager) && (
                        <NavLink to="/users" icon={<LuUsers />} label="Staff Members" />
                    )}
                    {/* Approvals - Both Admin and Manager */}
                    <NavLink to="/approvals" icon={<LuClipboardCheck />} label="Approvals" badge={approvalsCount} />
                    {/* Active On-Duty - Both Admin and Manager */}
                    <NavLink to="/active-onduty" icon={<LuCar />} label="Active On-Duty" badge={activeOnDutyCount} />
                    {/* Calendar - Both Admin and Manager */}
                    <NavLink to="/calendar" icon={<LuCalendarDays />} label="Schedule" />
                    {/* Leave Types - Admin Only */}
                    {isAdmin && (
                        <NavLink to="/leave-types" icon={<LuLayers />} label="Leave Types" />
                    )}
                </div>

                <div>
                    <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-3 mt-6">Analysis</p>
                    <NavLink to="/reports" icon={<LuFileText />} label="Reports" />
                    {/* Activities - Admin Only */}
                    {isAdmin && (
                        <NavLink to="/activities" icon={<LuActivity />} label="Activity Log" />
                    )}

                    <div className="mt-6 mb-3 px-6 border-t border-[var(--border-color)] pt-6">
                        <p className="text-sm font-semibold text-blue-400 tracking-widest mb-3">Downloads</p>
                        <NavLink to="/apk" icon={<LuSmartphone />} label="Mobile App" />
                    </div>
                </div>

                {/* Role Badge */}
                <div className="mt-4 px-6 mb-6">
                    <div className="bg-white/10 dark:bg-slate-800/50 rounded-xl p-4 border border-[var(--border-color)] backdrop-blur-sm">
                        <p className="text-sm text-[var(--sidebar-muted)] mb-1 font-medium">Signed in as</p>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-base font-bold text-[var(--sidebar-text)] tracking-wide">
                                {isAdmin ? 'Administrator' : 'Manager'}
                            </p>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Footer */}
            <div className="p-6 border-t border-[var(--border-color)]">
                <p className="text-[10px] text-[var(--sidebar-text)] text-center font-medium tracking-widest uppercase">
                    WORKPULSE v{packageJson.version}
                </p>
            </div>
        </div>
    );
};

export default Sidebar;
