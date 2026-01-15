
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
        onDuty: true
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

    const SortableHeader = ({ label, sortKey, sortConfig, setSortConfig }) => (
        <th 
            onClick={() => {
                const newDirection = sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'desc' : 'asc';
                setSortConfig({ key: sortKey, direction: newDirection });
            }}
            className="px-6 py-3 text-left text-sm font-semibold text-white cursor-pointer hover:bg-[#1e3a5f] transition-all"
        >
            <div className="flex items-center gap-2">
                {label}
                <span className="text-xs text-blue-100">
                    {sortConfig.key === sortKey ? (
                        sortConfig.direction === 'asc' ? '↑' : '↓'
                    ) : (
                        '⇅'
                    )}
                </span>
            </div>
        </th>
    );

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

    const getStatusIcon = (status) => {
        if (status === 'Approved') return '✅';
        if (status === 'Rejected') return '❌';
        return '⏳';
    };

    const getStatusColor = (status) => {
        if (status === 'Approved') return { bg: 'bg-green-50', border: 'border-green-200' };
        if (status === 'Rejected') return { bg: 'bg-red-50', border: 'border-red-200' };
        return { bg: 'bg-yellow-50', border: 'border-yellow-200' };
    };

    const renderCompactCard = (request, isLeave, index) => {
        const staffName = request.tblstaff ? `${request.tblstaff.firstname} ${request.tblstaff.lastname}` : 'Unknown';
        const statusColor = getStatusColor(request.status);
        
        return (
            <tr key={`${isLeave ? 'leave' : 'onduty'}-${request.id}`} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                {statusFilter === 'Pending' && (
                    <td className="px-6 py-4 text-sm font-medium text-gray-600 w-12">
                        <input
                            type="checkbox"
                            checked={selectedItems.has(`${isLeave ? 'leave' : 'onduty'}-${request.id}`)}
                            onChange={() => handleSelectItem(`${isLeave ? 'leave' : 'onduty'}-${request.id}`)}
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-[#2E5090]"
                        />
                    </td>
                )}
                <td className="px-6 py-4 text-sm font-medium text-gray-600">{index + 1}</td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">{staffName}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                    {isLeave ? request.leave_type : request.client_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {isLeave 
                        ? `${calculateDaysOfLeave(request.start_date, request.end_date)} days`
                        : calculateOnDutyDuration(request.start_time, request.end_time)
                    }
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                    {isLeave 
                        ? `${request.start_date} - ${request.end_date}`
                        : `${new Date(request.start_time).toLocaleDateString()} ${new Date(request.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(request.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    }
                </td>
                {isHistory && request.status === 'Rejected' && statusFilter === 'Rejected' && (
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                        {request.rejection_reason ? (
                            <div className="bg-red-50 border border-red-200 rounded p-2 text-red-800 text-xs italic flex items-start justify-between gap-2">
                                <span>"{request.rejection_reason}"</span>
                                {request.manager_id === user.id && (
                                    <button
                                        onClick={() => setEditReasonModal({
                                            show: true,
                                            item: request,
                                            isLeave: isLeave,
                                            reason: request.rejection_reason
                                        })}
                                        className="text-red-600 hover:text-red-800 font-medium flex-shrink-0"
                                        title="Edit rejection reason"
                                    >
                                        ✎
                                    </button>
                                )}
                            </div>
                        ) : (
                            <span className="text-gray-400">—</span>
                        )}
                    </td>
                )}
                {isHistory && statusFilter === 'Approved' && (
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {formatApprovalDate(request.updatedAt)}
                    </td>
                )}
                {isHistory && statusFilter === 'Rejected' && (
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {formatApprovalDate(request.updatedAt)}
                    </td>
                )}
                {isHistory && (
                    <td className="px-6 py-4 text-sm text-gray-700">
                        {request.approver ? (
                            <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{request.approver.firstname} {request.approver.lastname}</span>
                                {request.approver.email && <span className="text-xs text-blue-600">{request.approver.email}</span>}
                            </div>
                        ) : (
                            <span className="text-gray-400 italic">—</span>
                        )}
                    </td>
                )}
                {!isHistory && (
                    <td className="px-6 py-4 flex gap-2">
                        <button
                            onClick={() => handleUpdateStatus(request, 'rejected', isLeave)}
                            disabled={processingId === `${isLeave ? 'leave' : 'onduty'}-${request.id}-rejected`}
                            className="px-3 py-1 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center gap-2 min-w-fit"
                            title="Reject"
                        >
                            {processingId === `${isLeave ? 'leave' : 'onduty'}-${request.id}-rejected` ? (
                                <>
                                    <span className="inline-block w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
                                    <span>Processing...</span>
                                </>
                            ) : (
                                'Reject'
                            )}
                        </button>
                        <button
                            onClick={() => handleUpdateStatus(request, 'approved', isLeave)}
                            disabled={processingId === `${isLeave ? 'leave' : 'onduty'}-${request.id}-approved`}
                            className="px-3 py-1 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center gap-2 min-w-fit"
                            title="Approve"
                        >
                            {processingId === `${isLeave ? 'leave' : 'onduty'}-${request.id}-approved` ? (
                                <>
                                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    <span>Processing...</span>
                                </>
                            ) : (
                                'Approve'
                            )}
                        </button>
                    </td>
                )}
            </tr>
        );
    };

    const renderApprovalsList = (items, isLeave) => {
        return (
            <div className="grid gap-5">
                {items.length > 0 ? (
                    items.map((request) => {
                        const staffName = request.tblstaff ? `${request.tblstaff.firstname} ${request.tblstaff.lastname}` : 'Unknown';
                        const isApproved = request.status === 'Approved';
                        const isRejected = request.status === 'Rejected';
                        const isPending = request.status === 'Pending';
                        
                        let headerBg, headerBorder, statusBadgeColor;
                        if (isApproved) {
                            headerBg = 'bg-gradient-to-r from-emerald-50 to-emerald-25';
                            headerBorder = 'border-emerald-200';
                            statusBadgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-300';
                        } else if (isRejected) {
                            headerBg = 'bg-gradient-to-r from-red-50 to-rose-25';
                            headerBorder = 'border-red-200';
                            statusBadgeColor = 'bg-red-100 text-red-700 border-red-300';
                        } else {
                            headerBg = 'bg-gradient-to-r from-blue-50 to-cyan-25';
                            headerBorder = 'border-blue-200';
                            statusBadgeColor = 'bg-blue-100 text-blue-700 border-blue-300';
                        }

                        return (
                            <div key={`${isLeave ? 'leave' : 'onduty'}-${request.id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                                {/* Header Section */}
                                <div className={`${headerBg} border-b ${headerBorder} px-6 py-4`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2E5090] to-[#3D6DB3] flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
                                                {staffName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">{staffName}</h3>
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${isLeave ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-violet-50 text-violet-700 border-violet-300'}`}>
                                                        {isLeave ? '📋 ' + request.leave_type : '🏢 On-Duty'}
                                                    </span>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeColor}`}>
                                                        {isApproved && '✅ Approved'}
                                                        {isRejected && '❌ Rejected'}
                                                        {isPending && '⏳ Pending'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {isHistory && (
                                            <button
                                                onClick={() => handleUpdateStatus(request, 'pending', isLeave)}
                                                disabled={processingId === `${isLeave ? 'leave' : 'onduty'}-${request.id}`}
                                                className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all disabled:opacity-50"
                                                title="Unapprove (Revert to Pending)"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Details Section */}
                                <div className="px-6 py-5">
                                    {isLeave ? (
                                        <div className="space-y-4">
                                            {/* Date Range */}
                                            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                                                <span className="text-xl">📅</span>
                                                <div className="flex-1">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</p>
                                                    <p className="text-gray-900 font-medium mt-1">
                                                        {request.start_date} <span className="text-gray-400">→</span> {request.end_date}
                                                    </p>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        <span className="inline-block px-2.5 py-1 bg-[#2E5090] text-white rounded-md font-bold text-xs">
                                                            {calculateDaysOfLeave(request.start_date, request.end_date)} {calculateDaysOfLeave(request.start_date, request.end_date) === 1 ? 'day' : 'days'}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Reason */}
                                            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                                                <span className="text-xl">💬</span>
                                                <div className="flex-1">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</p>
                                                    <p className="text-gray-900 font-medium mt-1">{request.reason || 'No reason provided'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Date and Time */}
                                            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                                                <span className="text-xl">📅</span>
                                                <div className="flex-1">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date & Time</p>
                                                    <p className="text-gray-900 font-medium mt-1">
                                                        {new Date(request.start_time).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </p>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        ⏰ {new Date(request.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {request.end_time && (
                                                            <span> - {new Date(request.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        )}
                                                    </p>
                                                    <p className="text-sm font-semibold text-[#2E5090] mt-2">
                                                        ⏱ {calculateOnDutyDuration(request.start_time, request.end_time)} duration
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Client and Location */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                                                    <span className="text-xl">🏢</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</p>
                                                        <p className="text-gray-900 font-medium mt-1 truncate">{request.client_name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                                                    <span className="text-xl">📍</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</p>
                                                        <p className="text-gray-900 font-medium mt-1 truncate">{request.location}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Rejection Reason */}
                                    {request.rejection_reason && (
                                        <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                                            <span className="text-xl">⚠️</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Rejection Reason</p>
                                                <p className="text-red-700 font-medium mt-2">{request.rejection_reason}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Approved By */}
                                    {isHistory && request.approver && (
                                        <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                                            <span className="text-xl">👤</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Approved By</p>
                                                <p className="text-gray-900 font-medium mt-2">
                                                    {request.approver.firstname} {request.approver.lastname}
                                                </p>
                                                {request.approver.email && (
                                                    <p className="text-sm text-blue-600 mt-1">{request.approver.email}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                {!isHistory && (
                                    <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
                                        <button
                                            onClick={() => handleUpdateStatus(request, 'rejected', isLeave)}
                                            disabled={processingId === `${isLeave ? 'leave' : 'onduty'}-${request.id}`}
                                            className="px-4 py-2.5 rounded-lg border-2 border-red-300 text-red-700 bg-white hover:bg-red-50 transition-colors disabled:opacity-50 font-semibold text-sm shadow-sm hover:shadow-md"
                                            title="Reject"
                                        >
                                            ❌ Reject
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(request, 'approved', isLeave)}
                                            disabled={processingId === `${isLeave ? 'leave' : 'onduty'}-${request.id}`}
                                            className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-md hover:shadow-lg font-semibold text-sm"
                                            title="Approve"
                                        >
                                            {processingId === `${isLeave ? 'leave' : 'onduty'}-${request.id}` ? '⏳ Processing...' : '✅ Approve'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                        <div className="text-5xl mb-4">✨</div>
                        <p className="text-gray-600 font-semibold text-base mb-1">No {statusFilter.toLowerCase()} requests</p>
                        <p className="text-gray-500 text-sm">All clear! You're all caught up.</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Approvals & Requests</h1>
                        <p className="text-gray-600 mt-1">
                            Manage and view {statusFilter.toLowerCase()} leave and on-duty requests
                        </p>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
                    {['Pending', 'Approved', 'Rejected'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setStatusFilter(tab)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${statusFilter === tab
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium">⚠️ {error}</p>
                </div>
            )}

            {loading ? (
                <ModernLoader size="lg" message="Loading Approvals..." />
            ) : (
                <>
                    {/* Tab Navigation */}
                    <div className="flex gap-1 mb-8 border-b-2 border-gray-200">
                        <button
                            onClick={() => {
                                setExpandedSections({ leave: true, onDuty: false });
                            }}
                            className={`px-6 py-4 font-semibold transition-all border-b-3 relative flex items-center gap-2 ${
                                expandedSections.leave
                                    ? 'border-[#2E5090] text-[#2E5090]'
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <span className="text-lg">📋</span>
                            Leave Requests
                            <span className={`ml-2 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                expandedSections.leave
                                    ? 'bg-blue-100 text-[#2E5090]'
                                    : 'bg-gray-200 text-gray-600'
                            }`}>
                                {leaveApprovals.length}
                            </span>
                        </button>
                        <button
                            onClick={() => {
                                setExpandedSections({ leave: false, onDuty: true });
                            }}
                            className={`px-6 py-4 font-semibold transition-all border-b-3 relative flex items-center gap-2 ${
                                expandedSections.onDuty
                                    ? 'border-[#2E5090] text-[#2E5090]'
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <span className="text-lg">🏢</span>
                            On-Duty Requests
                            <span className={`ml-2 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                expandedSections.onDuty
                                    ? 'bg-blue-100 text-[#2E5090]'
                                    : 'bg-gray-200 text-gray-600'
                            }`}>
                                {onDutyApprovals.length}
                            </span>
                        </button>
                    </div>

                    {/* Bulk Action Bar */}
                    {selectedItems.size > 0 && statusFilter === 'Pending' && (
                        <div className="mb-6 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-[#2E5090] rounded-lg p-4 flex items-center justify-between sticky top-20 z-10 shadow-md">
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-semibold text-[#2E5090]">
                                    {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleBulkAction('approved')}
                                    disabled={bulkProcessing}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {bulkProcessing ? <ModernLoader size="sm" /> : '✅'}
                                    Approve All
                                </button>
                                <button
                                    onClick={() => handleBulkAction('rejected')}
                                    disabled={bulkProcessing}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {bulkProcessing ? <ModernLoader size="sm" /> : '❌'}
                                    Reject All
                                </button>
                                <button
                                    onClick={() => setSelectedItems(new Set())}
                                    disabled={bulkProcessing}
                                    className="px-4 py-2 bg-gray-400 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                                >
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Leave Approvals Section */}
                    {expandedSections.leave && (
                        <div className="space-y-4 mb-8">
                                {/* Filter Controls */}
                                <div className="flex gap-3 flex-wrap items-center bg-white p-3 rounded-lg border border-gray-200">
                                    <div className="flex-1 min-w-48">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                                        <select
                                            value={nameFilter}
                                            onChange={(e) => setNameFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                            {getUniqueNames().map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1 min-w-48">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                                        <select
                                            value={leaveTypeFilter}
                                            onChange={(e) => setLeaveTypeFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                            {getUniqueLeaveTypes().map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {(nameFilter !== 'All' || leaveTypeFilter !== 'All') && (
                                        <button
                                            onClick={() => {
                                                setNameFilter('All');
                                                setLeaveTypeFilter('All');
                                            }}
                                            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>

                                {/* Results Count */}
                                <div className="text-sm text-gray-600">
                                    {pagination.leaveCount > 0 
                                        ? `Total: ${pagination.leaveCount} leave entries`
                                        : 'No leave requests found'
                                    }
                                </div>

                                {/* Table */}
                                <div className="bg-white rounded-lg shadow overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-[#2E5090]">
                                                <tr>
                                                {statusFilter === 'Pending' && (
                                                    <th className="px-6 py-3 text-left text-sm font-semibold text-white whitespace-nowrap w-12">
                                                        <input
                                                            type="checkbox"
                                                            checked={leaveApprovals.length > 0 && leaveApprovals.every(item => selectedItems.has(`leave-${item.id}`))}
                                                            onChange={() => handleSelectAll(true)}
                                                            className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-white"
                                                        />
                                                    </th>
                                                )}
                                                <th className="px-6 py-3 text-left text-sm font-semibold text-white whitespace-nowrap min-w-16">S. No</th>
                                                <SortableHeader label="Name" sortKey="staffName" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                                <SortableHeader label="Leave Type" sortKey="leave_type" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                                <th className="px-6 py-3 text-left text-sm font-semibold text-white">Duration</th>
                                                <SortableHeader label="Dates" sortKey="start_date" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                                {isHistory && statusFilter === 'Rejected' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Rejection Reason</th>}
                                                {isHistory && statusFilter === 'Approved' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Approved On</th>}
                                                {isHistory && statusFilter === 'Rejected' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Rejected On</th>}
                                                {isHistory && <th className="px-6 py-3 text-left text-sm font-semibold text-white">{statusFilter === 'Approved' ? 'Approved By' : statusFilter === 'Rejected' ? 'Rejected By' : 'Approved/Rejected By'}</th>}
                                                {!isHistory && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedAndFilteredLeaveApprovals.length > 0 
                                                ? sortedAndFilteredLeaveApprovals.map((req, idx) => {
                                                    const row = renderCompactCard(req, true, idx);
                                                    return row ? React.cloneElement(row, { className: (row.props.className || '') + ' border-b border-gray-200' }) : null;
                                                })
                                                : <tr>
                                                    <td colSpan={isHistory ? 7 : 7} className="px-6 py-8 text-center text-gray-500">
                                                        {nameFilter !== 'All' || leaveTypeFilter !== 'All' 
                                                            ? 'No matching records found' 
                                                            : `No ${statusFilter.toLowerCase()} requests found`
                                                        }
                                                    </td>
                                                </tr>
                                            }
                                        </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* DataTables Footer */}
                                <DataTablesFooter pageData={pagination} type="leave" />
                            </div>
                        )}

                    {/* On-Duty Approvals Section */}
                    {expandedSections.onDuty && (
                        <div className="space-y-4">
                                {/* Filter Controls */}
                                <div className="flex gap-3 flex-wrap items-center bg-white p-3 rounded-lg border border-gray-200">
                                    <div className="flex-1 min-w-48">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                                        <select
                                            value={nameFilter}
                                            onChange={(e) => setNameFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                        >
                                            {getUniqueNames().map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {nameFilter !== 'All' && (
                                        <button
                                            onClick={() => setNameFilter('All')}
                                            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>

                                {/* Results Count */}
                                <div className="text-sm text-gray-600">
                                    {pagination.onDutyCount > 0 
                                        ? `Total: ${pagination.onDutyCount} on-duty entries`
                                        : 'No on-duty requests found'
                                    }
                                </div>

                                {/* Table */}
                                <div className="bg-white rounded-lg shadow overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-[#2E5090]">
                                                <tr>
                                                {statusFilter === 'Pending' && (
                                                    <th className="px-6 py-3 text-left text-sm font-semibold text-white whitespace-nowrap w-12">
                                                        <input
                                                            type="checkbox"
                                                            checked={onDutyApprovals.length > 0 && onDutyApprovals.every(item => selectedItems.has(`onduty-${item.id}`))}
                                                            onChange={() => handleSelectAll(false)}
                                                            className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-white"
                                                        />
                                                    </th>
                                                )}
                                                <th className="px-6 py-3 text-left text-sm font-semibold text-white whitespace-nowrap min-w-16">S. No</th>
                                                <SortableHeader label="Name" sortKey="staffName" sortConfig={onDutySortConfig} setSortConfig={setOnDutySortConfig} />
                                                <SortableHeader label="Client" sortKey="client_name" sortConfig={onDutySortConfig} setSortConfig={setOnDutySortConfig} />
                                                <th className="px-6 py-3 text-left text-sm font-semibold text-white">Duration</th>
                                                <SortableHeader label="Date" sortKey="start_time" sortConfig={onDutySortConfig} setSortConfig={setOnDutySortConfig} />
                                                {isHistory && statusFilter === 'Rejected' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Rejection Reason</th>}
                                                {isHistory && statusFilter === 'Approved' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Approved On</th>}
                                                {isHistory && statusFilter === 'Rejected' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Rejected On</th>}
                                                {isHistory && <th className="px-6 py-3 text-left text-sm font-semibold text-white">{statusFilter === 'Approved' ? 'Approved By' : statusFilter === 'Rejected' ? 'Rejected By' : 'Approved/Rejected By'}</th>}
                                                {!isHistory && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedAndFilteredOnDutyApprovals.length > 0 
                                                ? sortedAndFilteredOnDutyApprovals.map((req, idx) => renderCompactCard(req, false, idx))
                                                : <tr>
                                                    <td colSpan={isHistory ? 7 : 7} className="text-center py-8 text-gray-500">
                                                        {nameFilter !== 'All' 
                                                            ? 'No matching on-duty requests found' 
                                                            : `No ${statusFilter.toLowerCase()} requests found`
                                                        }
                                                    </td>
                                                </tr>
                                            }
                                        </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* DataTables Footer */}
                                <DataTablesFooter pageData={pagination} type="onDuty" />
                            </div>
                        )}
                </>
            )}

            {/* Rejection Reason Modal */}
            {rejectionModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="bg-red-50 border-b border-red-200 px-6 py-4">
                            <h2 className="text-lg font-bold text-red-900">Reject {rejectionModal.isLeave ? 'Leave Request' : 'On-Duty Request'}</h2>
                            <p className="text-sm text-red-700 mt-1">Please provide a reason for rejection</p>
                        </div>
                        <div className="p-6">
                            <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                                {rejectionModal.isLeave ? (
                                    <>
                                        <p className="text-sm text-gray-600"><strong>Staff:</strong> {rejectionModal.item?.tblstaff?.firstname} {rejectionModal.item?.tblstaff?.lastname}</p>
                                        <p className="text-sm text-gray-600"><strong>Leave Type:</strong> {rejectionModal.item?.leave_type}</p>
                                        <p className="text-sm text-gray-600"><strong>Period:</strong> {rejectionModal.item?.start_date} to {rejectionModal.item?.end_date}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-600"><strong>Staff:</strong> {rejectionModal.item?.tblstaff?.firstname} {rejectionModal.item?.tblstaff?.lastname}</p>
                                        <p className="text-sm text-gray-600"><strong>Client:</strong> {rejectionModal.item?.client_name}</p>
                                        <p className="text-sm text-gray-600"><strong>Location:</strong> {rejectionModal.item?.location}</p>
                                    </>
                                )}
                            </div>
                            <textarea
                                value={rejectionModal.reason}
                                onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
                                placeholder="Enter the reason for rejection..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                                rows="4"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRejectionModal({ ...rejectionModal, show: false, reason: '' })}
                                    disabled={processingId === `${rejectionModal.isLeave ? 'leave' : 'onduty'}-${rejectionModal.item?.id}-rejected`}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!rejectionModal.reason.trim()) {
                                            setError('Please provide a reason for rejection');
                                            return;
                                        }
                                        await performStatusUpdate(rejectionModal.item, 'rejected', rejectionModal.isLeave, rejectionModal.reason);
                                        setRejectionModal({ ...rejectionModal, show: false, reason: '' });
                                    }}
                                    disabled={processingId === `${rejectionModal.isLeave ? 'leave' : 'onduty'}-${rejectionModal.item?.id}-rejected`}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                                >
                                    {processingId === `${rejectionModal.isLeave ? 'leave' : 'onduty'}-${rejectionModal.item?.id}-rejected` ? (
                                        <>
                                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        'Confirm Rejection'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Rejection Modal */}
            {bulkRejectionModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="bg-red-50 border-b border-red-200 px-6 py-4">
                            <h2 className="text-lg font-bold text-red-900">Bulk Reject Requests</h2>
                            <p className="text-sm text-red-700 mt-1">Rejecting {selectedItems.size} selected item{selectedItems.size !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="p-6">
                            <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                                <p className="text-sm text-gray-600"><strong>Selected Items:</strong> {selectedItems.size}</p>
                                <p className="text-sm text-gray-600 mt-2">All selected requests will be rejected with the same reason.</p>
                            </div>
                            <textarea
                                value={bulkRejectionModal.reason}
                                onChange={(e) => setBulkRejectionModal({ ...bulkRejectionModal, reason: e.target.value })}
                                placeholder="Enter the reason for rejection..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                                rows="4"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setBulkRejectionModal({ show: false, reason: '', action: null })}
                                    disabled={bulkProcessing}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!bulkRejectionModal.reason.trim()) {
                                            setError('Please provide a reason for rejection');
                                            return;
                                        }
                                        await performBulkStatusUpdate('rejected', bulkRejectionModal.reason);
                                    }}
                                    disabled={bulkProcessing}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                                >
                                    {bulkProcessing ? (
                                        <>
                                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        'Confirm Bulk Rejection'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Rejection Reason Modal */}
            {editReasonModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="bg-orange-50 border-b border-orange-200 px-6 py-4">
                            <h2 className="text-lg font-bold text-orange-900">Edit Rejection Reason</h2>
                            <p className="text-sm text-orange-700 mt-1">Update the reason for rejection</p>
                        </div>
                        <div className="p-6">
                            <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                                {editReasonModal.isLeave ? (
                                    <>
                                        <p className="text-sm text-gray-600"><strong>Staff:</strong> {editReasonModal.item?.tblstaff?.firstname} {editReasonModal.item?.tblstaff?.lastname}</p>
                                        <p className="text-sm text-gray-600"><strong>Leave Type:</strong> {editReasonModal.item?.leave_type}</p>
                                        <p className="text-sm text-gray-600"><strong>Period:</strong> {editReasonModal.item?.start_date} to {editReasonModal.item?.end_date}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-600"><strong>Staff:</strong> {editReasonModal.item?.tblstaff?.firstname} {editReasonModal.item?.tblstaff?.lastname}</p>
                                        <p className="text-sm text-gray-600"><strong>Client:</strong> {editReasonModal.item?.client_name}</p>
                                        <p className="text-sm text-gray-600"><strong>Location:</strong> {editReasonModal.item?.location}</p>
                                    </>
                                )}
                            </div>
                            <textarea
                                value={editReasonModal.reason}
                                onChange={(e) => setEditReasonModal({ ...editReasonModal, reason: e.target.value })}
                                placeholder="Enter the rejection reason..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
                                rows="4"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setEditReasonModal({ ...editReasonModal, show: false })}
                                    disabled={processingId === `${editReasonModal.isLeave ? 'leave' : 'onduty'}-${editReasonModal.item?.id}-edit`}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!editReasonModal.reason.trim()) {
                                            setError('Please provide a reason');
                                            return;
                                        }
                                        await updateRejectionReason(editReasonModal.item, editReasonModal.isLeave, editReasonModal.reason);
                                        setEditReasonModal({ ...editReasonModal, show: false });
                                    }}
                                    disabled={processingId === `${editReasonModal.isLeave ? 'leave' : 'onduty'}-${editReasonModal.item?.id}-edit`}
                                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                                >
                                    {processingId === `${editReasonModal.isLeave ? 'leave' : 'onduty'}-${editReasonModal.item?.id}-edit` ? (
                                        <>
                                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        'Save Changes'
                                    )}
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
