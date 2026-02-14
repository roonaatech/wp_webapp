
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuClock, LuCheck, LuX, LuChevronDown, LuChevronUp, LuSearch, LuFilter, LuArrowUpDown } from "react-icons/lu";
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import OnDutyLocationMap from '../components/OnDutyLocationMap';
import { calculateLeaveDays } from '../utils/dateUtils';
import { fetchRoles, canApproveLeave, canApproveOnDuty } from '../utils/roleUtils';

// Helper to format dates without timezone conversion
const formatDateLocal = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return new Date(dateStr).toLocaleDateString();
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString();
};


const Approvals = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [leaveApprovals, setLeaveApprovals] = useState([]);
    const [onDutyApprovals, setOnDutyApprovals] = useState([]);
    const [timeOffApprovals, setTimeOffApprovals] = useState([]); // New State
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [error, setError] = useState(null);
    const [expandedSections, setExpandedSections] = useState({
        leave: true,
        onDuty: false,
        timeOff: false // New Section
    });
    const [leaveTypeFilter, setLeaveTypeFilter] = useState('All');
    const [nameFilter, setNameFilter] = useState('All');
    const [leaveSortConfig, setLeaveSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [onDutySortConfig, setOnDutySortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [timeOffSortConfig, setTimeOffSortConfig] = useState({ key: 'createdAt', direction: 'desc' }); // New Sort Config
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
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Modals State
    const [detailsModal, setDetailsModal] = useState({ show: false, item: null, type: null });
    const [rejectionModal, setRejectionModal] = useState({ show: false, item: null, type: null, reason: '', showError: false });
    const [confirmationModal, setConfirmationModal] = useState({
        show: false,
        title: '',
        message: '',
        confirmText: '',
        confirmButtonColor: '',
        action: null
    });
    const [editReasonModal, setEditReasonModal] = useState({ show: false, item: null, type: null, reason: '' });

    // Bulk Action State
    const [bulkRejectionModal, setBulkRejectionModal] = useState({ show: false, reason: '', action: '', showError: false });
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const checkPermission = async () => {
            const token = localStorage.getItem('token');
            const userStr = localStorage.getItem('user');

            if (!token || !userStr) {
                navigate('/login');
                return;
            }

            try {
                const user = JSON.parse(userStr);
                setCurrentUser(user);
                await fetchRoles(); // Ensure roles are loaded

                const canApproveL = canApproveLeave(user.role);
                const canApproveOD = canApproveOnDuty(user.role);

                if (!canApproveL && !canApproveOD) {
                    toast.error('You do not have permission to access the approvals page');
                    navigate('/dashboard');
                    return;
                }

                setHasPermission(true);
            } catch (error) {
                console.error('Error checking permissions:', error);
                navigate('/login');
            } finally {
                setPermissionChecked(true);
            }
        };

        checkPermission();
    }, [navigate]);

    useEffect(() => {
        if (permissionChecked && hasPermission) {
            fetchApprovals(currentPage);
        }
    }, [permissionChecked, hasPermission, statusFilter, rowsPerPage, currentPage]);

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

            // Separate requests
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
                    updatedAt: item.updatedAt,
                    start_lat: item.start_lat,
                    start_long: item.start_long,
                    end_lat: item.end_lat,
                    end_long: item.end_long
                };
            });

            const timeOff = allRequests.filter(item => item.type === 'time_off').map(item => ({
                id: item.id,
                staff_id: item.staff_id,
                tblstaff: item.tblstaff,
                // Time-Off specific fields parsing
                type: 'time_off',
                date: item.date,
                start_time: item.start_time,
                end_time: item.end_time,
                reason: item.reason.replace(`${item.start_time} - ${item.end_time}: `, ''), // content comes formatted from backend
                status: item.status,
                rejection_reason: item.rejection_reason,
                manager_id: item.manager_id,
                approver: item.approver,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            }));

            setLeaveApprovals(leaves);
            setOnDutyApprovals(onDuty);
            setTimeOffApprovals(timeOff); // Set new state
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

    const handleUpdateStatus = async (item, status, type) => {
        // type: 'leave' | 'onduty' | 'timeoff'
        // If rejecting, show modal to get reason
        if (status === 'rejected') {
            setRejectionModal({
                show: true,
                item: item,
                type: type, // 'leave', 'onduty', 'timeoff'
                reason: '',
                showError: false
            });
            return;
        }

        if (status === 'approved') {
            const employeeName = `${item.tblstaff?.firstname} ${item.tblstaff?.lastname}`;
            const typeLabel = type === 'leave' ? 'Leave' : (type === 'timeoff' ? 'Time-Off' : 'On-Duty');
            setConfirmationModal({
                show: true,
                title: 'Confirm Approval',
                message: `Are you sure you want to approve this ${typeLabel} request for ${employeeName}?`,
                confirmText: 'Approve',
                confirmButtonColor: 'bg-green-600 hover:bg-green-700',
                action: () => performStatusUpdate(item, status, type, null)
            });
            return;
        }

        // For pending (revert), also ask for confirmation
        if (status === 'pending') {
            setConfirmationModal({
                show: true,
                title: 'Revert to Pending',
                message: 'Are you sure you want to move this request back to pending status?',
                confirmText: 'Revert',
                confirmButtonColor: 'bg-red-600 hover:bg-red-700',
                action: () => performStatusUpdate(item, status, type, null)
            });
            return;
        }

        // Proceed directly
        await performStatusUpdate(item, status, type, null);
    };

    const performStatusUpdate = async (item, status, type, rejectionReason = null) => {
        const itemKey = `${type}-${item.id}-${status}`;
        setProcessingId(itemKey);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found.');
                setProcessingId(null);
                return;
            }

            let endpoint = '';
            if (type === 'leave') endpoint = `${API_BASE_URL}/api/leave/${item.id}/status`;
            else if (type === 'timeoff') endpoint = `${API_BASE_URL}/api/timeoff/${item.id}/status`;
            else endpoint = `${API_BASE_URL}/api/onduty/${item.id}/status`;

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
            if (type === 'leave') {
                setLeaveApprovals(leaveApprovals.filter(a => a.id !== item.id));
            } else if (type === 'timeoff') {
                setTimeOffApprovals(timeOffApprovals.filter(a => a.id !== item.id));
            } else {
                setOnDutyApprovals(onDutyApprovals.filter(a => a.id !== item.id));
            }

            // Dispatch event to notify Header
            window.dispatchEvent(new Event('approvalStatusChanged'));

            setError(null);
            const employeeName = item.tblstaff ? `${item.tblstaff.firstname} ${item.tblstaff.lastname}` : 'Request';
            const typeLabel = type === 'leave' ? 'leave' : (type === 'timeoff' ? 'time-off' : 'on-duty');
            toast.success(`${employeeName}'s ${typeLabel} ${statusStr.toLowerCase()} successfully`, {
                style: {
                    background: statusStr === 'Approved' ? '#059669' : '#dc2626',
                    color: '#fff'
                }
            });
        } catch (error) {
            console.error('Error updating status:', error);
            const errorMsg = error.response?.data?.message || 'Failed to update request';
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setProcessingId(null);
        }
    };

    const handleOpenDetails = (item, type) => {
        setDetailsModal({
            show: true,
            item: item,
            type: type // 'leave', 'onduty', 'timeoff'
        });
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

    const handleSelectAll = (type) => {
        // type: 'leave', 'onduty', 'timeoff'
        let items = [];
        if (type === 'leave') items = leaveApprovals;
        else if (type === 'timeoff') items = timeOffApprovals;
        else items = onDutyApprovals;

        const newSelected = new Set(selectedItems);

        const allKeys = items.map(item => `${type}-${item.id}`);
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
            setBulkRejectionModal({ show: true, reason: '', action: 'rejected', showError: false });
        } else {
            setConfirmationModal({
                show: true,
                title: 'Bulk Approval',
                message: `Are you sure you want to approve all ${selectedItems.size} selected items?`,
                confirmText: 'Approve All',
                confirmButtonColor: 'bg-green-600 hover:bg-green-700',
                action: () => performBulkStatusUpdate('approved')
            });
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
                let items = [];
                if (type === 'leave') items = leaveApprovals;
                else if (type === 'timeoff') items = timeOffApprovals;
                else items = onDutyApprovals;

                const item = items.find(i => i.id === parseInt(id));
                return { item, type };
            }).filter(u => u.item); // Filter out any undefined items

            for (const { item, type } of updates) {
                let endpoint = '';
                if (type === 'leave') endpoint = `${API_BASE_URL}/api/leave/${item.id}/status`;
                else if (type === 'timeoff') endpoint = `${API_BASE_URL}/api/timeoff/${item.id}/status`;
                else endpoint = `${API_BASE_URL}/api/onduty/${item.id}/status`;

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
            setLeaveApprovals(prev => prev.filter(a => !selectedItems.has(`leave-${a.id}`)));
            setTimeOffApprovals(prev => prev.filter(a => !selectedItems.has(`timeoff-${a.id}`)));
            setOnDutyApprovals(prev => prev.filter(a => !selectedItems.has(`onduty-${a.id}`)));
            setSelectedItems(new Set());
            setBulkRejectionModal({ show: false, reason: '', action: null });

            window.dispatchEvent(new Event('approvalStatusChanged'));
            setError(null);
            const actionStr = status === 'approved' ? 'approved' : 'rejected';
            toast.success(`${updates.length} request(s) ${actionStr} successfully!`, {
                style: {
                    background: status === 'approved' ? '#059669' : '#dc2626',
                    color: '#fff'
                }
            });
        } catch (error) {
            console.error('Error performing bulk update:', error);
            const errorMsg = error.response?.data?.message || 'Failed to perform bulk action';
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setBulkProcessing(false);
        }
    };

    const updateRejectionReason = async (item, type, newReason) => {
        const itemKey = `${type}-${item.id}-edit`;
        setProcessingId(itemKey);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found.');
                setProcessingId(null);
                return;
            }

            let endpoint = '';
            if (type === 'leave') endpoint = `${API_BASE_URL}/api/leave/${item.id}/status`;
            else if (type === 'timeoff') endpoint = `${API_BASE_URL}/api/timeoff/${item.id}/status`;
            else endpoint = `${API_BASE_URL}/api/onduty/${item.id}/status`;

            // Update only the rejection_reason without changing the status
            await axios.put(endpoint,
                { rejection_reason: newReason },
                { headers: { 'x-access-token': token } }
            );

            // Update local state - update the item's rejection_reason
            if (type === 'leave') {
                setLeaveApprovals(leaveApprovals.map(a =>
                    a.id === item.id ? { ...a, rejection_reason: newReason } : a
                ));
            } else if (type === 'timeoff') {
                setTimeOffApprovals(timeOffApprovals.map(a =>
                    a.id === item.id ? { ...a, rejection_reason: newReason } : a
                ));
            } else {
                setOnDutyApprovals(onDutyApprovals.map(a =>
                    a.id === item.id ? { ...a, rejection_reason: newReason } : a
                ));
            }
            setError(null);
            const name = item.tblstaff ? `${item.tblstaff.firstname}` : 'Request';
            toast.success(`Updated rejection reason for ${name}`, {
                style: {
                    background: '#2563eb', // Blue for updates
                    color: '#fff'
                }
            });
        } catch (error) {
            console.error('Error updating rejection reason:', error);
            const errorMsg = error.response?.data?.message || 'Failed to update rejection reason';
            setError(errorMsg);
            toast.error(errorMsg);
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

    const filteredTimeOffApprovals = timeOffApprovals.filter(item => { // New Filter
        const staffName = item.tblstaff ? `${item.tblstaff.firstname} ${item.tblstaff.lastname}` : '';
        const matchesName = nameFilter === 'All' || staffName === nameFilter;
        return matchesName;
    });

    // Apply sorting to filtered data
    const sortedAndFilteredLeaveApprovals = sortData(filteredLeaveApprovals, leaveSortConfig.key, leaveSortConfig.direction);
    const sortedAndFilteredOnDutyApprovals = sortData(filteredOnDutyApprovals, onDutySortConfig.key, onDutySortConfig.direction);
    const sortedAndFilteredTimeOffApprovals = sortData(filteredTimeOffApprovals, timeOffSortConfig.key, timeOffSortConfig.direction); // New Sort

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
            <div className="mt-4 flex items-center justify-between bg-[var(--header-bg)] p-3 rounded-xl border border-[var(--border-color)]">
                <div className="text-sm text-[var(--text-muted)] font-medium">
                    Showing <span className="text-[var(--text-main)] font-bold">{startIdx}</span> to <span className="text-[var(--text-main)] font-bold">{endIdx}</span> of <span className="text-[var(--text-main)] font-bold">{totalCount}</span> {type === 'leave' ? 'leave' : 'on-duty'} entries
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchApprovals(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-main)] rounded-lg text-sm font-bold hover:bg-[var(--bg-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        ← Previous
                    </button>
                    <button
                        onClick={() => fetchApprovals(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-main)] rounded-lg text-sm font-bold hover:bg-[var(--bg-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                    }}
                    className="px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-primary)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                </select>
            </div>
        );
    };

    // Show loading while checking permissions
    if (!permissionChecked) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <ModernLoader />
            </div>
        );
    }

    // Don't render if no permission
    if (!hasPermission) {
        return null;
    }

    return (
        <div className="p-6 font-sans min-h-screen bg-[var(--bg-primary)] transition-colors duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-main)]">Approvals & Requests</h1>
                    <p className="text-[var(--text-muted)] mt-1">Manage {statusFilter.toLowerCase()} leave and on-duty requests</p>
                </div>

                {/* Status Tabs */}
                <div className="bg-transparent p-1 inline-flex gap-4">
                    {[
                        { id: 'Pending', icon: <LuClock />, color: 'amber' },
                        { id: 'Approved', icon: <LuCheck />, color: 'emerald' },
                        { id: 'Rejected', icon: <LuX />, color: 'rose' }
                    ].map((tab) => {
                        const isActive = statusFilter === tab.id;
                        const colorClasses = {
                            amber: isActive
                                ? 'bg-amber-500 dark:bg-amber-600 text-white border-0 shadow-lg shadow-amber-500/30'
                                : 'text-black dark:text-black border-2 border-black dark:border-black bg-white dark:bg-white hover:bg-gray-100 dark:hover:bg-gray-100',
                            emerald: isActive
                                ? 'bg-emerald-500 dark:bg-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/30'
                                : 'text-black dark:text-black border-2 border-black dark:border-black bg-white dark:bg-white hover:bg-gray-100 dark:hover:bg-gray-100',
                            rose: isActive
                                ? 'bg-rose-500 dark:bg-rose-600 text-white border-0 shadow-lg shadow-rose-500/30'
                                : 'text-black dark:text-black border-2 border-black dark:border-black bg-white dark:bg-white hover:bg-gray-100 dark:hover:bg-gray-100'
                        };

                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setStatusFilter(tab.id);
                                    setExpandedSections({ leave: true, onDuty: false, timeOff: false });
                                }}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 transform hover:scale-105 ${colorClasses[tab.color]}`}
                            >
                                <span className="text-xl">{tab.icon}</span>
                                {tab.id}
                            </button>
                        );
                    })}
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
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[var(--header-bg)] p-4 rounded-xl shadow-sm border border-[var(--border-color)]">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setExpandedSections({ leave: true, onDuty: false, timeOff: false })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${expandedSections.leave
                                    ? 'bg-[#2E5090] text-white border-[#2E5090] shadow-md transform scale-105'
                                    : 'bg-[var(--header-bg)] text-[var(--text-muted)] border-[var(--border-color)] hover:bg-[var(--bg-primary)]'
                                    }`}
                            >
                                Leave Requests ({pagination.leaveCount !== undefined ? pagination.leaveCount : leaveApprovals.length})
                            </button>
                            <button
                                onClick={() => setExpandedSections({ leave: false, onDuty: false, timeOff: true })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${expandedSections.timeOff
                                    ? 'bg-[#2E5090] text-white border-[#2E5090] shadow-md transform scale-105'
                                    : 'bg-[var(--header-bg)] text-[var(--text-muted)] border-[var(--border-color)] hover:bg-[var(--bg-primary)]'
                                    }`}
                            >
                                Time-Off Requests ({timeOffApprovals.length})
                            </button>
                            <button
                                onClick={() => setExpandedSections({ leave: false, onDuty: true, timeOff: false })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${expandedSections.onDuty
                                    ? 'bg-[#2E5090] text-white border-[#2E5090] shadow-md transform scale-105'
                                    : 'bg-[var(--header-bg)] text-[var(--text-muted)] border-[var(--border-color)] hover:bg-[var(--bg-primary)]'
                                    }`}
                            >
                                On-Duty Requests ({pagination.onDutyCount !== undefined ? pagination.onDutyCount : onDutyApprovals.length})
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {expandedSections.leave && (
                                <select
                                    value={leaveTypeFilter}
                                    onChange={(e) => setLeaveTypeFilter(e.target.value)}
                                    className="px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-main)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {getUniqueLeaveTypes().map(type => (
                                        <option key={type} value={type}>{type === 'All' ? 'All Types' : type}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                className="px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-main)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                                    >
                                        Approve ({selectedItems.size})
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('rejected')}
                                        disabled={bulkProcessing}
                                        className="px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 shadow-lg shadow-rose-500/20"
                                    >
                                        Reject ({selectedItems.size})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="bg-[var(--header-bg)] rounded-xl shadow-lg overflow-hidden border border-[var(--border-color)]">
                        {expandedSections.leave && (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#2E5090] text-white">
                                        <tr>
                                            {statusFilter === 'Pending' && (
                                                <th className="px-6 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        onChange={() => handleSelectAll('leave')}
                                                        checked={leaveApprovals.length > 0 && selectedItems.size === leaveApprovals.map(i => `leave-${i.id}`).filter(k => selectedItems.has(k)).length}
                                                        className="w-4 h-4 rounded accent-blue-600"
                                                    />
                                                </th>
                                            )}
                                            <SortableHeader label="Employee" sortKey="staffName" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                            <SortableHeader label="Leave Type" sortKey="leave_type" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-white">Duration</th>
                                            <SortableHeader label="Period" sortKey="start_date" sortConfig={leaveSortConfig} setSortConfig={setLeaveSortConfig} />
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-white">Reason</th>
                                            {statusFilter === 'Approved' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Approved By</th>}
                                            {statusFilter === 'Rejected' && <th className="px-6 py-3 text-left text-sm font-semibold text-white">Rejection Reason</th>}
                                            <th className="px-6 py-3 text-right text-sm font-semibold text-white">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {sortedAndFilteredLeaveApprovals.length > 0 ? (
                                            sortedAndFilteredLeaveApprovals.map((req) => (
                                                <tr
                                                    key={`l-${req.id}`}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                                    onClick={() => handleOpenDetails(req, 'leave')}
                                                >
                                                    {statusFilter === 'Pending' && (
                                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
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
                                                        {calculateLeaveDays(req.start_date, req.end_date)} Days
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm text-gray-900">
                                                            {req.start_date} <span className="text-gray-400">to</span> {req.end_date}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                                                        <div className="line-clamp-2" title={req.reason}>
                                                            {req.reason || '-'}
                                                        </div>
                                                    </td>
                                                    {statusFilter === 'Approved' && (
                                                        <td className="px-6 py-4 text-sm text-gray-700">
                                                            {req.approver ? `${req.approver.firstname} ${req.approver.lastname}` : '-'}
                                                        </td>
                                                    )}
                                                    {statusFilter === 'Rejected' && (
                                                        <td className="px-6 py-4 text-sm text-red-600 italic max-w-xs" title={req.rejection_reason}>
                                                            {req.rejection_reason && req.rejection_reason.length > 120
                                                                ? `${req.rejection_reason.substring(0, 120)}...`
                                                                : req.rejection_reason || '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        {!isHistory ? (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'approved', 'leave')}
                                                                    disabled={processingId === `leave-${req.id}-approved`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `leave-${req.id}-approved` ? '...' : 'Approve'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'rejected', 'leave')}
                                                                    disabled={processingId === `leave-${req.id}-rejected`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `leave-${req.id}-rejected` ? '...' : 'Reject'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-3">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'pending', 'leave')}
                                                                    disabled={processingId === `leave-${req.id}-pending`}
                                                                    className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                                                    title="Revert to Pending"
                                                                >
                                                                    Revert
                                                                </button>
                                                                {statusFilter === 'Rejected' && req.manager_id && currentUser && (Number(currentUser.id) === Number(req.manager_id) || Number(currentUser.staffid) === Number(req.manager_id)) && (
                                                                    <button
                                                                        onClick={() => setEditReasonModal({
                                                                            show: true,
                                                                            item: req,
                                                                            type: 'leave',
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
                                                <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                                                    No leave requests found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {expandedSections.timeOff && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                                            {statusFilter === 'Pending' && (
                                                <th className="px-6 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        onChange={() => handleSelectAll('timeoff')}
                                                        checked={timeOffApprovals.length > 0 && selectedItems.size === timeOffApprovals.map(i => `timeoff-${i.id}`).filter(k => selectedItems.has(k)).length}
                                                        className="w-4 h-4 rounded accent-blue-600"
                                                    />
                                                </th>
                                            )}
                                            <th className="px-6 py-3">Employee</th>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Duration</th>
                                            <th className="px-6 py-3">Time</th>
                                            <th className="px-6 py-3">Reason</th>
                                            {statusFilter === 'Approved' && <th className="px-6 py-3">Approved By</th>}
                                            {statusFilter === 'Rejected' && <th className="px-6 py-3">Rejection Reason</th>}
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {sortedAndFilteredTimeOffApprovals.length > 0 ? (
                                            sortedAndFilteredTimeOffApprovals.map((req) => (
                                                <tr
                                                    key={`t-${req.id}`}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                                    onClick={() => handleOpenDetails(req, 'timeoff')}
                                                >
                                                    {statusFilter === 'Pending' && (
                                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(`timeoff-${req.id}`)}
                                                                onChange={() => handleSelectItem(`timeoff-${req.id}`)}
                                                                className="w-4 h-4 rounded accent-[#2E5090]"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                                                                {req.tblstaff?.firstname?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900">{req.tblstaff?.firstname} {req.tblstaff?.lastname}</p>
                                                                <p className="text-xs text-gray-500">ID: {req.staff_id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        {formatDateLocal(req.date)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-sm font-medium">
                                                            {calculateTimeOffDuration(req.start_time, req.end_time)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {req.start_time} - {req.end_time}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                                                        <div className="line-clamp-2" title={req.reason}>
                                                            {req.reason || '-'}
                                                        </div>
                                                    </td>
                                                    {statusFilter === 'Approved' && (
                                                        <td className="px-6 py-4 text-sm text-gray-700">
                                                            {req.approver ? `${req.approver.firstname} ${req.approver.lastname}` : '-'}
                                                        </td>
                                                    )}
                                                    {statusFilter === 'Rejected' && (
                                                        <td className="px-6 py-4 text-sm text-red-600 italic max-w-xs" title={req.rejection_reason}>
                                                            {req.rejection_reason && req.rejection_reason.length > 120
                                                                ? `${req.rejection_reason.substring(0, 120)}...`
                                                                : req.rejection_reason || '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        {!isHistory ? (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'approved', 'timeoff')}
                                                                    disabled={processingId === `timeoff-${req.id}-approved`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `timeoff-${req.id}-approved` ? '...' : 'Approve'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'rejected', 'timeoff')}
                                                                    disabled={processingId === `timeoff-${req.id}-rejected`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `timeoff-${req.id}-rejected` ? '...' : 'Reject'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-3">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'pending', 'timeoff')}
                                                                    disabled={processingId === `timeoff-${req.id}-pending`}
                                                                    className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                                                    title="Revert to Pending"
                                                                >
                                                                    Revert
                                                                </button>
                                                                {statusFilter === 'Rejected' && req.manager_id && currentUser && (Number(currentUser.id) === Number(req.manager_id) || Number(currentUser.staffid) === Number(req.manager_id)) && (
                                                                    <button
                                                                        onClick={() => setEditReasonModal({
                                                                            show: true,
                                                                            item: req,
                                                                            type: 'timeoff',
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
                                                <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                                    No time-off requests found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {expandedSections.onDuty && (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#2E5090] text-white">
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
                                                <tr
                                                    key={`o-${req.id}`}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                                    onClick={() => handleOpenDetails(req, 'onduty')}
                                                >
                                                    {statusFilter === 'Pending' && (
                                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
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
                                                        <td className="px-6 py-4 text-sm text-red-600 italic max-w-xs" title={req.rejection_reason}>
                                                            {req.rejection_reason && req.rejection_reason.length > 150
                                                                ? `${req.rejection_reason.substring(0, 150)}...`
                                                                : req.rejection_reason || '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        {!isHistory ? (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'approved', 'onduty')}
                                                                    disabled={processingId === `onduty-${req.id}-approved`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `onduty-${req.id}-approved` ? '...' : 'Approve'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'rejected', 'onduty')}
                                                                    disabled={processingId === `onduty-${req.id}-rejected`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors text-sm font-medium"
                                                                >
                                                                    {processingId === `onduty-${req.id}-rejected` ? '...' : 'Reject'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-3">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req, 'pending', 'onduty')}
                                                                    disabled={processingId === `onduty-${req.id}-pending`}
                                                                    className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                                                    title="Revert to Pending"
                                                                >
                                                                    Revert
                                                                </button>
                                                                {statusFilter === 'Rejected' && req.manager_id && currentUser && (Number(currentUser.id) === Number(req.manager_id) || Number(currentUser.staffid) === Number(req.manager_id)) && (
                                                                    <button
                                                                        onClick={() => setEditReasonModal({
                                                                            show: true,
                                                                            item: req,
                                                                            type: 'onduty',
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn border border-gray-200">
                        <div className="p-6 bg-[#2E5090] text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">Reject Request</h2>
                            <button onClick={() => setRejectionModal({ ...rejectionModal, show: false })} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">✕</button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 font-medium mb-4">Please provide a formal reason for this rejection.</p>
                            <textarea
                                value={rejectionModal.reason}
                                onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value, showError: false })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all font-medium ${rejectionModal.showError ? 'border-red-500 focus:ring-red-500 bg-red-50/30' : 'border-gray-200 focus:ring-[#2E5090] bg-gray-50/30'}`}
                                rows="4"
                                placeholder="State the reason for rejection..."
                            />
                            {rejectionModal.showError && (
                                <p className="text-red-500 text-xs mt-2 font-bold flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                    </svg>
                                    Justification is required for rejection.
                                </p>
                            )}
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setRejectionModal({ ...rejectionModal, show: false })}
                                    className="px-6 py-2.5 text-gray-600 font-bold text-xs uppercase tracking-wider hover:bg-gray-100 rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (!rejectionModal.reason.trim()) {
                                            setRejectionModal({ ...rejectionModal, showError: true });
                                            return;
                                        }
                                        performStatusUpdate(rejectionModal.item, 'rejected', rejectionModal.type, rejectionModal.reason);
                                        setRejectionModal({ ...rejectionModal, show: false, reason: '', showError: false });
                                    }}
                                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all shadow-md shadow-red-100"
                                >
                                    Confirm Rejection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Rejection Modal */}
            {bulkRejectionModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn border border-gray-200">
                        <div className="p-6 bg-[#2E5090] text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">Bulk Rejection</h2>
                            <button onClick={() => setBulkRejectionModal({ ...bulkRejectionModal, show: false })} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">✕</button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 font-medium mb-4">Provide a unified reason for rejecting all selected requests.</p>
                            <textarea
                                value={bulkRejectionModal.reason}
                                onChange={(e) => setBulkRejectionModal({ ...bulkRejectionModal, reason: e.target.value, showError: false })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all font-medium ${bulkRejectionModal.showError ? 'border-red-500 focus:ring-red-500 bg-red-50/30' : 'border-gray-200 focus:ring-[#2E5090] bg-gray-50/30'}`}
                                rows="4"
                                placeholder="Common justification for rejection..."
                            />
                            {bulkRejectionModal.showError && (
                                <p className="text-red-500 text-xs mt-2 font-bold flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                    </svg>
                                    A reason is required for processing.
                                </p>
                            )}
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setBulkRejectionModal({ ...bulkRejectionModal, show: false })}
                                    className="px-6 py-2.5 text-gray-600 font-bold text-xs uppercase tracking-wider hover:bg-gray-100 rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (!bulkRejectionModal.reason.trim()) {
                                            setBulkRejectionModal({ ...bulkRejectionModal, showError: true });
                                            return;
                                        }
                                        performBulkStatusUpdate('rejected', bulkRejectionModal.reason);
                                        setBulkRejectionModal({ ...bulkRejectionModal, show: false, reason: '', showError: false });
                                    }}
                                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all shadow-md"
                                >
                                    Execute Rejection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Reason Modal */}
            {editReasonModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn border border-gray-200">
                        <div className="p-6 bg-[#2E5090] text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">Amend Reason</h2>
                            <button onClick={() => setEditReasonModal({ ...editReasonModal, show: false })} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">✕</button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 font-medium mb-4">Modify the existing rejection reason for this record.</p>
                            <textarea
                                value={editReasonModal.reason}
                                onChange={(e) => setEditReasonModal({ ...editReasonModal, reason: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E5090] bg-gray-50/30 font-medium"
                                rows="4"
                                placeholder="Updated justification..."
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setEditReasonModal({ ...editReasonModal, show: false })}
                                    className="px-6 py-2.5 text-gray-600 font-bold text-xs uppercase tracking-wider hover:bg-gray-100 rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        updateRejectionReason(editReasonModal.item, editReasonModal.type, editReasonModal.reason);
                                        setEditReasonModal({ ...editReasonModal, show: false });
                                    }}
                                    className="px-6 py-2.5 bg-[#2E5090] text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-blue-800 transition-all shadow-md"
                                >
                                    Save Amendments
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmationModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn border border-gray-200">
                        <div className="p-6 bg-[#2E5090] text-white">
                            <h3 className="text-xl font-bold">{confirmationModal.title}</h3>
                        </div>
                        <div className="p-8">
                            <p className="text-gray-600 font-medium leading-relaxed">{confirmationModal.message}</p>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmationModal({ ...confirmationModal, show: false })}
                                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    confirmationModal.action();
                                    setConfirmationModal({ ...confirmationModal, show: false });
                                }}
                                className={`px-6 py-2.5 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-md ${confirmationModal.confirmButtonColor}`}
                            >
                                {confirmationModal.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {detailsModal.show && detailsModal.item && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scaleIn border border-gray-200">
                        {/* Header Panel */}
                        <div className="p-6 bg-[#2E5090] text-white relative">
                            <button
                                onClick={() => setDetailsModal({ ...detailsModal, show: false })}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-bold shadow-inner border border-white/20">
                                    {detailsModal.type === 'leave' ? '📄' : (detailsModal.type === 'timeoff' ? '⏱️' : '📍')}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">
                                        {detailsModal.type === 'leave' ? 'Leave Request Details' : (detailsModal.type === 'timeoff' ? 'Time-Off Details' : 'On-Duty Details')}
                                    </h2>
                                    <p className="text-white/80 text-xs font-semibold tracking-wide">
                                        {detailsModal.type === 'leave' ? 'Leave Application Details' : (detailsModal.type === 'timeoff' ? 'Hourly Permission Details' : 'On-Duty Transaction Details')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-4">
                                <span className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wide border ${detailsModal.item.status === 'Approved' ? 'bg-green-500/20 border-green-400/30 text-green-100' :
                                    detailsModal.item.status === 'Rejected' ? 'bg-red-500/20 border-red-400/30 text-red-100' :
                                        'bg-orange-500/20 border-orange-400/30 text-orange-100'
                                    }`}>
                                    {detailsModal.item.status}
                                </span>
                                <span className="text-[10px] font-semibold text-white/70 tracking-wide">
                                    System ID: {detailsModal.item.id}
                                </span>
                            </div>
                        </div>

                        {/* Content Scrollable */}
                        <div className="p-8 overflow-y-auto hide-scrollbar space-y-8">
                            {/* Employee Header */}
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-[#2E5090]/10 flex items-center justify-center text-xl font-bold text-[#2E5090]">
                                    {detailsModal.item.tblstaff?.firstname?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{detailsModal.item.tblstaff?.firstname} {detailsModal.item.tblstaff?.lastname}</h3>
                                    <p className="text-sm text-gray-500 font-medium">Employee ID: {detailsModal.item.staff_id}</p>
                                </div>
                            </div>

                            {/* Main Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 border-t border-b border-gray-100 py-8">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-[#2E5090] tracking-wide">Category Type</p>
                                    <p className="text-base font-semibold text-gray-900">
                                        {detailsModal.type === 'leave' ? detailsModal.item.leave_type : (detailsModal.type === 'timeoff' ? 'Time-Off' : detailsModal.item.client_name)}
                                    </p>
                                    {detailsModal.type === 'onduty' && (
                                        <p className="text-sm text-[#2E5090] font-medium flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="m9.69 18.94.027.013a2.358 2.358 0 0 0 2.566-.013l.027-.013c.12-.058.214-.144.3-.23.111-.11.23-.235.343-.352l.006-.006c.928-.971 1.636-1.742 2.146-2.583.506-.833.76-1.614.76-2.345 0-2.433-2.029-4.409-4.528-4.409-2.5 0-4.528 1.976-4.528 4.409 0 .731.254 1.512.759 2.345.51.841 1.218 1.612 2.147 2.583l.006.006c.113.117.232.243.343.352.086.086.18.172.3.23ZM10 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                            </svg>
                                            {detailsModal.item.location || 'Client Office'}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-[#2E5090] tracking-wide">Application Period</p>
                                    <p className="text-base font-semibold text-gray-900">
                                        {detailsModal.type === 'leave'
                                            ? `${calculateLeaveDays(detailsModal.item.start_date, detailsModal.item.end_date)} Day(s)`
                                            : (detailsModal.type === 'timeoff'
                                                ? calculateTimeOffDuration(detailsModal.item.start_time, detailsModal.item.end_time)
                                                : calculateOnDutyDuration(detailsModal.item.start_time, detailsModal.item.end_time))
                                        }
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-[#2E5090] tracking-wide">Effective Start</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-semibold text-gray-900">
                                            {detailsModal.type === 'leave'
                                                ? detailsModal.item.start_date
                                                : (detailsModal.type === 'timeoff' ? `${detailsModal.item.start_time} (On ${new Date(detailsModal.item.date).toLocaleDateString()})` : formatApprovalDate(detailsModal.item.start_time))}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-[#2E5090] tracking-wide">Effective End</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-semibold text-gray-900">
                                            {detailsModal.type === 'leave'
                                                ? detailsModal.item.end_date
                                                : (detailsModal.type === 'timeoff' ? detailsModal.item.end_time : formatApprovalDate(detailsModal.item.end_time))}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Reason Section */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-[#2E5090] tracking-wide">Applied Reason / Purpose</p>
                                <p className="text-sm font-medium text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                                    {detailsModal.type === 'onduty' ? (detailsModal.item.purpose || 'No purpose specified.') : (detailsModal.item.reason || 'No reason provided.')}
                                </p>
                            </div>
                            {/* Location Map for On-Duty */}
                            {detailsModal.type === 'onduty' && (
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-[#2E5090] tracking-wide">Location Tracking</p>
                                    <OnDutyLocationMap
                                        startLat={detailsModal.item.start_lat}
                                        startLong={detailsModal.item.start_long}
                                        endLat={detailsModal.item.end_lat}
                                        endLong={detailsModal.item.end_long}
                                        clientName={detailsModal.item.client_name}
                                        location={detailsModal.item.location}
                                    />
                                </div>
                            )}

                            {/* Decision Trail */}
                            {detailsModal.item.status !== 'Pending' && (
                                <div className={`p-6 rounded-xl border ${detailsModal.item.status === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                    }`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className={`text-xs font-bold tracking-wide mb-1 ${detailsModal.item.status === 'Approved' ? 'text-green-700' : 'text-red-700'
                                                }`}>
                                                Management Decision
                                            </p>
                                            <p className="text-sm font-semibold text-gray-900">
                                                Processed by: {detailsModal.item.approver ? `${detailsModal.item.approver.firstname} ${detailsModal.item.approver.lastname}` : 'System Admin'}
                                            </p>
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-500 tracking-wide">
                                            {formatApprovalDate(detailsModal.item.updatedAt)}
                                        </p>
                                    </div>
                                    {detailsModal.item.status === 'Rejected' && (
                                        <div className="pt-3 border-t border-red-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-red-600 tracking-wide block">Rejection Justification:</span>
                                                {detailsModal.item.manager_id && currentUser && (Number(currentUser.id) === Number(detailsModal.item.manager_id) || Number(currentUser.staffid) === Number(detailsModal.item.manager_id)) && (
                                                    <button
                                                        onClick={() => {
                                                            setDetailsModal({ ...detailsModal, show: false });
                                                            setEditReasonModal({
                                                                show: true,
                                                                item: detailsModal.item,
                                                                type: detailsModal.type,
                                                                reason: detailsModal.item.rejection_reason || ''
                                                            });
                                                        }}
                                                        className="text-[10px] font-bold text-[#2E5090] hover:underline uppercase tracking-tighter"
                                                    >
                                                        Modify
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-red-900 bg-white/50 p-3 rounded-lg border border-red-100 leading-relaxed">
                                                {detailsModal.item.rejection_reason || 'No specific feedback provided by the approver.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Timestamps */}
                            <div className="pt-4 flex justify-between text-[10px] font-bold text-gray-500 tracking-wide border-t border-gray-100">
                                <span>Requested On: {formatApprovalDate(detailsModal.item.createdAt)}</span>
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <div className="text-[10px] font-semibold text-gray-500 tracking-wide">
                                Logged: {formatApprovalDate(detailsModal.item.createdAt)}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setDetailsModal({ ...detailsModal, show: false })}
                                    className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                {detailsModal.item.status === 'Pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                handleUpdateStatus(detailsModal.item, 'rejected', detailsModal.type);
                                                setDetailsModal({ ...detailsModal, show: false });
                                            }}
                                            className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all shadow-md"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleUpdateStatus(detailsModal.item, 'approved', detailsModal.type);
                                                setDetailsModal({ ...detailsModal, show: false });
                                            }}
                                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-green-700 transition-all shadow-md shadow-green-100"
                                        >
                                            Approve Request
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
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

const calculateTimeOffDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '-';
    // Format: HH:MM:SS
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    const diff = end - start;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
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
