import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiHome, FiFileText } from 'react-icons/fi';

const ModuleDisabled = ({ module = 'Attendance' }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center animate-scaleIn">
                <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-amber-200 text-amber-600 shadow-sm">
                    <FiAlertTriangle className="w-10 h-10" />
                </div>

                <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
                    Feature Disabled
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {module} Module Is Disabled
                </h1>

                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    The <strong>{module}</strong> feature is currently disabled across the organization by your system administrator.
                </p>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500 mb-8 text-left space-y-1.5">
                    <p className="font-semibold text-gray-700">What this means:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Kiosk check-in / check-out terminals are offline</li>
                        <li>Timesheet reviews and regularizations are disabled</li>
                        <li>Other modules (Leaves, Time-Off, On-Duty) remain active</li>
                    </ul>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#2E5090] text-white font-semibold rounded-xl hover:bg-[#243d6a] transition-all shadow-md hover:shadow-lg"
                    >
                        <FiHome className="w-4 h-4" />
                        Go to Dashboard
                    </button>

                    <button
                        onClick={() => navigate('/my-requests')}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                    >
                        <FiFileText className="w-4 h-4" />
                        Go to My Requests
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModuleDisabled;
