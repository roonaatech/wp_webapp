import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import OnDutyLocationMap from '../components/OnDutyLocationMap';
import { hasAdminPermission } from '../utils/roleUtils';

const ActiveOnDuty = () => {
    const [onDutyRecords, setOnDutyRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'start_time', direction: 'desc' });
    const [expandedRowId, setExpandedRowId] = useState(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = hasAdminPermission(user.role);

    useEffect(() => {
        fetchActiveOnDuty();
    }, []);

    const fetchActiveOnDuty = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found. Please login first.');
                return;
            }

            // Fetch all active on-duty records (end_time is null)
            const response = await axios.get(
                `${API_BASE_URL}/api/onduty/active-all`,
                { headers: { 'x-access-token': token } }
            );

            setOnDutyRecords(response.data.items || []);
        } catch (err) {
            console.error('Error fetching active on-duty records:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch active on-duty records');
        } finally {
            setLoading(false);
        }
    };

    // Filter records based on search
    const filteredRecords = useMemo(() => {
        return onDutyRecords.filter(record => {
            const staffName = `${record.tblstaff?.firstname || ''} ${record.tblstaff?.lastname || ''}`.toLowerCase();
            const clientName = (record.client_name || '').toLowerCase();
            const location = (record.location || '').toLowerCase();
            const searchLower = searchTerm.toLowerCase();

            return (
                staffName.includes(searchLower) ||
                clientName.includes(searchLower) ||
                location.includes(searchLower)
            );
        });
    }, [onDutyRecords, searchTerm]);

    // Sort records
    const sortedRecords = useMemo(() => {
        const sorted = [...filteredRecords];
        sorted.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle nested properties
            if (sortConfig.key === 'staffName') {
                aValue = `${a.tblstaff?.firstname || ''} ${a.tblstaff?.lastname || ''}`;
                bValue = `${b.tblstaff?.firstname || ''} ${b.tblstaff?.lastname || ''}`;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredRecords, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const formatTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatDuration = (startTime) => {
        if (!startTime) return 'N/A';
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) {
            return `${diffMins} min`;
        }
        const diffHours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${diffHours}h ${mins}m`;
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span className="text-gray-400 text-sm">⬍</span>;
        return sortConfig.direction === 'asc' ? <span className="text-blue-500">↑</span> : <span className="text-blue-500">↓</span>;
    };

    if (loading) {
        return <ModernLoader />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Active On-Duty</h1>
                    <p className="text-gray-600 mt-1">
                        {isAdmin
                            ? 'View all active on-duty records'
                            : 'View active on-duty records for your team'}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-bold text-blue-600">{sortedRecords.length}</div>
                    <p className="text-gray-600 text-sm">Currently Active</p>
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white rounded-lg shadow-md p-4">
                <input
                    type="text"
                    placeholder="Search by employee name, client, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Records Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {sortedRecords.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="text-4xl mb-2">😴</div>
                        <p className="text-lg">No active on-duty records</p>
                        <p className="text-sm text-gray-400 mt-1">
                            {searchTerm ? 'Try adjusting your search filters' : 'All employees are currently offline'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                    <th className="px-6 py-4 text-left">
                                        <button
                                            onClick={() => handleSort('staffName')}
                                            className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                                        >
                                            Employee <SortIcon column="staffName" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <button
                                            onClick={() => handleSort('client_name')}
                                            className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                                        >
                                            Client <SortIcon column="client_name" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <button
                                            onClick={() => handleSort('location')}
                                            className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                                        >
                                            Location <SortIcon column="location" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <button
                                            onClick={() => handleSort('start_time')}
                                            className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                                        >
                                            Started <SortIcon column="start_time" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Duration</th>
                                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Purpose</th>
                                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRecords.map((record, index) => (
                                    <React.Fragment key={record.id}>
                                        <tr
                                            className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                            }`}
                                        >
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-semibold text-gray-900">
                                                        {record.tblstaff?.firstname} {record.tblstaff?.lastname}
                                                    </p>
                                                    <p className="text-sm text-gray-500">{record.tblstaff?.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                    <p className="text-gray-900 font-medium">{record.client_name}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">{record.location}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {formatTime(record.start_time)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                                                    {formatDuration(record.start_time)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 max-w-xs truncate">
                                                {record.purpose}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => {
                                                        console.log('Record details:', record);
                                                        setExpandedRowId(expandedRowId === record.id ? null : record.id);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                                >
                                                    {expandedRowId === record.id ? 'Hide' : 'Details'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedRowId === record.id && (
                                            <tr className="bg-blue-50 border-b border-gray-200">
                                                <td colSpan="7" className="px-6 py-6">
                                                    <div className="space-y-6">
                                                        {/* Location Map */}
                                                        <div>
                                                            <h4 className="font-semibold text-gray-900 mb-4 text-lg">Location Tracking</h4>
                                                            <OnDutyLocationMap
                                                                startLat={record.start_lat}
                                                                startLong={record.start_long}
                                                                endLat={record.end_lat}
                                                                endLong={record.end_long}
                                                                clientName={record.client_name}
                                                                location={record.location}
                                                            />
                                                        </div>

                                                        {/* Additional Details */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                                                            <div>
                                                                <h4 className="font-semibold text-gray-900 mb-3">Visit Information</h4>
                                                                <div className="space-y-2 text-sm">
                                                                    <p>
                                                                        <span className="text-gray-600">Client:</span>
                                                                        <span className="ml-2 text-gray-900 font-medium">{record.client_name}</span>
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-gray-600">Location:</span>
                                                                        <span className="ml-2 text-gray-900">{record.location}</span>
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-gray-600">Purpose:</span>
                                                                        <span className="ml-2 text-gray-900">{record.purpose}</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-gray-900 mb-3">Timeline</h4>
                                                                <div className="space-y-2 text-sm">
                                                                    <p>
                                                                        <span className="text-gray-600">Start Time:</span>
                                                                        <span className="ml-2 text-gray-900">
                                                                            {formatTime(record.start_time)}
                                                                        </span>
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-gray-600">Duration:</span>
                                                                        <span className="ml-2 text-gray-900 font-medium">
                                                                            {formatDuration(record.start_time)}
                                                                        </span>
                                                                    </p>
                                                                    {record.end_time && (
                                                                        <p>
                                                                            <span className="text-gray-600">End Time:</span>
                                                                            <span className="ml-2 text-gray-900">
                                                                                {formatTime(record.end_time)}
                                                                            </span>
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="text-center text-sm text-gray-500">
                <p>Refresh the page to get the latest data</p>
            </div>
        </div>
    );
};

export default ActiveOnDuty;
