import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiSave, FiSettings, FiClock, FiGlobe } from 'react-icons/fi';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { fetchRoles, getRoleById, canManageSystemSettings } from '../utils/roleUtils';
import { TIMEZONE_OPTIONS } from '../utils/timezone.util';

export default function Settings() {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(false);
    const [savingKey, setSavingKey] = useState(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Settings State - organized by category
    const [settings, setSettings] = useState({
        max_time_off_hours: '',
        application_timezone: 'America/Chicago'
    });

    // Define settings configuration for easy expansion
    const settingsConfig = [
        {
            category: 'General Configuration',
            description: 'Application-wide settings',
            icon: <FiGlobe className="text-blue-600" />,
            settings: [
                {
                    key: 'application_timezone',
                    label: 'Application Timezone',
                    description: 'Timezone used for displaying dates and times throughout the application',
                    type: 'select',
                    options: TIMEZONE_OPTIONS,
                    placeholder: 'Select timezone'
                }
            ]
        },
        {
            category: 'Time-Off Configuration',
            description: 'Manage limitations and rules for Time-Off requests',
            icon: <FiClock className="text-purple-600" />,
            settings: [
                {
                    key: 'max_time_off_hours',
                    label: 'Maximum Hours Per Day',
                    description: 'Users cannot request more than this duration in a single day',
                    type: 'number',
                    min: 0.5,
                    max: 24,
                    step: 0.5,
                    unit: 'hours',
                    placeholder: '4'
                }
            ]
        }
        // Add more categories here in the future
    ];

    // Check permission first
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const role = getRoleById(user.role);
                const canManage = canManageSystemSettings(user.role);

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
            fetchSettings();
        }
    }, [hasPermission]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/settings`, {
                headers: { 'x-access-token': token }
            });
            if (response.data && response.data.map) {
                setSettings(prev => ({
                    ...prev,
                    ...response.data.map
                }));
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const saveSetting = async (key, value) => {
        setSavingKey(key);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/settings`, {
                key: key,
                value: value
            }, {
                headers: { 'x-access-token': token }
            });
            toast.success('Setting saved successfully');
        } catch (err) {
            console.error('Error saving setting:', err);
            const msg = err.response?.data?.message || 'Failed to save setting';
            toast.error(msg);
        } finally {
            setSavingKey(null);
        }
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
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl text-white shadow-lg">
                    <FiSettings size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
                    <p className="text-gray-500 text-sm mt-1">Configure global application parameters</p>
                </div>
            </div>

            {/* Settings Categories */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <ModernLoader />
                </div>
            ) : (
                <div className="space-y-6">
                    {settingsConfig.map((category, categoryIndex) => (
                        <div key={categoryIndex} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Category Header */}
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        {category.icon}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-800">{category.category}</h2>
                                        <p className="text-sm text-gray-500">{category.description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Settings Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                Setting
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                Value
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {category.settings.map((setting, settingIndex) => (
                                            <tr key={settingIndex} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{setting.label}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{setting.description}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 max-w-xs">
                                                        {setting.type === 'select' ? (
                                                            <select
                                                                value={settings[setting.key] || ''}
                                                                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                                            >
                                                                <option value="">{setting.placeholder || 'Select an option'}</option>
                                                                {setting.options?.map((option) => (
                                                                    <option key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type={setting.type}
                                                                value={settings[setting.key] || ''}
                                                                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                                                min={setting.min}
                                                                max={setting.max}
                                                                step={setting.step}
                                                                placeholder={setting.placeholder}
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                                            />
                                                        )}
                                                        {setting.unit && (
                                                            <span className="text-sm text-gray-500 font-medium">{setting.unit}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => saveSetting(setting.key, settings[setting.key])}
                                                        disabled={savingKey === setting.key}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                    >
                                                        {savingKey === setting.key ? (
                                                            <>
                                                                <ModernLoader size={14} color="#fff" />
                                                                <span>Saving...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FiSave size={14} />
                                                                <span>Save</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info Footer */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Changes to system settings take effect immediately. Make sure to test thoroughly after making changes.
                </p>
            </div>
        </div>
    );
}
