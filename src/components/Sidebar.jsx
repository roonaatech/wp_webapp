import React, { useState, useEffect, useRef } from 'react';
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
    LuChevronRight,
    LuClipboardPen,
    LuSettings,
    LuUserCog,
    LuQrCode,
    LuCalendarPlus,
    LuCalendarHeart,
    LuCalendarCheck
} from "react-icons/lu";
import API_BASE_URL from '../config/api.config';
import BrandLogo from './BrandLogo';
import packageJson from '../../package.json';
import '../hide-scrollbar.css';
import {
    canApproveLeave,
    canApproveOnDuty,
    canManageLeaveTypes,
    canManageHolidays,
    canManageOnboarding,
    canManageManualAttendance,
    canViewReports,
    canManageRoles,
    canManageEmailSettings,
    canManageSystemSettings,
    canAccessUsersPage,
    canManageActiveOnDuty,
    canManageSchedule,
    canViewActivities,
    canAccessAttendancePortal,
    canViewAttendanceReport,
    canManageServiceAccounts,
    isSelfServiceOnly
} from '../utils/roleUtils';

const Sidebar = () => {
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Permission-based checks
    const isSelfService = isSelfServiceOnly(user.role);
    const canApprove = canApproveLeave(user.role) || canApproveOnDuty(user.role);
    const canAccessUsersPermission = canAccessUsersPage(user.role);
    const canManageOnboardingPermission = canManageOnboarding(user.role);
    const canManageRolesPermission = canManageRoles(user.role);
    const canManageEmailPermission = canManageEmailSettings(user.role);
    const canManageSystemPermission = canManageSystemSettings(user.role);
    const canManageActiveOnDutyPermission = canManageActiveOnDuty(user.role);
    const canManageSchedulePermission = canManageSchedule(user.role);
    const canViewReportsPermission = canViewReports(user.role);
    const canViewActivitiesPermission = canViewActivities(user.role);
    const canAccessAttendance = canAccessAttendancePortal(user.role);
    const canViewAttendanceReportPermission = canViewAttendanceReport(user.role);
    const canManageServiceAccountsPermission = canManageServiceAccounts(user.role);
    const canManageManualAttendancePermission = canManageManualAttendance(user.role);

    // Group visibility checks
    const hasPeopleMenu = canAccessUsersPermission || canManageOnboardingPermission;
    const hasAttendanceMenu = canAccessAttendance || canViewAttendanceReportPermission || canManageManualAttendancePermission || canManageSchedulePermission || canManageActiveOnDutyPermission;
    const hasReportsMenu = canViewReportsPermission || canViewActivitiesPermission;
    const hasSettingsMenu = canManageLeaveTypes(user.role) || canManageHolidays(user.role) || canManageRolesPermission || canManageSystemPermission || canManageEmailPermission || canManageServiceAccountsPermission || true;

    // Group child route arrays for active highlighting and auto-expansion
    const peoplePaths = ['/users', '/onboard'];
    const attendancePaths = ['/attendance', '/attendance-report', '/manual-attendance', '/calendar', '/active-onduty'];
    const reportsPaths = ['/reports', '/activities'];
    const settingsPaths = ['/leave-types', '/holidays', '/roles', '/settings', '/email-settings', '/service-accounts', '/apk'];

    const [activeOnDutyCount, setActiveOnDutyCount] = useState(0);
    const [approvalsCount, setApprovalsCount] = useState(0);
    const [, setRoleVersion] = useState(0);

    // Sidebar collapsed state
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved ? JSON.parse(saved) : false;
    });

    // Submenus open state
    const [openMenus, setOpenMenus] = useState(() => {
        const p = location.pathname;
        return {
            people: peoplePaths.includes(p),
            attendance: attendancePaths.includes(p),
            reports: reportsPaths.includes(p),
            settings: settingsPaths.includes(p)
        };
    });

    const toggleMenu = (menuKey) => {
        setOpenMenus(prev => ({
            ...prev,
            [menuKey]: !prev[menuKey]
        }));
    };

    // Auto-expand parent submenu when navigating to a child page
    useEffect(() => {
        const p = location.pathname;
        if (peoplePaths.includes(p)) {
            setOpenMenus(prev => ({ ...prev, people: true }));
        } else if (attendancePaths.includes(p)) {
            setOpenMenus(prev => ({ ...prev, attendance: true }));
        } else if (reportsPaths.includes(p)) {
            setOpenMenus(prev => ({ ...prev, reports: true }));
        } else if (settingsPaths.includes(p)) {
            setOpenMenus(prev => ({ ...prev, settings: true }));
        }
    }, [location.pathname]);

    useEffect(() => {
        const handleRolesUpdated = () => {
            setRoleVersion(v => v + 1);
        };
        window.addEventListener('rolesUpdated', handleRolesUpdated);
        return () => window.removeEventListener('rolesUpdated', handleRolesUpdated);
    }, []);

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
    }, [isCollapsed]);

    useEffect(() => {
        fetchActiveOnDutyCount();
        fetchApprovalsCount();
        const interval = setInterval(() => {
            fetchActiveOnDutyCount();
            fetchApprovalsCount();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchActiveOnDutyCount = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token || !canManageActiveOnDuty(user.role)) {
                setActiveOnDutyCount(0);
                return;
            }

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

            const hasLeavePermission = canApproveLeave(user.role);
            const hasOnDutyPermission = canApproveOnDuty(user.role);

            if (!hasLeavePermission && !hasOnDutyPermission) {
                setApprovalsCount(0);
                return;
            }

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

    const isActive = (path) => location.pathname === path;

    const [hoveredLink, setHoveredLink] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

    const handleMouseEnter = (to, event) => {
        if (isCollapsed) {
            setHoveredLink(to);
            const rect = event.currentTarget.getBoundingClientRect();
            setTooltipPos({
                top: rect.top + rect.height / 2,
                left: rect.right + 10
            });
        }
    };

    const handleMouseLeave = () => {
        setHoveredLink(null);
    };

    // Standard NavLink (Top-level or Indented Submenu Item)
    const NavLink = ({ to, icon, label, badge, indent = false }) => {
        const active = isActive(to);
        return (
            <div className="relative group">
                <Link
                    to={to}
                    onMouseEnter={(e) => handleMouseEnter(to, e)}
                    onMouseLeave={handleMouseLeave}
                    className={`
                        flex items-center gap-3 px-4 py-2.5 transition-colors duration-200 relative
                        ${isCollapsed ? 'justify-center mx-4 rounded-lg' : ''}
                        ${!isCollapsed && active
                            ? (indent 
                                ? 'bg-[var(--bg-primary)] text-[#1e1b4b] font-bold rounded-l-xl ml-8 rounded-r-none soft-arc-active' 
                                : 'bg-[var(--bg-primary)] text-[#1e1b4b] font-bold rounded-l-xl ml-4 rounded-r-none soft-arc-active')
                            : ''
                        }
                        ${!isCollapsed && !active
                            ? (indent 
                                ? 'text-slate-300 hover:bg-white/5 hover:text-white rounded-lg ml-8 mr-4' 
                                : 'text-slate-200 hover:bg-white/5 hover:text-white rounded-lg mx-4')
                            : ''
                        }
                        ${indent && !isCollapsed ? 'text-sm py-2' : ''}
                    `}
                >
                    <span className={`${indent && !isCollapsed ? 'text-lg text-slate-300' : 'text-xl'} flex-shrink-0`}>{icon}</span>
                    {!isCollapsed && (
                        <>
                            <span className={`flex-1 tracking-wide ${indent ? 'text-sm font-medium' : 'text-base font-medium'}`}>{label}</span>
                            {badge !== undefined && badge > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm flex-shrink-0 bg-rose-500 text-white">
                                    {badge}
                                </span>
                            )}
                        </>
                    )}
                    {isCollapsed && badge !== undefined && badge > 0 && (
                        <span className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold bg-rose-500 text-white">
                            {badge}
                        </span>
                    )}
                </Link>

                {/* Tooltip for standalone items in collapsed mode */}
                {isCollapsed && hoveredLink === to && (
                    <div
                        className="fixed bg-gray-900 text-white px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium shadow-lg z-50 pointer-events-none"
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
    };

    // Accordion Parent Group for Expanded Sidebar
    const NavParent = ({ icon, label, isOpen, onToggle, childPaths, badge, children }) => {
        const isChildActive = childPaths.some(p => location.pathname === p);

        return (
            <div className="relative mb-1">
                <button
                    type="button"
                    onClick={onToggle}
                    className={`
                        w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200 mx-4 relative
                        ${isChildActive && !isOpen ? 'text-cyan-400 font-semibold bg-white/5' : 'text-slate-200 hover:bg-white/5 hover:text-white'}
                    `}
                    style={{ width: 'calc(100% - 2rem)' }}
                >
                    <span className={`text-xl flex-shrink-0 ${isChildActive && !isOpen ? 'text-cyan-400' : 'text-slate-300'}`}>{icon}</span>
                    <span className="font-medium flex-1 tracking-wide text-base text-left">{label}</span>
                    {badge !== undefined && badge > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm bg-rose-500 text-white mr-1.5 flex-shrink-0">
                            {badge}
                        </span>
                    )}
                    <span className={`transition-transform duration-200 text-slate-400 flex-shrink-0 ${isOpen ? 'rotate-90 text-white' : ''}`}>
                        <LuChevronRight size={16} />
                    </span>
                </button>

                {/* Submenu Accordion */}
                <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isOpen ? 'max-h-[600px] opacity-100 mt-1 mb-2 space-y-0.5' : 'max-h-0 opacity-0'
                    }`}
                >
                    {children}
                </div>
            </div>
        );
    };

    // Collapsed Flyout Group
    const CollapsedGroup = ({ icon, label, badge, childPaths, children }) => {
        const [isHovered, setIsHovered] = useState(false);
        const [flyoutTop, setFlyoutTop] = useState(0);
        const isChildActive = childPaths.some(p => location.pathname === p);
        const containerRef = useRef(null);

        const handleMouseEnter = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setFlyoutTop(rect.top);
            }
            setIsHovered(true);
        };

        const handleMouseLeave = () => {
            setIsHovered(false);
        };

        return (
            <div 
                ref={containerRef}
                onMouseEnter={handleMouseEnter} 
                onMouseLeave={handleMouseLeave} 
                className="relative flex justify-center py-1"
            >
                <div
                    className={`
                        w-12 h-11 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer relative
                        ${isChildActive ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30' : 'text-slate-200 hover:bg-white/10 hover:text-white'}
                    `}
                >
                    <span className="text-xl">{icon}</span>
                    {badge !== undefined && badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm">
                            {badge}
                        </span>
                    )}
                </div>

                {/* Floating Flyout Menu */}
                {isHovered && (
                    <div 
                        className="fixed left-[76px] z-50 bg-[#1e1b4b] border border-indigo-800/90 rounded-xl shadow-2xl py-2 min-w-[210px] animate-in fade-in zoom-in-95 duration-150"
                        style={{ top: `${Math.max(10, Math.min(flyoutTop, window.innerHeight - 340))}px` }}
                    >
                        <div className="px-4 py-2 border-b border-white/10 mb-1 flex items-center justify-between">
                            <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">{label}</span>
                            {badge !== undefined && badge > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                                    {badge}
                                </span>
                            )}
                        </div>
                        <div className="py-0.5 space-y-0.5">
                            {children}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Sub-item for collapsed flyout menu
    const FlyoutLink = ({ to, icon, label, badge }) => {
        const active = isActive(to);
        return (
            <Link
                to={to}
                className={`
                    flex items-center gap-2.5 px-4 py-2 text-sm transition-colors
                    ${active 
                        ? 'bg-blue-600/30 text-cyan-300 font-semibold border-l-2 border-cyan-400' 
                        : 'text-slate-200 hover:bg-white/10 hover:text-white font-medium'}
                `}
            >
                <span className="text-base flex-shrink-0 text-slate-300">{icon}</span>
                <span className="flex-1">{label}</span>
                {badge !== undefined && badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                        {badge}
                    </span>
                )}
            </Link>
        );
    };

    return (
        <div className={`
            bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] min-h-screen flex flex-col font-sans transition-all duration-300
            ${isCollapsed ? 'w-20' : 'w-72'}
        `}>
            {/* Header with collapse button */}
            <div className="p-4 pb-6 flex items-center justify-between">
                {!isCollapsed && (
                    <Link to={isSelfService ? "/my-requests" : "/"} className="hover:opacity-90 transition-opacity block flex-1">
                        <BrandLogo textTheme="dark" />
                    </Link>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`
                        p-2 rounded-md transition-colors duration-200 
                        text-slate-200 hover:bg-white/10 hover:text-white
                        ${isCollapsed ? 'w-full flex justify-center' : ''}
                    `}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                    {isCollapsed ? <LuChevronRight size={20} /> : <LuChevronLeft size={20} />}
                </button>
            </div>

            {/* Navigation Menus */}
            <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-visible hide-scrollbar py-2">
                
                {/* 1. OVERVIEW / DASHBOARD */}
                {!user.isServiceAccount && (
                    <div>
                        {!isCollapsed && (
                            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest px-6 mb-2">Overview</p>
                        )}
                        {isSelfService ? (
                            <NavLink to="/my-requests" icon={<LuClipboardPen />} label="My Requests" />
                        ) : (
                            <NavLink to="/" icon={<LuLayoutDashboard />} label="Dashboard" />
                        )}
                    </div>
                )}

                {/* 2. APPROVALS */}
                {canApprove && (
                    <div>
                        <NavLink to="/approvals" icon={<LuClipboardCheck />} label="Approvals" badge={approvalsCount} />
                    </div>
                )}

                {/* CATEGORY DIVIDER FOR CORE MODULES */}
                {!isCollapsed && (hasPeopleMenu || hasAttendanceMenu || hasReportsMenu || hasSettingsMenu) && (
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest px-6 mb-2 mt-5">Modules</p>
                )}

                {/* ========================================================= */}
                {/* EXPANDED VIEW: 4 Core Accordion Menus (People, Attendance, Reports, Settings) */}
                {/* ========================================================= */}
                {!isCollapsed && (
                    <>
                        {/* 3. PEOPLE MENU */}
                        {hasPeopleMenu && (
                            <NavParent
                                id="people"
                                icon={<LuUsers />}
                                label="People"
                                isOpen={openMenus.people}
                                onToggle={() => toggleMenu('people')}
                                childPaths={peoplePaths}
                            >
                                {canAccessUsersPermission && (
                                    <NavLink to="/users" icon={<LuUsers />} label="Employee Directory" indent={true} />
                                )}
                                {canManageOnboardingPermission && (
                                    <NavLink to="/onboard" icon={<LuClipboardPen />} label="Onboarding" indent={true} />
                                )}
                            </NavParent>
                        )}

                        {/* 4. ATTENDANCE MENU */}
                        {hasAttendanceMenu && (
                            <NavParent
                                id="attendance"
                                icon={<LuCalendarCheck />}
                                label="Attendance"
                                isOpen={openMenus.attendance}
                                onToggle={() => toggleMenu('attendance')}
                                childPaths={attendancePaths}
                                badge={!openMenus.attendance ? activeOnDutyCount : undefined}
                            >
                                {canAccessAttendance && (
                                    <NavLink to="/attendance" icon={<LuQrCode />} label="Kiosk Terminal" indent={true} />
                                )}
                                {canViewAttendanceReportPermission && (
                                    <NavLink to="/attendance-report" icon={<LuCalendarDays />} label="Timesheet Review" indent={true} />
                                )}
                                {canManageManualAttendancePermission && (
                                    <NavLink to="/manual-attendance" icon={<LuCalendarPlus />} label="Manual Punch Entry" indent={true} />
                                )}
                                {canManageSchedulePermission && (
                                    <NavLink to="/calendar" icon={<LuCalendarDays />} label="Shift Roster" indent={true} />
                                )}
                                {canManageActiveOnDutyPermission && (
                                    <NavLink to="/active-onduty" icon={<LuCar />} label="Live On-Duty" badge={activeOnDutyCount} indent={true} />
                                )}
                            </NavParent>
                        )}

                        {/* 5. REPORTS MENU */}
                        {hasReportsMenu && (
                            <NavParent
                                id="reports"
                                icon={<LuFileText />}
                                label="Reports & Analytics"
                                isOpen={openMenus.reports}
                                onToggle={() => toggleMenu('reports')}
                                childPaths={reportsPaths}
                            >
                                {canViewReportsPermission && (
                                    <NavLink to="/reports" icon={<LuFileText />} label="Summary Reports" indent={true} />
                                )}
                                {canViewActivitiesPermission && (
                                    <NavLink to="/activities" icon={<LuActivity />} label="Audit Trail" indent={true} />
                                )}
                            </NavParent>
                        )}

                        {/* 6. SETTINGS MENU */}
                        {hasSettingsMenu && (
                            <NavParent
                                id="settings"
                                icon={<LuSettings />}
                                label="Settings"
                                isOpen={openMenus.settings}
                                onToggle={() => toggleMenu('settings')}
                                childPaths={settingsPaths}
                            >
                                {canManageLeaveTypes(user.role) && (
                                    <NavLink to="/leave-types" icon={<LuLayers />} label="Leave Types" indent={true} />
                                )}
                                {canManageHolidays(user.role) && (
                                    <NavLink to="/holidays" icon={<LuCalendarHeart />} label="Holidays" indent={true} />
                                )}
                                {canManageRolesPermission && (
                                    <NavLink to="/roles" icon={<LuShield />} label="Roles & Permissions" indent={true} />
                                )}
                                {canManageSystemPermission && (
                                    <NavLink to="/settings" icon={<LuSettings />} label="General Settings" indent={true} />
                                )}
                                {canManageEmailPermission && (
                                    <NavLink to="/email-settings" icon={<LuMail />} label="Email Settings" indent={true} />
                                )}
                                {canManageServiceAccountsPermission && (
                                    <NavLink to="/service-accounts" icon={<LuUserCog />} label="Service Accounts" indent={true} />
                                )}
                                <NavLink to="/apk" icon={<LuSmartphone />} label="App Distribution" indent={true} />
                            </NavParent>
                        )}
                    </>
                )}

                {/* ========================================================= */}
                {/* COLLAPSED VIEW: 4 Core Flyout Menus */}
                {/* ========================================================= */}
                {isCollapsed && (
                    <div className="space-y-1 pt-1">
                        {/* 3. PEOPLE (Collapsed Flyout) */}
                        {hasPeopleMenu && (
                            <CollapsedGroup
                                icon={<LuUsers />}
                                label="People"
                                childPaths={peoplePaths}
                            >
                                {canAccessUsersPermission && (
                                    <FlyoutLink to="/users" icon={<LuUsers />} label="Employee Directory" />
                                )}
                                {canManageOnboardingPermission && (
                                    <FlyoutLink to="/onboard" icon={<LuClipboardPen />} label="Onboarding" />
                                )}
                            </CollapsedGroup>
                        )}

                        {/* 4. ATTENDANCE (Collapsed Flyout) */}
                        {hasAttendanceMenu && (
                            <CollapsedGroup
                                icon={<LuCalendarCheck />}
                                label="Attendance"
                                childPaths={attendancePaths}
                                badge={activeOnDutyCount}
                            >
                                {canAccessAttendance && (
                                    <FlyoutLink to="/attendance" icon={<LuQrCode />} label="Kiosk Terminal" />
                                )}
                                {canViewAttendanceReportPermission && (
                                    <FlyoutLink to="/attendance-report" icon={<LuCalendarDays />} label="Timesheet Review" />
                                )}
                                {canManageManualAttendancePermission && (
                                    <FlyoutLink to="/manual-attendance" icon={<LuCalendarPlus />} label="Manual Punch Entry" />
                                )}
                                {canManageSchedulePermission && (
                                    <FlyoutLink to="/calendar" icon={<LuCalendarDays />} label="Shift Roster" />
                                )}
                                {canManageActiveOnDutyPermission && (
                                    <FlyoutLink to="/active-onduty" icon={<LuCar />} label="Live On-Duty" badge={activeOnDutyCount} />
                                )}
                            </CollapsedGroup>
                        )}

                        {/* 5. REPORTS (Collapsed Flyout) */}
                        {hasReportsMenu && (
                            <CollapsedGroup
                                icon={<LuFileText />}
                                label="Reports & Analytics"
                                childPaths={reportsPaths}
                            >
                                {canViewReportsPermission && (
                                    <FlyoutLink to="/reports" icon={<LuFileText />} label="Summary Reports" />
                                )}
                                {canViewActivitiesPermission && (
                                    <FlyoutLink to="/activities" icon={<LuActivity />} label="Audit Trail" />
                                )}
                            </CollapsedGroup>
                        )}

                        {/* 6. SETTINGS (Collapsed Flyout) */}
                        {hasSettingsMenu && (
                            <CollapsedGroup
                                icon={<LuSettings />}
                                label="Settings"
                                childPaths={settingsPaths}
                            >
                                {canManageLeaveTypes(user.role) && (
                                    <FlyoutLink to="/leave-types" icon={<LuLayers />} label="Leave Types" />
                                )}
                                {canManageHolidays(user.role) && (
                                    <FlyoutLink to="/holidays" icon={<LuCalendarHeart />} label="Holidays" />
                                )}
                                {canManageRolesPermission && (
                                    <FlyoutLink to="/roles" icon={<LuShield />} label="Roles & Permissions" />
                                )}
                                {canManageSystemPermission && (
                                    <FlyoutLink to="/settings" icon={<LuSettings />} label="General Settings" />
                                )}
                                {canManageEmailPermission && (
                                    <FlyoutLink to="/email-settings" icon={<LuMail />} label="Email Settings" />
                                )}
                                {canManageServiceAccountsPermission && (
                                    <FlyoutLink to="/service-accounts" icon={<LuUserCog />} label="Service Accounts" />
                                )}
                                <FlyoutLink to="/apk" icon={<LuSmartphone />} label="App Distribution" />
                            </CollapsedGroup>
                        )}
                    </div>
                )}

            </nav>

            {/* Footer */}
            {!isCollapsed && (
                <div className="p-6 border-t border-white/5">
                    <p className="text-[10px] text-[var(--sidebar-text)] text-center font-medium tracking-widest uppercase">
                        WORKPULSE v{packageJson.version}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
