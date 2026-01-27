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
    LuSmartphone,
    LuShield,
    LuMail,
    LuChevronLeft,
    LuChevronRight
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
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved ? JSON.parse(saved) : false;
    });

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

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
    }, [isCollapsed]);

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
            title={isCollapsed ? label : ''}
            className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mx-2
                ${isCollapsed ? 'justify-center' : ''}
                ${isActive(to)
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-[var(--sidebar-muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--sidebar-text)]'
                }
            `}
        >
            <span className="text-xl flex-shrink-0">{icon}</span>
            {!isCollapsed && (
                <>
                    <span className="font-medium flex-1 tracking-wide text-base">{label}</span>
                    {badge !== undefined && badge > 0 && (
                        <span className={`
                            px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm flex-shrink-0
                            ${isActive(to)
                                ? 'bg-white/20 text-white'
                                : 'bg-rose-500 text-white'
                            }
                        `}>
                            {badge}
                        </span>
                    )}
                </>
            )}
            {isCollapsed && badge !== undefined && badge > 0 && (
                <span className={`
                    absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold
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
        <div className={`
            bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] text-[var(--sidebar-text)] min-h-screen shadow-2xl flex flex-col font-sans transition-all duration-300
            ${isCollapsed ? 'w-20' : 'w-72'}
        `}>
            {/* Header with collapse button */}
            <div className="p-4 pb-6 flex items-center justify-between">
                {!isCollapsed && (
                    <Link to="/" className="hover:opacity-90 transition-opacity block flex-1">
                        <BrandLogo />
                    </Link>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`
                        p-2 rounded-lg transition-all duration-300 
                        text-[var(--sidebar-muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--sidebar-text)]
                        ${isCollapsed ? 'w-full flex justify-center' : ''}
                    `}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                    {isCollapsed ? <LuChevronRight size={20} /> : <LuChevronLeft size={20} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 space-y-4 overflow-y-auto hide-scrollbar py-4">
                {!isCollapsed && (
                    <div>
                        <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-3">Overview</p>
                        <NavLink to="/" icon={<LuLayoutDashboard />} label="Dashboard" />
                    </div>
                )}
                {isCollapsed && (
                    <NavLink to="/" icon={<LuLayoutDashboard />} label="Dashboard" />
                )}

                {!isCollapsed && (
                    <div>
                        <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-3 mt-6">Management</p>
                        {/* Approvals - Both Admin and Manager */}
                        <NavLink to="/approvals" icon={<LuClipboardCheck />} label="Approvals" badge={approvalsCount} />
                        {/* Active On-Duty - Both Admin and Manager */}
                        <NavLink to="/active-onduty" icon={<LuCar />} label="Active On-Duty" badge={activeOnDutyCount} />
                        {/* Calendar - Both Admin and Manager */}
                        <NavLink to="/calendar" icon={<LuCalendarDays />} label="Schedule" />
                    </div>
                )}
                {isCollapsed && (
                    <div className="space-y-2">
                        <NavLink to="/approvals" icon={<LuClipboardCheck />} label="Approvals" badge={approvalsCount} />
                        <NavLink to="/active-onduty" icon={<LuCar />} label="Active On-Duty" badge={activeOnDutyCount} />
                        <NavLink to="/calendar" icon={<LuCalendarDays />} label="Schedule" />
                    </div>
                )}

                {!isCollapsed && (
                    <div>
                        <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-3 mt-6">Configurations</p>
                        {/* Users - Admin & Manager */}
                        {(isAdmin || isManager) && (
                            <NavLink to="/users" icon={<LuUsers />} label="Staff Members" />
                        )}
                        {/* Leave Types - Admin Only */}
                        {isAdmin && (
                            <NavLink to="/leave-types" icon={<LuLayers />} label="Leave Types" />
                        )}
                        {/* Roles - Admin Only */}
                        {isAdmin && (
                            <NavLink to="/roles" icon={<LuShield />} label="Roles" />
                        )}
                        {isAdmin && (
                            <NavLink to="/email-settings" icon={<LuMail />} label="Email Settings" />
                        )}
                    </div>
                )}
                {isCollapsed && (
                    <div className="space-y-2">
                        {(isAdmin || isManager) && (
                            <NavLink to="/users" icon={<LuUsers />} label="Staff Members" />
                        )}
                        {isAdmin && (
                            <NavLink to="/leave-types" icon={<LuLayers />} label="Leave Types" />
                        )}
                        {isAdmin && (
                            <NavLink to="/roles" icon={<LuShield />} label="Roles" />
                        )}
                        {isAdmin && (
                            <NavLink to="/email-settings" icon={<LuMail />} label="Email Settings" />
                        )}
                    </div>
                )}

                {!isCollapsed && (
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
                )}
                {isCollapsed && (
                    <div className="space-y-2">
                        <NavLink to="/reports" icon={<LuFileText />} label="Reports" />
                        {isAdmin && (
                            <NavLink to="/activities" icon={<LuActivity />} label="Activity Log" />
                        )}
                        <NavLink to="/apk" icon={<LuSmartphone />} label="Mobile App" />
                    </div>
                )}

                {/* Role Badge */}
                {!isCollapsed && (
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
                )}
            </nav>

            {/* Footer */}
            {!isCollapsed && (
                <div className="p-6 border-t border-[var(--border-color)]">
                    <p className="text-[10px] text-[var(--sidebar-text)] text-center font-medium tracking-widest uppercase">
                        WORKPULSE v{packageJson.version}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
