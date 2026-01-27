import React, { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2, FiPlus, FiX } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import MermaidChart from '../components/MermaidChart';
import { 
    hasAdminPermission, 
    canApproveLeave, 
    canApproveOnDuty, 
    getRoleDisplayName, 
    getRoleColor as getRoleColorUtil,
    getHierarchyLevel,
    canBeApproverFor,
    getCachedRoles,
    fetchRoles,
    needsApprover,
    getApproverLabel 
} from '../utils/roleUtils';

const Users = () => {
    // Leave Types Modal State
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveModalUser, setLeaveModalUser] = useState(null);
    const [leaveModalLoading, setLeaveModalLoading] = useState(false);
    const [leaveModalError, setLeaveModalError] = useState('');
    const [leaveModalSaving, setLeaveModalSaving] = useState(false);
    const [modalLeaveTypes, setModalLeaveTypes] = useState([]); // unified: all types, with assigned/unassigned


    // Handler to open the Edit Leave Types modal and fetch leave types for a user
    const handleEditLeaveTypes = async (user) => {
        setLeaveModalUser(user);
        setShowLeaveModal(true);
        setLeaveModalLoading(true);
        setLeaveModalError('');
        try {
            const token = localStorage.getItem('token');
            // Get all leave types
            const allTypesRes = await axios.get(`${API_BASE_URL}/api/leavetypes/admin/all`, {
                headers: { 'x-access-token': token }
            });
            // Get user assignments
            const userTypesRes = await axios.get(`${API_BASE_URL}/api/user/${user.staffid}/leave-types`, {
                headers: { 'x-access-token': token }
            });
            // Build a map of assigned leave_type_id
            const assignedMap = {};
            userTypesRes.data.forEach(lt => {
                if (lt.assigned) assignedMap[lt.leave_type_id] = lt;
            });
            // Filter leave types based on gender restriction
            const userGender = user.gender;
            const filteredLeaveTypes = allTypesRes.data.filter(lt => {
                // If no gender restriction or empty array, show to all
                if (!lt.gender_restriction || lt.gender_restriction.length === 0) {
                    return true;
                }
                // If user has no gender set, show all leave types
                if (!userGender) {
                    return true;
                }
                // Check if user's gender is in the restriction list
                return lt.gender_restriction.includes(userGender);
            });
            // All leave types: only mark as assigned if present in user_leave_types
            const merged = filteredLeaveTypes.map(lt => {
                const assigned = assignedMap[lt.id];
                return {
                    leave_type_id: lt.id,
                    name: lt.name,
                    assigned: !!assigned,
                    days_allowed: assigned ? assigned.days_allowed : '',
                    days_used: assigned ? assigned.days_used : 0
                };
            });
            setModalLeaveTypes(merged);
        } catch (err) {
            setLeaveModalError('Failed to load leave types');
        } finally {
            setLeaveModalLoading(false);
        }
    };

    // Handler to save leave types for a user
    const handleSaveLeaveTypes = async () => {
        setLeaveModalSaving(true);
        setLeaveModalError('');
        try {
            const token = localStorage.getItem('token');
            // Only send assigned types with days_allowed
            const leaveTypesPayload = modalLeaveTypes.filter(lt => lt.assigned && lt.days_allowed !== '').map(lt => ({
                leave_type_id: lt.leave_type_id,
                days_allowed: Number(lt.days_allowed)
            }));
            await axios.put(`${API_BASE_URL}/api/user/${leaveModalUser.staffid}/leave-types`,
                { leaveTypes: leaveTypesPayload },
                { headers: { 'x-access-token': token } }
            );
            toast.success('Leave types updated successfully');
            // Refresh leave balance for this user to show updated data
            await fetchLeaveBalance(leaveModalUser.staffid);
            setShowLeaveModal(false);
        } catch (err) {
            setLeaveModalError('Failed to save leave types');
        } finally {
            setLeaveModalSaving(false);
        }
    };

    // Handler to add a leave type to user
    const handleAddLeaveTypeToUser = (leaveTypeId) => {
        setModalLeaveTypes(prev => prev.map(lt =>
            lt.leave_type_id === leaveTypeId
                ? { ...lt, assigned: true, days_allowed: '' }
                : lt
        ));
    };

    // Handler to remove a leave type from user
    const handleRemoveLeaveTypeFromUser = (leaveTypeId) => {
        setModalLeaveTypes(prev => prev.map(lt =>
            lt.leave_type_id === leaveTypeId
                ? { ...lt, assigned: false, days_allowed: '' }
                : lt
        ));
    };

    // Handler to edit days_allowed for a leave type
    const handleEditDaysAllowed = (leaveTypeId, days) => {
        setModalLeaveTypes(prev => prev.map(lt =>
            lt.leave_type_id === leaveTypeId
                ? { ...lt, days_allowed: days }
                : lt
        ));
    };

    const [users, setUsers] = useState([]);
    const [allUsersRef, setAllUsersRef] = useState([]); // For Org Chart hierarchy
    const [fullScreenChart, setFullScreenChart] = useState(null); // Store chart data for full screen
    const [chartZoom, setChartZoom] = useState(1); // Zoom level for full-screen chart
    const [panX, setPanX] = useState(0); // Horizontal pan offset
    const [panY, setPanY] = useState(0); // Vertical pan offset
    const [isDragging, setIsDragging] = useState(false); // Is user dragging the chart
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Starting position of drag
    const [managersAndAdmins, setManagersAndAdmins] = useState([]);
    const [availableRoles, setAvailableRoles] = useState([]); // All available roles for dropdown
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState([]); // Array of selected status values
    const [showStatusDropdown, setShowStatusDropdown] = useState(false); // Toggle status dropdown
    const [roleFilter, setRoleFilter] = useState([]); // Array of selected role ids
    const [showRoleDropdown, setShowRoleDropdown] = useState(false); // Toggle role dropdown
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const location = useLocation();
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAuthInfo, setShowAuthInfo] = useState(true); // Show auth info first, then form
    const [editingUserId, setEditingUserId] = useState(null);
    const [editingUserFromPhp, setEditingUserFromPhp] = useState(false); // Track if user is from PHP app
    const [expandedUserId, setExpandedUserId] = useState(null);
    const [leaveBalances, setLeaveBalances] = useState({});
    const [loadingBalance, setLoadingBalance] = useState({});
    const [formData, setFormData] = useState({
        firstname: '',
        lastname: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: '4',
        approving_manager_id: '',
        gender: ''
    });
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmationModal, setConfirmationModal] = useState({
        show: false,
        title: '',
        message: '',
        confirmText: '',
        confirmButtonColor: '',
        action: null,
        data: null
    });
    const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
    const [resetPasswordData, setResetPasswordData] = useState({ userId: null, userName: '', newPassword: '', confirmPassword: '' });
    const [resetPasswordError, setResetPasswordError] = useState(null);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [showSuccessNotification, setShowSuccessNotification] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [sortField, setSortField] = useState('staffid');
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
    const [letterFilter, setLetterFilter] = useState(''); // '' means no filter, or single letter A-Z
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    // Use permission-based checks instead of hardcoded role IDs
    const isAdmin = hasAdminPermission(user.role);
    const canApprove = canApproveLeave(user.role) || canApproveOnDuty(user.role);
    const isAllowed = isAdmin || canApprove;

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const statusParam = params.get('status');
        if (statusParam && statusParam !== statusFilter) {
            setStatusFilter(statusParam);
        }
    }, [location.search]);

    // Fetch Managers List (Once)
    useEffect(() => {
        if (isAllowed) {
            fetchManagersAndAdmins();
            fetchAvailableRoles();
        }
    }, [isAllowed]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, pageSize, letterFilter, roleFilter]);

    // Fetch Users when params change
    useEffect(() => {
        if (isAllowed) {
            const timeoutId = setTimeout(() => {
                fetchUsers(currentPage);
            }, 300); // Debounce
            return () => clearTimeout(timeoutId);
        }
    }, [isAllowed, currentPage, searchTerm, statusFilter, pageSize, letterFilter, roleFilter]);

    const fetchUsers = async (page) => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found. Please login first.');
                return;
            }

            const queryParams = new URLSearchParams({
                page: page,
                limit: pageSize,
                search: searchTerm,
                letter: letterFilter
            });

            // Add status filter if any statuses are selected
            if (statusFilter.length > 0) {
                queryParams.append('status', statusFilter.join(','));
            }

            // Add role filter if any roles are selected
            if (roleFilter.length > 0) {
                queryParams.append('role', roleFilter.join(','));
            }

            const response = await axios.get(`${API_BASE_URL}/api/admin/users?${queryParams.toString()}`, {
                headers: { 'x-access-token': token }
            });

            if (response.data.users) {
                setUsers(response.data.users); // users is now the current page
                setTotalPages(response.data.totalPages);
                setTotalItems(response.data.totalItems);
            } else {
                setUsers(response.data);
                setTotalPages(1);
                setTotalItems(response.data.length);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setError(error.response?.data?.message || error.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const fetchManagersAndAdmins = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get(`${API_BASE_URL}/api/admin/managers-admins`, {
                headers: { 'x-access-token': token }
            });
            setManagersAndAdmins(response.data);
        } catch (error) {
            console.error('Error fetching managers and admins:', error);
        }
    };

    const fetchAvailableRoles = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get(`${API_BASE_URL}/api/roles`, {
                headers: { 'x-access-token': token }
            });
            setAvailableRoles(response.data);
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const fetchAllUsersForChart = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get(`${API_BASE_URL}/api/admin/users?limit=all`, {
                headers: { 'x-access-token': token }
            });
            if (response.data.users) {
                setAllUsersRef(response.data.users);
            }
        } catch (error) {
            console.error('Error fetching all users for chart:', error);
        }
    };

    const fetchLeaveBalance = async (userId) => {
        try {
            setLoadingBalance(prev => ({ ...prev, [userId]: true }));
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.get(`${API_BASE_URL}/api/leave/user-balance/${userId}`, {
                headers: { 'x-access-token': token }
            });

            setLeaveBalances(prev => ({
                ...prev,
                [userId]: response.data
            }));
        } catch (error) {
            console.error(`Error fetching leave balance for user ${userId}:`, error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to load leave balance';
            setLeaveBalances(prev => ({
                ...prev,
                [userId]: { error: errorMessage }
            }));
        } finally {
            setLoadingBalance(prev => ({ ...prev, [userId]: false }));
        }
    };

    const handleExpandUser = (userId) => {
        if (expandedUserId === userId) {
            setExpandedUserId(null);
        } else {
            setExpandedUserId(userId);
            // Fetch leave balance if not already loaded
            if (!leaveBalances[userId]) {
                fetchLeaveBalance(userId);
            }
            // Fetch all users for org chart if not already loaded
            if (allUsersRef.length === 0) {
                fetchAllUsersForChart();
            }
        }
    };

    const handleAddUserClick = () => {
        setShowAddModal(true);
        setShowAuthInfo(true); // Show auth info first
        setEditingUserId(null);
        setFormError(null);
    };

    const handleProceedToCreate = () => {
        setShowAuthInfo(false);
        setFormData({
            firstname: '',
            lastname: '',
            email: '',
            password: '',
            confirmPassword: '',
            role: '4',
            approving_manager_id: '',
            gender: ''
        });
    };

    const handleCloseModal = () => {
        setShowAddModal(false);
        setEditingUserId(null);
        setEditingUserFromPhp(false);
        setFormError(null);
        setFormData({
            firstname: '',
            lastname: '',
            email: '',
            password: '',
            confirmPassword: '',
            role: '4',
            approving_manager_id: '',
            gender: ''
        });
    };

    const handleEditUserClick = (editUser) => {
        console.log('Edit user data:', editUser); // Debug log to check userid field
        setShowAddModal(true);
        setShowAuthInfo(false); // Go directly to form when editing
        setEditingUserId(editUser.staffid || editUser.id);
        setEditingUserFromPhp(!!editUser.userid); // True if userid exists (from PHP app)
        setFormError(null);
        console.log('Setting role in form to:', editUser.role, 'Type:', typeof editUser.role);
        setFormData({
            firstname: editUser.firstname,
            lastname: editUser.lastname,
            email: editUser.email,
            password: '',
            confirmPassword: '',
            role: editUser.role ? String(editUser.role) : '4', // Default to Employee (4) if role is missing/null
            approving_manager_id: editUser.approving_manager_id || '',
            gender: editUser.gender || ''
        });
    };

    const handleExpandChart = (user) => {
        console.log('Expanding chart for user:', user);
        setFullScreenChart({
            chart: generateOrgChart(user),
            user: user,
            uniqueId: `fullscreen-${user.staffid}`
        });
    };

    const handleCloseFullScreen = () => {
        setFullScreenChart(null);
        setChartZoom(1); // Reset zoom when closing
        setPanX(0); // Reset pan
        setPanY(0);
        setIsDragging(false);
    };

    const handleZoomIn = () => {
        setChartZoom(prev => Math.min(prev + 0.2, 10));
    };

    const handleZoomOut = () => {
        setChartZoom(prev => Math.max(prev - 0.2, 0.5));
    };

    const handleResetZoom = () => {
        setChartZoom(1);
        setPanX(0); // Reset pan
        setPanY(0);
    };

    const handleChartMouseDown = (e) => {
        if (chartZoom > 1.2) { // Enable dragging only when zoomed in
            setIsDragging(true);
            setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
        }
    };

    const handleChartMouseMove = (e) => {
        if (isDragging && chartZoom > 1.2) {
            const newPanX = e.clientX - dragStart.x;
            const newPanY = e.clientY - dragStart.y;
            setPanX(newPanX);
            setPanY(newPanY);
        }
    };

    const handleChartMouseUp = () => {
        setIsDragging(false);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmitUser = async (e) => {
        e.preventDefault();
        setFormError(null);

        // Validation
        if (!formData.firstname.trim()) {
            setFormError('First name is required.');
            return;
        }
        if (!formData.lastname.trim()) {
            setFormError('Last name is required.');
            return;
        }
        if (!formData.email.trim()) {
            setFormError('Email is required.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setFormError('Please enter a valid email address.');
            return;
        }

        // For new users, password is required; for edits, password is optional
        if (!editingUserId) {
            if (!formData.password) {
                setFormError('Password is required.');
                return;
            }
            if (formData.password.length < 6) {
                setFormError('Password must be at least 6 characters long.');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setFormError('Passwords do not match.');
                return;
            }
        } else if (formData.password) {
            // If editing and password is provided, validate it
            if (formData.password.length < 6) {
                setFormError('Password must be at least 6 characters long.');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setFormError('Passwords do not match.');
                return;
            }
        }

        if (formData.role === '2' && !formData.approving_manager_id) {
            setFormError('Manager role requires selecting an approving admin.');
            return;
        }
        if (!formData.gender) {
            setFormError('Gender is required.');
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const roleNum = parseInt(formData.role);
            console.log('Form role value:', formData.role, 'Parsed:', roleNum);
            const payload = {
                firstname: formData.firstname.trim(),
                lastname: formData.lastname.trim(),
                email: formData.email.trim(),
                role: roleNum, // Must be an integer
                gender: formData.gender
            };

            // Only include password if provided
            if (formData.password) {
                payload.password = formData.password;
            }

            if (formData.approving_manager_id && formData.approving_manager_id !== '') {
                payload.approving_manager_id = parseInt(formData.approving_manager_id);
            } else if (editingUserId) {
                // For edit mode, always include the field (can be null)
                payload.approving_manager_id = formData.approving_manager_id ? parseInt(formData.approving_manager_id) : null;
            }

            let response;
            if (editingUserId) {
                // Update user - password not included in edit mode
                console.log('Sending update request with payload:', payload);
                console.log('Updating user with ID:', editingUserId);
                response = await axios.put(
                    `${API_BASE_URL}/api/admin/users/${editingUserId}`,
                    payload,
                    { headers: { 'x-access-token': token } }
                );

                // Update the user in the list
                console.log('Update response user:', response.data.user);
                console.log('Editing user ID:', editingUserId);
                const responseRole = parseInt(response.data.user.role);
                console.log('Response role:', response.data.user.role, 'Parsed:', responseRole);
                
                setUsers(users.map(u => {
                    // Compare by staffid since that's the primary key
                    if (String(u.staffid) === String(editingUserId)) {
                        // Merge response data with existing user to preserve all fields
                        const updatedUser = {
                            ...u,
                            ...response.data.user,
                            role: responseRole // Ensure role is an integer
                        };
                        console.log('Found matching user. Updated user object:', updatedUser);
                        return updatedUser;
                    }
                    return u;
                }));
                
                // Refetch users from current page to ensure complete data
                console.log('Refetching users from page:', currentPage);
                await fetchUsers(currentPage);
                
                handleCloseModal();
                toast.success(`User ${payload.firstname} ${payload.lastname} updated successfully`);
            } else {
                // Create new user - password required
                payload.password = formData.password;
                response = await axios.post(`${API_BASE_URL}/api/admin/users`, payload, {
                    headers: { 'x-access-token': token }
                });

                // Add new user to the list
                setUsers(prev => [...prev, response.data.user]);
                handleCloseModal();
                toast.success(`User ${payload.firstname} ${payload.lastname} created successfully`);
            }
        } catch (err) {
            console.error('Error:', err);
            const errorMsg = err.response?.data?.message || err.message || 'Failed to save user';
            setFormError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = (user) => {
        const action = user.active ? 'deactivate' : 'activate';
        setConfirmationModal({
            show: true,
            title: `${user.active ? 'Deactivate' : 'Activate'} User`,
            message: `Are you sure you want to ${action} ${user.firstname} ${user.lastname}?`,
            confirmText: user.active ? 'Deactivate' : 'Activate',
            confirmButtonColor: user.active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
            action: 'toggle_status',
            data: user
        });
    };

    const confirmAction = async () => {
        if (!confirmationModal.data) return;

        const user = confirmationModal.data;
        if (confirmationModal.action === 'toggle_status') {
            try {
                const token = localStorage.getItem('token');
                const payload = {
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    role: user.role,
                    gender: user.gender,
                    approving_manager_id: user.approving_manager_id,
                    active: user.active ? 0 : 1
                };

                await axios.put(
                    `${API_BASE_URL}/api/admin/users/${user.staffid || user.id}`,
                    payload,
                    { headers: { 'x-access-token': token } }
                );

                setUsers(users.map(u => {
                    if (u.staffid === (user.staffid || user.id)) {
                        return { ...u, active: payload.active };
                    }
                    return u;
                }));
                closeConfirmationModal();
                const status = payload.active ? 'activated' : 'deactivated';
                toast.success(`User ${user.firstname} ${user.lastname} ${status} successfully`, {
                    style: {
                        background: payload.active ? '#059669' : '#4b5563', // Green for active, Gray for deactive
                        color: '#fff'
                    }
                });
            } catch (error) {
                console.error('Error updating status:', error);
                const errorMsg = error.response?.data?.message || error.message;
                toast.error(`Failed to update status: ${errorMsg}`);
            }
        }
    };

    const closeConfirmationModal = () => {
        setConfirmationModal({ ...confirmationModal, show: false });
    };

    const handleResetPasswordClick = (user) => {
        setResetPasswordData({
            userId: user.staffid || user.id,
            userName: `${user.firstname} ${user.lastname}`,
            newPassword: '',
            confirmPassword: ''
        });
        setResetPasswordError(null);
        setShowPasswordResetModal(true);
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setResetPasswordError(null);

        // Validation
        if (!resetPasswordData.newPassword) {
            setResetPasswordError('Password is required.');
            return;
        }
        if (resetPasswordData.newPassword.length < 6) {
            setResetPasswordError('Password must be at least 6 characters long.');
            return;
        }
        if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
            setResetPasswordError('Passwords do not match.');
            return;
        }

        try {
            setResettingPassword(true);
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_BASE_URL}/api/admin/users/${resetPasswordData.userId}/reset-password`,
                { newPassword: resetPasswordData.newPassword },
                { headers: { 'x-access-token': token } }
            );

            // Show success notification
            toast.success(`Password for ${resetPasswordData.userName} reset successfully`, {
                style: {
                    background: '#7c3aed', // Purple for password reset
                    color: '#fff'
                }
            });
            setSuccessMessage(`Password reset successfully for ${resetPasswordData.userName}`);
            setShowSuccessNotification(true);
            setShowPasswordResetModal(false);
            setResetPasswordData({ userId: null, userName: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            console.error('Error resetting password:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to reset password';
            setResetPasswordError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setResettingPassword(false);
        }
    };

    // Server-side filtering is active, so we just use the users array directly
    const filteredUsers = users.slice().sort((a, b) => {
        let aValue, bValue;

        switch (sortField) {
            case 'staffid':
                aValue = parseInt(a.staffid);
                bValue = parseInt(b.staffid);
                break;
            case 'name':
                aValue = `${a.firstname} ${a.lastname}`.toLowerCase();
                bValue = `${b.firstname} ${b.lastname}`.toLowerCase();
                break;
            case 'email':
                aValue = a.email.toLowerCase();
                bValue = b.email.toLowerCase();
                break;
            case 'role':
                aValue = a.role;
                bValue = b.role;
                break;
            case 'status':
                aValue = a.active ? 1 : 0;
                bValue = b.active ? 1 : 0;
                break;
            default:
                return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleLetterFilter = (letter) => {
        setLetterFilter(letter === letterFilter ? '' : letter); // Toggle: click same letter to clear filter
    };

    // Use role utilities for dynamic role colors and names
    const getRoleColor = (roleId) => {
        return getRoleColorUtil(roleId);
    };

    const getRoleName = (roleId) => {
        return getRoleDisplayName(roleId);
    };

    const generateOrgChart = (currentUser) => {
        let definition = 'graph TD\n';

        // Define styles with role-specific colors
        definition += 'classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#1e40af;\n';
        definition += 'classDef admin fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#991b1b;\n';
        definition += 'classDef manager fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#92400e;\n';
        definition += 'classDef leader fill:#d1fae5,stroke:#10b981,stroke-width:2px,color:#065f46;\n';
        definition += 'classDef employee fill:#e0e7ff,stroke:#6366f1,stroke-width:1px,color:#3730a3;\n';
        definition += 'classDef other fill:#f3f4f6,stroke:#9ca3af,stroke-width:1px,color:#374151;\n';

        const safeId = (id) => `U${id}`;
        const buildLabel = (u) => {
            const role = getRoleName(u.role);
            return `${u.firstname} ${u.lastname}<br/>(${role})`;
        };

        const getRoleStyle = (u, isCurrent = false) => {
            if (isCurrent) return 'current';
            switch (u.role) {
                case 1: return 'admin';
                case 2: return 'manager';
                case 3: return 'leader';
                case 4: return 'employee';
                default: return 'other';
            }
        };

        const addedNodes = new Set();
        const addNode = (u, isCurrent = false) => {
            const id = u.staffid || u.id;
            if (addedNodes.has(id)) return;
            const styleClass = getRoleStyle(u, isCurrent);
            definition += `${safeId(id)}["${buildLabel(u)}"]:::${styleClass}\n`;
            addedNodes.add(id);
        };

        const addEdge = (parent, child) => {
            const pid = parent.staffid || parent.id;
            const cid = child.staffid || child.id;
            // Only add edge if both nodes are in our relevant set
            if (addedNodes.has(pid) && addedNodes.has(cid)) {
                definition += `${safeId(pid)} --> ${safeId(cid)}\n`;
            }
        };

        // 1. Traverse Up (Ancestors)
        let curr = currentUser;
        const ancestors = [];
        const visited = new Set(); // Avoid loops in bad data

        // Helper to find user in any available list
        const findUser = (id) => {
            return allUsersRef.find(u => (u.staffid || u.id) === id) ||
                users.find(u => (u.staffid || u.id) === id) ||
                managersAndAdmins.find(u => (u.staffid || u.id) === id) ||
                ((user.staffid || user.id) === id ? user : null);
        };

        while (curr.approving_manager_id) {
            const mgr = findUser(curr.approving_manager_id);
            if (mgr && !visited.has(mgr.staffid || mgr.id)) {
                ancestors.unshift(mgr); // Add to beginning
                visited.add(mgr.staffid || mgr.id);
                curr = mgr;
            } else {
                break;
            }
        }

        // Add Ancestors to Graph
        ancestors.forEach(a => {
            addNode(a, false);
        });

        // Add Current User (highlighted)
        addNode(currentUser, true);

        // 2. Traverse Down (Descendants) - Recursive
        const processDescendants = (parent) => {
            const pid = parent.staffid || parent.id;
            const sourceList = allUsersRef.length > 0 ? allUsersRef : users;
            const directReports = sourceList.filter(u => u.approving_manager_id === pid);

            directReports.forEach(child => {
                addNode(child, false);
                processDescendants(child);
            });
        };

        processDescendants(currentUser);

        // 3. Draw edges for all added nodes (use Set to avoid duplicate edges)
        const addedEdges = new Set();
        const relevantUsers = [...allUsersRef, ...users, ...managersAndAdmins, user].filter(u => u && addedNodes.has(u.staffid || u.id));

        // Deduplicate users by ID before processing edges
        const uniqueUsers = [];
        const seenIds = new Set();
        relevantUsers.forEach(u => {
            const id = u.staffid || u.id;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                uniqueUsers.push(u);
            }
        });

        uniqueUsers.forEach(u => {
            if (u.approving_manager_id) {
                const mgr = findUser(u.approving_manager_id);
                if (mgr) {
                    const edgeKey = `${mgr.staffid || mgr.id}-${u.staffid || u.id}`;
                    if (!addedEdges.has(edgeKey)) {
                        addEdge(mgr, u);
                        addedEdges.add(edgeKey);
                    }
                }
            }
        });

        return definition;
    };



    // Show unauthorized page for non-admin/non-manager users
    if (!isAllowed) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 mb-3">
                            Access Denied
                        </h1>

                        <p className="text-gray-600 mb-6 leading-relaxed">
                            You do not have permission to access the User Management page. This area is restricted to administrators and managers only.
                        </p>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-800">
                                <strong>Your Role:</strong> {getRoleName(user.role)}
                            </p>
                        </div>

                        <button
                            onClick={() => window.history.back()}
                            className="w-full py-3 bg-gradient-to-r from-blue-700 to-blue-800 text-white rounded-lg hover:from-blue-800 hover:to-blue-900 transition-all font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                            ← Go Back
                        </button>

                        <p className="text-sm text-gray-500 mt-6">
                            If you believe this is an error, please contact your administrator.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                        <p className="text-gray-600 mt-1">
                            {isAdmin
                                ? 'Manage all system users and their permissions'
                                : 'View your team details and leave balances'}
                        </p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={handleAddUserClick}
                            className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium flex items-center gap-2">
                            <span className="text-green-300 text-lg">+</span> Add New User
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium">⚠️ {error}</p>
                </div>
            )}

            {/* Search and Filter Bar */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                        />
                    </div>

                    {/* Status Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                            className="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2"
                        >
                            <span>Status:</span>
                            <span className="font-semibold">
                                {statusFilter.length === 0 ? 'All' : `${statusFilter.length} selected`}
                            </span>
                            <svg className={`w-4 h-4 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>

                        {showStatusDropdown && (
                            <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-10 w-48">
                                <div className="p-3 space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={statusFilter.length === 0}
                                            onChange={() => setStatusFilter([])}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">All</span>
                                    </label>
                                    <hr className="my-2" />
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={statusFilter.includes('active')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setStatusFilter([...statusFilter, 'active']);
                                                } else {
                                                    setStatusFilter(statusFilter.filter(s => s !== 'active'));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                                        />
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-sm font-medium text-gray-700">Active</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={statusFilter.includes('inactive')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setStatusFilter([...statusFilter, 'inactive']);
                                                } else {
                                                    setStatusFilter(statusFilter.filter(s => s !== 'inactive'));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                                        />
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            <span className="text-sm font-medium text-gray-700">InActive</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={statusFilter.includes('incomplete')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setStatusFilter([...statusFilter, 'incomplete']);
                                                } else {
                                                    setStatusFilter(statusFilter.filter(s => s !== 'incomplete'));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-600"
                                        />
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                            <span className="text-sm font-medium text-gray-700">Setup Required</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Role Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                            className="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2"
                        >
                            <span>Role:</span>
                            <span className="font-semibold">
                                {roleFilter.length === 0 ? 'All' : `${roleFilter.length} selected`}
                            </span>
                            <svg className={`w-4 h-4 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>

                        {showRoleDropdown && (
                            <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-10 w-48">
                                <div className="p-3 space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={roleFilter.length === 0}
                                            onChange={() => setRoleFilter([])}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">All Roles</span>
                                    </label>
                                    <hr className="my-2" />
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={roleFilter.includes('1')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setRoleFilter([...roleFilter, '1']);
                                                } else {
                                                    setRoleFilter(roleFilter.filter(r => r !== '1'));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Admin</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={roleFilter.includes('2')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setRoleFilter([...roleFilter, '2']);
                                                } else {
                                                    setRoleFilter(roleFilter.filter(r => r !== '2'));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Leader</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={roleFilter.includes('3')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setRoleFilter([...roleFilter, '3']);
                                                } else {
                                                    setRoleFilter(roleFilter.filter(r => r !== '3'));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Manager</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={roleFilter.includes('4')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setRoleFilter([...roleFilter, '4']);
                                                } else {
                                                    setRoleFilter(roleFilter.filter(r => r !== '4'));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Employee</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Alphabet Filter */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Filter by First Letter:</span>
                        <button
                            onClick={() => setLetterFilter('')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${letterFilter === ''
                                    ? 'bg-blue-700 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center">
                        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
                            <button
                                key={letter}
                                onClick={() => handleLetterFilter(letter)}
                                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${letterFilter === letter
                                        ? 'bg-blue-700 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                title={`Show users whose first name starts with ${letter}`}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[#2E5090] border-b border-gray-200">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-white w-12"></th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-semibold text-white cursor-pointer hover:bg-[#3E6090] transition-colors"
                                    onClick={() => handleSort('staffid')}
                                >
                                    <div className="flex items-center gap-1">
                                        ID
                                        {sortField === 'staffid' && (
                                            <span className="text-white">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-semibold text-white cursor-pointer hover:bg-[#3E6090] transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-1">
                                        User
                                        {sortField === 'name' && (
                                            <span className="text-white">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-semibold text-white cursor-pointer hover:bg-[#3E6090] transition-colors"
                                    onClick={() => handleSort('email')}
                                >
                                    <div className="flex items-center gap-1">
                                        Email
                                        {sortField === 'email' && (
                                            <span className="text-white">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-semibold text-white cursor-pointer hover:bg-[#3E6090] transition-colors"
                                    onClick={() => handleSort('role')}
                                >
                                    <div className="flex items-center gap-1">
                                        Role
                                        {sortField === 'role' && (
                                            <span className="text-white">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-semibold text-white cursor-pointer hover:bg-[#3E6090] transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center gap-1">
                                        Status
                                        {sortField === 'status' && (
                                            <span className="text-white">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-white">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center">
                                        <ModernLoader size="md" message="Loading Users..." />
                                    </td>
                                </tr>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map((u) => (
                                    <React.Fragment key={u.staffid}>
                                        <tr className="hover:bg-gray-50 transition-colors">
                                            <td className="px-3 py-4 text-center">
                                                <button
                                                    onClick={() => handleExpandUser(u.staffid)}
                                                    className="p-1 hover:bg-blue-100 rounded transition-colors text-blue-600"
                                                    title={expandedUserId === u.staffid ? "Collapse" : "Expand"}
                                                >
                                                    {expandedUserId === u.staffid ? '▼' : '▶'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                #{u.staffid}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-bold">
                                                        {u.firstname.charAt(0)}{u.lastname.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {u.firstname} {u.lastname}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={'px-3 py-1 rounded-full text-xs font-medium ' + getRoleColor(u.role)}>
                                                    {getRoleName(u.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleToggleStatus(u)}
                                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${u.active ? 'bg-green-600' : 'bg-red-600'
                                                                }`}
                                                            role="switch"
                                                            aria-checked={u.active}
                                                        >
                                                            <span
                                                                aria-hidden="true"
                                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${u.active ? 'translate-x-5' : 'translate-x-0'
                                                                    }`}
                                                            />
                                                        </button>
                                                    )}
                                                    <span className={`text-sm font-medium ${u.active ? 'text-green-600' : 'text-red-600'}`}>
                                                        {u.active ? 'Active' : 'InActive'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {isAdmin && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEditUserClick(u)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
                                                                title="Edit user details"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                                <span>Edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleEditLeaveTypes(u)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow ml-2"
                                                                title="Edit leave types"
                                                            >
                                                                <FiEdit2 className="w-4 h-4" />
                                                                <span>Leave Types</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    {(isAdmin || isManager) && (
                                                        <button
                                                            onClick={() => handleResetPasswordClick(u)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 hover:border-amber-300 transition-all duration-200 shadow-sm hover:shadow"
                                                            title="Reset user password"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                            </svg>
                                                            <span>Reset</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Leave Balance Child Row */}
                                        {expandedUserId === u.staffid && (
                                            <tr className="bg-slate-50 border-t border-slate-200 shadow-inner">
                                                <td colSpan="7" className="px-6 py-6">
                                                    {loadingBalance[u.staffid] ? (
                                                        <div className="flex flex-col items-center justify-center py-8">
                                                            <ModernLoader size="md" message="Loading leave balance..." />
                                                        </div>
                                                    ) : leaveBalances[u.staffid]?.error ? (
                                                        <div className="flex items-center justify-center p-6 bg-red-50 rounded-xl border border-red-100 text-red-600">
                                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            <span className="font-medium">{leaveBalances[u.staffid].error}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                            {/* Column 1: Leave Balance List */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                                                        <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
                                                                        Leave Balances
                                                                    </h4>
                                                                    {leaveBalances[u.staffid]?.leaveTypes && leaveBalances[u.staffid].leaveTypes.length > 0 && (
                                                                        <div className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                                                                            Total Available: <span className="font-extrabold text-blue-600 ml-1">{
                                                                                leaveBalances[u.staffid].leaveTypes.reduce((sum, lt) => sum + (lt.balance || 0), 0)
                                                                            }</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Use user_leave_types for leave balances */}
                                                                {leaveBalances[u.staffid]?.leaveTypes && leaveBalances[u.staffid].leaveTypes.length > 0 ? (
                                                                    <div className="space-y-3">
                                                                        {leaveBalances[u.staffid].leaveTypes.map((lt) => {
                                                                            const pct = ((lt.used / lt.total_days) * 100) || 0;
                                                                            let colors = { bar: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', muted: 'text-green-400' };

                                                                            if (pct >= 90) colors = { bar: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', muted: 'text-red-400' };
                                                                            else if (pct >= 75) colors = { bar: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', muted: 'text-amber-400' };
                                                                            else if (pct >= 50) colors = { bar: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', muted: 'text-blue-400' };

                                                                            return (
                                                                                <div key={lt.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                                                                                    {/* Left: Info & Progress */}
                                                                                    <div className="flex-1 mr-4">
                                                                                        <div className="flex justify-between items-end mb-1.5">
                                                                                            <span className="font-bold text-gray-800 text-sm">{lt.name}</span>
                                                                                            <span className="text-xs text-gray-500">{lt.used} / {lt.total_days}</span>
                                                                                        </div>
                                                                                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                                                            <div
                                                                                                className={`h-1.5 rounded-full ${colors.bar} transition-all duration-500`}
                                                                                                style={{ width: `${pct}%` }}
                                                                                            ></div>
                                                                                        </div>
                                                                                    </div>
                                                                                    {/* Right: Balance Circle */}
                                                                                    <div className={`flex flex-col items-center justify-center ${colors.bg} ${colors.text} w-10 h-10 rounded-lg border ${colors.border}`}>
                                                                                        <span className="text-sm font-bold leading-none">{lt.balance}</span>
                                                                                        <span className={`text-[9px] uppercase font-bold ${colors.muted} mt-0.5`}>Left</span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-6 bg-white rounded-xl border border-dashed border-gray-300">
                                                                        <p className="text-gray-500 text-xs">No leave types assigned.</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Column 2: Org Structure */}
                                                            <div className="hidden lg:block border-l border-gray-200 pl-8">
                                                                <div className="h-full flex flex-col">
                                                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-purple-600 rounded-full"></span>
                                                                            Organization Structure
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                console.log('Expand button clicked for user:', u);
                                                                                handleExpandChart(u);
                                                                            }}
                                                                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                                                                            title="Expand to full screen"
                                                                        >
                                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                                            </svg>
                                                                        </button>
                                                                    </h4>
                                                                    <div className="flex-1 flex items-center justify-center bg-gray-50/50 rounded-xl overflow-hidden min-h-[200px] border border-gray-100">
                                                                        <MermaidChart chart={generateOrgChart(u)} uniqueId={u.staffid} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>Show</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                }}
                                className="border border-gray-300 rounded text-sm py-1 px-2 focus:outline-none focus:border-blue-500 bg-white"
                            >
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            <span>per page</span>
                        </div>
                        <p className="text-sm text-gray-600 border-l border-gray-300 pl-4">
                            Showing <span className="font-medium">{totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span> of <span className="font-medium">{totalItems}</span> users
                        </p>
                    </div>

                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`px-3 py-1 border border-gray-300 rounded text-sm transition-colors ${currentPage === 1 ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600 px-2 flex items-center gap-1">
                            Page
                            <span className="font-medium text-gray-900">{currentPage}</span>
                            of
                            <span className="font-medium text-gray-900">{Math.max(totalPages, 1)}</span>
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage >= totalPages}
                            className={`px-3 py-1 border border-gray-300 rounded text-sm transition-colors ${currentPage >= totalPages ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit Leave Types Modal */}
            {showLeaveModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-green-700 to-green-800 px-6 py-4">
                            <h2 className="text-2xl font-bold text-white">Edit Leave Types</h2>
                        </div>

                        <div className="p-6 space-y-4">
                            {leaveModalLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <ModernLoader size="md" message="Loading leave types..." />
                                </div>
                            ) : leaveModalError ? (
                                <div className="bg-red-50 border border-red-200 rounded p-3">
                                    <p className="text-red-800 text-sm font-medium">⚠️ {leaveModalError}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                                        <p className="text-sm text-green-800">
                                            <strong>Employee:</strong> {leaveModalUser?.firstname} {leaveModalUser?.lastname}
                                        </p>
                                    </div>

                                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Leave Type</th>
                                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Days Allowed</th>
                                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Days Used</th>
                                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {modalLeaveTypes.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" className="text-center text-gray-400 py-6 text-sm">No leave types available.</td>
                                                    </tr>
                                                ) : modalLeaveTypes.map((lt, idx) => (
                                                    <tr key={lt.leave_type_id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors`}>
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{lt.name}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {lt.assigned ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={lt.days_allowed}
                                                                    onChange={e => handleEditDaysAllowed(lt.leave_type_id, e.target.value)}
                                                                    className="w-24 px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-green-600"
                                                                    placeholder="0"
                                                                    autoFocus={lt.days_allowed === ''}
                                                                />
                                                            ) : (
                                                                <span className="text-gray-400 text-sm">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">{lt.days_used || 0}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {lt.assigned ? (
                                                                <button
                                                                    onClick={() => handleRemoveLeaveTypeFromUser(lt.leave_type_id)}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                                    title="Remove leave type"
                                                                >
                                                                    <FiTrash2 className="w-4 h-4" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleAddLeaveTypeToUser(lt.leave_type_id)}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                                                    title="Add leave type"
                                                                >
                                                                    <FiPlus className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowLeaveModal(false)}
                                            disabled={leaveModalSaving}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveLeaveTypes}
                                            disabled={leaveModalSaving}
                                            className="flex-1 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {leaveModalSaving ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                    Saving...
                                                </>
                                            ) : (
                                                'Save Changes'
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-6 py-4">
                            <h2 className="text-2xl font-bold text-white">{editingUserId ? 'Edit User' : 'Add New User'}</h2>
                        </div>

                        {showAuthInfo ? (
                            /* Authentication Information */
                            <div className="p-6 space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-xl font-bold text-blue-800">Authentication Managed by ABiS</h3>
                                            <div className="mt-2 text-lg text-blue-700">
                                                <p>User authentication and access management is handled through the ABiS application. Most users should have their accounts created and managed there.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-xl font-bold text-yellow-800">Need WorkPulse Access Without ABiS?</h3>
                                            <div className="mt-2 text-lg text-yellow-700">
                                                <p>If a user needs access to WorkPulse but does not have login access in ABiS, you can create their account directly here.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="px-6 py-3 border border-gray-300 rounded-md text-base font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleProceedToCreate}
                                        className="px-6 py-3 bg-blue-600 border border-transparent rounded-md text-base font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Create Account Anyway
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* User Creation Form */
                            <form onSubmit={handleSubmitUser} className="p-6 space-y-4">
                                {formError && (
                                    <div className="bg-red-50 border border-red-200 rounded p-3">
                                        <p className="text-red-800 text-sm font-medium">⚠️ {formError}</p>
                                    </div>
                                )}

                                {editingUserFromPhp && (
                                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl flex-shrink-0">ℹ️</div>
                                            <div>
                                                <h4 className="font-semibold text-amber-900 mb-1">User from ABiS System</h4>
                                                <p className="text-sm text-amber-800">
                                                    The <span className="font-bold">name and email</span> fields are managed through the ABiS application and cannot be edited here. To update this information, please edit the user profile in the ABiS system.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-base font-medium text-gray-700 mb-1 flex items-center gap-2">
                                        First Name
                                        {editingUserFromPhp && <span title="This user is from ABiS and cannot be edited">🔒</span>}
                                    </label>
                                    <input
                                        type="text"
                                        name="firstname"
                                        value={formData.firstname}
                                        onChange={handleFormChange}
                                        placeholder="John"
                                        disabled={editingUserFromPhp}
                                        className={`w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 ${
                                            editingUserFromPhp ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-base font-medium text-gray-700 mb-1 flex items-center gap-2">
                                        Last Name
                                        {editingUserFromPhp && <span title="This user is from ABiS and cannot be edited">🔒</span>}
                                    </label>
                                    <input
                                        type="text"
                                        name="lastname"
                                        value={formData.lastname}
                                        onChange={handleFormChange}
                                        placeholder="Doe"
                                        disabled={editingUserFromPhp}
                                        className={`w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 ${
                                            editingUserFromPhp ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-base font-medium text-gray-700 mb-1 flex items-center gap-2">
                                        Email
                                        {editingUserFromPhp && <span title="This user is from ABiS and cannot be edited">🔒</span>}
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleFormChange}
                                        placeholder="john@example.com"
                                        disabled={editingUserFromPhp}
                                        className={`w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 ${
                                            editingUserFromPhp ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-base font-medium text-gray-700 mb-1">Role</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="">Select Role</option>
                                        {availableRoles.map((role) => (
                                            <option key={role.id} value={String(role.id)}>
                                                {role.display_name || role.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-base font-medium text-gray-700 mb-1">Gender</label>
                                    <select
                                        name="gender"
                                        value={formData.gender}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Transgender">Transgender</option>
                                    </select>
                                </div>

                                {/* Manager/Approver Selection - Show for roles that need an approver */}
                                {formData.role && needsApprover(parseInt(formData.role)) && (
                                    <div>
                                        <label className="block text-base font-medium text-gray-700 mb-1">
                                            {getApproverLabel(parseInt(formData.role))}
                                        </label>
                                        <select
                                            name="approving_manager_id"
                                            value={formData.approving_manager_id}
                                            onChange={handleFormChange}
                                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                        >
                                            <option value="">Select Approver</option>
                                            {managersAndAdmins.map((approver) => {
                                                // Use hierarchy-based check: approver must be higher in hierarchy than target role
                                                const targetRoleId = parseInt(formData.role);
                                                const approverRoleId = approver.role;
                                                
                                                // Only show approvers who are higher in hierarchy than the target role
                                                if (!canBeApproverFor(approverRoleId, targetRoleId)) {
                                                    return null;
                                                }
                                                
                                                return (
                                                    <option key={approver.staffid} value={approver.staffid}>
                                                        {approver.firstname} {approver.lastname} ({getRoleName(approver.role)})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {formError && formError.includes('Manager role requires') && (
                                            <p className="text-xs text-red-600 mt-1">⚠️ This field is required</p>
                                        )}
                                    </div>
                                )}

                                {/* Only show password fields for new users */}
                                {!editingUserId && (
                                    <>
                                        <div>
                                            <label className="block text-base font-medium text-gray-700 mb-1">Password (required)</label>
                                            <input
                                                type="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleFormChange}
                                                placeholder="••••••••"
                                                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                                        </div>

                                        <div>
                                            <label className="block text-base font-medium text-gray-700 mb-1">Confirm Password</label>
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleFormChange}
                                                placeholder="••••••••"
                                                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        disabled={submitting}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                {editingUserId ? 'Saving...' : 'Creating...'}
                                            </>
                                        ) : (
                                            editingUserId ? 'Save Changes' : 'Create User'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmationModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full transform transition-all scale-100">
                        <div className="p-6">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full mb-4">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-center text-gray-900 mb-2">{confirmationModal.title}</h3>
                            <p className="text-sm text-center text-gray-500 mb-6">{confirmationModal.message}</p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={closeConfirmationModal}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAction}
                                    className={`px-4 py-2 text-white rounded-lg font-medium shadow-sm transition-colors ${confirmationModal.confirmButtonColor}`}
                                >
                                    {confirmationModal.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Reset Modal */}
            {showPasswordResetModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4">
                            <h2 className="text-xl font-bold text-white">🔑 Reset Password</h2>
                        </div>

                        <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-blue-800">
                                    <strong>User:</strong> {resetPasswordData.userName}
                                </p>
                            </div>

                            {resetPasswordError && (
                                <div className="bg-red-50 border border-red-200 rounded p-3">
                                    <p className="text-red-800 text-sm font-medium">⚠️ {resetPasswordError}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={resetPasswordData.newPassword}
                                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                                    placeholder="Enter new password"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-600"
                                />
                                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value={resetPasswordData.confirmPassword}
                                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                                    placeholder="Confirm new password"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-600"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordResetModal(false);
                                        setResetPasswordData({ userId: null, userName: '', newPassword: '', confirmPassword: '' });
                                        setResetPasswordError(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resettingPassword}
                                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {resettingPassword ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Resetting...</span>
                                        </>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Success Notification Modal */}
            {showSuccessNotification && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full transform scale-100 transition-all p-6 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Success!</h3>
                        <p className="text-gray-600 mb-6">{successMessage}</p>
                        <button
                            onClick={() => setShowSuccessNotification(false)}
                            className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Full Screen Chart Modal */}
            {fullScreenChart && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <span className="w-2 h-6 bg-purple-600 rounded-full"></span>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Organization Structure</h2>
                                    <p className="text-sm text-gray-600">{fullScreenChart.user.firstname} {fullScreenChart.user.lastname}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Zoom Control Panel */}
                                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
                                    {/* Minus Button */}
                                    <button
                                        onClick={handleZoomOut}
                                        disabled={chartZoom <= 0.5}
                                        className="p-1.5 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                                        title="Zoom out"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                                        </svg>
                                    </button>

                                    {/* Zoom Slider */}
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="10"
                                        step="0.1"
                                        value={chartZoom}
                                        onChange={(e) => setChartZoom(parseFloat(e.target.value))}
                                        className="w-24 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                                        title="Drag to zoom"
                                    />

                                    {/* Plus Button */}
                                    <button
                                        onClick={handleZoomIn}
                                        disabled={chartZoom >= 10}
                                        className="p-1.5 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                                        title="Zoom in"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                        </svg>
                                    </button>

                                    {/* Zoom Percentage */}
                                    <span className="text-xs font-medium text-gray-700 min-w-[45px] text-center">{Math.round(chartZoom * 100)}%</span>

                                    <div className="w-px h-6 bg-gray-300"></div>

                                    {/* Preset Zoom Buttons */}
                                    <div className="flex items-center gap-0.5">
                                        {[0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7.5, 10].map((zoom) => (
                                            <button
                                                key={zoom}
                                                onClick={() => setChartZoom(zoom)}
                                                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${Math.abs(chartZoom - zoom) < 0.05
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-gray-600 hover:bg-white'
                                                    }`}
                                                title={`Zoom ${Math.round(zoom * 100)}%`}
                                            >
                                                {Math.round(zoom * 100)}%
                                            </button>
                                        ))}
                                    </div>

                                    <div className="w-px h-6 bg-gray-300"></div>

                                    {/* Reset Button */}
                                    <button
                                        onClick={handleResetZoom}
                                        className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white rounded transition-colors"
                                        title="Reset zoom to 100%"
                                    >
                                        Reset
                                    </button>
                                </div>
                                <button
                                    onClick={handleCloseFullScreen}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Close full screen"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Chart Container */}
                        <div className="flex-1 p-6 overflow-hidden">
                            <div
                                className="w-full h-full min-h-[600px] bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center"
                                style={{
                                    cursor: chartZoom > 1.2 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                    overflow: 'hidden'
                                }}
                                onMouseDown={handleChartMouseDown}
                                onMouseMove={handleChartMouseMove}
                                onMouseUp={handleChartMouseUp}
                                onMouseLeave={handleChartMouseUp}
                            >
                                <div
                                    style={{
                                        transform: `translate(${panX}px, ${panY}px) scale(${chartZoom})`,
                                        transformOrigin: 'center center',
                                        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                                    }}
                                >
                                    <MermaidChart
                                        chart={fullScreenChart.chart}
                                        uniqueId={fullScreenChart.uniqueId}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
}

export default Users;
