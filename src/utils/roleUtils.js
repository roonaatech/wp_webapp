/**
 * Role Utilities - Dynamic role management based on database roles
 * All role checks should use these utilities instead of hardcoded role IDs
 */

import axios from 'axios';
import API_BASE_URL from '../config/api.config';

// Cache for roles data
let rolesCache = null;
let rolesCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all roles from the API
 * Uses caching to avoid excessive API calls
 */
export const fetchRoles = async (forceRefresh = false) => {
    const now = Date.now();

    // Return cached data if still valid
    if (!forceRefresh && rolesCache && rolesCacheTime && (now - rolesCacheTime < CACHE_DURATION)) {
        return rolesCache;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) return rolesCache || [];

        const response = await axios.get(`${API_BASE_URL}/api/roles`, {
            headers: { 'x-access-token': token }
        });

        rolesCache = response.data;
        rolesCacheTime = now;

        // Also store in localStorage for initial load before API call
        localStorage.setItem('cachedRoles', JSON.stringify(rolesCache));

        return rolesCache;
    } catch (error) {
        console.error('Error fetching roles:', error);
        // Try to get from localStorage cache
        const cached = localStorage.getItem('cachedRoles');
        if (cached) {
            rolesCache = JSON.parse(cached);
            return rolesCache;
        }
        return [];
    }
};

/**
 * Get roles from cache (synchronous, for immediate use)
 * Falls back to localStorage cache if memory cache is empty
 */
export const getCachedRoles = () => {
    if (rolesCache) return rolesCache;

    const cached = localStorage.getItem('cachedRoles');
    if (cached) {
        rolesCache = JSON.parse(cached);
        return rolesCache;
    }

    return [];
};

/**
 * Get role by ID
 */
export const getRoleById = (roleId) => {
    const roles = getCachedRoles();
    return roles.find(r => r.id === parseInt(roleId));
};

/**
 * Get role display name by ID
 */
export const getRoleDisplayName = (roleId) => {
    const role = getRoleById(roleId);
    if (role) {
        return role.display_name || role.name;
    }
    return 'Unknown';
};

/**
 * Check if a role has permission to access the webapp
 * Uses the explicit can_access_webapp permission field
 */
export const canAccessWebApp = (roleId) => {
    const role = getRoleById(roleId);
    console.log('canAccessWebApp - checking role:', roleId, 'found:', role);

    if (!role) {
        console.log('canAccessWebApp - role not found in cache, checking if roles are loaded');
        const allRoles = getCachedRoles();
        console.log('canAccessWebApp - cached roles:', allRoles);
        return false;
    }

    // If role is inactive, deny access
    if (role.active === false) {
        console.log('canAccessWebApp - role is inactive');
        return false;
    }

    // Use the explicit can_access_webapp permission
    // Strict check - no fallbacks
    const hasAccess = role.can_access_webapp === true;

    console.log('canAccessWebApp - hasAccess:', hasAccess, 'role details:', {
        can_access_webapp: role.can_access_webapp
    });

    return hasAccess;
};

/**
 * Check if user has admin-level permissions
 * Based on can_manage_users permission being 'subordinates' or 'all'
 */
export const hasAdminPermission = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_users === 'all';
};

/**
 * Check if user can manage leave types (global permission - boolean)
 */
export const canManageLeaveTypes = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_leave_types === true;
};

/**
 * Check if user can approve leave requests (any level - subordinates or all)
 */
export const canApproveLeave = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_approve_leave === 'subordinates' || role.can_approve_leave === 'all';
};

/**
 * Check if user can approve leave for all users
 */
export const canApproveLeaveAll = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_approve_leave === 'all';
};

/**
 * Check if user can approve on-duty requests (any level - subordinates or all)
 */
export const canApproveOnDuty = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_approve_onduty === 'subordinates' || role.can_approve_onduty === 'all';
};

/**
 * Check if user can approve on-duty for all users
 */
export const canApproveOnDutyAll = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_approve_onduty === 'all';
};

/**
 * Check if user can view reports (any level - subordinates or all)
 */
export const canViewReports = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_view_reports === 'subordinates' || role.can_view_reports === 'all';
};

/**
 * Check if user can view reports for all users
 */
export const canViewReportsAll = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_view_reports === 'all';
};

/**
 * Check if user can manage users (any level - subordinates or all)
 */
export const canManageUsers = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_users === 'subordinates' || role.can_manage_users === 'all';
};

/**
 * Check if user can manage all users
 */
export const canManageUsersAll = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_users === 'all';
};

/**
 * Check if user can manage active on-duty records (any level - subordinates or all)
 */
export const canManageActiveOnDuty = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_active_onduty === 'subordinates' || role.can_manage_active_onduty === 'all';
};

/**
 * Check if user can manage all active on-duty records
 */
export const canManageActiveOnDutyAll = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_active_onduty === 'all';
};

/**
 * Check if user can manage schedule (any level - subordinates or all)
 */
export const canManageSchedule = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_schedule === 'subordinates' || role.can_manage_schedule === 'all';
};

/**
 * Check if user can manage schedule for all users
 */
export const canManageScheduleAll = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_schedule === 'all';
};

/**
 * Check if user can view activities (any level - subordinates or all)
 */
export const canViewActivities = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_view_activities === 'subordinates' || role.can_view_activities === 'all';
};

