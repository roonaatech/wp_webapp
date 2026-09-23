import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { 
    LuShieldCheck, 
    LuShieldAlert,
    LuRefreshCw, 
    LuClock, 
    LuUser, 
    LuBuilding, 
    LuQrCode, 
    LuLock, 
    LuLockOpen, 
    LuCircleCheck, 
    LuSparkles,
    LuInfo,
    LuArrowLeft,
    LuLogOut,
    LuSmartphone,
    LuExternalLink
} from 'react-icons/lu';
import API_BASE_URL from '../config/api.config';
import BrandLogo from '../components/BrandLogo';
import ModernLoader from '../components/ModernLoader';
import { canAccessWebApp } from '../utils/roleUtils';
import { getOrCreateDeviceId, getDeviceName, isMobileClient, getMobileDeviceMetadata } from '../utils/deviceFingerprint';

const ROTATION_INTERVAL_SEC = 5;

const MyBadge = () => {
    const navigate = useNavigate();
    const [badgeData, setBadgeData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(ROTATION_INTERVAL_SEC);
    const [isLocked, setIsLocked] = useState(false);
    const [error, setError] = useState(null);
    const [isDeviceViolation, setIsDeviceViolation] = useState(false);
    const [isMobileWebBlocked, setIsMobileWebBlocked] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const isMobile = isMobileClient();
    const isDesktopWithLayout = canAccessWebApp(user.role) && !isMobile;

    const timerRef = useRef(null);

    const fetchBadge = useCallback(async (isManual = false) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Please log in to view your attendance badge.');
            setLoading(false);
            return;
        }

        if (isManual) setRefreshing(true);

        try {
            const devMeta = await getMobileDeviceMetadata();

            const response = await axios.get(`${API_BASE_URL}/api/attendance/my-badge`, {
                headers: { 
                    'x-access-token': token,
                    'x-is-mobile': devMeta.isMobile ? 'true' : 'false',
                    'x-device-id': devMeta.deviceId,
                    'x-device-name': devMeta.deviceName,
                    'x-device-model': devMeta.deviceModel || ''
                },
                params: {
                    deviceId: devMeta.isMobile ? devMeta.deviceId : undefined,
                    deviceName: devMeta.isMobile ? devMeta.deviceName : undefined,
                    deviceModel: devMeta.isMobile ? devMeta.deviceModel : undefined
                }
            });

            if (response.data && response.data.success) {
                setBadgeData(response.data);
                setError(null);
                setIsDeviceViolation(false);
                setSecondsLeft(ROTATION_INTERVAL_SEC);
            } else {
                setError(response.data?.message || 'Failed to load attendance badge.');
            }
        } catch (err) {
            console.error('Error fetching badge data:', err);
            const isViolation = err.response?.data?.deviceViolation === true;
            const isBlocked = err.response?.data?.isMobileWebBlocked === true;
            const msg = err.response?.data?.message || 'Could not connect to badge server.';
            setIsDeviceViolation(isViolation);
            setIsMobileWebBlocked(isBlocked);
            setError(msg);
            if (isManual) toast.error(msg);
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchBadge();
    }, [fetchBadge]);

    // Countdown and auto-refresh timer
    useEffect(() => {
        if (loading || isLocked || error) return;

        timerRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    fetchBadge();
                    return ROTATION_INTERVAL_SEC;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [loading, isLocked, error, fetchBadge]);

    const handleUnlock = async () => {
        // Optional WebAuthn / Biometric prompt if supported on mobile Safari / Chrome
        if (window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
            try {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (available) {
                    // Quick confirmation challenge
                    setIsLocked(false);
                    toast.success('Badge unlocked!');
                    fetchBadge(true);
                    return;
                }
            } catch (_) {}
        }
        setIsLocked(false);
        toast.success('Badge unlocked!');
        fetchBadge(true);
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        const token = localStorage.getItem('token');
        try {
            if (token) {
                await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, { headers: { 'x-access-token': token } });
            }
        } catch (_) {
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('mustChangePassword');
            localStorage.removeItem('mustCompleteDeclaration');
            localStorage.removeItem('settings');
            navigate('/login');
        }
    };

    // Desktop browser notice
    if (!isMobile) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-6 bg-slate-100">
                <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-200">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
                        <LuQrCode className="w-8 h-8" />
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
                        <LuShieldCheck className="w-3.5 h-3.5" />
                        <span>Mobile Attendance Security</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mb-2">Mobile Only Feature</h2>
                    <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        Smart Attendance Badges with dynamic rotating QR codes are presented at the kiosk terminal from your phone. 
                        Please open the official <strong>WorkPulse Mobile App</strong> on your mobile device to view your attendance badge.
                    </p>
                    <button
                        onClick={() => navigate(canAccessWebApp(user.role) ? '/' : '/my-requests')}
                        className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-colors text-sm"
                    >
                        {canAccessWebApp(user.role) ? 'Return to Dashboard' : 'Go to My Requests'}
                    </button>
                </div>
            </div>
        );
    }


    if (loading) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-slate-100">
                <ModernLoader />
                <p className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">
                    Generating secure attendance badge...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-6 bg-slate-100">
                <div className={`bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border ${isDeviceViolation ? 'border-red-300 ring-4 ring-red-50' : 'border-red-100'}`}>
                    <div className={`w-16 h-16 ${isDeviceViolation ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-red-50 text-red-500'} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                        {isDeviceViolation ? <LuShieldAlert className="w-8 h-8" /> : <LuInfo className="w-8 h-8" />}
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mb-2">
                        {isDeviceViolation ? 'Security Alert: Device Conflict' : 'Badge Unavailable'}
                    </h2>
                    <p className={`text-sm mb-6 ${isDeviceViolation ? 'text-red-700 font-semibold bg-red-50 p-4 rounded-xl border border-red-100' : 'text-slate-600'}`}>
                        {error}
                    </p>
                    {isDeviceViolation && (
                        <p className="text-xs text-slate-500 mb-6">
                            For security and anti-proxy compliance, each mobile phone can only be used by one employee. If you recently changed or received a second-hand phone from a colleague, please contact HR to reset the device registration.
                        </p>
                    )}
                    <button
                        onClick={() => { setError(null); setIsDeviceViolation(false); setLoading(true); fetchBadge(true); }}
                        className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-colors text-sm"
                    >
                        Try Refreshing
                    </button>
                </div>
            </div>
        );
    }

    const { employee, qrPayload, todayStatus, checkInTime } = badgeData || {};
    const progressPercent = ((ROTATION_INTERVAL_SEC - secondsLeft) / ROTATION_INTERVAL_SEC) * 100;

    return (
        <div className="w-full min-h-screen bg-slate-100 flex flex-col items-center">
            
            {/* Top Navigation Bar - ONLY for Mobile / Standalone self-service view */}
            {!isDesktopWithLayout && (
                <header className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white sticky top-0 z-30 safe-area-top shadow-lg">
                    <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
                        <button
                            onClick={() => navigate('/my-requests')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all active:scale-95 border border-white/20 backdrop-blur-sm shadow-sm"
                        >
                            <LuArrowLeft className="w-4 h-4" />
                            <span>Requests</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center p-1 border border-white/20 shadow-inner">
                                <BrandLogo showText={false} iconSize="w-5 h-5" />
                            </div>
                            <span className="font-extrabold text-sm tracking-tight text-white">WorkPulse</span>
                        </div>

                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="p-2 rounded-xl hover:bg-white/20 text-white/90 hover:text-white transition-all active:scale-95"
                            title="Sign Out"
                        >
                            {isLoggingOut ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block"></span>
                            ) : (
                                <LuLogOut className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </header>
            )}

            <main className="w-full max-w-xl p-4 sm:p-6 flex flex-col items-center justify-center flex-1">
                {/* Header Title */}
                <div className="text-center mb-5 max-w-sm w-full">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold mb-2.5 shadow-sm border border-emerald-300">
                        <LuShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>Official Digital ID & Attendance Badge</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Smart Attendance Badge</h1>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                        Hold this QR code in front of the office kiosk scanner
                    </p>
                </div>

            {/* Smart ID Card */}
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 transition-all">
                
                {/* Card Top Accent Banner */}
                <div className="h-28 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 p-4 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                    <div className="relative z-10 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center p-1 border border-white/20">
                                <BrandLogo showText={false} iconSize="w-6 h-6" />
                            </div>
                            <span className="font-bold text-sm tracking-wide">WorkPulse</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-3.5" />
                            Live Security
                        </div>
                    </div>
                </div>

                {/* Profile Section */}
                <div className="px-6 pt-0 pb-6 text-center relative">
                    
                    {/* Avatar with Circular Ring */}
                    <div className="-mt-14 mb-3 inline-block relative">
                        <div className="w-24 h-24 rounded-full p-1 bg-white shadow-xl mx-auto">
                            {employee?.avatarUrl ? (
                                <img
                                    src={`${API_BASE_URL}/${employee.avatarUrl}`}
                                    alt={employee.name}
                                    className="w-full h-full rounded-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div
                                className="w-full h-full rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-bold text-2xl items-center justify-center shadow-inner"
                                style={{ display: employee?.avatarUrl ? 'none' : 'flex' }}
                            >
                                {employee?.name ? employee.name.charAt(0).toUpperCase() : <LuUser className="w-10 h-10" />}
                            </div>
                        </div>
                        <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border-2 border-white text-[10px]">
                            <LuSparkles className="w-3.5 h-3.5" />
                        </div>
                    </div>

                    {/* Employee Identity */}
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                        {employee?.name || 'Employee'}
                    </h2>
                    <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                        {employee?.role || 'Staff Member'}
                    </p>
                    {employee?.department && (
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                            <LuBuilding className="w-3 h-3" />
                            {employee.department}
                        </p>
                    )}

                    {/* Today's Status Badge */}
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition-all">
                        {todayStatus === 'CHECKED_IN' ? (
                            <span className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Checked In {checkInTime ? `since ${checkInTime.split(' ')[1] || checkInTime}` : ''}
                            </span>
                        ) : todayStatus === 'COMPLETED' ? (
                            <span className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5">
                                <LuCircleCheck className="w-3.5 h-3.5 text-blue-600" />
                                Attendance Completed for Today
                            </span>
                        ) : (
                            <span className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1.5">
                                <LuClock className="w-3.5 h-3.5 text-amber-600" />
                                Not Checked In Yet
                            </span>
                        )}
                    </div>

                    {/* QR Code Container */}
                    <div className="mt-5 p-4 rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100/80 border border-gray-200 shadow-inner relative group">
                        
                        {isLocked ? (
                            <div className="py-12 flex flex-col items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center mb-3">
                                    <LuLock className="w-8 h-8" />
                                </div>
                                <p className="text-sm font-bold text-gray-800">Badge Hidden</p>
                                <p className="text-xs text-gray-500 mb-4">Tap unlock to display your dynamic QR</p>
                                <button
                                    onClick={handleUnlock}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                                >
                                    <LuLockOpen className="w-3.5 h-3.5" />
                                    Unlock Badge
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                {/* The Dynamic QR */}
                                <div className="bg-white p-3.5 rounded-xl shadow-md border border-gray-100 relative">
                                    {qrPayload ? (
                                        <QRCodeSVG
                                            value={qrPayload}
                                            size={200}
                                            level="M"
                                            includeMargin={false}
                                            className="w-48 h-48 sm:w-52 sm:h-52"
                                        />
                                    ) : (
                                        <div className="w-48 h-48 flex items-center justify-center text-gray-400">
                                            <LuQrCode className="w-16 h-16 animate-pulse" />
                                        </div>
                                    )}
                                </div>

                                {/* Rotation Progress Bar */}
                                <div className="w-full mt-4">
                                    <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 mb-1 px-1">
                                        <span className="flex items-center gap-1">
                                            <LuRefreshCw className={`w-3 h-3 text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
                                            Rotates in <strong className="text-emerald-700">{secondsLeft}s</strong>
                                        </span>
                                        <span className="text-[10px] text-gray-400">Anti-Screenshot</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 ease-linear"
                                            style={{ width: `${100 - progressPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Controls */}
                    <div className="mt-4 flex items-center justify-between gap-2">
                        <button
                            onClick={() => fetchBadge(true)}
                            disabled={refreshing}
                            className="flex-1 py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                            <LuRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'Refreshing...' : 'Refresh QR'}
                        </button>
                        <button
                            onClick={() => setIsLocked(!isLocked)}
                            className="py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                            title={isLocked ? "Unlock Badge" : "Lock for Privacy"}
                        >
                            {isLocked ? <LuLockOpen className="w-3.5 h-3.5 text-emerald-600" /> : <LuLock className="w-3.5 h-3.5" />}
                            {isLocked ? "Unlock" : "Lock"}
                        </button>
                    </div>

                </div>
            </div>

            {/* Quick Tips */}
            <div className="mt-6 max-w-sm w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/60 shadow-sm text-xs text-gray-600 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <LuInfo className="w-4 h-4" />
                </div>
                <div>
                    <p className="font-semibold text-gray-900">How to Scan:</p>
                    <p className="text-gray-500 mt-0.5">
                        Hold your phone screen facing the office terminal camera. The terminal will automatically beep and record your check-in or check-out in under 1 second.
                    </p>
                </div>
            </div>

            </main>
        </div>
    );
};

export default MyBadge;
