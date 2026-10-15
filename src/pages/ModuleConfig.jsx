import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuCalendarCheck, LuTriangleAlert, LuCircleCheck, LuX } from 'react-icons/lu';
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
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        message: '',
        note: '',
        confirmText: '',
        confirmButtonClass: '',
        isDestructive: false,
        onConfirm: null
    });

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

    const requestToggleAttendance = (nextState) => {
        if (!canManageModules(user.role)) {
            toast.error('You do not have permission to modify module configurations.');
            return;
        }

        if (nextState) {
            setConfirmModal({
                show: true,
                title: 'Enable Attendance Module?',
                message: 'Are you sure you want to enable the Attendance Module? Kiosk check-in terminals, punch logging (QR, Kiosk, Mobile), timesheets, and attendance metrics will be reactivated organization-wide.',
                note: 'All employees will regain access to attendance logging and reports.',
                confirmText: 'Yes, Enable Module',
                confirmButtonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
                isDestructive: false,
                onConfirm: () => executeToggleAttendance(true)
            });
        } else {
            setConfirmModal({
                show: true,
                title: 'Disable Attendance Module?',
                message: 'Are you sure you want to disable the Attendance Module? Kiosk terminals, punch logging, and timesheets will be deactivated across the organization.',
                note: 'Shift Roster and Field On-Duty will remain active under Operations.',
                confirmText: 'Yes, Disable Module',
                confirmButtonClass: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
                isDestructive: true,
                onConfirm: () => executeToggleAttendance(false)
            });
        }
    };

    const executeToggleAttendance = async (nextState) => {
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
            setConfirmModal(prev => ({ ...prev, show: false }));

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
                        onClick={() => requestToggleAttendance(!attendanceActive)}
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

            {/* Confirmation Modal */}
            {confirmModal.show && (
                <div 
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
                    onClick={() => !saving && setConfirmModal(prev => ({ ...prev, show: false }))}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 transform transition-all animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl shrink-0 ${
                                    confirmModal.isDestructive 
                                        ? 'bg-rose-100 text-rose-600 border border-rose-200' 
                                        : 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                                }`}>
                                    {confirmModal.isDestructive ? (
                                        <LuTriangleAlert className="w-6 h-6" />
                                    ) : (
                                        <LuCircleCheck className="w-6 h-6" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-slate-900 leading-tight">
                                            {confirmModal.title}
                                        </h3>
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                                            className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                                        >
                                            <LuX className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                                        {confirmModal.message}
                                    </p>
                                    {confirmModal.note && (
                                        <div className={`mt-3 p-3 rounded-xl text-xs font-medium border ${
                                            confirmModal.isDestructive 
                                                ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}>
                                            {confirmModal.note}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition uppercase tracking-wider disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={confirmModal.onConfirm}
                                    className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition flex items-center gap-2 disabled:opacity-50 ${confirmModal.confirmButtonClass}`}
                                >
                                    {saving && (
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {confirmModal.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModuleConfig;
