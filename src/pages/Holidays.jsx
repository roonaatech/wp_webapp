import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
    FiPlus,
    FiX,
    FiEdit2,
    FiTrash2,
    FiSearch,
    FiRotateCw,
    FiChevronDown,
    FiAlertCircle
} from 'react-icons/fi';
import { LuCalendarHeart } from 'react-icons/lu';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import TableSortIcon from '../components/TableSortIcon';
import { fetchRoles, canManageHolidays } from '../utils/roleUtils';

export default function Holidays() {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(true);
    const [holidays, setHolidays] = useState([]);
    const [availableYears, setAvailableYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: 'holiday_date', direction: 'asc' });

    // Modals state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
    const [originalDate, setOriginalDate] = useState('');
    const [formData, setFormData] = useState({
        holiday_date: '',
        holiday_name: '',
        status: 1
    });
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState({});
    const [modalError, setModalError] = useState('');

    // Delete confirmation modal state
    const [deleteModal, setDeleteModal] = useState({
        show: false,
        holiday: null,
        submitting: false
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Format YYYY-MM-DD or ISO timestamp to DD-MM-YYYY
    const formatDisplayDate = (dateVal) => {
        if (!dateVal) return '-';
        if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
            const [y, m, d] = dateVal.substring(0, 10).split('-');
            return `${d}-${m}-${y}`;
        }
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // Helper to get abbreviated day of the week
    const getDayOfWeek = (dateVal) => {
        if (!dateVal) return '';
        try {
            const d = new Date(dateVal.length === 10 ? `${dateVal}T00:00:00` : dateVal);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-US', { weekday: 'short' });
            }
        } catch (_) {}
        return '';
    };

    // Permission check
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const canManage = canManageHolidays(user.role);
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

    // Fetch years list
    const fetchYears = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/holidays/years`, {
                headers: { 'x-access-token': token }
            });
            if (Array.isArray(res.data) && res.data.length > 0) {
                setAvailableYears(res.data);
            } else {
                const current = new Date().getFullYear();
                setAvailableYears([current + 1, current, current - 1]);
            }
        } catch (err) {
            console.error('Error fetching years:', err);
            const current = new Date().getFullYear();
            setAvailableYears([current + 1, current, current - 1]);
        }
    };

    // Fetch holidays for selected year
    const fetchHolidays = async () => {
        if (!hasPermission) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/holidays?year=${selectedYear}`, {
                headers: { 'x-access-token': token }
            });
            setHolidays(res.data || []);
        } catch (err) {
            console.error('Error fetching holidays:', err);
            toast.error(err.response?.data?.message || 'Failed to load holidays');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasPermission) {
            fetchYears();
        }
    }, [hasPermission]);

    useEffect(() => {
        if (hasPermission) {
            fetchHolidays();
        }
    }, [hasPermission, selectedYear]);

    // Sorting handler
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filtered and sorted data
    const filteredHolidays = useMemo(() => {
        let list = [...holidays];

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            list = list.filter(h => {
                const dateStr = formatDisplayDate(h.holiday_date).toLowerCase();
                const nameStr = (h.holiday_name || '').toLowerCase();
                const statusStr = (h.status === 1 ? 'active' : 'inactive');
                const addedStr = formatDisplayDate(h.date_added).toLowerCase();
                const dayStr = getDayOfWeek(h.holiday_date).toLowerCase();
                return dateStr.includes(term) || nameStr.includes(term) || statusStr.includes(term) || addedStr.includes(term) || dayStr.includes(term);
            });
        }

        list.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (sortConfig.key === 'status') {
                aVal = a.status === 1 ? 'Active' : 'Inactive';
                bVal = b.status === 1 ? 'Active' : 'Inactive';
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }, [holidays, searchTerm, sortConfig]);

    // Pagination calculations
    const totalRecords = filteredHolidays.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedHolidays = filteredHolidays.slice(startIndex, startIndex + pageSize);

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize, selectedYear]);

    // Export to Excel (.xlsx)
    const handleExport = () => {
        if (filteredHolidays.length === 0) {
            toast.error('No holidays to export');
            return;
        }

        const exportData = filteredHolidays.map((h, idx) => ({
            '#': idx + 1,
            'Holiday Date': formatDisplayDate(h.holiday_date),
            'Day': getDayOfWeek(h.holiday_date),
            'Name': h.holiday_name,
            'Status': h.status === 1 ? 'Active' : 'Inactive',
            'Date Added': formatDisplayDate(h.date_added)
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Holidays_${selectedYear}`);
        XLSX.writeFile(workbook, `Holidays_${selectedYear}.xlsx`);
        toast.success(`Exported ${filteredHolidays.length} holidays to Excel`);
    };

    // Open Create Modal
    const openCreateModal = () => {
        setModalMode('create');
        setOriginalDate('');
        setFormErrors({});
        setModalError('');
        const currentY = new Date().getFullYear();
        let defaultDate = '';
        if (selectedYear === currentY) {
            defaultDate = new Date().toISOString().substring(0, 10);
        } else {
            defaultDate = `${selectedYear}-01-01`;
        }
        setFormData({
            holiday_date: defaultDate,
            holiday_name: '',
            status: 1
        });
        setShowModal(true);
    };

    // Open Edit Modal
    const openEditModal = (holiday) => {
        setModalMode('edit');
        setOriginalDate(holiday.holiday_date);
        setFormErrors({});
        setModalError('');
        setFormData({
            holiday_date: holiday.holiday_date,
            holiday_name: holiday.holiday_name,
            status: holiday.status !== undefined ? holiday.status : 1
        });
        setShowModal(true);
    };

    // Handle Form Submit
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const errors = {};
        if (!formData.holiday_date) {
            errors.holiday_date = 'Holiday date is required';
        }
        if (!formData.holiday_name || !formData.holiday_name.trim()) {
            errors.holiday_name = 'Holiday name is required';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setModalError('Please fix the highlighted errors below before saving.');
            return;
        }

        setFormErrors({});
        setModalError('');
        setFormSubmitting(true);
        const token = localStorage.getItem('token');
        const config = { headers: { 'x-access-token': token } };

        try {
            if (modalMode === 'create') {
                await axios.post(`${API_BASE_URL}/api/holidays`, formData, config);
                toast.success('Holiday created successfully');
            } else {
                await axios.put(`${API_BASE_URL}/api/holidays/${originalDate}`, formData, config);
                toast.success('Holiday updated successfully');
            }
            setShowModal(false);
            fetchHolidays();
            fetchYears();
        } catch (err) {
            console.error('Error saving holiday:', err);
            const msg = err.response?.data?.message || 'Failed to save holiday';
            setModalError(msg);
            toast.error(msg);
        } finally {
            setFormSubmitting(false);
        }
    };

    // Open Delete Modal
    const openDeleteModal = (holiday) => {
        setDeleteModal({
            show: true,
            holiday: holiday,
            submitting: false
        });
    };

    // Confirm Delete
    const handleConfirmDelete = async () => {
        if (!deleteModal.holiday) return;
        setDeleteModal(prev => ({ ...prev, submitting: true }));
        const token = localStorage.getItem('token');
        const config = { headers: { 'x-access-token': token } };

        try {
            await axios.delete(`${API_BASE_URL}/api/holidays/${deleteModal.holiday.holiday_date}`, config);
            toast.success('Holiday deleted successfully');
            setDeleteModal({ show: false, holiday: null, submitting: false });
            fetchHolidays();
        } catch (err) {
            console.error('Error deleting holiday:', err);
            toast.error(err.response?.data?.message || 'Failed to delete holiday');
            setDeleteModal(prev => ({ ...prev, submitting: false }));
        }
    };

    if (!permissionChecked) {
        return (
            <div className="flex items-center justify-center h-screen">
                <ModernLoader />
            </div>
        );
    }

    if (!hasPermission) {
        return null;
    }

    return (
        <div className="p-6 relative min-h-screen bg-slate-50/50">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Holidays</h1>
                    <p className="text-sm text-gray-500 mt-1">Configure company holidays and observances</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Year Selector */}
                    <div className="flex items-center gap-2.5">
                        <label htmlFor="year-select" className="text-sm font-semibold text-gray-700">
                            Year:
                        </label>
                        <div className="relative">
                            <select
                                id="year-select"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="appearance-none bg-white border border-gray-300 rounded-lg pl-3.5 pr-9 py-2 text-sm font-semibold text-gray-800 shadow-2xs hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer transition min-w-[110px]"
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" size={15} />
                        </div>
                    </div>

                    {/* New Holiday Button */}
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition shadow-sm font-medium text-sm"
                    >
                        <FiPlus size={18} />
                        New Holiday
                    </button>
                </div>
            </div>

            {/* Table Container Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden relative min-h-[450px]">
                {loading && (
                    <ModernLoader size="container" message="Loading holidays..." fullScreen={false} />
                )}

                {/* Top Controls Bar */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                    {/* Left: Per page, Export, Refresh */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(parseInt(e.target.value))}
                                className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" size={14} />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">per page</span>

                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition ml-2"
                        >
                            Export
                        </button>

                        <button
                            onClick={fetchHolidays}
                            className="inline-flex items-center justify-center p-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 rounded-lg shadow-2xs transition"
                            title="Refresh holidays"
                        >
                            <FiRotateCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
                        </button>
                    </div>

                    {/* Right: Search Input */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <FiSearch size={15} />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search holidays..."
                            className="pl-9 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-64 shadow-2xs"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                <FiX size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full">
                        <thead className="bg-[#1e1b4b] text-white">
                            <tr>
                                <th className="px-6 py-3 text-left">
                                    <button
                                        onClick={() => handleSort('holiday_date')}
                                        className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                    >
                                        Holiday Date <TableSortIcon column="holiday_date" sortConfig={sortConfig} />
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <button
                                        onClick={() => handleSort('holiday_name')}
                                        className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                    >
                                        Holiday Name <TableSortIcon column="holiday_name" sortConfig={sortConfig} />
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
                                        onClick={() => handleSort('date_added')}
                                        className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-[#0ea5e9] transition-colors"
                                    >
                                        Date Added <TableSortIcon column="date_added" sortConfig={sortConfig} />
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-right text-[10px] font-black text-white uppercase tracking-widest">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {paginatedHolidays.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <LuCalendarHeart className="w-10 h-10 text-gray-300 mb-2" />
                                            <p className="text-base font-medium text-gray-700">No holidays found</p>
                                            <p className="text-sm text-gray-400 mt-0.5">
                                                {searchTerm ? 'Try adjusting your search query' : `No holidays configured for ${selectedYear}`}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedHolidays.map((holiday) => {
                                    const dayOfWeek = getDayOfWeek(holiday.holiday_date);
                                    return (
                                        <tr
                                            key={holiday.holiday_date}
                                            className="hover:bg-gray-50/80 transition-colors"
                                        >
                                            {/* Holiday Date */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <button
                                                        onClick={() => openEditModal(holiday)}
                                                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-sm text-left"
                                                        title="Click to edit holiday"
                                                    >
                                                        {formatDisplayDate(holiday.holiday_date)}
                                                    </button>
                                                    {dayOfWeek && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                                            {dayOfWeek}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Holiday Name */}
                                            <td className="px-6 py-4">
                                                <span className="font-medium text-gray-900 text-sm">
                                                    {holiday.holiday_name}
                                                </span>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    holiday.status === 1
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${holiday.status === 1 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                    {holiday.status === 1 ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>

                                            {/* Date Added */}
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {formatDisplayDate(holiday.date_added)}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => openEditModal(holiday)}
                                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                                                        title="Edit Holiday"
                                                    >
                                                        <FiEdit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(holiday)}
                                                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                                                        title="Delete Holiday"
                                                    >
                                                        <FiTrash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-gray-600">
                        Showing <span className="font-medium">{totalRecords > 0 ? startIndex + 1 : 0}</span> to <span className="font-medium">{Math.min(startIndex + pageSize, totalRecords)}</span> of <span className="font-medium">{totalRecords}</span> entries
                    </p>

                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`px-3 py-1 border border-gray-300 rounded-lg text-sm transition-colors ${
                                currentPage === 1 
                                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                                    : 'hover:bg-gray-100 text-gray-700 bg-white shadow-2xs'
                            }`}
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600 px-2 flex items-center gap-1">
                            Page
                            <span className="font-semibold text-gray-900">{currentPage}</span>
                            of
                            <span className="font-semibold text-gray-900">{Math.max(totalPages, 1)}</span>
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage >= totalPages || totalPages === 0}
                            className={`px-3 py-1 border border-gray-300 rounded-lg text-sm transition-colors ${
                                currentPage >= totalPages || totalPages === 0
                                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                                    : 'hover:bg-gray-100 text-gray-700 bg-white shadow-2xs'
                            }`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Create / Edit Holiday Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-[#1e1b4b] text-white p-5 px-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <FiEdit2 size={18} className="text-[#38bdf8]" />
                                    {modalMode === 'create' ? 'New Holiday' : 'Edit Holiday'}
                                </h2>
                                <p className="text-xs text-indigo-200 mt-0.5">
                                    {modalMode === 'create' ? 'Configure a new company holiday observance' : 'Update company holiday details'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-300 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleFormSubmit} noValidate className="p-6 space-y-4">
                            {/* Tailwind Alert Banner */}
                            {modalError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg flex items-start justify-between gap-2 animate-in fade-in duration-150">
                                    <div className="flex items-center gap-2">
                                        <FiAlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                        <span>{modalError}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setModalError('')}
                                        className="text-red-400 hover:text-red-700 p-0.5 rounded transition"
                                    >
                                        <FiX size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Holiday Date */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Holiday Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.holiday_date}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, holiday_date: e.target.value }));
                                        if (formErrors.holiday_date) {
                                            setFormErrors(prev => ({ ...prev, holiday_date: '' }));
                                        }
                                        if (modalError) setModalError('');
                                    }}
                                    className={`w-full px-3.5 py-2 border rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 shadow-2xs transition ${
                                        formErrors.holiday_date 
                                            ? 'border-red-400 focus:ring-red-200 focus:border-red-500 bg-red-50/20' 
                                            : 'border-gray-300 focus:ring-blue-500/20 focus:border-blue-600 bg-white'
                                    }`}
                                />
                                {formErrors.holiday_date && (
                                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-medium">
                                        <FiAlertCircle size={12} />
                                        {formErrors.holiday_date}
                                    </p>
                                )}
                            </div>

                            {/* Holiday Name */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Holiday Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Republic Day"
                                    value={formData.holiday_name}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, holiday_name: e.target.value }));
                                        if (formErrors.holiday_name) {
                                            setFormErrors(prev => ({ ...prev, holiday_name: '' }));
                                        }
                                        if (modalError) setModalError('');
                                    }}
                                    className={`w-full px-3.5 py-2 border rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 shadow-2xs transition ${
                                        formErrors.holiday_name 
                                            ? 'border-red-400 focus:ring-red-200 focus:border-red-500 bg-red-50/20' 
                                            : 'border-gray-300 focus:ring-blue-500/20 focus:border-blue-600 bg-white'
                                    }`}
                                />
                                {formErrors.holiday_name && (
                                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-medium">
                                        <FiAlertCircle size={12} />
                                        {formErrors.holiday_name}
                                    </p>
                                )}
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: parseInt(e.target.value) }))}
                                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs cursor-pointer"
                                >
                                    <option value={1}>Active</option>
                                    <option value={0}>Inactive</option>
                                </select>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium text-sm rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formSubmitting}
                                    className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition disabled:opacity-60 flex items-center gap-2"
                                >
                                    {formSubmitting && <FiRotateCw className="animate-spin" size={14} />}
                                    {modalMode === 'create' ? 'Create Holiday' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal.show && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 p-6">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4">
                            <FiTrash2 size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Holiday</h3>
                        <p className="text-sm text-slate-600 mb-5">
                            Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteModal.holiday?.holiday_name}</span> ({formatDisplayDate(deleteModal.holiday?.holiday_date)})? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteModal({ show: false, holiday: null, submitting: false })}
                                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deleteModal.submitting}
                                onClick={handleConfirmDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition disabled:opacity-60 flex items-center gap-2"
                            >
                                {deleteModal.submitting && <FiRotateCw className="animate-spin" size={14} />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
