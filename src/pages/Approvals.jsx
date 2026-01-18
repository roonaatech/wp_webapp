
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';

const Approvals = () => {
    const [leaveApprovals, setLeaveApprovals] = useState([]);
    const [onDutyApprovals, setOnDutyApprovals] = useState([]);
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [error, setError] = useState(null);
    const [expandedSections, setExpandedSections] = useState({
        leave: true,
        onDuty: false
    });
    const [leaveTypeFilter, setLeaveTypeFilter] = useState('All');
    const [nameFilter, setNameFilter] = useState('All');
    const [leaveSortConfig, setLeaveSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [onDutySortConfig, setOnDutySortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [rowsPerPage, setRowsPerPage] = useState(() => {
        const saved = localStorage.getItem('approvalsRowsPerPage');
        return saved ? parseInt(saved) : 10;
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState({
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
        pageSize: 10,
        hasPrevPage: false,
        hasNextPage: false
    });
    const [rejectionModal, setRejectionModal] = useState({
        show: false,
        item: null,
        isLeave: false,
        reason: ''
    });
    const [editReasonModal, setEditReasonModal] = useState({
        show: false,
        item: null,
        isLeave: false,
        reason: ''
    });
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [bulkRejectionModal, setBulkRejectionModal] = useState({
        show: false,
        reason: '',
        action: null
    });
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchApprovals(1);
        setSelectedItems(new Set()); // Clear selections when status changes
    }, [statusFilter, rowsPerPage]);

    const fetchApprovals = async (page = 1) => {
        try {
            setLoading(true);
            setError(null);
            setCurrentPage(page);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found. Please login first.');
                return;
            }

            // Fetch with server-side pagination
            const response = await axios.get(
                `${API_BASE_URL}/api/leave/requests?status=${statusFilter}&page=${page}&limit=${rowsPerPage}`,
                { headers: { 'x-access-token': token } }
            );

            const allRequests = response.data.items || [];
            const paginationData = response.data.pagination || {};

            // Separate leave and on-duty requests
            const leaves = allRequests.filter(item => item.type === 'leave').map(item => ({
                id: item.id,
                staff_id: item.staff_id,
                tblstaff: item.tblstaff,
                leave_type: item.title,
                reason: item.reason,
                start_date: item.start_date,
                end_date: item.end_date,
                status: item.status,
                rejection_reason: item.rejection_reason,
                manager_id: item.manager_id,
                approver: item.approver,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            }));

            const onDuty = allRequests.filter(item => item.type === 'on_duty').map(item => {
                // Extract location from reason string format: "purpose (location)"
                const reasonMatch = item.reason.match(/^(.+?)\s*\((.+?)\)$/);
                const location = reasonMatch ? reasonMatch[2] : '';
                return {
                    id: item.id,
                    staff_id: item.staff_id,
                    tblstaff: item.tblstaff,
                    client_name: item.title.replace('On-Duty: ', ''),
                    purpose: reasonMatch ? reasonMatch[1] : item.reason,
                    start_time: item.start_date,
                    end_time: item.end_date,
                    status: item.status,
                    rejection_reason: item.rejection_reason,
                    location: location,
                    manager_id: item.manager_id,
                    approver: item.approver,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                };
            });

            setLeaveApprovals(leaves);
            setOnDutyApprovals(onDuty);
            setPagination(paginationData);
        } catch (error) {
            console.error('Error fetching approvals:', error);
            setError(error.response?.data?.message || error.message || 'Failed to fetch approvals');
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handleUpdateStatus = async (item, status, isLeave) => {
        // If rejecting, show modal to get reason
        if (status === 'rejected') {
            setRejectionModal({
                show: true,
                item: item,
                isLeave: isLeave,
                reason: ''
            });
            return;
        }

        // For approve or pending, proceed directly
        await performStatusUpdate(item, status, isLeave, null);
    };

    const performStatusUpdate = async (item, status, isLeave, rejectionReason = null) => {
        const itemKey = `${isLeave ? 'leave' : 'onduty'}-${item.id}-${status}`;
        setProcessingId(itemKey);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found.');
                setProcessingId(null);
                return;
            }

            const endpoint = isLeave
                ? `${API_BASE_URL}/api/leave/${item.id}/status`
                : `${API_BASE_URL}/api/onduty/${item.id}/status`;

            let statusStr = 'Pending';
            if (status === 'approved') statusStr = 'Approved';
            else if (status === 'rejected') statusStr = 'Rejected';

            const requestBody = { status: statusStr };
            if (statusStr === 'Rejected' && rejectionReason) {
                requestBody.rejection_reason = rejectionReason;
            }

            await axios.put(endpoint,
                requestBody,
                { headers: { 'x-access-token': token } }
            );

            // Remove from local state
            if (isLeave) {
                setLeaveApprovals(leaveApprovals.filter(a => a.id !== item.id));
            } else {
                setOnDutyApprovals(onDutyApprovals.filter(a => a.id !== item.id));
            }

            // Dispatch event to notify Header to refresh pending count
            window.dispatchEvent(new Event('approvalStatusChanged'));

            setError(null);
        } catch (error) {
            console.error('Error updating status:', error);
            setError(error.response?.data?.message || 'Failed to update request');
        } finally {
            setProcessingId(null);
        }
    };

    const handleSelectItem = (key) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedItems(newSelected);
    };

    const handleSelectAll = (isLeave) => {
        const items = isLeave ? leaveApprovals : onDutyApprovals;
        const newSelected = new Set(selectedItems);

        const allKeys = items.map(item => `${isLeave ? 'leave' : 'onduty'}-${item.id}`);
        const allSelected = allKeys.every(key => newSelected.has(key));

        if (allSelected) {
            allKeys.forEach(key => newSelected.delete(key));
        } else {
            allKeys.forEach(key => newSelected.add(key));
        }
        setSelectedItems(newSelected);
    };

    const handleBulkAction = (action) => {
        if (selectedItems.size === 0) {
            alert('Please select at least one item');
            return;
        }

        if (action === 'rejected') {
            setBulkRejectionModal({ show: true, reason: '', action: 'rejected' });
        } else {
            performBulkStatusUpdate('approved');
        }
    };

    const performBulkStatusUpdate = async (status, rejectionReason = null) => {
        setBulkProcessing(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found.');
                return;
            }

            const updates = Array.from(selectedItems).map(key => {
                const [type, id] = key.split('-');
                const isLeave = type === 'leave';
                const items = isLeave ? leaveApprovals : onDutyApprovals;
                const item = items.find(i => i.id === parseInt(id));
                return { item, isLeave };
            });

            for (const { item, isLeave } of updates) {
                const endpoint = isLeave
                    ? `${API_BASE_URL}/api/leave/${item.id}/status`
                    : `${API_BASE_URL}/api/onduty/${item.id}/status`;

                let statusStr = 'Pending';
                if (status === 'approved') statusStr = 'Approved';
                else if (status === 'rejected') statusStr = 'Rejected';

                const requestBody = { status: statusStr };
                if (statusStr === 'Rejected' && rejectionReason) {
                    requestBody.rejection_reason = rejectionReason;
                }

                await axios.put(endpoint, requestBody, { headers: { 'x-access-token': token } });
            }

            // Remove all approved/rejected items from local state
            setLeaveApprovals(leaveApprovals.filter(a => !selectedItems.has(`leave-${a.id}`)));
            setOnDutyApprovals(onDutyApprovals.filter(a => !selectedItems.has(`onduty-${a.id}`)));
            setSelectedItems(new Set());
            setBulkRejectionModal({ show: false, reason: '', action: null });

            window.dispatchEvent(new Event('approvalStatusChanged'));
            setError(null);
            alert(`${updates.length} item(s) ${status === 'approved' ? 'approved' : 'rejected'} successfully!`);
        } catch (error) {
            console.error('Error performing bulk update:', error);
            setError(error.response?.data?.message || 'Failed to perform bulk action');
        } finally {
            setBulkProcessing(false);
        }
    };

    const updateRejectionReason = async (item, isLeave, newReason) => {
        const itemKey = `${isLeave ? 'leave' : 'onduty'}-${item.id}-edit`;
        setProcessingId(itemKey);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found.');
                setProcessingId(null);
                return;
            }

            const endpoint = isLeave
                ? `${API_BASE_URL}/api/leave/${item.id}/status`
                : `${API_BASE_URL}/api/onduty/${item.id}/status`;

            // Update only the rejection_reason without changing the status
            await axios.put(endpoint,
                { rejection_reason: newReason },
                { headers: { 'x-access-token': token } }
            );

            // Update local state - update the item's rejection_reason
            if (isLeave) {
                setLeaveApprovals(leaveApprovals.map(a =>
                    a.id === item.id ? { ...a, rejection_reason: newReason } : a
                ));
            } else {
                setOnDutyApprovals(onDutyApprovals.map(a =>
                    a.id === item.id ? { ...a, rejection_reason: newReason } : a
                ));
            }
            setError(null);
        } catch (error) {
            console.error('Error updating rejection reason:', error);
            setError(error.response?.data?.message || 'Failed to update rejection reason');
        } finally {
            setProcessingId(null);
        }
    };

    const isHistory = statusFilter !== 'Pending';

    // Sorting utility - define before use
    const sortData = (data, key, direction) => {
        return [...data].sort((a, b) => {
            let aVal = a[key];
            let bVal = b[key];

            // Handle nested fields
            if (key === 'staffName') {
                aVal = a.tblstaff ? `${a.tblstaff.firstname} ${a.tblstaff.lastname}` : '';
                bVal = b.tblstaff ? `${b.tblstaff.firstname} ${b.tblstaff.lastname}` : '';
            }

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const filteredLeaveApprovals = leaveApprovals.filter(item => {
        const staffName = item.tblstaff ? `${item.tblstaff.firstname} ${item.tblstaff.lastname}` : '';
        const matchesName = nameFilter === 'All' || staffName === nameFilter;
        const matchesType = leaveTypeFilter === 'All' || item.leave_type === leaveTypeFilter;
        return matchesName && matchesType;
    });

    const filteredOnDutyApprovals = onDutyApprovals.filter(item => {
        const staffName = item.tblstaff ? `${item.tblstaff.firstname} ${item.tblstaff.lastname}` : '';
        const matchesName = nameFilter === 'All' || staffName === nameFilter;
        return matchesName;
    });

    // Apply sorting to filtered data
    const sortedAndFilteredLeaveApprovals = sortData(filteredLeaveApprovals, leaveSortConfig.key, leaveSortConfig.direction);
    const sortedAndFilteredOnDutyApprovals = sortData(filteredOnDutyApprovals, onDutySortConfig.key, onDutySortConfig.direction);

    const getUniqueLeaveTypes = () => {
        const types = new Set(leaveApprovals.map(item => item.leave_type));
        return ['All', ...Array.from(types)];
    };
    const SortableHeader = ({ label, sortKey, sortConfig, setSortConfig, align = 'left' }) => (
        <th
            className={`px-6 py-3 text-sm font-semibold text-white cursor-pointer hover:bg-white/10 transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
            onClick={() => {
                const direction = sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'desc' : 'asc';
                setSortConfig({ key: sortKey, direction });
            }}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                {label}
                {sortConfig.key === sortKey && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
            </div>
        </th>
    );


    const getUniqueNames = () => {
        const names = new Set();
        [...leaveApprovals, ...onDutyApprovals].forEach(item => {
            if (item.tblstaff) {
                names.add(`${item.tblstaff.firstname} ${item.tblstaff.lastname}`);
            }
        });
        return ['All', ...Array.from(names).sort()];
    };

    // Pagination utility
    const paginate = (data) => {
        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        return data.slice(startIdx, endIdx);
    };

    const getTotalPages = (dataLength) => Math.ceil(dataLength / rowsPerPage);



    const DataTablesFooter = ({ pageData, type }) => {
        // Get separate counts based on table type
        const pageSize = pageData?.pageSize || rowsPerPage;
        const currentPage = pageData?.currentPage || 1;
        const totalPages = pageData?.totalPages || 1;

        // Use separate total counts for each table type
        let totalCount = 0;
        let currentTypeItems = 0;

        if (type === 'leave') {
            totalCount = pageData?.leaveCount || leaveApprovals.length;
            currentTypeItems = leaveApprovals.length;
        } else if (type === 'onDuty') {
            totalCount = pageData?.onDutyCount || onDutyApprovals.length;
            currentTypeItems = onDutyApprovals.length;
        }

        // Calculate pagination indices based on the total count for this type
        const startIdx = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
        const endIdx = Math.min((currentPage - 1) * pageSize + currentTypeItems, totalCount);

        return (
            <div className="mt-4 flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">
                    Showing {startIdx} to {endIdx} of {totalCount} {type === 'leave' ? 'leave' : 'on-duty'} entries
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchApprovals(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Previous
                    </button>
                    <button
                        onClick={() => fetchApprovals(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Next →
                    </button>
                </div>
                <select
                    value={rowsPerPage}
                    onChange={(e) => {
                        const newRowsPerPage = parseInt(e.target.value);
                        setRowsPerPage(newRowsPerPage);
                        localStorage.setItem('approvalsRowsPerPage', newRowsPerPage);
                        fetchApprovals(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                </select>
            </div>
        );
    };



    return (
        <div className="p-6 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Approvals & Requests</h1>
                    <p className="text-gray-600 mt-1">Manage {statusFilter.toLowerCase()} leave and on-duty requests</p>
                </div>

                {/* Status Tabs */}
                <div className="bg-gray-100 p-1 rounded-lg inline-flex">
                    {['Pending', 'Approved', 'Rejected'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => {
                                setStatusFilter(tab);
                                setExpandedSections({ leave: true, onDuty: false });
                            }}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${statusFilter === tab
                                ? 'bg-white text-[#2E5090] shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-lg border border-red-200">
                    <p className="font-medium">⚠️ {error}</p>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <ModernLoader size="lg" message="Loading..." />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Section Switcher & Filters */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setExpandedSections({ leave: true, onDuty: false })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${expandedSections.leave
                                    ? 'bg-[#2E5090] text-white border-[#2E5090]'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                Leave Requests ({leaveApprovals.length})
                            </button>
                            <button
                                onClick={() => setExpandedSections({ leave: false, onDuty: true })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${expandedSections.onDuty
                                    ? 'bg-[#2E5090] text-white border-[#2E5090]'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                On-Duty Requests ({onDutyApprovals.length})
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {expandedSections.leave && (
                                <select
                                    value={leaveTypeFilter}
                                    onChange={(e) => setLeaveTypeFilter(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                >
                                    {getUniqueLeaveTypes().map(type => (
                                        <option key={type} value={type}>{type === 'All' ? 'All Types' : type}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            >
                                {getUniqueNames().map(name => (
                                    <option key={name} value={name}>{name === 'All' ? 'All Employees' : name}</option>
                                ))}
                            </select>

                            {/* Bulk Actions */}
                            {selectedItems.size > 0 && statusFilter === 'Pending' && (
                                <div className="flex gap-2 animate-in fade-in duration-200">
                                    <button
                                        onClick={() => handleBulkAction('approved')}
                                        disabled={bulkProcessing}
                                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Approve ({selectedItems.size})
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('rejected')}
                                        disabled={bulkProcessing}
                                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                    >
                                        Reject ({selectedItems.size})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                        {expandedSections.leave ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#2E5090]">
                                        <tr>
                                            {statusFilter === 'Pending' && (
                                                <th className="px-6 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        onChange={() => handleSelectAll(true)}
                                                        checked={leaveApprovals.length > 0 && selectedItems.size === leaveApprovals.map(i => `leave-${i.id}`).filter(k => selectedItems.has(k)).length}
                                                        className="w-4 h-4 rounded accent-blue-600"
                                                    />
                                                </th>
                                            )}
                                            <SortableHeader label="Employee" sortKey="staffName" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                            <SortableHeader label="Leave Type" sortKey="leave_type" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-white">Duration</th>
                                            <SortableHeader label="Period" sortKey="start_date" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                            {statusFilter === 'Approved' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Approved By</th>}
                                            {statusFilter === 'Rejected' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Reason</th>}
                                            <th className="px-6 py-3 text-right text-sm font-semibold text-white">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {sortedAndFilteredLeaveApprovals.length > 0 ? (
                                            sortedAndFilteredLeaveApprovals.map((req) => (
                                                <tr key={`l-${req.id}`} className="hover:bg-gray-50 transition-colors">
                                                    {statusFilter === 'Pending' && (
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(`leave-${req.id}`)}
                                                                onChange={() => handleSelectItem(`leave-${req.id}`)}
                                                                className="w-4 h-4 rounded accent-[#2E5090]"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#2E5090] font-bold text-sm">
                                                                {req.tblstaff?.firstname?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900">{req.tblstaff?.firstname} {req.tblstaff?.lastname}</p>
                                                                <p className="text-xs text-gray-500">ID: {req.staff_id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                                                            {req.leave_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {calculateDaysOfLeave(req.start_date, req.end_date)} Days
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm text-gray-900">
                                                            {req.start_date} <span className="text-gray-400">to</span> {req.end_date}
                                                        </div>
                                                    </td>
                                                    {statusFilter === 'Approved' && (
                                                        <td className="px-6 py-4 text-sm text-gray-700">
                                                            {req.approver ? `${req.approver.firstname} ${req.approver.lastname}` : '-'}
                                                        </td>
                                                    )}
                                                    {statusFilter === 'Rejected' && (
                                                        <td className="px-6 py-4 text-sm text-red-600 italic max-w-xs">{req.rejection_reason || '-'}</td>
                                                    )}
                                                    <td className="px-6 py-4 text-right">
                                                        {!isHistory ? (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'approved', true)}
                                                                    disabled={processingId === `leave-${req.id}-approved`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `leave-${req.id}-approved` ? '...' : 'Approve'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'rejected', true)}
                                                                    disabled={processingId === `leave-${req.id}-rejected`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `leave-${req.id}-rejected` ? '...' : 'Reject'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-3">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'pending', true)}
                                                                    disabled={processingId === `leave-${req.id}-pending`}
                                                                    className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                                                    title="Revert to Pending"
                                                                >
                                                                    Revert
                                                                </button>
                                                                {statusFilter === 'Rejected' && user.id === req.manager_id && (
                                                                    <button
                                                                        onClick={() => setEditReasonModal({
                                                                            show: true,
                                                                            item: req,
                                                                            isLeave: true,
                                                                            reason: req.rejection_reason || ''
                                                                        })}
                                                                        className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-sm font-medium transition-colors"
                                                                    >
                                                                        Edit Reason
                                                                    </button>
                                                                )}

                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                                    No leave requests found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#2E5090]">
                                        <tr>
                                            {statusFilter === 'Pending' && (
                                                <th className="px-6 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        onChange={() => handleSelectAll(false)}
                                                        checked={onDutyApprovals.length > 0 && selectedItems.size === onDutyApprovals.map(i => `onduty-${i.id}`).filter(k => selectedItems.has(k)).length}
                                                        className="w-4 h-4 rounded accent-blue-600"
                                                    />
                                                </th>
                                            )}
                                            <SortableHeader label="Employee" sortKey="staffName" sortConfig={onDutySortConfig} setSortConfig={setOnDutySortConfig} />
                                            <SortableHeader label="Client / Location" sortKey="client_name" sortConfig={onDutySortConfig} setSortConfig={setOnDutySortConfig} />
                                            <SortableHeader label="Date" sortKey="start_time" sortConfig={onDutySortConfig} setSortConfig={setOnDutySortConfig} />
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-white">Duration</th>
                                            {statusFilter === 'Approved' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Approved By</th>}
                                            {statusFilter === 'Rejected' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Reason</th>}
                                            <th className="px-6 py-3 text-right text-sm font-semibold text-white">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {sortedAndFilteredOnDutyApprovals.length > 0 ? (
                                            sortedAndFilteredOnDutyApprovals.map((req) => (
                                                <tr key={`o-${req.id}`} className="hover:bg-gray-50 transition-colors">
                                                    {statusFilter === 'Pending' && (
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(`onduty-${req.id}`)}
                                                                onChange={() => handleSelectItem(`onduty-${req.id}`)}
                                                                className="w-4 h-4 rounded accent-[#2E5090]"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#2E5090] font-bold text-sm">
                                                                {req.tblstaff?.firstname?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900">{req.tblstaff?.firstname} {req.tblstaff?.lastname}</p>
                                                                <p className="text-xs text-gray-500">ID: {req.staff_id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm font-medium text-gray-900">{req.client_name}</p>
                                                        <p className="text-xs text-gray-500">{req.location || 'Remote'}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        {new Date(req.start_time).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded text-sm font-medium">
                                                            {calculateOnDutyDuration(req.start_time, req.end_time)}
                                                        </span>
                                                    </td>
                                                    {statusFilter === 'Approved' && (
                                                        <td className="px-6 py-4 text-sm text-gray-700">
                                                            {req.approver ? `${req.approver.firstname} ${req.approver.lastname}` : '-'}
                                                        </td>
                                                    )}
                                                    {statusFilter === 'Rejected' && (
                                                        <td className="px-6 py-4 text-sm text-red-600 italic max-w-xs">{req.rejection_reason || '-'}</td>
                                                    )}
                                                    <td className="px-6 py-4 text-right">
                                                        {!isHistory ? (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'approved', false)}
                                                                    disabled={processingId === `onduty-${req.id}-approved`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `onduty-${req.id}-approved` ? '...' : 'Approve'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'rejected', false)}
                                                                    disabled={processingId === `onduty-${req.id}-rejected`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `onduty-${req.id}-rejected` ? '...' : 'Reject'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-3">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'pending', false)}
                                                                    disabled={processingId === `onduty-${req.id}-pending`}
                                                                    className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                                                    title="Revert to Pending"
                                                                >
                                                                    Revert
                                                                </button>
                                                                {statusFilter === 'Rejected' && user.id === req.manager_id && (
                                                                    <button
                                                                        onClick={() => setEditReasonModal({
                                                                            show: true,
                                                                            item: req,
                                                                            isLeave: false,
                                                                            reason: req.rejection_reason || ''
                                                                        })}
                                                                        className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-sm font-medium transition-colors"
                                                                    >
                                                                        Edit Reason
                                                                    </button>
                                                                )}

                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                                    No on-duty requests found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination Footer */}
                        <div className="bg-white border-t border-gray-200 p-4">
                            <DataTablesFooter pageData={pagination} type={expandedSections.leave ? 'leave' : 'onDuty'} />
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Reason Modal */}
            {rejectionModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-bold">Reject Request</h2>
                            <button onClick={() => setRejectionModal({ ...rejectionModal, show: false })} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">Please provide a reason for rejecting this request.</p>
                            <textarea
                                value={rejectionModal.reason}
                                onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                rows="3"
                                placeholder="Reason..."
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setRejectionModal({ ...rejectionModal, show: false })}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (!rejectionModal.reason.trim()) {
                                            setError('Reason is required');
                                            return;
                                        }
                                        performStatusUpdate(rejectionModal.item, 'rejected', rejectionModal.isLeave, rejectionModal.reason);
                                        setRejectionModal({ ...rejectionModal, show: false, reason: '' });
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Reject Request
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Rejection Modal - Simplified */}
            {bulkRejectionModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-bold">Bulk Reject</h2>
                            <button onClick={() => setBulkRejectionModal({ ...bulkRejectionModal, show: false })} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">Rejecting {selectedItems.size} items. Please provide a reason.</p>
                            <textarea
                                value={bulkRejectionModal.reason}
                                onChange={(e) => setBulkRejectionModal({ ...bulkRejectionModal, reason: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                rows="3"
                                placeholder="Reason..."
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setBulkRejectionModal({ ...bulkRejectionModal, show: false })}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => performBulkStatusUpdate('rejected', bulkRejectionModal.reason)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Confirm Rejection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Reason Modal - Simplified */}
            {editReasonModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-bold">Edit Reason</h2>
                            <button onClick={() => setEditReasonModal({ ...editReasonModal, show: false })} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={editReasonModal.reason}
                                onChange={(e) => setEditReasonModal({ ...editReasonModal, reason: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows="3"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setEditReasonModal({ ...editReasonModal, show: false })}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        updateRejectionReason(editReasonModal.item, editReasonModal.isLeave, editReasonModal.reason);
                                        setEditReasonModal({ ...editReasonModal, show: false });
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const calculateDaysOfLeave = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        // In JavaScript: Sunday = 0, Monday = 1, ..., Saturday = 6
        // Exclude Sunday (0)
        if (current.getDay() !== 0) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
};

const calculateOnDutyDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'In Progress';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
};

const formatApprovalDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' +
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default Approvals;
