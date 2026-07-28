import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import ModernLoader from '../components/ModernLoader';
import { fetchRoles, canAccessWebApp } from '../utils/roleUtils';
import { LuMapPin, LuClock, LuSearch, LuInfo } from 'react-icons/lu';

const OpenHours = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    const [address, setAddress] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const canAccess = canAccessWebApp(user.role);
                if (!canAccess) {
                    navigate('/unauthorized', { replace: true });
                } else {
                    setHasPermission(true);
                }
            } catch (err) {
                console.error('Error checking permissions:', err);
                navigate('/unauthorized', { replace: true });
            } finally {
                setPermissionChecked(true);
            }
        };
        checkPermission();
    }, [user.role, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!address.trim()) {
            toast.error("Please enter an address.");
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setResult(null);
            const token = localStorage.getItem('token');

            const res = await axios.post(`${API_BASE_URL}/api/open-hours/lookup`, {
                address: address.trim()
            }, {
                headers: { 'x-access-token': token }
            });

            setResult(res.data);
        } catch (err) {
            console.error("Error looking up open hours:", err);
            const message = err.response?.data?.message || "Failed to look up business hours.";
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (!permissionChecked || !hasPermission) {
        return <ModernLoader message="Loading Open Hours..." fullScreen={true} />;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-4">
            {/* Header */}
            <div className="border-b border-slate-100 pb-4">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Open Hours Lookup</h1>
                <p className="text-sm text-slate-500 mt-1">Enter a US business address to find its Monday - Friday operating hours.</p>
            </div>

            {/* Address Form */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold border-b border-slate-50 pb-2.5">
                    <LuMapPin size={16} className="text-indigo-600" />
                    <span className="uppercase tracking-wider text-sm">Business Address</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Address</label>
                        <input
                            type="text"
                            required
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="123 Main St, Springfield, IL 62704"
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition w-full"
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 uppercase tracking-wider disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <LuSearch size={14} /> Find Open Hours
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 font-semibold text-sm">
                    <LuInfo size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                            <LuClock size={18} />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 leading-tight">{result.name || 'Business Hours'}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{result.formattedAddress}</p>
                        </div>
                    </div>

                    {!result.hasHoursData ? (
                        <div className="p-10 text-center text-slate-400 font-medium space-y-2">
                            <LuInfo size={40} className="mx-auto text-slate-300" />
                            <p className="text-sm">No business hours are available for this location.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {result.hours.map(day => (
                                <div key={day.day} className="flex items-center justify-between px-5 py-3">
                                    <span className="text-sm font-bold text-slate-700">{day.day}</span>
                                    {day.closed ? (
                                        <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500">Closed</span>
                                    ) : (
                                        <span className="text-sm font-semibold text-slate-600">{day.open} &ndash; {day.close}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OpenHours;
