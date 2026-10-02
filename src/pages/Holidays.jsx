import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
    FiPlus,
    FiX,
    FiEdit2,
    FiSearch,
    FiRotateCw,
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight
} from 'react-icons/fi';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
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
                return dateStr.includes(term) || nameStr.includes(term) || statusStr.includes(term) || addedStr.includes(term);
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
        // Suggest a date in the selected year, e.g. today or Jan 1st of selected year
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
        if (!formData.holiday_date) {
            toast.error('Holiday date is required');
            return;
        }
        if (!formData.holiday_name.trim()) {
            toast.error('Holiday name is required');
            return;
        }

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
            toast.error(err.response?.data?.message || 'Failed to save holiday');
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
        <div className="p-6 relative min-h-screen bg-slate-50">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Holidays</h1>
            </div>

            {/* Top Action Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
                {/* Left: New Holiday Button */}
                <button
                    onClick={openCreateModal}
                    className="inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition shadow-sm hover:shadow"
                >
                    <FiPlus size={18} />
                    New Holiday
                </button>

                {/* Right: Year Selector */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                    <label htmlFor="year-select" className="text-sm font-semibold text-slate-700">
                        Year:
                    </label>
                    <div className="relative">
                        <select
                            id="year-select"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="appearance-none bg-white border border-slate-300 rounded-lg pl-3.5 pr-9 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[110px]"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" size={16} />
                    </div>
                </div>
            </div>

            {/* Table Container Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
                {/* Top Controls Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
                    {/* Left: Page Size, Export, Refresh */}
                    <div className="flex items-center gap-2.5">
                        {/* Page Size */}
                        <div className="relative">
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(parseInt(e.target.value))}
                                className="appearance-none bg-white border border-slate-300 rounded-md pl-3 pr-7 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" size={13} />
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-3.5 py-1.5 rounded-md shadow-sm transition"
                        >
                            Export
                        </button>

                        {/* Reload Button */}
                        <button
                            onClick={fetchHolidays}
                            className="inline-flex items-center justify-center p-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 rounded-md shadow-sm transition"
                            title="Refresh holidays"
                        >
                            <FiRotateCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
                        </button>
                    </div>

                    {/* Right: Search Input */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <FiSearch size={14} />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search.."
                            className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-56 shadow-sm"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                            <ModernLoader size="container" message="Loading holidays..." fullScreen={false} />
                        </div>
                    )}
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-[#f8fafc]">
                                <th className="px-4 py-3.5 text-left font-semibold text-sm text-[#1e40af]">
                                    <button
                                        onClick={() => handleSort('holiday_date')}
                                        className="inline-flex items-center gap-1.5 hover:text-blue-900 transition-colors"
                                    >
                                        Holiday Date
                                        <span className="inline-block text-xs text-slate-500">
                                            {sortConfig.key === 'holiday_date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                        </span>
                                    </button>
                                </th>
                                <th className="px-4 py-3.5 text-left font-semibold text-sm text-[#1e40af]">
                                    <button
                                        onClick={() => handleSort('holiday_name')}
                                        className="inline-flex items-center gap-1.5 hover:text-blue-900 transition-colors"
                                    >
                                        Name
                                        <span className="inline-block text-xs text-slate-500">
                                            {sortConfig.key === 'holiday_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                        </span>
                                    </button>
                                </th>
                                <th className="px-4 py-3.5 text-left font-semibold text-sm text-[#1e40af]">
                                    <button
                                        onClick={() => handleSort('status')}
                                        className="inline-flex items-center gap-1.5 hover:text-blue-900 transition-colors"
                                    >
                                        Status
                                        <span className="inline-block text-xs text-slate-500">
                                            {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                        </span>
                                    </button>
                                </th>
                                <th className="px-4 py-3.5 text-left font-semibold text-sm text-[#1e40af]">
                                    <button
                                        onClick={() => handleSort('date_added')}
                                        className="inline-flex items-center gap-1.5 hover:text-blue-900 transition-colors"
                                    >
                                        Date Added
                                        <span className="inline-block text-xs text-slate-500">
                                            {sortConfig.key === 'date_added' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                        </span>
                                    </button>
                                </th>
                                <th className="px-4 py-3.5 text-left font-semibold text-sm text-[#1e40af]">
                                    Options
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedHolidays.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-10 text-center text-slate-500">
                                        {searchTerm ? 'No matching holidays found' : `No holidays configured for ${selectedYear}`}
                                    </td>
                                </tr>
                            ) : (
                                paginatedHolidays.map((holiday) => (
                                    <tr
                                        key={holiday.holiday_date}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        {/* Holiday Date - Blue link style */}
                                        <td className="px-4 py-3.5">
                                            <button
                                                onClick={() => openEditModal(holiday)}
                                                className="text-[#1d4ed8] hover:underline font-medium text-sm text-left"
                                                title="Click to edit holiday"
                                            >
                                                {formatDisplayDate(holiday.holiday_date)}
                                            </button>
                                        </td>

                                        {/* Name */}
                                        <td className="px-4 py-3.5 text-sm text-slate-800 font-normal">
                                            {holiday.holiday_name}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3.5 text-sm text-slate-700">
                                            {holiday.status === 1 ? 'Active' : 'Inactive'}
                                        </td>

                                        {/* Date Added */}
                                        <td className="px-4 py-3.5 text-sm text-slate-700">
                                            {formatDisplayDate(holiday.date_added)}
                                        </td>

                                        {/* Options */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                {/* Green Edit button */}
                                                <button
                                                    onClick={() => openEditModal(holiday)}
                                                    className="p-1.5 bg-[#16a34a] hover:bg-emerald-700 text-white rounded transition shadow-sm inline-flex items-center justify-center"
                                                    title="Edit Holiday"
                                                >
                                                    <FiEdit2 size={13} />
                                                </button>

                                                {/* Red Delete button */}
                                                <button
                                                    onClick={() => openDeleteModal(holiday)}
                                                    className="p-1.5 bg-[#dc2626] hover:bg-red-700 text-white rounded transition shadow-sm inline-flex items-center justify-center"
                                                    title="Delete Holiday"
                                                >
                                                    <FiX size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {totalRecords > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 pt-4 border-t border-slate-100 text-sm text-slate-600">
                        <div>
                            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalRecords)} of {totalRecords} entries
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition"
                                title="Previous Page"
                            >
                                <FiChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`px-3 py-1 rounded text-sm font-medium transition ${
                                        currentPage === page
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition"
                                title="Next Page"
                            >
                                <FiChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create / Edit Holiday Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {modalMode === 'create' ? 'New Holiday' : 'Edit Holiday'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                            {/* Holiday Date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Holiday Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.holiday_date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, holiday_date: e.target.value }))}
                                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                />
                            </div>

                            {/* Holiday Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Holiday Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Republic Day"
                                    value={formData.holiday_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, holiday_name: e.target.value }))}
                                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: parseInt(e.target.value) }))}
                                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                >
                                    <option value={1}>Active</option>
                                    <option value={0}>Inactive</option>
                                </select>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formSubmitting}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition disabled:opacity-60 flex items-center gap-2"
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