/**
 * Check if user can view activities for all users
 */
export const canViewActivitiesAll = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_view_activities === 'all';
};

/**
 * Get permission level for a specific permission
 * Returns: 'none', 'subordinates', or 'all'
 */
export const getPermissionLevel = (roleId, permissionName) => {
    const role = getRoleById(roleId);
    if (!role) return 'none';
    return role[permissionName] || 'none';
};

/**
 * Check if user can manage roles (global permission - boolean)
 */
export const canManageRoles = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_roles === true;
};

/**
 * Check if user can manage email settings (global permission - boolean)
 */
export const canManageEmailSettings = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return false;
    return role.can_manage_email_settings === true;
};

/**
 * Get hierarchy level for a role (lower = higher authority)
 */
export const getHierarchyLevel = (roleId) => {
    const role = getRoleById(roleId);
    return role ? role.hierarchy_level : 999;
};

/**
 * Check if roleA is higher in hierarchy than roleB
 * (i.e., roleA can approve/manage roleB)
 */
export const isHigherRole = (roleIdA, roleIdB) => {
    const levelA = getHierarchyLevel(roleIdA);
    const levelB = getHierarchyLevel(roleIdB);
    return levelA < levelB;
};

/**
 * Get all roles that can approve a given role
 * (roles with equal or lower hierarchy_level)
 */
export const getApproverRoles = (roleId) => {
    const roles = getCachedRoles();
    const targetLevel = getHierarchyLevel(roleId);

    return roles.filter(r =>
        r.hierarchy_level <= targetLevel &&
        (r.can_approve_leave !== 'none' || r.can_approve_onduty !== 'none')
    );
};

/**
 * Check if a user (by their role) can be an approver for another role
 */
export const canBeApproverFor = (approverRoleId, targetRoleId) => {
    const approverLevel = getHierarchyLevel(approverRoleId);
    const targetLevel = getHierarchyLevel(targetRoleId);
    const approverRole = getRoleById(approverRoleId);

    console.log('canBeApproverFor check:', {
        approverRoleId,
        targetRoleId,
        approverLevel,
        targetLevel,
        approverRole: approverRole ? { name: approverRole.name, can_approve_leave: approverRole.can_approve_leave, can_approve_onduty: approverRole.can_approve_onduty } : null
    });

    // Approver must have equal or higher authority (lower or same level number) and approval permissions
    // e.g., Admin (level 1) can approve Leader (level 2), and Leader can also approve another Leader
    // For enum permissions, check if they're not 'none'
    const hasApprovalPermission = approverRole &&
        (approverRole.can_approve_leave !== 'none' || approverRole.can_approve_onduty !== 'none');

    return approverLevel <= targetLevel && hasApprovalPermission;
};

/**
 * Check if a role needs an approving manager
 * A role needs an approver if there's at least one role with equal or higher authority that can approve
 */
export const needsApprover = (roleId) => {
    const roles = getCachedRoles();
    const targetLevel = getHierarchyLevel(roleId);

    // Check if there's any role with equal or higher authority (lower or same level) that can approve
    return roles.some(r =>
        r.hierarchy_level <= targetLevel &&
        (r.can_approve_leave !== 'none' || r.can_approve_onduty !== 'none')
    );
};

/**
 * Get a dynamic label for the approver field based on what roles can approve
 */
export const getApproverLabel = (targetRoleId) => {
    const roles = getCachedRoles();
    const targetLevel = getHierarchyLevel(targetRoleId);

    // Get all roles that can be approvers for this role (including same role)
    const approverRoles = roles.filter(r =>
        r.hierarchy_level <= targetLevel &&
        (r.can_approve_leave || r.can_approve_onduty)
    ).sort((a, b) => a.hierarchy_level - b.hierarchy_level);

    if (approverRoles.length === 0) return 'Approving Manager';
    if (approverRoles.length === 1) return `Approving ${approverRoles[0].display_name}`;

    // Join role names
    const roleNames = approverRoles.map(r => r.display_name);
    return roleNames.join(' / ');
};

/**
 * Get role color based on hierarchy level
 */
export const getRoleColor = (roleId) => {
    const role = getRoleById(roleId);
    if (!role) return 'bg-gray-50 text-gray-700';

    // Color based on hierarchy level
    if (role.hierarchy_level === 0) return 'bg-purple-50 text-purple-700'; // Super Admin
    if (role.hierarchy_level === 1) return 'bg-red-50 text-red-700';       // Admin
    if (role.hierarchy_level <= 2) return 'bg-blue-50 text-blue-700';      // Second level (Leader)
    if (role.hierarchy_level <= 3) return 'bg-green-50 text-green-700';    // Third level (Manager)
    return 'bg-gray-50 text-gray-700';                                      // Lower levels
};

/**
 * Clear roles cache (useful after role updates)
 */
export const clearRolesCache = () => {
    rolesCache = null;
    rolesCacheTime = null;
};

export default {
    fetchRoles,
    getCachedRoles,
    getRoleById,
    getRoleDisplayName,
    canAccessWebApp,
    hasAdminPermission,
    canManageLeaveTypes,
    canApproveLeave,
    canApproveOnDuty,
    canViewReports,
    getHierarchyLevel,
    isHigherRole,
    getApproverRoles,
    canBeApproverFor,
    getRoleColor,
    clearRolesCache
};
