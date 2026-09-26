import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus, FiX, FiCheck, FiSave, FiMove } from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import {
    LuShield,
    LuUsers,
    LuUserCheck,
    LuCalendar,
    LuCalendarCheck,
    LuClock,
    LuFileCheck,
    LuFileText,
    LuSettings,
    LuKey,
    LuMail,
    LuGlobe,
    LuLock,
    LuQrCode,
    LuCake,
    LuAward,
    LuActivity,
    LuChartColumn,
    LuCheck,
    LuX,
    LuSlidersHorizontal,
    LuCompass,
    LuBriefcase,
    LuInfo,
    LuLayers,
    LuRotateCcw,
    LuChevronRight,
    LuChevronLeft,
    LuChevronDown,
    LuChevronUp,
    LuSparkles,
    LuCheckCheck,
    LuTrash2,
    LuPencil
} from "react-icons/lu";
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { fetchRoles as fetchRolesUtil, clearRolesCache, canManageRoles, getRoleById } from '../utils/roleUtils';
import TableSortIcon from '../components/TableSortIcon';

const HIERARCHICAL_GROUPS = [
    {
        id: 'approvals',
        title: 'Approvals & Requests',
        categoryTag: 'Category 01 • Approvals',
        description: 'Authorize or reject staff leave, on-duty, and time-off applications',
        icon: LuFileCheck,
        theme: {
            border: 'border-indigo-200/90 shadow-sm shadow-indigo-100/50',
            borderCollapsed: 'border-indigo-200/70 bg-gradient-to-r from-indigo-50/40 to-white hover:border-indigo-300',
            headerBg: 'bg-gradient-to-r from-indigo-50/90 via-indigo-50/30 to-white',
            iconContainer: 'bg-indigo-600 text-white shadow-md shadow-indigo-200/60',
            titleText: 'text-indigo-950 group-hover/hdr:text-indigo-600',
            categoryTagClass: 'bg-indigo-100/90 text-indigo-800 border-indigo-200/70',
            badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            btnSubordinates: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
        },
        permissions: [
            {
                key: 'can_approve_leave',
                title: 'Approve Leave Requests',
                description: 'Review and decide on annual, casual, medical, and other leave requests',
                icon: LuCalendarCheck
            },
            {
                key: 'can_approve_onduty',
                title: 'Approve On-Duty Requests',
                description: 'Authorize off-site assignments, client visits, and on-duty work sessions',
                icon: LuCompass
            },
            {
                key: 'can_approve_timeoff',
                title: 'Approve Time-Off Requests',
                description: 'Grant short permission passes and partial-day time-off requests',
                icon: LuClock
            }
        ]
    },
    {
        id: 'staff_directory',
        title: 'Staff Directory & Profiles',
        categoryTag: 'Category 02 • Directory & Staff',
        description: 'Account administration and viewing employee directory data',
        icon: LuUsers,
        theme: {
            border: 'border-sky-200/90 shadow-sm shadow-sky-100/50',
            borderCollapsed: 'border-sky-200/70 bg-gradient-to-r from-sky-50/40 to-white hover:border-sky-300',
            headerBg: 'bg-gradient-to-r from-sky-50/90 via-sky-50/30 to-white',
            iconContainer: 'bg-sky-600 text-white shadow-md shadow-sky-200/60',
            titleText: 'text-sky-950 group-hover/hdr:text-sky-600',
            categoryTagClass: 'bg-sky-100/90 text-sky-800 border-sky-200/70',
            badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
            btnSubordinates: 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
        },
        permissions: [
            {
                key: 'can_manage_users',
                title: 'Manage Staff Accounts',
                description: 'Add new staff, edit profile information, manage status, and reset passwords',
                icon: LuUserCheck
            },
            {
                key: 'can_view_users',
                title: 'View Staff Directory (Read Only)',
                description: 'Browse staff contact list, employee profiles, and hierarchy details',
                icon: LuUsers
            }
        ]
    },
    {
        id: 'attendance_tracking',
        title: 'Attendance & Field Tracking',
        categoryTag: 'Category 03 • Attendance & Field',
        description: 'Override attendance records, inspect reports, and view live field duty',
        icon: LuClock,
        theme: {
            border: 'border-amber-200/90 shadow-sm shadow-amber-100/50',
            borderCollapsed: 'border-amber-200/70 bg-gradient-to-r from-amber-50/40 to-white hover:border-amber-300',
            headerBg: 'bg-gradient-to-r from-amber-50/90 via-amber-50/30 to-white',
            iconContainer: 'bg-amber-600 text-white shadow-md shadow-amber-200/60',
            titleText: 'text-amber-950 group-hover/hdr:text-amber-700',
            categoryTagClass: 'bg-amber-100/90 text-amber-800 border-amber-200/70',
            badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
            btnSubordinates: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
        },
        permissions: [
            {
                key: 'can_edit_attendance',
                title: 'Edit Attendance Records',
                description: 'Correct punch timings, adjust biometric logs, and modify check-in/out timestamps',
                icon: LuSlidersHorizontal
            },
            {
                key: 'can_delete_attendance',
                title: 'Delete Attendance Records',
                description: 'Remove duplicate punch entries and delete invalid biometric logs',
                icon: LuTrash2
            },
            {
                key: 'can_view_attendance_report',
                title: 'View Attendance Reports',
                description: 'Access detailed daily and monthly attendance summaries and export data',
                icon: LuChartColumn
            },
            {
                key: 'can_manage_active_onduty',
                title: 'Track Active On-Duty Personnel',
                description: 'Monitor live GPS locations, routes, and active field duty sessions on maps',
                icon: LuCompass
            },
            {
                key: 'can_manage_schedule',
                title: 'Manage Work Schedules & Shifts',
                description: 'Assign shifts, customize working hours, and view roster calendars',
                icon: LuCalendar
            }
        ]
    },
    {
        id: 'analytics_audit',
        title: 'Analytics & Audit Logs',
        categoryTag: 'Category 04 • Reports & Logs',
        description: 'High-level business analytics and operational audit trails',
        icon: LuActivity,
        theme: {
            border: 'border-purple-200/90 shadow-sm shadow-purple-100/50',
            borderCollapsed: 'border-purple-200/70 bg-gradient-to-r from-purple-50/40 to-white hover:border-purple-300',
            headerBg: 'bg-gradient-to-r from-purple-50/90 via-purple-50/30 to-white',
            iconContainer: 'bg-purple-600 text-white shadow-md shadow-purple-200/60',
            titleText: 'text-purple-950 group-hover/hdr:text-purple-700',
            categoryTagClass: 'bg-purple-100/90 text-purple-800 border-purple-200/70',
            badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
            btnSubordinates: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
        },
        permissions: [
            {
                key: 'can_view_reports',
                title: 'View Analytics & Management Reports',
                description: 'Generate operational reports and managerial overview analytics',
                icon: LuChartColumn
            },
            {
                key: 'can_view_activities',
                title: 'View System Activity Logs',
                description: 'Inspect user login history, approval logs, and system audit records',
                icon: LuActivity
            }
        ]
    }
];

