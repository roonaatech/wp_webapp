import React, { useEffect, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [managersAndAdmins, setManagersAndAdmins] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
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
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 1;

    useEffect(() => {
        fetchUsers();
        fetchManagersAndAdmins();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found. Please login first.');
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/api/admin/users`, {
                headers: { 'x-access-token': token }
            });
            setUsers(response.data);
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
        setEditingUserId(editUser.staffid || editUser.id);
        setFormError(null);
        setFormData({
            firstname: editUser.firstname,
            lastname: editUser.lastname,
            email: editUser.email,
            password: '',
            confirmPassword: '',
            role: String(editUser.role),
            approving_manager_id: editUser.approving_manager_id || '',
            gender: editUser.gender || ''
        });
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
            } else {
                // Create new user - password required
                payload.password = formData.password;
                response = await axios.post(`${API_BASE_URL}/api/admin/users`, payload, {
                    headers: { 'x-access-token': token }
                });

                // Add new user to the list
                setUsers(prev => [...prev, response.data.user]);
                handleCloseModal();
            }
        } catch (err) {
            console.error('Error:', err);
            setFormError(err.response?.data?.message || err.message || 'Failed to save user');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const fullName = u.firstname + ' ' + u.lastname;
        return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
    });

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

    return (
        <div>
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                        <p className="text-gray-600 mt-1">
                            {isAdmin
                                ? 'Manage all system users and their permissions'
                                : 'Managers cannot access user management'}
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

            {/* Admin Only Access Message */}
            {!isAdmin && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 font-medium">ℹ️ This page is restricted to Admins only</p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium">⚠️ {error}</p>
                </div>
            )}

            {/* Search Bar */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <div className="relative">
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
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[#2E5090] border-b border-gray-200">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-white w-12"></th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-white">User</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-white">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-white">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-white">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-white">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center">
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
                                                    <div className={'w-2 h-2 rounded-full ' + (u.active ? 'bg-green-500' : 'bg-gray-300')}></div>
                                                    <span className={'text-sm font-medium ' + (u.active ? 'text-green-600' : 'text-gray-600')}>
                                                        {u.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleEditUserClick(u)}
                                                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
                                                        title="Edit user"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600" title="Delete user">
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Leave Balance Child Row */}
                                        {expandedUserId === u.staffid && (
                                            <tr className="bg-blue-50 border-t border-blue-100">
                                                <td colSpan="6" className="px-6 py-4">
                                                    {loadingBalance[u.staffid] ? (
                                                        <div className="flex items-center justify-center py-4">
                                                            <ModernLoader size="sm" message="Loading leave balance..." />
                                                        </div>
                                                    ) : leaveBalances[u.staffid]?.error ? (
                                                        <div className="text-red-600 text-sm">
                                                            ⚠️ {leaveBalances[u.staffid].error}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {leaveBalances[u.staffid]?.leaveTypes && leaveBalances[u.staffid].leaveTypes.length > 0 && (
                                                                <h4 className="font-semibold text-gray-900 mb-4">
                                                                    Leave Balance (Total Available: <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold">{leaveBalances[u.staffid].leaveTypes.reduce((sum, l) => sum + l.balance, 0)}</span> days)
                                                                </h4>
                                                            )}
                                                            <div className="overflow-x-auto">
                                                                <div className="flex gap-4 min-w-min pb-2">
                                                                    {leaveBalances[u.staffid]?.leaveTypes && leaveBalances[u.staffid].leaveTypes.length > 0 ? (
                                                                        leaveBalances[u.staffid].leaveTypes.map((leave) => (
                                                                            <div key={leave.id} className="bg-white rounded-lg p-2 border border-blue-200 min-w-[120px] max-w-[140px]">
                                                                                <div className="flex flex-row items-center justify-between mb-0.5">
                                                                                    <div className="text-[10px] text-gray-600 font-medium">{leave.name}</div>
                                                                                    <div className="text-lg font-bold text-blue-600">{leave.balance || 0}</div>
                                                                                </div>
                                                                                <div className="space-y-1 text-xs">
                                                                                    <div className="border-t pt-1 flex flex-row gap-3 items-end">
                                                                                        <div>
                                                                                            <div className="text-[10px] text-gray-500">Total</div>
                                                                                            <div className="font-semibold text-gray-900">{leave.total_days || 0}</div>
                                                                                        </div>
                                                                                        <div>
                                                                                            <div className="text-[10px] text-gray-500">Availed</div>
                                                                                            <div className="font-semibold text-orange-600">{leave.used || 0}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-gray-600 text-sm">
                                                                            No leave types assigned
                                                                        </div>
                                                                    )}
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
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        Showing <span className="font-medium">{filteredUsers.length}</span> of <span className="font-medium">{users.length}</span> users
                    </p>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm">Previous</button>
                        <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm">Next</button>
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
