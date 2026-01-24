import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import MermaidChart from '../components/MermaidChart';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [allUsersRef, setAllUsersRef] = useState([]); // For Org Chart hierarchy
    const [fullScreenChart, setFullScreenChart] = useState(null); // Store chart data for full screen
    const [chartZoom, setChartZoom] = useState(1); // Zoom level for full-screen chart
    const [panX, setPanX] = useState(0); // Horizontal pan offset
    const [panY, setPanY] = useState(0); // Vertical pan offset
    const [isDragging, setIsDragging] = useState(false); // Is user dragging the chart
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Starting position of drag
    const [managersAndAdmins, setManagersAndAdmins] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'incomplete'
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
    const [expandedUserId, setExpandedUserId] = useState(null);
    const [leaveBalances, setLeaveBalances] = useState({});
    const [loadingBalance, setLoadingBalance] = useState({});
    const [formData, setFormData] = useState({
        firstname: '',
        lastname: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: '3',
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
    const isAdmin = user.role === 1;
    const isManager = user.role === 2;
    const isAllowed = isAdmin || isManager;

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
            fetchAllUsersForChart();
        }
    }, [isAllowed]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, pageSize, letterFilter]);

    // Fetch Users when params change
    useEffect(() => {
        if (isAllowed) {
            const timeoutId = setTimeout(() => {
                fetchUsers(currentPage);
            }, 300); // Debounce
            return () => clearTimeout(timeoutId);
        }
    }, [isAllowed, currentPage, searchTerm, statusFilter, pageSize, letterFilter]);

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
                status: statusFilter,
                letter: letterFilter
            });

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
            if (!leaveBalances[userId]) {
                fetchLeaveBalance(userId);
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
            role: '3',
            approving_manager_id: '',
            gender: ''
        });
    };

    const handleCloseModal = () => {
        setShowAddModal(false);
        setEditingUserId(null);
        setFormError(null);
        setFormData({
            firstname: '',
            lastname: '',
            email: '',
            password: '',
            confirmPassword: '',
            role: '3',
            approving_manager_id: '',
            gender: ''
        });
    };

    const handleEditUserClick = (editUser) => {
        setShowAddModal(true);
        setShowAuthInfo(false); // Go directly to form when editing
        setEditingUserId(editUser.staffid || editUser.id);
        setFormError(null);
        setFormData({
            firstname: editUser.firstname,
            lastname: editUser.lastname,
            email: editUser.email,
            password: '',
            confirmPassword: '',
            role: editUser.role ? String(editUser.role) : '3', // Default to Employee (3) if role is missing/null
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
            const payload = {
                firstname: formData.firstname.trim(),
                lastname: formData.lastname.trim(),
                email: formData.email.trim(),
                role: formData.role,
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
                response = await axios.put(
                    `${API_BASE_URL}/api/admin/users/${editingUserId}`,
                    payload,
                    { headers: { 'x-access-token': token } }
                );

                // Update the user in the list
                setUsers(users.map(u => {
                    if (u.staffid === editingUserId || u.id === editingUserId) {
                        return response.data.user;
                    }
                    return u;
                }));
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

    const getRoleColor = (role) => {
        switch (role) {
            case 1: return 'bg-red-50 text-red-700';
            case 2: return 'bg-blue-50 text-blue-700';
            case 3: return 'bg-gray-50 text-gray-700';
            default: return 'bg-gray-50 text-gray-700';
        }
    };

    const getRoleName = (role) => {
        switch (role) {
            case 1: return 'Admin';
            case 2: return 'Manager';
            case 3: return 'Employee';
            default: return 'Unknown';
        }
    };

    const generateOrgChart = (currentUser) => {
        let definition = 'graph TD\n';
        
        // Define styles
        definition += 'classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e40af;\n';
        definition += 'classDef manager fill:#f3f4f6,stroke:#9ca3af,stroke-width:1px,color:#374151;\n';
        definition += 'classDef reportee fill:#fff,stroke:#e5e7eb,stroke-width:1px,color:#4b5563;\n';
        definition += 'classDef admin fill:#fef2f2,stroke:#ef4444,stroke-width:1px,color:#991b1b;\n';

        const safeId = (id) => `U${id}`;
        const buildLabel = (u) => {
             const role = getRoleName(u.role);
             return `${u.firstname} ${u.lastname}<br/>(${role})`;
        };

        const addedNodes = new Set();
        const addNode = (u, styleClass) => {
            const id = u.staffid || u.id;
            if (addedNodes.has(id)) return;
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
            let style = 'manager';
            if (a.role === 1) style = 'admin';
            addNode(a, style);
        });

        // Add Current User
        addNode(currentUser, 'current');

        // 2. Traverse Down (Descendants) - Recursive
        const processDescendants = (parent) => {
            const pid = parent.staffid || parent.id;
            const sourceList = allUsersRef.length > 0 ? allUsersRef : users;
            const directReports = sourceList.filter(u => u.approving_manager_id === pid);
            
            directReports.forEach(child => {
                addNode(child, 'reportee');
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

                    {/* Status Filter */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === 'all'
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setStatusFilter('active')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${statusFilter === 'active'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            Active
                        </button>
                        <button
                            onClick={() => setStatusFilter('inactive')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${statusFilter === 'inactive'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            InActive
                        </button>
                        <button
                            onClick={() => setStatusFilter('incomplete')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${statusFilter === 'incomplete'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${statusFilter === 'incomplete' ? 'bg-white' : 'bg-orange-500'}`}></span>
                            Setup Required
                        </button>
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
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                letterFilter === ''
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
                                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                                    letterFilter === letter
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
                                                                    {leaveBalances[u.staffid]?.leaveTypes && (
                                                                        <div className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                                                                            Total Available: <span className="font-extrabold text-blue-600 ml-1">{leaveBalances[u.staffid].leaveTypes.reduce((sum, l) => sum + l.balance, 0)}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                {leaveBalances[u.staffid]?.leaveTypes && leaveBalances[u.staffid].leaveTypes.length > 0 ? (
                                                                    <div className="space-y-3">
                                                                        {leaveBalances[u.staffid].leaveTypes.map((leave) => {
                                                                            const percentage = leave.total_days > 0 ? (leave.used / leave.total_days) * 100 : 0;
                                                                            let progressColor = 'bg-green-500';
                                                                            if (percentage > 50) progressColor = 'bg-yellow-500';
                                                                            if (percentage > 80) progressColor = 'bg-orange-500';
                                                                            if (percentage >= 100) progressColor = 'bg-red-500';

                                                                            return (
                                                                                <div key={leave.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                                                                                    {/* Left: Info & Progress */}
                                                                                    <div className="flex-1 mr-4">
                                                                                        <div className="flex justify-between items-end mb-1.5">
                                                                                            <span className="font-bold text-gray-800 text-sm">{leave.name}</span>
                                                                                            <span className="text-[10px] text-gray-400 font-medium">
                                                                                                <span className="text-gray-600">{leave.used}</span> / {leave.total_days} Used
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                                                            <div 
                                                                                                className={`h-1.5 rounded-full ${progressColor} transition-all duration-500`} 
                                                                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                                                                            ></div>
                                                                                        </div>
                                                                                    </div>
                                                                                    
                                                                                    {/* Right: Balance Circle */}
                                                                                    <div className="flex flex-col items-center justify-center bg-blue-50 text-blue-700 w-10 h-10 rounded-lg border border-blue-100">
                                                                                        <span className="text-sm font-bold leading-none">{leave.balance}</span>
                                                                                        <span className="text-[9px] uppercase font-bold text-blue-400 mt-0.5">Left</span>
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

            {/* Add/Edit User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-6 py-4">
                            <h2 className="text-xl font-bold text-white">{editingUserId ? 'Edit User' : 'Add New User'}</h2>
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
                                            <h3 className="text-sm font-medium text-blue-800">Authentication Managed by ABiS</h3>
                                            <div className="mt-2 text-sm text-blue-700">
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
                                            <h3 className="text-sm font-medium text-yellow-800">Need WorkPulse Access Without ABiS?</h3>
                                            <div className="mt-2 text-sm text-yellow-700">
                                                <p>If a user needs access to WorkPulse but does not have login access in ABiS, you can create their account directly here.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleProceedToCreate}
                                        className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input
                                    type="text"
                                    name="firstname"
                                    value={formData.firstname}
                                    onChange={handleFormChange}
                                    placeholder="John"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    name="lastname"
                                    value={formData.lastname}
                                    onChange={handleFormChange}
                                    placeholder="Doe"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleFormChange}
                                    placeholder="john@example.com"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                >
                                    <option value="3">Employee</option>
                                    <option value="2">Manager</option>
                                    <option value="1">Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Transgender">Transgender</option>
                                </select>
                            </div>

                            {/* Manager/Approver Selection - Show for Employee and Manager roles */}
                            {(formData.role === '3' || formData.role === '2') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {formData.role === '3' ? 'Manager / Approving Admin' : 'Approving Admin'}
                                    </label>
                                    <select
                                        name="approving_manager_id"
                                        value={formData.approving_manager_id}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="">Select Approver</option>
                                        {managersAndAdmins.map((user) => {
                                            const isTargetManager = formData.role === '2';
                                            const isTargetEmployee = formData.role === '3';
                                            if (isTargetManager && user.role !== 1) return null;
                                            if (isTargetEmployee && (user.role !== 1 && user.role !== 2)) return null;
                                            return (
                                                <option key={user.staffid} value={user.staffid}>
                                                    {user.firstname} {user.lastname} ({getRoleName(user.role)})
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Password (required)</label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleFormChange}
                                            placeholder="••••••••"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleFormChange}
                                            placeholder="••••••••"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
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
                                                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                                    Math.abs(chartZoom - zoom) < 0.05
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
};

export default Users;
