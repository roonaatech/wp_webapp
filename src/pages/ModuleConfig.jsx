import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuCalendarCheck } from 'react-icons/lu';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { isAttendanceEnabled } from '../utils/attendanceConfig';
import { canManageModules, fetchRoles, getRoleById } from '../utils/roleUtils';

const ModuleConfig = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [attendanceActive, setAttendanceActive] = useState(() => isAttendanceEnabled());

    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const role = getRoleById(user.role);
                const canManage = canManageModules(user.role);
                if (!canManage) {
                    navigate('/unauthorized', { replace: true });
                } else {
                    setHasPermission(true);
                }
            } catch (error) {
                console.error('Error checking module config permissions:', error);
                navigate('/unauthorized', { replace: true });
            } finally {
                setPermissionChecked(true);
            }
        };
        checkPermission();
    }, [user.role, navigate]);

    useEffect(() => {
        if (hasPermission) {
            fetchSettings();
        }
    }, [hasPermission]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) return;

            const res = await axios.get(`${API_BASE_URL}/api/settings`, {
                headers: { 'x-access-token': token }
            });

            if (res.data && res.data.map) {
                const map = res.data.map;
                const isEnabled = map.module_attendance_enabled !== 'false' && map.module_attendance_enabled !== false;
                setAttendanceActive(isEnabled);

                const stored = JSON.parse(localStorage.getItem('settings') || '{}');
                localStorage.setItem('settings', JSON.stringify({ ...stored, ...map }));
            }
        } catch (err) {
            console.error('Error fetching module configuration:', err);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAttendance = async (nextState) => {
        if (!canManageModules(user.role)) {
            toast.error('You do not have permission to modify module configurations.');
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const stringVal = String(nextState);

            await axios.post(
                `${API_BASE_URL}/api/settings`,
                {
                    key: 'module_attendance_enabled',
                    value: stringVal,
                    is_public: true,
                    category: 'modules'
                },
                { headers: { 'x-access-token': token } }
            );

            const existing = JSON.parse(localStorage.getItem('settings') || '{}');
            existing.module_attendance_enabled = stringVal;
            localStorage.setItem('settings', JSON.stringify(existing));

            window.dispatchEvent(new Event('settingsLoaded'));
            setAttendanceActive(nextState);

            toast.success(nextState ? 'Attendance module enabled' : 'Attendance module disabled');
        } catch (err) {
            console.error('Error updating module setting:', err);
            toast.error(err.response?.data?.message || 'Failed to update module configuration');
        } finally {
            setSaving(false);
        }
    };

    if (!permissionChecked || loading) {
        return <ModernLoader size="container" message="Loading module settings..." />;
    }

    if (!hasPermission) {
        return null;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Module Configuration</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Enable or disable system modules across WorkPulse.
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
                <div className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                        <div className={`p-2.5 rounded-lg mt-0.5 ${attendanceActive ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                            <LuCalendarCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-gray-900">Attendance Module</h3>
                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${attendanceActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {attendanceActive ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 max-w-xl">
                                Controls kiosk terminals, timesheet reviews, punch logs, and attendance metrics. Shift Roster and Field On-Duty remain active under Operations even when Attendance is disabled.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={saving || !hasPermission}
                        onClick={() => handleToggleAttendance(!attendanceActive)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                            attendanceActive ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                        title={attendanceActive ? 'Disable Attendance Module' : 'Enable Attendance Module'}
                    >
                        <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                attendanceActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModuleConfig;
