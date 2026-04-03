import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus, FiX } from 'react-icons/fi';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { fetchRoles, canManageLeaveTypes } from '../utils/roleUtils';
import TableSortIcon from '../components/TableSortIcon';

export default function LeaveTypes() {
  const navigate = useNavigate();
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
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
  const [confirmationModal, setConfirmationModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmText: '',
    confirmButtonColor: '',
    data: null
  });
  const [employeeListModal, setEmployeeListModal] = useState({
    show: false,
    leaveTypeName: '',
    employees: [],
    message: '',
    instruction: ''
  });
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
      gender_restriction: Array.isArray(leaveType.gender_restriction) ? leaveType.gender_restriction : (leaveType.gender_restriction ? [leaveType.gender_restriction] : [])
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'gender_restriction') {
      setFormData(prev => {
        const currentGenders = Array.isArray(prev.gender_restriction) ? prev.gender_restriction : (prev.gender_restriction ? [prev.gender_restriction] : []);
        const genders = [...currentGenders];
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

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedLeaveTypes = React.useMemo(() => {
    const sorted = [...leaveTypes];
    sorted.sort((a, b) => {
      let aValue = a[sortConfig.key] || '';
      let bValue = b[sortConfig.key] || '';

      if (sortConfig.key === 'gender_restriction') {
        aValue = Array.isArray(a.gender_restriction) ? a.gender_restriction.join(', ') : (a.gender_restriction || '');
        bValue = Array.isArray(b.gender_restriction) ? b.gender_restriction.join(', ') : (b.gender_restriction || '');
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [leaveTypes, sortConfig]);

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

  const handleToggleStatus = (leaveType) => {
    const newStatus = !leaveType.status;
    const action = newStatus ? 'Activate' : 'Deactivate';

    setConfirmationModal({
      show: true,
      title: `${action} Leave Type`,
      message: `Are you sure you want to ${action.toLowerCase()} '${leaveType.name}'?`,
      confirmText: action,
      confirmButtonColor: newStatus ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
      data: leaveType
    });
  };

  const confirmAction = async () => {
    if (!confirmationModal.data) return;

    const leaveType = confirmationModal.data;
    const newStatus = !leaveType.status;
    const action = newStatus ? 'activate' : 'deactivate';

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/leavetypes/${leaveType.id}`,
        { status: newStatus },
        { headers: { 'x-access-token': token } }
      );

      closeConfirmationModal();
      const successMsg = `Leave type '${leaveType.name}' ${action}d successfully`;
      toast.success(successMsg, {
        style: {
          background: newStatus ? '#059669' : '#4b5563',
          color: '#fff'
        }
      });
      fetchLeaveTypes();
    } catch (err) {
      console.error('Error:', err);

      // Check if error response contains employee list (deactivation prevented)
      if (err.response?.data?.assignedEmployees && err.response?.data?.assignedEmployees.length > 0) {
        // Close confirmation modal
        closeConfirmationModal();

        // Show employee list modal
        setEmployeeListModal({
          show: true,
          leaveTypeName: leaveType.name,
          employees: err.response.data.assignedEmployees,
          message: err.response.data.message,
          instruction: err.response.data.instruction
        });
      } else {
        // Show regular error toast for other errors
        toast.error(err.response?.data?.message || `Failed to ${action} leave type`);
      }
    }
  };

  const closeEmployeeListModal = () => {
    setEmployeeListModal({
      show: false,
      leaveTypeName: '',
      employees: [],
      message: '',
      instruction: ''
    });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({ ...confirmationModal, show: false });
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
                  onClick={() => handleSort('description')}
                  className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                >
                  Description <TableSortIcon column="description" sortConfig={sortConfig} />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('gender_restriction')}
                  className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                >
                  Gender <TableSortIcon column="gender_restriction" sortConfig={sortConfig} />
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
              <th className="px-6 py-3 text-right text-[10px] font-black text-white uppercase tracking-widest">Actions</th>
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
              sortedLeaveTypes.map((leaveType, index) => (
                <tr key={leaveType.id} className="border-b border-gray-200">
                  <td className="px-6 py-4 font-medium text-gray-900">{leaveType.name}</td>
                  <td className="px-6 py-4 text-gray-600">{leaveType.description || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {Array.isArray(leaveType.gender_restriction)
                      ? (leaveType.gender_restriction.length > 0 ? leaveType.gender_restriction.join(', ') : 'All')
                      : (leaveType.gender_restriction || 'All')}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(leaveType)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${leaveType.status ? 'bg-green-600' : 'bg-red-500'}`}
                      title={leaveType.status ? 'Click to deactivate' : 'Click to activate'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${leaveType.status ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEditModal(leaveType)}
                      className="inline-flex items-center gap-2 px-3 py-1 text-sm rounded hover:opacity-70 transition text-blue-600 bg-blue-50"
                    >
                      <FiEdit2 size={16} />
                      Edit
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

      {/* Employee List Modal (Cannot Deactivate) */}
      {employeeListModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Cannot Deactivate Leave Type</h3>
                    <p className="text-sm text-gray-600 mt-1">"{employeeListModal.leaveTypeName}"</p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                  <p className="text-sm text-red-800 font-medium">{employeeListModal.message}</p>
                </div>
              </div>
              <button
                onClick={closeEmployeeListModal}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Employee List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">
                  Assigned Employees ({employeeListModal.employees.length})
                </h4>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee ID</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Days Allowed</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Days Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employeeListModal.employees.map((employee, index) => (
                      <tr key={employee.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{employee.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{employee.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{employee.employee_id || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center font-medium">{employee.days_allowed}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${employee.days_used > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {employee.days_used}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex items-center justify-end">
                <button
                  onClick={closeEmployeeListModal}
                  className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium transition"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
