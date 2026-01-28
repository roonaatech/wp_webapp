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
import { hasAdminPermission, canApproveLeave, canApproveOnDuty, canManageLeaveTypes, canViewReports, canManageRoles, canManageEmailSettings, canManageUsers as canManageUsersUtil, canManageActiveOnDuty, canManageSchedule } from '../utils/roleUtils';

const Sidebar = () => {
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    // Use permission-based checks instead of hardcoded role IDs
    const isAdmin = hasAdminPermission(user.role);
    const canApprove = canApproveLeave(user.role) || canApproveOnDuty(user.role);
    const canManageUsersPermission = canManageUsersUtil(user.role); // Users page visibility
    const canManageRolesPermission = canManageRoles(user.role);
    const canManageEmailPermission = canManageEmailSettings(user.role);
    const canManageActiveOnDutyPermission = canManageActiveOnDuty(user.role);
    const canManageSchedulePermission = canManageSchedule(user.role);
    // Show Configurations section if user has any configuration permission
    const hasAnyConfigPermission = canManageUsersPermission || canManageLeaveTypes(user.role) || canManageRolesPermission || canManageEmailPermission;
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

    const [hoveredLink, setHoveredLink] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

    const handleMouseEnter = (to, event) => {
        if (isCollapsed) {
            setHoveredLink(to);
            const rect = event.currentTarget.getBoundingClientRect();
            setTooltipPos({
                top: rect.top + rect.height / 2,
                left: rect.right + 10 // 10px gap from the element
            });
        }
    };

    const handleMouseLeave = () => {
        setHoveredLink(null);
    };

    const NavLink = ({ to, icon, label, badge }) => (
        <div className="relative group">
            <Link
                to={to}
                onMouseEnter={(e) => handleMouseEnter(to, e)}
                onMouseLeave={handleMouseLeave}
                className={`
                    flex items-center gap-3 px-4 py-1.5 rounded-xl transition-all duration-300 mx-2 relative
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

            {/* Tooltip - positioned at hovered element */}
            {isCollapsed && hoveredLink === to && (
                <div className="fixed bg-gray-900 text-white px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium shadow-lg z-50 pointer-events-none"
                    style={{
                        top: `${tooltipPos.top}px`,
                        left: `${tooltipPos.left}px`,
                        transform: 'translateY(-50%)'
                    }}
                >
                    {label}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
            )}
        </div>
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
            <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto overflow-x-visible hide-scrollbar py-2">
                {!isCollapsed && (
                    <div>
                        <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-1">Overview</p>
                        <NavLink to="/" icon={<LuLayoutDashboard />} label="Dashboard" />
                    </div>
                )}
                {isCollapsed && (
                    <NavLink to="/" icon={<LuLayoutDashboard />} label="Dashboard" />
                )}

                {!isCollapsed && (
                    <div>
                        <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-1 mt-2">Management</p>
                        {/* Approvals - Both Admin and Manager */}
                        <NavLink to="/approvals" icon={<LuClipboardCheck />} label="Approvals" badge={approvalsCount} />
                        {/* Active On-Duty - For users with can_manage_active_onduty permission */}
                        {canManageActiveOnDutyPermission && (
                            <NavLink to="/active-onduty" icon={<LuCar />} label="Active On-Duty" badge={activeOnDutyCount} />
                        )}
                        {/* Calendar/Schedule - For users with can_manage_schedule permission */}
                        {canManageSchedulePermission && (
                            <NavLink to="/calendar" icon={<LuCalendarDays />} label="Schedule" />
                        )}
                    </div>
                )}
                {isCollapsed && (
                    <div className="space-y-2">
                        <NavLink to="/approvals" icon={<LuClipboardCheck />} label="Approvals" badge={approvalsCount} />
                        {canManageActiveOnDutyPermission && (
                            <NavLink to="/active-onduty" icon={<LuCar />} label="Active On-Duty" badge={activeOnDutyCount} />
                        )}
                        {canManageSchedulePermission && (
                            <NavLink to="/calendar" icon={<LuCalendarDays />} label="Schedule" />
                        )}
                    </div>
                )}

                {/* Configurations - Show if user has any configuration permission */}
                {!isCollapsed && hasAnyConfigPermission && (
                    <div>
                        <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-1 mt-2">Configurations</p>
                        {/* Users - Admin & those who can manage users */}
                        {canManageUsersPermission && (
                            <NavLink to="/users" icon={<LuUsers />} label="Staff Members" />
                        )}
                        {/* Leave Types */}
                        {canManageLeaveTypes(user.role) && (
                            <NavLink to="/leave-types" icon={<LuLayers />} label="Leave Types" />
                        )}
                        {/* Roles */}
                        {canManageRolesPermission && (
                            <NavLink to="/roles" icon={<LuShield />} label="Roles" />
                        )}
                        {/* Email Settings */}
                        {canManageEmailPermission && (
                            <NavLink to="/email-settings" icon={<LuMail />} label="Email Settings" />
                        )}
                    </div>
                )}
                {isCollapsed && hasAnyConfigPermission && (
                    <div className="space-y-2">
                        {canManageUsersPermission && (
                            <NavLink to="/users" icon={<LuUsers />} label="Staff Members" />
                        )}
                        {canManageLeaveTypes(user.role) && (
                            <NavLink to="/leave-types" icon={<LuLayers />} label="Leave Types" />
                        )}
                        {canManageRolesPermission && (
                            <NavLink to="/roles" icon={<LuShield />} label="Roles" />
                        )}
                        {canManageEmailPermission && (
                            <NavLink to="/email-settings" icon={<LuMail />} label="Email Settings" />
                        )}
                    </div>
                )}

                {!isCollapsed && (
                    <div>
                        <p className="text-sm font-semibold text-blue-400 tracking-widest px-6 mb-1 mt-2">Analysis</p>
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