const GLOBAL_GROUPS = [
    {
        id: 'portals',
        title: 'Portal & Application Access',
        categoryTag: 'Section 01 • Application Portals',
        description: 'Access to web administrative consoles and attendance terminals',
        icon: LuGlobe,
        theme: {
            border: 'border-teal-200/90 shadow-sm shadow-teal-100/50',
            borderCollapsed: 'border-teal-200/70 bg-gradient-to-r from-teal-50/40 to-white hover:border-teal-300',
            headerBg: 'bg-gradient-to-r from-teal-50/90 via-teal-50/30 to-white',
            iconContainer: 'bg-teal-600 text-white shadow-md shadow-teal-200/60',
            titleText: 'text-teal-950 group-hover/hdr:text-teal-700',
            categoryTagClass: 'bg-teal-100/90 text-teal-800 border-teal-200/70',
            badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
            btnEnable: 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200'
        },
        permissions: [
            {
                key: 'can_access_webapp',
                title: 'Access Web Application',
                description: 'Allows staff members with this role to sign into the web management console',
                icon: LuGlobe
            },
            {
                key: 'can_access_attendance_portal',
                title: 'Access Kiosk Attendance Terminal',
                description: 'Permits opening and operating the front desk kiosk QR scanner terminal to capture employee attendance',
                icon: LuQrCode
            }
        ]
    },
    {
        id: 'hr_operations',
        title: 'HR Operations & Greetings',
        categoryTag: 'Section 02 • HR & Greetings',
        description: 'Onboarding document verification and staff milestone greetings',
        icon: LuBriefcase,
        theme: {
            border: 'border-rose-200/90 shadow-sm shadow-rose-100/50',
            borderCollapsed: 'border-rose-200/70 bg-gradient-to-r from-rose-50/40 to-white hover:border-rose-300',
            headerBg: 'bg-gradient-to-r from-rose-50/90 via-rose-50/30 to-white',
            iconContainer: 'bg-rose-600 text-white shadow-md shadow-rose-200/60',
            titleText: 'text-rose-950 group-hover/hdr:text-rose-700',
            categoryTagClass: 'bg-rose-100/90 text-rose-800 border-rose-200/70',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
            btnEnable: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
        },
        permissions: [
            {
                key: 'can_manage_onboarding',
                title: 'Manage Employee Onboarding',
                description: 'Review, verify, and approve/reject submitted joining documents from new recruits',
                icon: LuFileCheck,
                disabledFor: ['manager', 'employee']
            },
            {
                key: 'can_view_birthdays',
                title: 'View Staff Birthdays',
                description: "Displays today's birthdays on dashboard and enables sending birthday greetings",
                icon: LuCake
            },
            {
                key: 'can_view_anniversaries',
                title: 'View Work Anniversaries',
                description: "Displays work anniversaries on dashboard and enables sending anniversary wishes",
                icon: LuAward
            }
        ]
    },
    {
        id: 'system_admin',
        title: 'System Administration & Security',
        categoryTag: 'Section 03 • Security & Settings',
        description: 'Security policies, API keys, role definitions, and system-wide options',
        icon: LuSettings,
        theme: {
            border: 'border-slate-300/90 shadow-sm shadow-slate-200/50',
            borderCollapsed: 'border-slate-300/70 bg-gradient-to-r from-slate-100/60 to-white hover:border-slate-400',
            headerBg: 'bg-gradient-to-r from-slate-100 via-slate-50 to-white',
            iconContainer: 'bg-slate-800 text-white shadow-md shadow-slate-300',
            titleText: 'text-slate-950 group-hover/hdr:text-slate-700',
            categoryTagClass: 'bg-slate-200 text-slate-800 border-slate-300/80',
            badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
            btnEnable: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
        },
        permissions: [
            {
                key: 'can_manage_roles',
                title: 'Manage Roles & Permissions',
                description: 'Create and configure organizational roles, levels, and access permission rules',
                icon: LuShield
            },
            {
                key: 'can_manage_leave_types',
                title: 'Manage Leave Types & Policies',
                description: 'Create leave types, configure annual quotas, carryover limits, and rules',
                icon: LuCalendarCheck
            },
            {
                key: 'can_manage_service_accounts',
                title: 'Manage Service Accounts',
                description: 'Generate, rotate, and manage automated machine-to-machine API tokens',
                icon: LuKey
            },
            {
                key: 'can_manage_email_settings',
                title: 'Manage Email & SMTP Configuration',
                description: 'Configure SMTP servers, test mail delivery, and manage email notification templates',
                icon: LuMail
            },
            {
                key: 'can_manage_system_settings',
                title: 'Manage System Settings',
                description: 'Configure system-wide settings and preferences (Admin / Super Admin)',
                icon: LuSettings,
                adminOnly: true
            }
        ]
    }
];

