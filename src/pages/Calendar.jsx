import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { hasAdminPermission, fetchRoles, canManageSchedule } from '../utils/roleUtils';
import { getCurrentInAppTimezone } from '../utils/timezone.util';

const Calendar = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const now = getCurrentInAppTimezone().full;
    const [currentDate, setCurrentDate] = useState(now);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(now.getDate());
    const [selectedEvents, setSelectedEvents] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedEventType, setSelectedEventType] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [expandedEmployee, setExpandedEmployee] = useState(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Check permission first
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const canManage = canManageSchedule(user.role);
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
            fetchCalendarEvents();
        }
    }, [currentDate, hasPermission]);

    useEffect(() => {
        const today = now; // Use the mirrored 'now'
        if (today.getFullYear() === currentDate.getFullYear() &&
            today.getMonth() === currentDate.getMonth()) {
            const todayDate = today.getDate();
            // Only select if not already selected (to avoid infinite loops if logic changes)
            if (!selectedDate) {
                setSelectedDate(todayDate);
            }
            // Filter events for today and set them
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;
            const todayEvents = events.filter(event => event.date === dateStr);
            setSelectedEvents(todayEvents);
        }
    }, [events, currentDate, now]); // Run when events are loaded, include now in dependencies

    // Listen for approval status changes (on-duty completion)
    useEffect(() => {
        const handleStatusChange = () => {
            fetchCalendarEvents();
        };

        window.addEventListener('approvalStatusChanged', handleStatusChange);
        return () => {
            window.removeEventListener('approvalStatusChanged', handleStatusChange);
        };
    }, [currentDate]);

    // Update selected events when any filter changes
    useEffect(() => {
        handleDateClickInternal(selectedDate);
    }, [selectedEmployee, selectedEventType, selectedStatus]);

    const fetchCalendarEvents = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found. Please login first.');
                return;
            }

            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;

            const response = await axios.get(
                `${API_BASE_URL}/api/admin/calendar?year=${year}&month=${month}`,
                { headers: { 'x-access-token': token } }
            );

            console.log('Calendar events:', response.data);
            setEvents(response.data);
        } catch (error) {
            console.error('Error fetching calendar events:', error);
            setError(error.response?.data?.message || error.message || 'Failed to fetch calendar events');
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const getEventsForDate = (day) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let dayEvents = events.filter(event => event.date === dateStr);
        if (selectedEmployee) {
            dayEvents = dayEvents.filter(event => event.staff_name === selectedEmployee);
        }
        if (selectedEventType) {
            dayEvents = dayEvents.filter(event => event.type === selectedEventType);
        }
        if (selectedStatus) {
            dayEvents = dayEvents.filter(event => event.status === selectedStatus);
        }
        return dayEvents;
    };

    const getUniqueEmployees = () => {
        const employees = [...new Set(events.map(event => event.staff_name))].filter(Boolean);
        return employees.sort();
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    };

    const handleTodayClick = () => {
        setCurrentDate(now); // Use the mirrored 'now'
    };

    const handleDateClickInternal = (day) => {
        setSelectedDate(day);
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let dayEvents = events.filter(event => event.date === dateStr);
        if (selectedEmployee) {
            dayEvents = dayEvents.filter(event => event.staff_name === selectedEmployee);
        }
        if (selectedEventType) {
            dayEvents = dayEvents.filter(event => event.type === selectedEventType);
        }
        if (selectedStatus) {
            dayEvents = dayEvents.filter(event => event.status === selectedStatus);
        }
        setSelectedEvents(dayEvents);
    };

    const handleDateClick = (day) => {
        handleDateClickInternal(day);
    };

    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const isAdmin = hasAdminPermission(user.role);

    // Group events by staff name for the sidebar
    const groupedEvents = selectedEvents.reduce((acc, event) => {
        const key = event.staff_name;
        if (!acc[key]) {
            acc[key] = {
                events: [],
                hasLeave: false,
                hasOnDuty: false,
            };
        }
        acc[key].events.push(event);
        if (event.type === 'leave') acc[key].hasLeave = true;
        if (event.type === 'on_duty') acc[key].hasOnDuty = true;
        if (event.type === 'time_off') acc[key].hasTimeOff = true;
        return acc;
    }, {});

    // Show loading while checking permissions
    if (!permissionChecked) {
        return <ModernLoader />;
    }

    // Don't render if no permission
    if (!hasPermission) {
        return null;
    }

    if (loading) return <ModernLoader />;

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
                <p className="text-gray-600 mt-1">
                    {isAdmin
                        ? 'View all staff leave and on-duty schedules'
                        : "View your reportees' leave and on-duty schedules"}
                </p>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium">⚠️ {error}</p>
                </div>
            )}

            {/* Filter Section */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Employee</label>
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                            <option value="">All Employees</option>
                            {getUniqueEmployees().map((employee) => (
                                <option key={employee} value={employee}>
                                    {employee}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Type</label>
                        <select
                            value={selectedEventType}
                            onChange={(e) => setSelectedEventType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                            <option value="">All Types</option>
                            <option value="leave">Leave</option>
                            <option value="on_duty">On-Duty</option>
                            <option value="time_off">Time-Off</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Status</label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                            <option value="">All Statuses</option>
                            <option value="Approved">Approved</option>
                            <option value="Pending">Pending</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevMonth}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <span className="text-2xl">←</span>
                            </button>
                            <button
                                onClick={handleNextMonth}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <span className="text-2xl">→</span>
                            </button>
                            <button
                                onClick={handleTodayClick}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-semibold"
                            >
                                Today
                            </button>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{monthName}</h2>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-4">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="text-center font-semibold text-gray-700 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-2">
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square"></div>
                        ))}

                        {/* Calendar days */}
                        {days.map((day) => {
                            const today = getCurrentInAppTimezone().full;
                            const isToday = today.getFullYear() === currentDate.getFullYear() &&
                                today.getMonth() === currentDate.getMonth() &&
                                today.getDate() === day;

                            const dayEvents = getEventsForDate(day);
                            const leaveCount = dayEvents.filter(e => e.type === 'leave').length;
                            const onDutyCount = dayEvents.filter(e => e.type === 'on_duty').length;
                            const timeOffCount = dayEvents.filter(e => e.type === 'time_off').length;
                            const isSelected = selectedDate === day;
                            const hasLeave = leaveCount > 0;
                            const hasOnDuty = onDutyCount > 0;
                            const hasTimeOff = timeOffCount > 0;

                            let dayClasses = 'aspect-square rounded-lg border-2 p-2 text-left flex flex-col transition-all hover:border-gray-400';
                            let dayTextClasses = 'font-bold text-sm';

                            if (isToday) {
                                dayTextClasses += ' text-white';
                                if (isSelected) {
                                    dayClasses += ' bg-indigo-700 border-indigo-800 ring-2 ring-offset-1 ring-indigo-400';
                                } else {
                                    dayClasses += ' bg-indigo-600 border-indigo-700';
                                }
                            } else {
                                dayTextClasses += ' text-gray-900';
                                let bgColor = 'bg-white';
                                let borderColor = 'border-gray-200';
                                if (isSelected) {
                                    bgColor = 'bg-blue-50';
                                    borderColor = 'border-blue-600';
                                } else if ((hasLeave && hasOnDuty) || (hasLeave && hasTimeOff) || (hasOnDuty && hasTimeOff)) {
                                    bgColor = 'bg-purple-50';
                                    borderColor = 'border-purple-300';
                                } else if (hasLeave) {
                                    bgColor = 'bg-blue-50';
                                    borderColor = 'border-blue-300';
                                } else if (hasOnDuty) {
                                    bgColor = 'bg-green-50';
                                    borderColor = 'border-green-300';
                                } else if (hasTimeOff) {
                                    bgColor = 'bg-orange-50';
                                    borderColor = 'border-orange-300';
                                }
                                dayClasses += ` ${bgColor} ${borderColor}`;
                            }

                            return (
                                <button
                                    key={day}
                                    onClick={() => handleDateClick(day)}
                                    className={dayClasses}
                                >
                                    <span className={dayTextClasses}>{day}</span>
                                    <div className="flex-1 flex flex-col justify-end gap-1 mt-1">
                                        {leaveCount > 0 && (
                                            <div className="flex items-center gap-1">
                                                <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-blue-500'}`}></span>
                                                <span className={`text-xs font-semibold ${isToday ? 'text-white' : 'text-blue-700'}`}>{leaveCount}</span>
                                            </div>
                                        )}
                                        {onDutyCount > 0 && (
                                            <div className="flex items-center gap-1">
                                                <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-green-500'}`}></span>
                                                <span className={`text-xs font-semibold ${isToday ? 'text-white' : 'text-green-700'}`}>{onDutyCount}</span>
                                            </div>
                                        )}
                                        {timeOffCount > 0 && (
                                            <div className="flex items-center gap-1">
                                                <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-orange-500'}`}></span>
                                                <span className={`text-xs font-semibold ${isToday ? 'text-white' : 'text-orange-700'}`}>{timeOffCount}</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="mt-6 pt-6 border-t border-gray-200 flex gap-6">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <span className="text-sm text-gray-700">Leave</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">On-Duty</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                            <span className="text-sm text-gray-700">Time-Off</span>
                        </div>
                    </div>
                </div>

                {/* Events Sidebar */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 h-fit">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                        {selectedDate ? `${monthName.split(' ')[0]} ${selectedDate}, ${currentDate.getFullYear()}` : 'Select a date'}
                    </h3>

                    <div className="space-y-4">
                        {Object.keys(groupedEvents).length > 0 ? (
                            Object.entries(groupedEvents).map(([staffName, data]) => {
                                const isExpanded = expandedEmployee === staffName;
                                const { events: staffEvents, hasLeave, hasOnDuty, hasTimeOff } = data;

                                let cardBg = 'bg-gray-50';
                                let cardBorder = 'border-gray-300';
                                // Logic for mixed types
                                const types = [hasLeave, hasOnDuty, hasTimeOff].filter(Boolean).length;

                                if (types > 1) {
                                    cardBg = 'bg-purple-50';
                                    cardBorder = 'border-purple-500';
                                } else if (hasLeave) {
                                    cardBg = 'bg-blue-50';
                                    cardBorder = 'border-blue-500';
                                } else if (hasOnDuty) {
                                    cardBg = 'bg-green-50';
                                    cardBorder = 'border-green-500';
                                } else if (hasTimeOff) {
                                    cardBg = 'bg-orange-50';
                                    cardBorder = 'border-orange-500';
                                }

                                return (
                                    <div
                                        key={staffName}
                                        className={`rounded-lg border-l-4 ${cardBg} ${cardBorder} transition-all`}
                                    >
                                        {/* Compact View */}
                                        <button
                                            onClick={() => setExpandedEmployee(isExpanded ? null : staffName)}
                                            className="w-full text-left p-3 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 text-sm truncate">
                                                        {staffName}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {hasLeave && (
                                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-200 text-blue-800">
                                                            Leave
                                                        </span>
                                                    )}
                                                    {hasOnDuty && (
                                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-green-200 text-green-800">
                                                            On-Duty
                                                        </span>
                                                    )}
                                                    {hasTimeOff && (
                                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-orange-200 text-orange-800">
                                                            Time-Off
                                                        </span>
                                                    )}
                                                    <span className={`text-gray-600 hover:text-gray-900 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                        ▼
                                                    </span>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Expanded View */}
                                        {isExpanded && (
                                            <div className="p-3 border-t border-gray-200 space-y-3">
                                                {staffEvents.map((event, idx) => {
                                                    let statusBg = 'bg-gray-200';
                                                    let statusText = 'text-gray-800';
                                                    let statusLabel = event.status;

                                                    if (event.status === 'Approved') {
                                                        if (event.type === 'leave') {
                                                            statusBg = 'bg-blue-200'; statusText = 'text-blue-800';
                                                        } else if (event.type === 'on_duty') {
                                                            statusBg = 'bg-green-200'; statusText = 'text-green-800';
                                                        } else if (event.type === 'time_off') {
                                                            statusBg = 'bg-orange-200'; statusText = 'text-orange-800';
                                                        }
                                                    } else if (event.status === 'Pending') {
                                                        statusBg = 'bg-yellow-200';
                                                        statusText = 'text-yellow-800';
                                                    } else if (event.status === 'Rejected') {
                                                        statusBg = 'bg-red-200';
                                                        statusText = 'text-red-800';
                                                    }

                                                    return (
                                                        <div key={idx} className="bg-white p-2 rounded-md shadow-sm">
                                                            <div className="flex items-center justify-between">
                                                                <p className="font-semibold text-xs text-gray-800">
                                                                    {event.type === 'leave' ? `Leave: ${event.title}` : (event.type === 'time_off' ? 'Time-Off' : 'On-Duty')}
                                                                </p>
                                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBg} ${statusText}`}>
                                                                    {statusLabel}
                                                                </span>
                                                            </div>
                                                            {event.type === 'on_duty' && event.start_time && event.end_time && (
                                                                <p className="text-xs text-gray-600 mt-1">
                                                                    Duration: {(() => {
                                                                        const start = new Date(event.start_time);
                                                                        const end = new Date(event.end_time);
                                                                        const diffMs = end - start;
                                                                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                                                        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                                                        if (diffHours > 0) return `${diffHours}h ${diffMinutes}m`;
                                                                        return `${diffMinutes}m`;
                                                                    })()}
                                                                </p>
                                                            )}
                                                            {event.type === 'time_off' && event.start_time && event.end_time && (
                                                                <p className="text-xs text-gray-600 mt-1">
                                                                    Time: {event.start_time.substring(0, 5)} - {event.end_time.substring(0, 5)}
                                                                </p>
                                                            )}
                                                            {event.reason && <p className="text-xs text-gray-600 mt-1">Reason: {event.reason}</p>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-gray-500">No events for this day.</p>
                        )}
                    </div>
                </div>
                {/* Debug Info */}
                <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                    <p>Debug Info:</p>
                    <ul className="list-disc pl-4 mt-1">
                        <li>Total Events Loaded: {events.length}</li>
                        <li>Time-Off Events: {events.filter(e => e.type === 'time_off').length}</li>
                        <li>Leave Events: {events.filter(e => e.type === 'leave').length}</li>
                        <li>On-Duty Events: {events.filter(e => e.type === 'on_duty').length}</li>
                        <li>Current Date: {currentDate.toDateString()}</li>
                        <li>Selected Date: {selectedDate}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Calendar;
