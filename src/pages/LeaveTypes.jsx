import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus, FiX, FiTrash2, FiChevronDown, FiLock } from 'react-icons/fi';
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
    title: '',
    leaveTypeName: '',
    employees: [],
    message: '',
    instruction: ''
  });
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Close actions dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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

  const handleBlockedEdit = (leaveType) => {
    setEmployeeListModal({
      show: true,
      title: 'Cannot Edit Leave Type',
      leaveTypeName: leaveType.name,
      employees: leaveType.assigned_employees || [],
      message: `Cannot edit '${leaveType.name}'. It is currently assigned to ${leaveType.assigned_count || (leaveType.assigned_employees?.length || 1)} employee(s). Please remove this leave type from all employees before editing it.`,
      instruction: 'Only leave types not assigned to any employees can be edited.'
    });
  };

  const handleBlockedDelete = (leaveType) => {
    setEmployeeListModal({
      show: true,
      title: 'Cannot Delete Leave Type',
      leaveTypeName: leaveType.name,
      employees: leaveType.assigned_employees || [],
      message: `Cannot delete '${leaveType.name}'. It is currently assigned to ${leaveType.assigned_count || (leaveType.assigned_employees?.length || 1)} employee(s). Please remove this leave type from all employees before deleting it.`,
      instruction: 'Only leave types not assigned to any employees can be deleted.'
    });
  };

  const handleDeleteClick = (leaveType) => {
    if (leaveType.assigned_count > 0) {
      handleBlockedDelete(leaveType);
      return;
    }

    setConfirmationModal({
      show: true,
      title: 'Delete Leave Type',
      message: `Are you sure you want to permanently delete '${leaveType.name}'? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmButtonColor: 'bg-red-600 hover:bg-red-700',
      data: { ...leaveType, actionType: 'delete' }
    });
  };

  const openEditModal = (leaveType) => {
    if (leaveType.assigned_count > 0) {
      handleBlockedEdit(leaveType);
      return;
    }

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
      if (err.response?.data?.assignedEmployees && err.response?.data?.assignedEmployees.length > 0) {
        setShowModal(false);
        setEmployeeListModal({
          show: true,
          title: 'Cannot Edit Leave Type',
          leaveTypeName: formData.name,
          employees: err.response.data.assignedEmployees,
          message: err.response.data.message,
          instruction: err.response.data.instruction || 'Only leave types not assigned to any employees can be edited.'
        });
      } else {
        const errorMsg = err.response?.data?.message || 'An error occurred';
        setError(errorMsg);
        toast.error(errorMsg);
      }
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

    // Handle Delete action
    if (leaveType.actionType === 'delete') {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/leavetypes/${leaveType.id}`, {
          headers: { 'x-access-token': token }
        });

        closeConfirmationModal();
        const successMsg = `Leave type '${leaveType.name}' deleted successfully`;
        toast.success(successMsg);
        fetchLeaveTypes();
      } catch (err) {
        console.error('Error deleting leave type:', err);
        if (err.response?.data?.assignedEmployees && err.response?.data?.assignedEmployees.length > 0) {
          closeConfirmationModal();
          setEmployeeListModal({
            show: true,
            title: 'Cannot Delete Leave Type',
            leaveTypeName: leaveType.name,
            employees: err.response.data.assignedEmployees,
            message: err.response.data.message,
            instruction: err.response.data.instruction || 'Remove this leave type from all assigned employees before deleting.'
          });
        } else {
          toast.error(err.response?.data?.message || 'Failed to delete leave type');
        }
      }
      return;
    }

    // Status toggle (Activate / Deactivate)
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
        closeConfirmationModal();
        setEmployeeListModal({
          show: true,
          title: 'Cannot Deactivate Leave Type',
          leaveTypeName: leaveType.name,
          employees: err.response.data.assignedEmployees,
          message: err.response.data.message,
          instruction: err.response.data.instruction
        });
      } else {
        toast.error(err.response?.data?.message || `Failed to ${action} leave type`);
      }
    }
  };

  const closeEmployeeListModal = () => {
    setEmployeeListModal({
      show: false,
      title: '',
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

  return (
    <div className="p-6 relative min-h-[500px]">
      {loading && (
        <ModernLoader size="container" message="Fetching leave types..." fullScreen={false} />
      )}
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
      <div className="bg-white rounded-lg shadow min-h-[200px]">
        <table className="w-full">
          <thead className="bg-[#1e1b4b] text-white">
            <tr>
              <th className="px-6 py-3 text-left rounded-tl-lg">
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
              <th className="px-6 py-3 text-right text-[10px] font-black text-white uppercase tracking-widest rounded-tr-lg">Actions</th>
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
                <tr key={leaveType.id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{leaveType.name}</span>
                      {leaveType.assigned_count > 0 ? (
                        <span
                          onClick={() => handleBlockedEdit(leaveType)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer hover:bg-amber-100 transition"
                          title={`${leaveType.assigned_count} employee(s) assigned. Click to view list.`}
                        >
                          <FiLock size={9} />
                          {leaveType.assigned_count} {leaveType.assigned_count === 1 ? 'employee' : 'employees'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </td>
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
                    <div className={`relative inline-block text-left ${openActionMenuId === leaveType.id ? 'z-50' : 'z-auto'}`} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setOpenActionMenuId(openActionMenuId === leaveType.id ? null : leaveType.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition shadow-2xs cursor-pointer"
                        title="Actions"
                      >
                        Actions
                        <FiChevronDown className={`transition-transform duration-200 ${openActionMenuId === leaveType.id ? 'rotate-180' : ''}`} size={14} />
                      </button>

                      {openActionMenuId === leaveType.id && (
                        <div className={`absolute right-0 ${index >= Math.max(1, sortedLeaveTypes.length - 2) ? 'bottom-full mb-2' : 'top-full mt-2'} w-48 bg-[#1e1b4b] text-white rounded-xl shadow-2xl border border-indigo-900/80 z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150`}>
                          <div className="py-1.5">
                            {/* Edit Option */}
                            {leaveType.assigned_count > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleBlockedEdit(leaveType);
                                }}
                                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition font-medium cursor-pointer"
                                title={`Assigned to ${leaveType.assigned_count} employee(s). Editing is disabled.`}
                              >
                                <span className="flex items-center gap-2">
                                  <FiEdit2 size={13} className="text-gray-400" />
                                  Edit
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded-full border border-amber-400/30">
                                  <FiLock size={9} />
                                  Assigned
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  openEditModal(leaveType);
                                }}
                                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-blue-200 hover:bg-blue-600/30 hover:text-white transition font-medium cursor-pointer"
                              >
                                <FiEdit2 size={13} className="text-[#38bdf8]" />
                                Edit
                              </button>
                            )}

                            <div className="my-1 border-t border-indigo-950/80" />

                            {/* Delete Option */}
                            {leaveType.assigned_count > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleBlockedDelete(leaveType);
                                }}
                                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-gray-300 hover:bg-rose-500/20 hover:text-rose-200 transition font-medium cursor-pointer"
                                title={`Assigned to ${leaveType.assigned_count} employee(s). Deletion is disabled.`}
                              >
                                <span className="flex items-center gap-2">
                                  <FiTrash2 size={13} className="text-rose-400" />
                                  Delete
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded-full border border-rose-500/30">
                                  <FiLock size={9} />
                                  Assigned
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleDeleteClick(leaveType);
                                }}
                                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-rose-300 hover:bg-rose-500/25 hover:text-white transition font-medium cursor-pointer"
                              >
                                <FiTrash2 size={13} className="text-rose-400" />
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Leave Type Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="bg-[#1e1b4b] text-white p-5 px-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiEdit2 size={18} className="text-[#38bdf8]" />
                  {modalType === 'create' ? 'Add Leave Type' : 'Edit Leave Type'}
                </h2>
                <p className="text-xs text-indigo-200 mt-0.5">
                  {modalType === 'create' ? 'Configure a new organizational leave type' : 'Update leave policy and restrictions'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-300 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Leave Type Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    placeholder="e.g., Sick Leave, Annual Leave"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    rows="3"
                    placeholder="Optional description..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Gender Restriction
                  </label>
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-gray-200/80">
                    <div className="flex items-center pb-2 border-b border-gray-200 mb-2">
                      <input
                        type="checkbox"
                        id="gender_all"
                        checked={formData.gender_restriction.length === 3}
                        onChange={handleSelectAllGenders}
                        className="w-4 h-4 rounded accent-blue-700 cursor-pointer"
                      />
                      <label htmlFor="gender_all" className="ml-2 text-xs font-bold text-gray-800 cursor-pointer">
                        Select All Genders
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
                        className="w-4 h-4 rounded accent-blue-700 cursor-pointer"
                      />
                      <label htmlFor="gender_male" className="ml-2 text-xs text-gray-700 cursor-pointer">
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
                        className="w-4 h-4 rounded accent-blue-700 cursor-pointer"
                      />
                      <label htmlFor="gender_female" className="ml-2 text-xs text-gray-700 cursor-pointer">
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
                        className="w-4 h-4 rounded accent-blue-700 cursor-pointer"
                      />
                      <label htmlFor="gender_transgender" className="ml-2 text-xs text-gray-700 cursor-pointer">
                        Transgender
                      </label>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">If none are selected, it will be available for all employees.</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-gray-100 p-4 px-6 flex items-center justify-between gap-3">
                {modalType === 'edit' && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentItem = leaveTypes.find(lt => lt.id === editingId);
                      setShowModal(false);
                      if (currentItem) {
                        handleDeleteClick(currentItem);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition border border-rose-200 cursor-pointer"
                    title="Delete this leave type"
                  >
                    <FiTrash2 size={14} />
                    Delete
                  </button>
                )}
                <div className={`flex gap-3 ${modalType === 'create' ? 'w-full' : 'ml-auto'}`}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition font-medium text-xs uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-white bg-[#1e1b4b] rounded-lg hover:bg-indigo-950 transition font-bold text-xs uppercase tracking-wider shadow-sm"
                  >
                    {modalType === 'create' ? 'Create' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.show && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-gray-100">
            <div className="bg-[#1e1b4b] text-white p-4 px-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#38bdf8]">
                <FiLock size={16} />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{confirmationModal.title}</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-6 leading-relaxed">{confirmationModal.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={closeConfirmationModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  className={`px-4 py-2 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-colors ${confirmationModal.confirmButtonColor}`}
                >
                  {confirmationModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee List Modal (Cannot Modify / Assigned) */}
      {employeeListModal.show && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="bg-[#1e1b4b] text-white p-5 px-6 flex justify-between items-start">
              <div className="flex items-center gap-3.5">
                <div className="flex items-center justify-center w-10 h-10 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-300">
                  <FiLock size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{employeeListModal.title || 'Cannot Modify Leave Type'}</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">Leave Type: <span className="font-semibold text-white">"{employeeListModal.leaveTypeName}"</span></p>
                </div>
              </div>
              <button
                onClick={closeEmployeeListModal}
                className="text-gray-300 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Employee List Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5">
                <p className="text-xs text-amber-900 font-semibold">{employeeListModal.message}</p>
                {employeeListModal.instruction && (
                  <p className="text-[11px] text-amber-700 mt-1 font-medium">{employeeListModal.instruction}</p>
                )}
              </div>

              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Assigned Employees ({employeeListModal.employees.length})
                </h4>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full">
                  <thead className="bg-[#1e1b4b] text-white">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-white">Employee Name</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-white">Email</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-white">Employee ID</th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-white">Days Allowed</th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-white">Days Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employeeListModal.employees.map((employee, index) => (
                      <tr key={employee.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-900">{employee.name}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{employee.email}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{employee.employee_id || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-900 text-center font-bold">{employee.days_allowed}</td>
                        <td className="px-4 py-3 text-xs text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${employee.days_used > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600'}`}>
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
            <div className="border-t border-gray-200 p-4 px-6 bg-slate-50 flex items-center justify-end">
              <button
                onClick={closeEmployeeListModal}
                className="px-5 py-2 bg-[#1e1b4b] text-white rounded-lg hover:bg-indigo-950 font-bold text-xs uppercase tracking-wider transition shadow-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