const getRolePermissionsList = (role) => {
    if (!role) return [];
    const list = [];

    // Global Permissions
    if (role.can_access_webapp) {
        list.push({ label: 'Web App', color: 'bg-teal-50 text-teal-700 border-teal-200' });
    }
    if (role.can_access_attendance_portal) {
        list.push({ label: 'Kiosk Scanner', color: 'bg-amber-50 text-amber-700 border-amber-200' });
    }
    if (role.can_manage_onboarding) {
        list.push({ label: 'Onboarding', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' });
    }
    if (role.can_view_birthdays) {
        list.push({ label: 'Birthdays', color: 'bg-pink-50 text-pink-700 border-pink-200' });
    }
    if (role.can_view_anniversaries) {
        list.push({ label: 'Anniversaries', color: 'bg-teal-50 text-teal-700 border-teal-200' });
    }
    if (role.can_manage_roles) {
        list.push({ label: 'Manage Roles', color: 'bg-rose-50 text-rose-700 border-rose-200' });
    }
    if (role.can_manage_leave_types) {
        list.push({ label: 'Leave Types', color: 'bg-purple-50 text-purple-700 border-purple-200' });
    }
    if (role.can_manage_service_accounts) {
        list.push({ label: 'Service Accounts', color: 'bg-teal-50 text-teal-700 border-teal-200' });
    }
    if (role.can_manage_email_settings) {
        list.push({ label: 'Email Config', color: 'bg-slate-100 text-slate-700 border-slate-200' });
    }
    if (role.can_manage_system_settings === 'all') {
        list.push({ label: 'System Settings', color: 'bg-blue-50 text-blue-700 border-blue-200' });
    }

    // Hierarchical Permissions
    if (role.can_approve_leave && role.can_approve_leave !== 'none') {
        list.push({
            label: `Leave (${role.can_approve_leave === 'all' ? 'All' : 'Sub'})`,
            color: role.can_approve_leave === 'all' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        });
    }
    if (role.can_approve_onduty && role.can_approve_onduty !== 'none') {
        list.push({
            label: `OnDuty (${role.can_approve_onduty === 'all' ? 'All' : 'Sub'})`,
            color: role.can_approve_onduty === 'all' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        });
    }
    if (role.can_approve_timeoff && role.can_approve_timeoff !== 'none') {
        list.push({
            label: `TimeOff (${role.can_approve_timeoff === 'all' ? 'All' : 'Sub'})`,
            color: role.can_approve_timeoff === 'all' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        });
    }
    if (role.can_manage_users && role.can_manage_users !== 'none') {
        list.push({
            label: `Users (${role.can_manage_users === 'all' ? 'All' : 'Sub'})`,
            color: role.can_manage_users === 'all' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-50 text-purple-700 border-purple-200'
        });
    }
    if (role.can_view_users && role.can_view_users !== 'none') {
        list.push({
            label: `View Users (${role.can_view_users === 'all' ? 'All' : 'Sub'})`,
            color: role.can_view_users === 'all' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        });
    }
    if (role.can_manage_active_onduty && role.can_manage_active_onduty !== 'none') {
        list.push({
            label: `Active OnDuty (${role.can_manage_active_onduty === 'all' ? 'All' : 'Sub'})`,
            color: role.can_manage_active_onduty === 'all' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-orange-50 text-orange-700 border-orange-200'
        });
    }
    if (role.can_manage_schedule && role.can_manage_schedule !== 'none') {
        list.push({
            label: `Schedule (${role.can_manage_schedule === 'all' ? 'All' : 'Sub'})`,
            color: role.can_manage_schedule === 'all' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-50 text-purple-700 border-purple-200'
        });
    }
    if (role.can_view_reports && role.can_view_reports !== 'none') {
        list.push({
            label: `Reports (${role.can_view_reports === 'all' ? 'All' : 'Sub'})`,
            color: role.can_view_reports === 'all' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-50 text-blue-700 border-blue-200'
        });
    }
    if (role.can_view_activities && role.can_view_activities !== 'none') {
        list.push({
            label: `Activities (${role.can_view_activities === 'all' ? 'All' : 'Sub'})`,
            color: role.can_view_activities === 'all' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
        });
    }
    const editAttLevel = role.can_edit_attendance || (role.can_manage_attendance && role.can_manage_attendance !== 'none' ? role.can_manage_attendance : null);
    if (editAttLevel && editAttLevel !== 'none') {
        list.push({
            label: `Edit Att. (${editAttLevel === 'all' ? 'All' : 'Sub'})`,
            color: editAttLevel === 'all' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        });
    }
    const deleteAttLevel = role.can_delete_attendance || (role.can_manage_attendance && role.can_manage_attendance !== 'none' ? role.can_manage_attendance : null);
    if (deleteAttLevel && deleteAttLevel !== 'none') {
        list.push({
            label: `Delete Att. (${deleteAttLevel === 'all' ? 'All' : 'Sub'})`,
            color: deleteAttLevel === 'all' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        });
    }
    if (role.can_view_attendance_report && role.can_view_attendance_report !== 'none') {
        list.push({
            label: `Att. Report (${role.can_view_attendance_report === 'all' ? 'All' : 'Sub'})`,
            color: role.can_view_attendance_report === 'all' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-50 text-blue-700 border-blue-200'
        });
    }

    return list;
};

const Roles = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'hierarchy_level', direction: 'asc' });
    const [showModal, setShowModal] = useState(false);
    const [activeModalTab, setActiveModalTab] = useState('basic');
    const [editingRole, setEditingRole] = useState(null);
    const [saving, setSaving] = useState(false);
    const [statistics, setStatistics] = useState([]);
    const [hierarchyMode, setHierarchyMode] = useState(false);
    const [hierarchyRoles, setHierarchyRoles] = useState([]);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);
    const [deletingRole, setDeletingRole] = useState(false);
    const [expandedPermissions, setExpandedPermissions] = useState({});
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const togglePermissionsExpand = (roleId) => {
        setExpandedPermissions(prev => ({
            ...prev,
            [roleId]: !prev[roleId]
        }));
    };

    const allExpanded = roles.length > 0 && roles.every(r => expandedPermissions[r.id]);

    const toggleAllPermissionsExpand = () => {
        if (allExpanded) {
            setExpandedPermissions({});
        } else {
            const allExp = {};
            roles.forEach(r => { allExp[r.id] = true; });
            setExpandedPermissions(allExp);
        }
    };

    const getInitialCollapsedState = () => {
        const initial = {};
        HIERARCHICAL_GROUPS.forEach(g => { initial[g.id] = true; });
        GLOBAL_GROUPS.forEach(g => { initial[g.id] = true; });
        return initial;
    };

    const [collapsedGroups, setCollapsedGroups] = useState(getInitialCollapsedState);

    const toggleGroupCollapse = (groupId) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    const areAllHierarchicalCollapsed = HIERARCHICAL_GROUPS.every(g => !!collapsedGroups[g.id]);
    const toggleAllHierarchicalCollapse = () => {
        setCollapsedGroups(prev => {
            const updated = { ...prev };
            const shouldCollapse = !areAllHierarchicalCollapsed;
            HIERARCHICAL_GROUPS.forEach(g => {
                updated[g.id] = shouldCollapse;
            });
            return updated;
        });
    };

    const areAllGlobalCollapsed = GLOBAL_GROUPS.every(g => !!collapsedGroups[g.id]);
    const toggleAllGlobalCollapse = () => {
        setCollapsedGroups(prev => {
            const updated = { ...prev };
            const shouldCollapse = !areAllGlobalCollapsed;
            GLOBAL_GROUPS.forEach(g => {
                updated[g.id] = shouldCollapse;
            });
            return updated;
        });
    };

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        description: '',
        hierarchy_level: 999,
        // Hierarchical permissions - 'none', 'subordinates', 'all'
        can_approve_leave: 'none',
        can_approve_onduty: 'none',
        can_approve_timeoff: 'none',
        can_manage_users: 'none',
        can_view_users: 'none',
        can_edit_attendance: 'none',
        can_delete_attendance: 'none',
        can_view_attendance_report: 'none',
        can_manage_active_onduty: 'none',
        can_manage_schedule: 'none',
        can_view_reports: 'none',
        can_view_activities: 'none',
        // Global permissions - boolean
        can_manage_leave_types: false,
        can_manage_onboarding: false,
        can_view_birthdays: false,
        can_view_anniversaries: false,
        can_access_webapp: false,
        can_manage_roles: false,
        can_manage_service_accounts: false,
        can_manage_email_settings: false,
        can_manage_system_settings: 'none',
        can_access_attendance_portal: false,
        can_manage_attendance: 'none',
        active: true
    });

    // Check permission first
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRolesUtil(true);
                const role = getRoleById(user.role);
                const canManage = role?.can_manage_roles == true;
                if (!canManage) {
                    navigate('/unauthorized', { replace: true });
                } else {
                    setHasPermission(true);
                }
            } catch (error) {
                console.error('Error checking permissions:', error);
                navigate('/unauthorized', { replace: true });
            } finally {
                setPermissionChecked(true);
            }
        };
        checkPermission();
    }, [user.role, navigate]);

    useEffect(() => {
        if (hasPermission) {
            fetchRoles();
            fetchStatistics();
        }
    }, [hasPermission]);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/roles`, {
                headers: { 'x-access-token': token }
            });
            setRoles(response.data);
            setHierarchyRoles(response.data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load roles');
            toast.error('Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    const fetchStatistics = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/roles/statistics`, {
                headers: { 'x-access-token': token }
            });
            setStatistics(response.data);
        } catch (err) {
            console.error('Failed to load statistics:', err);
        }
    };

    const handleOpenModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setFormData({
                id: role.id,  // Add id to formData
                name: role.name,
                display_name: role.display_name,
                description: role.description || '',
                hierarchy_level: role.hierarchy_level,
                // Hierarchical permissions
                can_approve_leave: role.can_approve_leave || 'none',
                can_approve_onduty: role.can_approve_onduty || 'none',
                can_approve_timeoff: role.can_approve_timeoff || 'none',
                can_manage_users: role.can_manage_users || 'none',
                can_view_users: role.can_view_users || 'none',
                can_edit_attendance: role.can_edit_attendance || role.can_manage_attendance || 'none',
                can_delete_attendance: role.can_delete_attendance || role.can_manage_attendance || 'none',
                can_view_attendance_report: role.can_view_attendance_report || 'none',
                can_manage_active_onduty: role.can_manage_active_onduty || 'none',
                can_manage_schedule: role.can_manage_schedule || 'none',
                can_view_reports: role.can_view_reports || 'none',
                can_view_activities: role.can_view_activities || 'none',
                // Global permissions
                can_manage_leave_types: role.can_manage_leave_types,
                can_manage_onboarding: role.can_manage_onboarding,
                can_view_birthdays: role.can_view_birthdays,
                can_view_anniversaries: role.can_view_anniversaries || false,
                can_access_webapp: role.can_access_webapp,
                can_manage_roles: role.can_manage_roles,
                can_manage_service_accounts: role.can_manage_service_accounts || false,
                can_manage_email_settings: role.can_manage_email_settings,
                can_manage_system_settings: role.can_manage_system_settings,
                can_access_attendance_portal: role.can_access_attendance_portal || false,
                can_manage_attendance: role.can_manage_attendance || 'none',
                active: role.active
            });
        } else {
            setEditingRole(null);
            setFormData({
                name: '',
                display_name: '',
                description: '',
                hierarchy_level: 999,
                // Hierarchical permissions
                can_approve_leave: 'none',
                can_approve_onduty: 'none',
                can_approve_timeoff: 'none',
                can_manage_users: 'none',
                can_view_users: 'none',
                can_edit_attendance: 'none',
                can_delete_attendance: 'none',
                can_view_attendance_report: 'none',
                can_manage_active_onduty: 'none',
                can_manage_schedule: 'none',
                can_view_reports: 'none',
                can_view_activities: 'none',
                // Global permissions
                can_manage_leave_types: false,
                can_manage_onboarding: false,
                can_view_birthdays: false,
                can_view_anniversaries: false,
                can_access_webapp: false,
                can_manage_roles: false,
                can_manage_service_accounts: false,
                can_manage_email_settings: false,
                can_manage_system_settings: 'none',
                can_access_attendance_portal: false,
                can_manage_attendance: 'none',
                active: true
            });
        }
        setActiveModalTab('basic');
        setCollapsedGroups(getInitialCollapsedState());
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingRole(null);
        setActiveModalTab('basic');
        setCollapsedGroups(getInitialCollapsedState());
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Permission helpers for hierarchical scopes
    const setHierarchicalPermission = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const setHierarchicalGroup = (permissions, value) => {
        setFormData(prev => {
            const updated = { ...prev };
            permissions.forEach(p => {
                updated[p.key] = value;
            });
            return updated;
        });
    };

    const setAllHierarchical = (value) => {
        setFormData(prev => {
            const updated = { ...prev };
            HIERARCHICAL_GROUPS.forEach(group => {
                group.permissions.forEach(p => {
                    updated[p.key] = value;
                });
            });
            return updated;
        });
    };

    // Permission helpers for global booleans
    const toggleGlobalPermission = (key) => {
        setFormData(prev => {
            if (key === 'can_manage_system_settings') {
                return {
                    ...prev,
                    can_manage_system_settings: prev.can_manage_system_settings === 'all' ? 'none' : 'all'
                };
            }
            return {
                ...prev,
                [key]: !prev[key]
            };
        });
    };

    const setGlobalGroup = (permissions, value) => {
        setFormData(prev => {
            const updated = { ...prev };
            permissions.forEach(p => {
                if (p.disabledFor && p.disabledFor.includes(prev.name)) {
                    return;
                }
                if (p.key === 'can_manage_system_settings') {
                    if (prev.id === 1 || prev.id === 3 || !prev.id) {
                        updated[p.key] = value ? 'all' : 'none';
                    }
                } else {
                    updated[p.key] = value;
                }
            });
            return updated;
        });
    };

    const setAllGlobal = (value) => {
        setFormData(prev => {
            const updated = { ...prev };
            GLOBAL_GROUPS.forEach(group => {
                group.permissions.forEach(p => {
                    if (p.disabledFor && p.disabledFor.includes(prev.name)) {
                        return;
                    }
                    if (p.key === 'can_manage_system_settings') {
                        if (prev.id === 1 || prev.id === 3 || !prev.id) {
                            updated[p.key] = value ? 'all' : 'none';
                        }
                    } else {
                        updated[p.key] = value;
                    }
                });
            });
            return updated;
        });
    };

    // Calculate configured permission counts
    const activeHierarchicalCount = [
        formData.can_approve_leave,
        formData.can_approve_onduty,
        formData.can_approve_timeoff,
        formData.can_manage_users,
        formData.can_view_users,
        formData.can_edit_attendance,
        formData.can_delete_attendance,
        formData.can_view_attendance_report,
        formData.can_manage_active_onduty,
        formData.can_manage_schedule,
        formData.can_view_reports,
        formData.can_view_activities
    ].filter(val => val && val !== 'none').length;

    const activeGlobalCount = [
        formData.can_access_webapp,
        formData.can_access_attendance_portal,
        formData.can_manage_onboarding && formData.name !== 'manager' && formData.name !== 'employee',
        formData.can_view_birthdays,
        formData.can_view_anniversaries,
        formData.can_manage_roles,
        formData.can_manage_leave_types,
        formData.can_manage_service_accounts,
        formData.can_manage_email_settings,
        formData.can_manage_system_settings === 'all'
    ].filter(Boolean).length;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const token = localStorage.getItem('token');
            const submissionData = { ...formData };
            if (submissionData.name === 'manager' || submissionData.name === 'employee') {
                submissionData.can_manage_onboarding = false;
            }

            if (editingRole) {
                // Update existing role
                await axios.put(
                    `${API_BASE_URL}/api/roles/${editingRole.id}`,
                    submissionData,
                    { headers: { 'x-access-token': token } }
                );
                toast.success('Role updated successfully');
            } else {
                // Create new role
                await axios.post(
                    `${API_BASE_URL}/api/roles`,
                    submissionData,
                    { headers: { 'x-access-token': token } }
                );
                toast.success('Role created successfully');
            }

            // Clear the global roles cache so other pages pick up the change
            clearRolesCache();

            fetchRoles();
            fetchStatistics();
            handleCloseModal();
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to save role';
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (role) => {
        setDeleteRoleTarget(role);
    };

    const confirmDeleteRole = async () => {
        if (!deleteRoleTarget) return;
        setDeletingRole(true);

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/roles/${deleteRoleTarget.id}`, {
                headers: { 'x-access-token': token }
            });
            toast.success('Role deleted successfully');

            // Clear the global roles cache so other pages pick up the change
            clearRolesCache();

            fetchRoles();
            fetchStatistics();
            setDeleteRoleTarget(null);
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to delete role';
            toast.error(errorMsg);
        } finally {
            setDeletingRole(false);
        }
    };

    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedRoles = React.useMemo(() => {
        if (hierarchyMode) return hierarchyRoles; // Don't sort in hierarchy mode

        const sorted = [...roles];
        sorted.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle null/undefined values
            if (aValue == null) aValue = '';
            if (bValue == null) bValue = '';

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [roles, sortConfig, hierarchyMode, hierarchyRoles]);

    const handleToggleHierarchyMode = () => {
        if (hierarchyMode) {
            // Exiting hierarchy mode - reset
            setHierarchyRoles(roles);
            setDraggedIndex(null);
            setDragOverIndex(null);
        }
        setHierarchyMode(!hierarchyMode);
    };

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverIndex(null);
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDragOverIndex(null);
            return;
        }

        const newRoles = [...hierarchyRoles];
        const draggedRole = newRoles[draggedIndex];

        // Remove dragged item
        newRoles.splice(draggedIndex, 1);
        // Insert at new position
        newRoles.splice(dropIndex, 0, draggedRole);

        setHierarchyRoles(newRoles);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleSaveHierarchy = async () => {
        try {
            const token = localStorage.getItem('token');
            const updatedRoles = hierarchyRoles.map((role, index) => ({
                id: role.id,
                hierarchy_level: index
            }));

            await axios.put(
                `${API_BASE_URL}/api/roles/hierarchy/update`,
                { roles: updatedRoles },
                { headers: { 'x-access-token': token } }
            );

            toast.success('Hierarchy updated successfully');
            setHierarchyMode(false);

            // Clear the global roles cache so other pages pick up the hierarchy change
            clearRolesCache();

            fetchRoles();
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to update hierarchy';
            toast.error(errorMsg);
        }
    };

    const getUserCount = (roleId) => {
        const stat = statistics.find(s => s.id === roleId);
        return stat ? parseInt(stat.user_count) : 0;
    };

    // Show loading while checking permissions
    if (!permissionChecked) {
        return <ModernLoader />;
    }

    // Don't render if no permission
    if (!hasPermission) {
        return null;
    }


    return (
        <div className="p-6 relative min-h-[600px]">
            {loading && (
                <ModernLoader size="container" message="Fetching roles..." fullScreen={false} />
            )/* Localization: Overlay instead of full-page blur */}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <div className="mb-4 flex justify-between items-center">
                <button
                    onClick={handleToggleHierarchyMode}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${hierarchyMode
                        ? 'bg-gray-600 text-white hover:bg-gray-700'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                >
                    <FiMove className="inline mr-2" />
                    {hierarchyMode ? 'Cancel Hierarchy Edit' : 'Edit Hierarchy'}
                </button>

                {hierarchyMode && (
                    <button
                        onClick={handleSaveHierarchy}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                        <FiSave className="inline mr-2" />
                        Save Hierarchy
                    </button>
                )}

                {!hierarchyMode && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                        <FiPlus className="inline mr-2" />
                        Add New Role
                    </button>
                )}
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
                {hierarchyMode && (
                    <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
                        <p className="text-sm text-blue-800 font-medium flex items-center">
                            <MdDragIndicator className="mr-2" />
                            Drag and drop roles to reorder hierarchy (top = highest authority)
                        </p>
                    </div>
                )}
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {hierarchyMode && <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drag</th>}
                            <th className="px-3 py-3 text-left">
                                {!hierarchyMode ? (
                                    <button
                                        onClick={() => handleSort('display_name')}
                                        className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                                    >
                                        Display Name <TableSortIcon column="display_name" sortConfig={sortConfig} />
                                    </button>
                                ) : (
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Display Name</span>
                                )}
                            </th>
                            <th className="px-3 py-3 text-left">
                                {!hierarchyMode ? (
                                    <button
                                        onClick={() => handleSort('name')}
                                        className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                                    >
                                        Name <TableSortIcon column="name" sortConfig={sortConfig} />
                                    </button>
                                ) : (
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name</span>
                                )}
                            </th>
                            <th className="px-3 py-3 text-left">
                                {!hierarchyMode ? (
                                    <button
                                        onClick={() => handleSort('hierarchy_level')}
                                        className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                                    >
                                        Hierarchy <TableSortIcon column="hierarchy_level" sortConfig={sortConfig} />
                                    </button>
                                ) : (
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hierarchy</span>
                                )}
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                    <span>Permissions</span>
                                    {roles.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={toggleAllPermissionsExpand}
                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 normal-case px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition cursor-pointer flex items-center gap-1"
                                            title={allExpanded ? 'Collapse all role permissions' : 'Expand all role permissions'}
                                        >
                                            <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
                                            {allExpanded ? <LuChevronUp size={11} /> : <LuChevronDown size={11} />}
                                        </button>
                                    )}
                                </div>
                            </th>
                            <th className="px-3 py-3 text-left">
                                {!hierarchyMode ? (
                                    <button
                                        onClick={() => handleSort('active')}
                                        className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                                    >
                                        Status <TableSortIcon column="active" sortConfig={sortConfig} />
                                    </button>
                                ) : (
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</span>
                                )}
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {(hierarchyMode ? hierarchyRoles : sortedRoles).map((role, index) => (
                            <tr
                                key={role.id}
                                draggable={hierarchyMode}
                                onDragStart={hierarchyMode ? (e) => handleDragStart(e, index) : undefined}
                                onDragOver={hierarchyMode ? (e) => handleDragOver(e, index) : undefined}
                                onDragLeave={hierarchyMode ? handleDragLeave : undefined}
                                onDrop={hierarchyMode ? (e) => handleDrop(e, index) : undefined}
                                onDragEnd={hierarchyMode ? handleDragEnd : undefined}
                                className={`
                                    ${hierarchyMode ? 'cursor-move' : 'hover:bg-gray-50'}
                                    ${draggedIndex === index ? 'opacity-40 bg-gray-100' : ''}
                                    ${dragOverIndex === index ? 'border-t-4 border-indigo-500' : ''}
                                    transition-all duration-150
                                `}
                            >
                                {hierarchyMode && (
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <MdDragIndicator className="w-5 h-5 text-gray-400" />
                                    </td>
                                )}
                                <td className="px-3 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{role.display_name}</div>
                                    {role.description && (
                                        <div className="text-sm text-gray-500">{role.description}</div>
                                    )}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap">
                                    <span className="text-sm font-mono text-gray-700">{role.name}</span>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                        Level {role.hierarchy_level}
                                    </span>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                        {getUserCount(role.id)} users
                                    </span>
                                </td>
                                <td className="px-3 py-4 align-top">
                                    {(() => {
                                        const perms = getRolePermissionsList(role);
                                        const isExpanded = !!expandedPermissions[role.id];

                                        if (perms.length === 0) {
                                            return (
                                                <span className="text-xs text-slate-400 italic font-medium">
                                                    No permissions
                                                </span>
                                            );
                                        }

                                        const visiblePerms = isExpanded ? perms : perms.slice(0, 4);
                                        const remainingCount = perms.length - 4;

                                        return (
                                            <div className="space-y-1.5" style={{ minWidth: '240px', maxWidth: '340px' }}>
                                                <div className="flex flex-wrap gap-1">
                                                    {visiblePerms.map((perm, pIdx) => (
                                                        <span
                                                            key={pIdx}
                                                            className={`px-1.5 py-0.5 text-[11px] font-medium rounded text-center leading-tight border shadow-2xs ${perm.color}`}
                                                        >
                                                            {perm.label}
                                                        </span>
                                                    ))}
                                                </div>

                                                {perms.length > 4 && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            togglePermissionsExpand(role.id);
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition cursor-pointer"
                                                    >
                                                        {isExpanded ? (
                                                            <>
                                                                <span>Show Less</span>
                                                                <LuChevronUp size={12} />
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>+{remainingCount} more</span>
                                                                <LuChevronDown size={12} />
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${role.active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {role.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                                    {!hierarchyMode && (
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleOpenModal(role)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                                title="Edit role"
                                            >
                                                <FiEdit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(role)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete role"
                                            >
                                                <FiTrash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Role Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200/80 overflow-hidden">
                        {/* Modal Header */}
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                                        <LuShield size={22} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                            <span>{editingRole ? `Edit Role: ${editingRole.display_name}` : 'Create New Role'}</span>
                                            {editingRole && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                    Level {editingRole.hierarchy_level}
                                                </span>
                                            )}
                                        </h2>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Configure hierarchy tiers, scoped approvals, and system permissions
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCloseModal}
                                    className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Tabs */}
                            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70">
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('basic')}
                                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                                        activeModalTab === 'basic'
                                            ? 'bg-white text-slate-900 shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <LuFileText size={14} />
                                    <span>Basic Info</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('hierarchical')}
                                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                                        activeModalTab === 'hierarchical'
                                            ? 'bg-white text-indigo-700 shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <LuLayers size={14} />
                                    <span>Hierarchical Scopes</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                        activeModalTab === 'hierarchical' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {activeHierarchicalCount}/12
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('global')}
                                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                                        activeModalTab === 'global'
                                            ? 'bg-white text-emerald-700 shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <LuGlobe size={14} />
                                    <span>Global Permissions</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                        activeModalTab === 'global' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {activeGlobalCount}/{formData.id === 1 || formData.id === 3 || !formData.id ? '11' : '10'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between">
                            <div className="p-6 md:p-8 space-y-6">
                                {/* TAB 1: BASIC INFO */}
                                {activeModalTab === 'basic' && (
                                    <div className="space-y-6 animate-fadeIn">
                                        <div className="bg-gradient-to-r from-indigo-50/60 to-blue-50/40 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
                                            <LuInfo size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                                            <div className="text-xs text-slate-600 leading-relaxed">
                                                <strong className="text-slate-900 font-bold">Role Configuration:</strong> Define the identifier, human-readable display title, and hierarchical precedence.
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                                    System Identifier (name) *
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    required
                                                    pattern="[a-z0-9_]+"
                                                    disabled={!!editingRole && (editingRole.id === 1 || editingRole.id === 2 || editingRole.id === 3)}
                                                    className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                                                    placeholder="e.g., team_lead"
                                                />
                                                <p className="text-[11px] text-slate-400 mt-1">
                                                    Lowercase letters, numbers, and underscores only.
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                                    Display Title *
                                                </label>
                                                <input
                                                    type="text"
                                                    name="display_name"
                                                    value={formData.display_name}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm font-semibold transition"
                                                    placeholder="e.g., Team Lead"
                                                />
                                                <p className="text-[11px] text-slate-400 mt-1">
                                                    Name shown across user profiles and badges.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                                    Hierarchy Level (Precedence) *
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        name="hierarchy_level"
                                                        value={formData.hierarchy_level}
                                                        onChange={handleInputChange}
                                                        min="0"
                                                        max="999"
                                                        required
                                                        className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-sm font-bold transition"
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                                                    <span className="font-bold text-indigo-600">0 = Super Admin</span> (lowest number = highest authority).
                                                </p>
                                            </div>

                                            {/* Role Active Toggle */}
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                                    Role Status
                                                </label>
                                                <div
                                                    onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                                                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                                                        formData.active
                                                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                                                            : 'bg-slate-50 border-slate-200 text-slate-600'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2.5 h-2.5 rounded-full ${formData.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                        <span className="text-xs font-bold">
                                                            {formData.active ? 'Active Role (Enabled)' : 'Inactive Role (Disabled)'}
                                                        </span>
                                                    </div>
                                                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                                                        formData.active ? 'bg-emerald-600' : 'bg-slate-300'
                                                    }`}>
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 shadow-sm ${
                                                            formData.active ? 'translate-x-6' : 'translate-x-1'
                                                        }`} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                                Role Description
                                            </label>
                                            <textarea
                                                name="description"
                                                value={formData.description}
                                                onChange={handleInputChange}
                                                rows={3}
                                                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition"
                                                placeholder="Describe the responsibilities and scope of this role..."
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: HIERARCHICAL PERMISSIONS */}
                                {activeModalTab === 'hierarchical' && (
                                    <div className="space-y-6 animate-fadeIn">
                                        {/* Guide banner + Quick Global Toggles */}
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                                    <LuLayers size={14} className="text-indigo-600" />
                                                    Hierarchical Scope Guide
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Select <strong className="text-indigo-700">Subordinates</strong> for direct and downstream reports, or <strong className="text-emerald-700">All Staff</strong> for organization-wide access.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => setAllHierarchical('none')}
                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                                                >
                                                    All None
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAllHierarchical('subordinates')}
                                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                                                >
                                                    All Subordinates
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAllHierarchical('all')}
                                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                                                >
                                                    All Staff
                                                </button>
                                                <div className="h-4 w-[1px] bg-slate-200 mx-0.5 hidden sm:block"></div>
                                                <button
                                                    type="button"
                                                    onClick={toggleAllHierarchicalCollapse}
                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                                                >
                                                    {areAllHierarchicalCollapsed ? (
                                                        <>
                                                            <LuChevronDown size={13} />
                                                            <span>Expand All</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <LuChevronUp size={13} />
                                                            <span>Collapse All</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Grouped Hierarchical Categories */}
                                        <div className="space-y-4">
                                            {HIERARCHICAL_GROUPS.map((group) => {
                                                const GroupIcon = group.icon;
                                                const isCollapsed = !!collapsedGroups[group.id];
                                                const configuredCount = group.permissions.filter(p => (formData[p.key] || 'none') !== 'none').length;
                                                const allStaffCount = group.permissions.filter(p => formData[p.key] === 'all').length;
                                                const t = group.theme || {};

                                                return (
                                                    <div
                                                        key={group.id}
                                                        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                                            isCollapsed
                                                                ? (t.borderCollapsed || 'border-slate-200/80 bg-slate-50/40')
                                                                : `${t.border || 'border-slate-200/90'} bg-white`
                                                        }`}
                                                    >
                                                        {/* Main Section Header Banner (Visually distinct with theme gradient & category badge) */}
                                                        <div 
                                                            className={`p-4 sm:p-5 transition-colors duration-150 cursor-pointer select-none group/hdr ${
                                                                isCollapsed ? 'hover:bg-white/60' : `${t.headerBg || 'bg-slate-50'} border-b border-slate-200/60`
                                                            }`}
                                                            onClick={() => toggleGroupCollapse(group.id)}
                                                        >
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover/hdr:scale-105 duration-200 ${
                                                                        t.iconContainer || 'bg-indigo-600 text-white shadow-sm'
                                                                    }`}>
                                                                        <GroupIcon size={20} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                                            {group.categoryTag && (
                                                                                <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                                                                    t.categoryTagClass || 'bg-slate-200 text-slate-700'
                                                                                }`}>
                                                                                    {group.categoryTag}
                                                                                </span>
                                                                            )}
                                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                                                configuredCount === 0 
                                                                                    ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                                                                    : allStaffCount === group.permissions.length 
                                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                                        : (t.badgeClass || 'bg-indigo-50 text-indigo-700 border-indigo-200')
                                                                            }`}>
                                                                                {configuredCount}/{group.permissions.length} Configured
                                                                            </span>
                                                                        </div>
                                                                        <h4 className={`text-sm sm:text-base font-black tracking-tight leading-tight transition ${
                                                                            t.titleText || 'text-slate-900'
                                                                        }`}>
                                                                            {group.title}
                                                                        </h4>
                                                                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{group.description}</p>
                                                                    </div>
                                                                </div>

                                                                {/* Group Action Controls & Animated Chevron */}
                                                                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="flex items-center gap-1 bg-white/80 p-1 rounded-lg border border-slate-200/80 shadow-2xs">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setHierarchicalGroup(group.permissions, 'none')}
                                                                            className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                                                                        >
                                                                            Reset
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setHierarchicalGroup(group.permissions, 'subordinates')}
                                                                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer border ${
                                                                                t.btnSubordinates || 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                                                            }`}
                                                                        >
                                                                            Subordinates
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setHierarchicalGroup(group.permissions, 'all')}
                                                                            className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition cursor-pointer"
                                                                        >
                                                                            All Staff
                                                                        </button>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleGroupCollapse(group.id)}
                                                                        className="p-1.5 rounded-xl bg-white border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-100 shadow-2xs transition cursor-pointer"
                                                                        title={isCollapsed ? "Expand section" : "Collapse section"}
                                                                    >
                                                                        <LuChevronDown 
                                                                            size={18} 
                                                                            className={`transform transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} 
                                                                        />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Inner Child Elements List */}
                                                        {!isCollapsed && (
                                                            <div className="p-4 sm:p-5 bg-slate-50/50 space-y-3 animate-fadeIn">
                                                                {group.permissions.map((perm) => {
                                                                    const PermIcon = perm.icon;
                                                                    const currentValue = formData[perm.key] || 'none';

                                                                    return (
                                                                        <div
                                                                            key={perm.key}
                                                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition duration-150"
                                                                        >
                                                                            <div className="flex items-start gap-3 min-w-0">
                                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                                                    currentValue === 'all'
                                                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                                                        : currentValue === 'subordinates'
                                                                                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                                                                            : 'bg-slate-100 text-slate-400'
                                                                                }`}>
                                                                                    <PermIcon size={16} />
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className="text-xs font-bold text-slate-800">{perm.title}</span>
                                                                                        {currentValue === 'all' && (
                                                                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                                                All Staff
                                                                                            </span>
                                                                                        )}
                                                                                        {currentValue === 'subordinates' && (
                                                                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                                                Subordinates
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <p className="text-[11px] text-slate-500 mt-0.5">{perm.description}</p>
                                                                                </div>
                                                                            </div>

                                                                            {/* 3-Way Segmented Control */}
                                                                            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-center flex-shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setHierarchicalPermission(perm.key, 'none')}
                                                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                                        currentValue === 'none'
                                                                                            ? 'bg-white text-slate-700 shadow-2xs border border-slate-200/80'
                                                                                            : 'text-slate-500 hover:text-slate-800'
                                                                                    }`}
                                                                                >
                                                                                    <LuX size={12} />
                                                                                    <span>None</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setHierarchicalPermission(perm.key, 'subordinates')}
                                                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                                        currentValue === 'subordinates'
                                                                                            ? 'bg-indigo-600 text-white shadow-xs'
                                                                                            : 'text-slate-500 hover:text-indigo-600'
                                                                                    }`}
                                                                                >
                                                                                    <LuUsers size={12} />
                                                                                    <span>Subordinates</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setHierarchicalPermission(perm.key, 'all')}
                                                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                                        currentValue === 'all'
                                                                                            ? 'bg-emerald-600 text-white shadow-xs'
                                                                                            : 'text-slate-500 hover:text-emerald-600'
                                                                                    }`}
                                                                                >
                                                                                    <LuGlobe size={12} />
                                                                                    <span>All Staff</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: GLOBAL PERMISSIONS */}
                                {activeModalTab === 'global' && (
                                    <div className="space-y-6 animate-fadeIn">
                                        {/* Guide banner + Quick Global Toggles */}
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                                    <LuGlobe size={14} className="text-emerald-600" />
                                                    Global Permissions Guide
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    These permissions apply globally across the system and are independent of user hierarchy levels.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => setAllGlobal(false)}
                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                                                >
                                                    Disable All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAllGlobal(true)}
                                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                                                >
                                                    Enable All
                                                </button>
                                                <div className="h-4 w-[1px] bg-slate-200 mx-0.5 hidden sm:block"></div>
                                                <button
                                                    type="button"
                                                    onClick={toggleAllGlobalCollapse}
                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                                                >
                                                    {areAllGlobalCollapsed ? (
                                                        <>
                                                            <LuChevronDown size={13} />
                                                            <span>Expand All</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <LuChevronUp size={13} />
                                                            <span>Collapse All</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Grouped Global Categories */}
                                        <div className="space-y-4">
                                            {GLOBAL_GROUPS.map((group) => {
                                                const GroupIcon = group.icon;
                                                const isCollapsed = !!collapsedGroups[group.id];
                                                const visiblePermissions = group.permissions.filter(p => {
                                                    if (p.adminOnly) {
                                                        return formData.id === 1 || formData.id === 3 || !formData.id;
                                                    }
                                                    return true;
                                                });

                                                if (visiblePermissions.length === 0) return null;

                                                const activeCount = visiblePermissions.filter(p =>
                                                    p.key === 'can_manage_system_settings'
                                                        ? formData.can_manage_system_settings === 'all'
                                                        : !!formData[p.key]
                                                ).length;
                                                const t = group.theme || {};

                                                return (
                                                    <div
                                                        key={group.id}
                                                        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                                            isCollapsed
                                                                ? (t.borderCollapsed || 'border-slate-200/80 bg-slate-50/40')
                                                                : `${t.border || 'border-slate-200/90'} bg-white`
                                                        }`}
                                                    >
                                                        {/* Main Section Header Banner */}
                                                        <div 
                                                            className={`p-4 sm:p-5 transition-colors duration-150 cursor-pointer select-none group/hdr ${
                                                                isCollapsed ? 'hover:bg-white/60' : `${t.headerBg || 'bg-slate-50'} border-b border-slate-200/60`
                                                            }`}
                                                            onClick={() => toggleGroupCollapse(group.id)}
                                                        >
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover/hdr:scale-105 duration-200 ${
                                                                        t.iconContainer || 'bg-emerald-600 text-white shadow-sm'
                                                                    }`}>
                                                                        <GroupIcon size={20} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                                            {group.categoryTag && (
                                                                                <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                                                                    t.categoryTagClass || 'bg-slate-200 text-slate-700'
                                                                                }`}>
                                                                                    {group.categoryTag}
                                                                                </span>
                                                                            )}
                                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                                                activeCount === 0
                                                                                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                                                    : activeCount === visiblePermissions.length
                                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                                        : (t.badgeClass || 'bg-emerald-50 text-emerald-700 border-emerald-200')
                                                                            }`}>
                                                                                {activeCount}/{visiblePermissions.length} Active
                                                                            </span>
                                                                        </div>
                                                                        <h4 className={`text-sm sm:text-base font-black tracking-tight leading-tight transition ${
                                                                            t.titleText || 'text-slate-900'
                                                                        }`}>
                                                                            {group.title}
                                                                        </h4>
                                                                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{group.description}</p>
                                                                    </div>
                                                                </div>

                                                                {/* Group Action Controls & Animated Chevron */}
                                                                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="flex items-center gap-1 bg-white/80 p-1 rounded-lg border border-slate-200/80 shadow-2xs">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setGlobalGroup(visiblePermissions, false)}
                                                                            className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                                                                        >
                                                                            Disable
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setGlobalGroup(visiblePermissions, true)}
                                                                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer border ${
                                                                                t.btnEnable || 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                            }`}
                                                                        >
                                                                            Enable All
                                                                        </button>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleGroupCollapse(group.id)}
                                                                        className="p-1.5 rounded-xl bg-white border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-100 shadow-2xs transition cursor-pointer"
                                                                        title={isCollapsed ? "Expand section" : "Collapse section"}
                                                                    >
                                                                        <LuChevronDown 
                                                                            size={18} 
                                                                            className={`transform transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} 
                                                                        />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Inner Interactive Cards Grid */}
                                                        {!isCollapsed && (
                                                            <div className="p-4 sm:p-5 bg-slate-50/50 animate-fadeIn">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {visiblePermissions.map((perm) => {
                                                                        const PermIcon = perm.icon;
                                                                        const isDisabled = perm.disabledFor && perm.disabledFor.includes(formData.name);
                                                                        const isChecked = perm.key === 'can_manage_system_settings'
                                                                            ? formData.can_manage_system_settings === 'all'
                                                                            : !!formData[perm.key];

                                                                        return (
                                                                            <div
                                                                                key={perm.key}
                                                                                onClick={() => !isDisabled && toggleGlobalPermission(perm.key)}
                                                                                className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border transition duration-150 select-none ${
                                                                                    isDisabled
                                                                                        ? 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                                                                                        : isChecked
                                                                                            ? 'bg-emerald-50/50 border-emerald-200/90 shadow-2xs cursor-pointer hover:border-emerald-300'
                                                                                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer shadow-2xs'
                                                                                }`}
                                                                            >
                                                                                <div className="flex items-start gap-2.5 min-w-0">
                                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                                                        isChecked
                                                                                            ? 'bg-emerald-600 text-white shadow-xs'
                                                                                            : 'bg-slate-100 text-slate-400'
                                                                                    }`}>
                                                                                        <PermIcon size={16} />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                                            <span className={`text-xs font-bold leading-tight ${
                                                                                                isChecked ? 'text-emerald-950' : 'text-slate-800'
                                                                                            }`}>
                                                                                                {perm.title}
                                                                                            </span>
                                                                                            {isDisabled && (
                                                                                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">
                                                                                                    Locked
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                                                                            {perm.description}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>

                                                                                {/* iOS Toggle Switch */}
                                                                                <div className="flex-shrink-0 pt-0.5">
                                                                                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                                                                                        isChecked ? 'bg-emerald-600' : 'bg-slate-200'
                                                                                    }`}>
                                                                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 shadow-sm ${
                                                                                            isChecked ? 'translate-x-4.5' : 'translate-x-1'
                                                                                        }`} />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sticky Modal Footer */}
                            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    {activeModalTab === 'basic' && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveModalTab('hierarchical')}
                                            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <span>Next: Hierarchical Scopes</span>
                                            <LuChevronRight size={14} />
                                        </button>
                                    )}
                                    {activeModalTab === 'hierarchical' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setActiveModalTab('basic')}
                                                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
                                            >
                                                <LuChevronLeft size={14} />
                                                <span>Basic</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveModalTab('global')}
                                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>Next: Global Permissions</span>
                                                <LuChevronRight size={14} />
                                            </button>
                                        </>
                                    )}
                                    {activeModalTab === 'global' && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveModalTab('hierarchical')}
                                            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
                                        >
                                            <LuChevronLeft size={14} />
                                            <span>Hierarchical Scopes</span>
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        disabled={saving}
                                        className="flex-1 sm:flex-none px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                    >
                                        {saving ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                <span>Saving Role...</span>
                                            </>
                                        ) : (
                                            <>
                                                <LuCheck size={15} strokeWidth={2.5} />
                                                <span>{editingRole ? 'Update Role' : 'Create Role'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Role Confirmation Modal */}
            {deleteRoleTarget && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-5 text-rose-600 shadow-sm">
                            <FiTrash2 size={28} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete Role?</h3>
                        <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
                            Are you sure you want to delete the role <strong className="text-slate-800">"{deleteRoleTarget.display_name || deleteRoleTarget.name}"</strong>?
                            This action cannot be undone and will permanently remove this role from the system.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteRoleTarget(null)}
                                disabled={deletingRole}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteRole}
                                disabled={deletingRole}
                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {deletingRole ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Yes, Delete Role'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Roles;
