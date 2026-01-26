import React, { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2, FiPlus, FiX, FiMove, FiCheck, FiSave } from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';

const Roles = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [saving, setSaving] = useState(false);
    const [statistics, setStatistics] = useState([]);
    const [hierarchyMode, setHierarchyMode] = useState(false);
    const [hierarchyRoles, setHierarchyRoles] = useState([]);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        description: '',
        hierarchy_level: 999,
        can_approve_leave: false,
        can_approve_onduty: false,
        can_manage_users: false,
        can_manage_leave_types: false,
        can_view_reports: false,
        active: true
    });

    useEffect(() => {
        fetchRoles();
        fetchStatistics();
    }, []);

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
                name: role.name,
                display_name: role.display_name,
                description: role.description || '',
                hierarchy_level: role.hierarchy_level,
                can_approve_leave: role.can_approve_leave,
                can_approve_onduty: role.can_approve_onduty,
                can_manage_users: role.can_manage_users,
                can_manage_leave_types: role.can_manage_leave_types,
                can_view_reports: role.can_view_reports,
                active: role.active
            });
        } else {
            setEditingRole(null);
            setFormData({
                name: '',
                display_name: '',
                description: '',
                hierarchy_level: 999,
                can_approve_leave: false,
                can_approve_onduty: false,
                can_manage_users: false,
                can_manage_leave_types: false,
                can_view_reports: false,
                active: true
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingRole(null);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const token = localStorage.getItem('token');
            
            if (editingRole) {
                // Update existing role
                await axios.put(
                    `${API_BASE_URL}/api/roles/${editingRole.id}`,
                    formData,
                    { headers: { 'x-access-token': token } }
                );
                toast.success('Role updated successfully');
            } else {
                // Create new role
                await axios.post(
                    `${API_BASE_URL}/api/roles`,
                    formData,
                    { headers: { 'x-access-token': token } }
                );
                toast.success('Role created successfully');
            }

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

    const handleDelete = async (role) => {
        if (!window.confirm(`Are you sure you want to delete the role "${role.display_name}"?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/roles/${role.id}`, {
                headers: { 'x-access-token': token }
            });
            toast.success('Role deleted successfully');
            fetchRoles();
            fetchStatistics();
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to delete role';
            toast.error(errorMsg);
        }
    };

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

    if (loading) {
        return <ModernLoader />;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Role Management</h1>
                <p className="text-gray-600">Manage system roles and their permissions</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <div className="mb-4 flex justify-between items-center">
                <button
                    onClick={handleToggleHierarchyMode}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        hierarchyMode
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

            <div className="bg-white rounded-lg shadow overflow-hidden">
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
                            {hierarchyMode && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drag</th>}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Display Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hierarchy</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {(hierarchyMode ? hierarchyRoles : roles).map((role, index) => (
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
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <MdDragIndicator className="w-5 h-5 text-gray-400" />
                                    </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{role.display_name}</div>
                                    {role.description && (
                                        <div className="text-sm text-gray-500">{role.description}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm font-mono text-gray-700">{role.name}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                        Level {role.hierarchy_level}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                        {getUserCount(role.id)} users
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {role.can_approve_leave && (
                                            <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Leave</span>
                                        )}
                                        {role.can_approve_onduty && (
                                            <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">OnDuty</span>
                                        )}
                                        {role.can_manage_users && (
                                            <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">Users</span>
                                        )}
                                        {role.can_manage_leave_types && (
                                            <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">LeaveTypes</span>
                                        )}
                                        {role.can_view_reports && (
                                            <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">Reports</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        role.active
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {role.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingRole ? 'Edit Role' : 'Create New Role'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Basic Information */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Name (lowercase, no spaces) *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                            pattern="[a-z_]+"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="e.g., team_lead"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Display Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="display_name"
                                            value={formData.display_name}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="e.g., Team Lead"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Describe the role's responsibilities..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Hierarchy Level (0 = highest authority)
                                    </label>
                                    <input
                                        type="number"
                                        name="hierarchy_level"
                                        value={formData.hierarchy_level}
                                        onChange={handleInputChange}
                                        min="0"
                                        max="999"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Permissions */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900">Permissions</h3>
                                
                                <div className="space-y-3">
                                    <label className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            name="can_approve_leave"
                                            checked={formData.can_approve_leave}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Can approve leave requests</span>
                                    </label>

                                    <label className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            name="can_approve_onduty"
                                            checked={formData.can_approve_onduty}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Can approve on-duty requests</span>
                                    </label>

                                    <label className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            name="can_manage_users"
                                            checked={formData.can_manage_users}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Can manage users</span>
                                    </label>

                                    <label className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            name="can_manage_leave_types"
                                            checked={formData.can_manage_leave_types}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Can manage leave types</span>
                                    </label>

                                    <label className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            name="can_view_reports"
                                            checked={formData.can_view_reports}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Can view reports</span>
                                    </label>

                                    <label className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            name="active"
                                            checked={formData.active}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Active</span>
                                    </label>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Roles;
