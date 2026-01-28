import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiEdit2, FiTrash2, FiPlus, FiX } from 'react-icons/fi';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { fetchRoles, canManageLeaveTypes } from '../utils/roleUtils';

export default function LeaveTypes() {
  const navigate = useNavigate();
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create' or 'edit'
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: true,
    gender_restriction: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Check permission first
  useEffect(() => {
    const checkPermission = async () => {
      try {
        await fetchRoles(true);
        const canManage = canManageLeaveTypes(user.role);
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
      fetchLeaveTypes();
    }
  }, [hasPermission]);

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/leavetypes/admin/all`, {
        headers: { 'x-access-token': token }
      });
      setLeaveTypes(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching leave types:', err);
      setError('Failed to load leave types');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalType('create');
    setEditingId(null);
    setFormData({ name: '', description: '', status: true, gender_restriction: [] });
    setShowModal(true);
  };

  const openEditModal = (leaveType) => {
    setModalType('edit');
    setEditingId(leaveType.id);
    setFormData({
      name: leaveType.name,
      description: leaveType.description || '',
      status: leaveType.status,
      gender_restriction: leaveType.gender_restriction || []
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'gender_restriction') {
        setFormData(prev => {
            const genders = [...prev.gender_restriction];
            if (checked) {
                if (!genders.includes(value)) {
                    genders.push(value);
                }
            } else {
                const index = genders.indexOf(value);
                if (index > -1) {
                    genders.splice(index, 1);
                }
            }
            return { ...prev, gender_restriction: genders };
        });
    } else {
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }
  };

  const handleSelectAllGenders = (e) => {
    const { checked } = e.target;
    if (checked) {
        setFormData(prev => ({
            ...prev,
            gender_restriction: ['Male', 'Female', 'Transgender']
        }));
    } else {
        setFormData(prev => ({
            ...prev,
            gender_restriction: []
        }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Leave type name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const config = { headers: { 'x-access-token': token } };

      if (modalType === 'create') {
        await axios.post(`${API_BASE_URL}/api/leavetypes`, formData, config);
        const successMsg = `Leave type '${formData.name}' created successfully`;
        setSuccess(successMsg);
        toast.success(successMsg);
      } else {
        await axios.put(`${API_BASE_URL}/api/leavetypes/${editingId}`, formData, config);
        const successMsg = `Leave type '${formData.name}' updated successfully`;
        setSuccess(successMsg);
        toast.success(successMsg, {
            style: {
                background: '#2563eb', // Blue for updates
                color: '#fff'
            }
        });
      }

      setShowModal(false);
      fetchLeaveTypes();
    } catch (err) {
      console.error('Error:', err);
      const errorMsg = err.response?.data?.message || 'An error occurred';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this leave type?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/leavetypes/${id}`, {
        headers: { 'x-access-token': token }
      });
      const successMsg = 'Leave type deleted successfully';
      setSuccess(successMsg);
      toast.success(successMsg, {
        style: {
            background: '#dc2626', // Red for delete
            color: '#fff'
        }
      });
      fetchLeaveTypes();
    } catch (err) {
      console.error('Error:', err);
      const errorMsg = err.response?.data?.message || 'Failed to delete leave type';
      setError(errorMsg);
      toast.error(errorMsg);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leave Types</h1>
          <p className="text-gray-600">Manage leave types for your organization</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-white bg-blue-700 rounded-lg hover:opacity-90 transition"
        >
          <FiPlus size={20} />
          Add Leave Type
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

      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-800 rounded-lg flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-600 hover:text-green-800">
            <FiX size={20} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#2E5090]">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white">Description</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white">Gender Restriction</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white">Status</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveTypes.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No leave types found
                </td>
              </tr>
            ) : (
              leaveTypes.map((leaveType, index) => (
                <tr key={leaveType.id} className="border-b border-gray-200">
                  <td className="px-6 py-4 font-medium text-gray-900">{leaveType.name}</td>
                  <td className="px-6 py-4 text-gray-600">{leaveType.description || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{leaveType.gender_restriction?.join(', ') || 'All'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        leaveType.status
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {leaveType.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEditModal(leaveType)}
                      className="inline-flex items-center gap-2 px-3 py-1 mr-2 text-sm rounded hover:opacity-70 transition text-blue-600 bg-blue-50"
                    >
                      <FiEdit2 size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(leaveType.id)}
                      className="inline-flex items-center gap-2 px-3 py-1 text-sm rounded hover:opacity-70 transition text-red-600 bg-red-50"
                    >
                      <FiTrash2 size={16} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">
                {modalType === 'create' ? 'Add Leave Type' : 'Edit Leave Type'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Type Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  placeholder="e.g., Sick Leave, Annual Leave"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  rows="3"
                  placeholder="Optional description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Gender Restriction
                </label>
                <div className="space-y-2">
                  <div className="flex items-center pb-2 border-b border-gray-200 mb-2">
                    <input
                      type="checkbox"
                      id="gender_all"
                      checked={formData.gender_restriction.length === 3}
                      onChange={handleSelectAllGenders}
                      className="w-4 h-4 rounded accent-blue-700"
                    />
                    <label htmlFor="gender_all" className="ml-2 text-sm font-medium text-gray-800">
                      Select All
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="gender_male"
                      name="gender_restriction"
                      value="Male"
                      checked={formData.gender_restriction.includes('Male')}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded accent-blue-700"
                    />
                    <label htmlFor="gender_male" className="ml-2 text-sm text-gray-700">
                      Male
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="gender_female"
                      name="gender_restriction"
                      value="Female"
                      checked={formData.gender_restriction.includes('Female')}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded accent-blue-700"
                    />
                    <label htmlFor="gender_female" className="ml-2 text-sm text-gray-700">
                      Female
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="gender_transgender"
                      name="gender_restriction"
                      value="Transgender"
                      checked={formData.gender_restriction.includes('Transgender')}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded accent-blue-700"
                    />
                    <label htmlFor="gender_transgender" className="ml-2 text-sm text-gray-700">
                      Transgender
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">If none are selected, it will be available for all genders.</p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="status"
                  name="status"
                  checked={formData.status}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded accent-blue-700"
                />
                <label htmlFor="status" className="ml-2 text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white bg-blue-700 rounded-lg hover:opacity-90 transition font-medium"
                >
                  {modalType === 'create' ? 'Create' : 'Update'}
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
}
