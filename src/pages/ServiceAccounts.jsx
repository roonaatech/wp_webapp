import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus, FiX, FiEye, FiEyeOff } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import TableSortIcon from '../components/TableSortIcon';
import { fetchRoles as fetchRolesUtil, canManageServiceAccounts } from '../utils/roleUtils';

const ServiceAccounts = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role_id: '',
        active: true
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Check permission first
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRolesUtil(true);
                const canManage = canManageServiceAccounts(user.role);
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
            fetchServiceAccounts();
            fetchRoles();
        }
    }, [hasPermission]);

    const fetchServiceAccounts = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/admin/service-accounts`, {
                headers: { 'x-access-token': token }
            });
            setAccounts(response.data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load service accounts');
            toast.error('Failed to load service accounts');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/roles`, {
                headers: { 'x-access-token': token }
            });
            // Only allow assigning webapp-accessible roles
            const webappRoles = response.data.filter(r => r.can_access_webapp && r.active);
            setRoles(webappRoles);
        } catch (err) {
            console.error('Failed to load roles:', err);
        }
    };

    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedAccounts = React.useMemo(() => {
        const sorted = [...accounts];
        sorted.sort((a, b) => {
            let aValue;
            let bValue;
            switch (sortConfig.key) {
                case 'role':
                    aValue = a.role_info?.display_name || '';
                    bValue = b.role_info?.display_name || '';
                    break;
                case 'status':
                    aValue = a.active ? 1 : 0;
                    bValue = b.active ? 1 : 0;
                    break;
                case 'last_login':
                    aValue = a.last_login ? new Date(a.last_login).getTime() : 0;
                    bValue = b.last_login ? new Date(b.last_login).getTime() : 0;
                    break;
                default:
                    aValue = (a[sortConfig.key] || '').toString().toLowerCase();
                    bValue = (b[sortConfig.key] || '').toString().toLowerCase();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [accounts, sortConfig]);

    const handleOpenAddModal = () => {
        setEditingAccount(null);
        setFormData({
            name: '',
            email: '',
            password: '',
            role_id: roles[0]?.id || '',
            active: true
        });
        setShowPassword(false);
        setShowModal(true);
    };

    const handleOpenEditModal = (account) => {
        setEditingAccount(account);
        setFormData({
            name: account.name,
            email: account.email,
            password: '', // keep blank unless rotating secret
            role_id: account.role_id,
            active: account.active
        });
        setShowPassword(false);
        setShowModal(true);
    };

    const handleDeleteAccount = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete service account "${name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/admin/service-accounts/${id}`, {
                headers: { 'x-access-token': token }
            });
            toast.success('Service account deleted successfully');
            fetchServiceAccounts();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete service account');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.name.trim()) return toast.error('Name is required');
        if (!formData.email.trim()) return toast.error('Email is required');
        if (!editingAccount && !formData.password) return toast.error('Password is required');
        if (!formData.role_id) return toast.error('Please assign a role');

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            if (editingAccount) {
                // Update
                const updatePayload = {
                    name: formData.name,
                    email: formData.email,
                    role_id: parseInt(formData.role_id),
                    active: formData.active
                };
                if (formData.password) {
                    updatePayload.password = formData.password;
                }
                await axios.put(`${API_BASE_URL}/api/admin/service-accounts/${editingAccount.id}`, updatePayload, {
                    headers: { 'x-access-token': token }
                });
                toast.success('Service account updated successfully');
            } else {
                // Create
                const createPayload = {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role_id: parseInt(formData.role_id)
                };
                await axios.post(`${API_BASE_URL}/api/admin/service-accounts`, createPayload, {
                    headers: { 'x-access-token': token }
                });
                toast.success('Service account created successfully');
            }
            setShowModal(false);
            fetchServiceAccounts();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed');
        } finally {
            setSaving(false);
        }
    };

    // Show loading while checking permissions
    if (!permissionChecked) {
        return (
            <div className="flex items-center justify-center h-screen">
                <ModernLoader />
            </div>
        );
    }

    // Don't render if no permission
    if (!hasPermission) {
        return null;
    }

    return (
        <div className="p-6 relative min-h-[500px]">
            {loading && (
                <ModernLoader size="container" message="Fetching service accounts..." fullScreen={false} />
            )}
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Service Accounts</h1>
                    <p className="text-gray-600">Manage system-level service credentials with custom role assignments</p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-2 px-4 py-2 text-white bg-blue-700 rounded-lg hover:opacity-90 transition"
                >
                    <FiPlus size={20} />
                    Create Service Account
                </button>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
                        <FiX size={20} />
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-[#1e1b4b] text-white">
                        <tr>
                            <th className="px-6 py-3 text-left">
                                <button
                                    onClick={() => handleSort('name')}
                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                >
                                    Name <TableSortIcon column="name" sortConfig={sortConfig} />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-left">
                                <button
                                    onClick={() => handleSort('email')}
                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                >
                                    Email / Username <TableSortIcon column="email" sortConfig={sortConfig} />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-left">
                                <button
                                    onClick={() => handleSort('role')}
                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                >
                                    Role Assignment <TableSortIcon column="role" sortConfig={sortConfig} />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-left">
                                <button
                                    onClick={() => handleSort('status')}
                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                >
                                    Status <TableSortIcon column="status" sortConfig={sortConfig} />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-left">
                                <button
                                    onClick={() => handleSort('last_login')}
                                    className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                >
                                    Last Login <TableSortIcon column="last_login" sortConfig={sortConfig} />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-right text-[10px] font-black text-white uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                    No service accounts found
                                </td>
                            </tr>
                        ) : (
                            sortedAccounts.map((account) => (
                                <tr key={account.id} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{account.name}</td>
                                    <td className="px-6 py-4 font-mono text-gray-600">{account.email}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {account.role_info?.display_name || 'No Role Assigned'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${account.active
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {account.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 text-sm">
                                        {account.last_login
                                            ? new Date(account.last_login).toLocaleString()
                                            : 'Never logged in'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenEditModal(account)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                                title="Edit Service Account"
                                            >
                                                <FiEdit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAccount(account.id, account.name)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete"
                                            >
                                                <FiTrash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingAccount ? 'Edit Service Account' : 'Create Service Account'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <FiX size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Display Name *
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., Kiosk Attendance Integration"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address (Login Username) *
                                </label>
                                <input
                                    type="email"
                                    placeholder="e.g., kiosk-service@abis.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 font-mono"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {editingAccount ? 'Rotate Password (leave blank to keep unchanged)' : 'Password *'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={editingAccount ? 'Enter new password if rotating' : '••••••••'}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Assigned Role */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Assigned Role *
                                </label>
                                <select
                                    value={formData.role_id}
                                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                >
                                    <option value="" disabled>Select a role...</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.display_name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    Reuses existing Roles and permissions policy structure.
                                </p>
                            </div>

                            {/* Status - Only show when editing */}
                            {editingAccount && (
                                <div className="flex items-center justify-between border border-gray-200 bg-gray-50 rounded-lg p-3">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">Active Status</h4>
                                        <p className="text-xs text-gray-500">Enable or disable login access for this account.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, active: !formData.active })}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${formData.active ? 'bg-green-600' : 'bg-red-500'}`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.active ? 'translate-x-5' : 'translate-x-0'}`}
                                        />
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 text-white bg-blue-700 rounded-lg hover:opacity-90 transition font-medium disabled:opacity-60"
                                >
                                    {saving ? 'Saving...' : (editingAccount ? 'Update' : 'Create')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceAccounts;
