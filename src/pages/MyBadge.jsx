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
    LuExternalLink,
    LuHouse,
    LuMapPin,
    LuNavigation,
    LuLogIn,
    LuCheck,
    LuFileText,
    LuX,
    LuChevronRight,
    LuSettings,
    LuCircleAlert
} from 'react-icons/lu';
import API_BASE_URL from '../config/api.config';
import BrandLogo from '../components/BrandLogo';
import ModernLoader from '../components/ModernLoader';
import { canAccessWebApp } from '../utils/roleUtils';
import { isMobileClient, getMobileDeviceMetadata } from '../utils/deviceFingerprint';

const ROTATION_INTERVAL_SEC = 5;

const getDetectedPlatform = () => {
    if (typeof navigator === 'undefined') return 'ios';
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
    if (isIOS) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'ios';
};

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

    // Detected device platform & location help state
    const detectedPlatform = getDetectedPlatform();
    const [helpPlatform, setHelpPlatform] = useState(detectedPlatform);
    const [showLocationHelp, setShowLocationHelp] = useState(false);
    
    // WFH Punch Specific State
    const [wfhNotes, setWfhNotes] = useState('');
    const [punchLoading, setPunchLoading] = useState(false);
    const [location, setLocation] = useState({ lat: null, lng: null, accuracy: null, error: null, loading: false });
    const [elapsedTime, setElapsedTime] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const rawLocalMode = (user?.work_mode === 'Regular' ? 'Office' : (user?.work_mode || '')).trim().toLowerCase();
    const isLocalWfh = rawLocalMode === 'work from home' || rawLocalMode === 'wfh' || rawLocalMode === 'remote';
    const isMobile = isMobileClient();
    const isDesktopWithLayout = canAccessWebApp(user.role) && !isMobile;

    const timerRef = useRef(null);

    // Capture GPS Geolocation for WFH punch with 2-phase fallback (High Accuracy GPS -> Network/Wi-Fi)
    const captureLocation = useCallback(() => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                const errorMsg = 'Geolocation is not supported by this browser.';
                setLocation(prev => ({ ...prev, error: errorMsg, loading: false }));
                resolve(null);
                return;
            }
            setLocation(prev => ({ ...prev, loading: true, error: null }));

            const isIOS = getDetectedPlatform() === 'ios';

            const handleSuccess = (pos) => {
                const loc = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: Math.round(pos.coords.accuracy),
                    error: null,
                    loading: false
                };
                setLocation(loc);
                resolve(loc);
            };

            const handleError = (err) => {
                let errorMsg = 'Could not determine GPS location.';
                if (err.code === 1) {
                    errorMsg = isIOS 
                        ? 'Safari website permission needed: Tap the "aA" icon in the address bar ➔ Website Settings ➔ Location ➔ set to "Allow".'
                        : 'Location access denied. Please enable site location permissions in browser settings.';
                } else if (err.code === 2) {
                    errorMsg = 'GPS position unavailable. Please ensure Wi-Fi or Cellular is active and tap Refresh GPS.';
                } else if (err.code === 3) {
                    errorMsg = 'GPS location request timed out. Please tap Refresh GPS to try again.';
                }
                setLocation(prev => ({ ...prev, lat: null, lng: null, loading: false, error: errorMsg }));
                resolve(null);
            };

            // Phase 1: High Accuracy GPS (8 sec timeout)
            navigator.geolocation.getCurrentPosition(
                handleSuccess,
                (err1) => {
                    // If error is code 2 (POSITION_UNAVAILABLE) or code 3 (TIMEOUT), fall back to standard accuracy
                    if (err1.code === 2 || err1.code === 3) {
                        console.warn('High-accuracy GPS unavailable indoors/timing out, attempting network fallback...', err1);
                        navigator.geolocation.getCurrentPosition(
                            handleSuccess,
                            handleError,
                            { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
                        );
                        return;
                    }
                    // For code 1 (PERMISSION_DENIED), dispatch error immediately
                    handleError(err1);
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
            );
        });
    }, []);

    const fetchBadge = useCallback(async (isManual = false) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Please log in to view your attendance badge.');
            setLoading(false);
            return;
        }

        if (isManual) setRefreshing(true);

        try {
            const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const devMeta = await getMobileDeviceMetadata();

            const response = await axios.get(`${API_BASE_URL}/api/attendance/my-badge`, {
                headers: { 
                    'x-access-token': token,
                    'x-client-timezone': clientTimezone,
                    'x-is-mobile': devMeta.isMobile ? 'true' : 'false',
                    'x-device-id': devMeta.deviceId,
                    'x-device-name': devMeta.deviceName,
                    'x-device-model': devMeta.deviceModel || ''
                },
                params: {
                    clientTimezone,
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

                // Auto capture location on WFH days
                if (response.data.isWfhDay || isLocalWfh) {
                    captureLocation();
                }
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
    }, [captureLocation]);

    // Initial fetch
    useEffect(() => {
        fetchBadge();
    }, [fetchBadge]);

    // Countdown and auto-refresh timer ONLY for office QR badge (disabled on WFH days)
    useEffect(() => {
        if (loading || isLocked || error || badgeData?.isWfhDay || isLocalWfh) return;

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
    }, [loading, isLocked, error, badgeData?.isWfhDay, isLocalWfh, fetchBadge]);

    // Live elapsed timer for CHECKED_IN status on WFH days
    useEffect(() => {
        const isWfh = badgeData?.isWfhDay || isLocalWfh;
        if (!isWfh || badgeData?.todayStatus !== 'CHECKED_IN' || !badgeData?.checkInTime) {
            setElapsedTime('');
            return;
        }

        const updateTimer = () => {
            const timeRaw = badgeData?.badge?.checkInTime || badgeData?.checkInTime;
            if (!timeRaw) return;

            let startTime = new Date(timeRaw).getTime();
            if (isNaN(startTime)) {
                // If it's a formatted time string like "09:30 AM", fallback to today
                const parts = timeRaw.split(' ');
                if (parts.length >= 2) {
                    const todayDate = new Date().toISOString().split('T')[0];
                    startTime = new Date(`${todayDate} ${timeRaw}`).getTime();
                }
            }

            if (!isNaN(startTime)) {
                const now = Date.now();
                const diffMs = Math.max(0, now - startTime);
                const hrs = Math.floor(diffMs / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                const secs = Math.floor((diffMs % 60000) / 1000);
                setElapsedTime(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [badgeData?.isWfhDay, badgeData?.todayStatus, badgeData?.checkInTime, badgeData?.badge?.checkInTime]);

    // Handle WFH Check-In / Check-Out Punch
    const handleWfhPunch = async (action) => {
        setPunchLoading(true);
        try {
            let lat = location.lat;
            let lng = location.lng;

            if (!lat || !lng || (lat === 0 && lng === 0)) {
                const freshLoc = await captureLocation();
                if (freshLoc && freshLoc.lat && freshLoc.lng) {
                    lat = freshLoc.lat;
                    lng = freshLoc.lng;
                } else {
                    const actionVerb = action === 'CHECK_IN' ? 'check in' : 'check out';
                    toast.error(`Location required: Please enable device location permissions in settings to ${actionVerb}.`);
                    setHelpPlatform(detectedPlatform);
                    setShowLocationHelp(true);
                    setPunchLoading(false);
                    return;
                }
            }

            const token = localStorage.getItem('token');
            const devMeta = await getMobileDeviceMetadata();
            const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const payload = {
                action,
                latitude: lat,
                longitude: lng,
                clientTimezone,
                notes: wfhNotes ? wfhNotes.trim() : undefined
            };

            const response = await axios.post(`${API_BASE_URL}/api/attendance/wfh-punch`, payload, {
                headers: {
                    'x-access-token': token,
                    'x-client-timezone': clientTimezone,
                    'x-is-mobile': devMeta.isMobile ? 'true' : 'false',
                    'x-device-id': devMeta.deviceId,
                    'x-device-name': devMeta.deviceName,
                    'x-device-model': devMeta.deviceModel || ''
                }
            });

            if (response.data && response.data.success) {
                toast.success(response.data.message || `${action === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} successful!`);
                setWfhNotes('');
                fetchBadge(true);
            } else {
                toast.error(response.data?.message || 'Failed to record attendance punch.');
            }
        } catch (err) {
            console.error('WFH punch error:', err);
            const msg = err.response?.data?.message || 'Failed to record attendance punch.';
            toast.error(msg);
        } finally {
            setPunchLoading(false);
        }
    };

    const handleUnlock = async () => {
        if (window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
            try {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (available) {
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

    // Desktop browser notice ONLY for Office workers who need kiosk scanning with phone
    if (!isMobile && !badgeData?.isWfhDay) {
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
                    <h2 className="text-xl font-black text-slate-900 mb-2">Office Mode: Mobile Device Required</h2>
                    <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        Smart Attendance Badges with dynamic rotating QR codes must be presented at the office kiosk scanner from your bound mobile device. 
                        Please open the official <strong>WorkPulse Mobile App</strong> or mobile browser on your registered phone.
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
                    Loading attendance details...
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

    const { employee, qrPayload, todayStatus, checkInTime, isWfhDay, workMode, todayDayOfWeek } = badgeData || {};

    const rawBadgeMode = (workMode === 'Regular' ? 'Office' : (workMode || '')).trim().toLowerCase();
    const isBadgeWfh = rawBadgeMode === 'work from home' || rawBadgeMode === 'wfh' || rawBadgeMode === 'remote';
    const effectiveIsWfh = isLocalWfh || isBadgeWfh || Boolean(isWfhDay);

    const progressPercent = ((ROTATION_INTERVAL_SEC - secondsLeft) / ROTATION_INTERVAL_SEC) * 100;

    return (
        <div className="w-full min-h-screen bg-slate-100 flex flex-col items-center">
            
            {/* Top Navigation Bar - ONLY for Mobile / Standalone self-service view */}
            {!isDesktopWithLayout && (
                <header className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-30 safe-area-top shadow-lg">
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
                {!isDesktopWithLayout && (
                    <div className="text-center mb-5 max-w-sm w-full">
                        {effectiveIsWfh ? (
                            <>
                                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-900 text-xs font-bold mb-2 shadow-sm border border-blue-300">
                                    <LuHouse className="w-4 h-4 text-blue-700" />
                                    <span>{workMode === 'Hybrid' ? `Hybrid Mode: Remote (${todayDayOfWeek || 'Today'})` : 'Work From Home Mode'}</span>
                                </div>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">WFH Attendance</h1>
                                <p className="text-xs text-slate-600 font-medium mt-1">
                                    Punch your attendance directly with bound device & GPS
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold mb-2.5 shadow-sm border border-emerald-300">
                                    <LuShieldCheck className="w-4 h-4 text-emerald-700" />
                                    <span>Official Digital ID & Attendance Badge</span>
                                </div>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Smart Attendance Badge</h1>
                                <p className="text-xs text-slate-600 font-medium mt-1">
                                    Hold this QR code in front of the office kiosk scanner
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* Main Card Container */}
                <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 transition-all">
                    
                    {/* Card Top Accent Banner */}
                    <div className={`h-28 ${effectiveIsWfh ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600' : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600'} p-4 relative overflow-hidden`}>
                        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                        <div className="relative z-10 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center p-1 border border-white/20">
                                    <BrandLogo showText={false} iconSize="w-6 h-6" />
                                </div>
                                <span className="font-bold text-sm tracking-wide">WorkPulse</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/20">
                                <span className={`w-2 h-2 rounded-full ${effectiveIsWfh ? 'bg-sky-300' : 'bg-emerald-400'} animate-ping`} />
                                <span className={`w-2 h-2 rounded-full ${effectiveIsWfh ? 'bg-sky-300' : 'bg-emerald-400'} -ml-3.5`} />
                                {effectiveIsWfh ? 'Remote Punch' : 'Live Security'}
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
                                    className={`w-full h-full rounded-full ${effectiveIsWfh ? 'bg-gradient-to-tr from-blue-500 to-indigo-500' : 'bg-gradient-to-tr from-emerald-500 to-teal-400'} text-white font-bold text-2xl items-center justify-center shadow-inner`}
                                    style={{ display: employee?.avatarUrl ? 'none' : 'flex' }}
                                >
                                    {employee?.name ? employee.name.charAt(0).toUpperCase() : <LuUser className="w-10 h-10" />}
                                </div>
                            </div>
                            <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full ${effectiveIsWfh ? 'bg-blue-600' : 'bg-emerald-500'} text-white flex items-center justify-center shadow-md border-2 border-white text-[10px]`}>
                                {effectiveIsWfh ? <LuHouse className="w-3.5 h-3.5" /> : <LuSparkles className="w-3.5 h-3.5" />}
                            </div>
                        </div>

                        {/* Employee Identity */}
                        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                            {employee?.name || 'Employee'}
                        </h2>
                        <p className={`text-xs font-semibold ${effectiveIsWfh ? 'text-blue-600' : 'text-emerald-600'} mt-0.5`}>
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
                            ) : todayStatus === 'ON_LEAVE' ? (
                                <span className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1.5">
                                    <LuInfo className="w-3.5 h-3.5 text-purple-600" />
                                    On Approved Leave Today
                                </span>
                            ) : (
                                <span className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1.5">
                                    <LuClock className="w-3.5 h-3.5 text-amber-600" />
                                    Not Checked In Yet
                                </span>
                            )}
                        </div>

                        {/* ========================================================================= */}
                        {/* CONDITIONAL RENDER: WFH PUNCH vs OFFICE QR BADGE */}
                        {/* ========================================================================= */}
                        {effectiveIsWfh ? (
                            /* ─── WFH PUNCH CARD VIEW (DO NOT SHOW QR CODE!) ─── */
                            <div className="mt-5 text-left">
                                
                                {/* Live Stopwatch if Checked In */}
                                {todayStatus === 'CHECKED_IN' && elapsedTime && (
                                    <div className="mb-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white text-center shadow-md">
                                        <p className="text-[11px] uppercase tracking-wider text-emerald-100 font-bold">Session Duration</p>
                                        <p className="text-3xl font-black tracking-tight mt-1 font-mono">{elapsedTime}</p>
                                        <p className="text-[10px] text-emerald-100 mt-1">Check-in at {checkInTime}</p>
                                    </div>
                                )}

                                {/* GPS Location Status Card */}
                                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                            <LuMapPin className="w-3.5 h-3.5 text-blue-600" />
                                            GPS Telemetry
                                        </span>
                                        <button
                                            onClick={captureLocation}
                                            disabled={location.loading}
                                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                        >
                                            <LuRefreshCw className={`w-3 h-3 ${location.loading ? 'animate-spin' : ''}`} />
                                            {location.loading ? 'Locating...' : 'Refresh GPS'}
                                        </button>
                                    </div>

                                    {location.lat && location.lng ? (
                                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                                            </span>
                                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                                <LuCheck className="w-3.5 h-3.5" />
                                                Acquired {location.accuracy ? `(±${location.accuracy}m)` : ''}
                                            </span>
                                        </div>
                                    ) : location.error ? (
                                        <div className="space-y-2">
                                            <p className="text-[11px] text-rose-500 font-medium leading-tight">
                                                {location.error}
                                            </p>
                                            {detectedPlatform === 'ios' && (
                                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 text-left shadow-sm">
                                                    <p className="font-bold flex items-center gap-1.5 text-amber-900 text-xs">
                                                        <span>📍</span> Safari Per-Website Setting Required:
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-amber-800 leading-relaxed font-medium">
                                                        Even with iPhone Settings turned on, Safari requires permission for this specific site:
                                                    </p>
                                                    <ol className="list-decimal list-inside mt-1.5 space-y-1 text-amber-950 font-semibold text-[11px]">
                                                        <li>In Safari, tap the <span className="px-1 py-0.5 bg-amber-100 rounded font-bold border border-amber-300">aA</span> icon in the address bar.</li>
                                                        <li>Tap <strong>Website Settings</strong>.</li>
                                                        <li>Change <strong>Location</strong> from "Deny" to <strong>"Allow"</strong>.</li>
                                                        <li>Tap <strong>Done</strong>, then tap <strong>Refresh GPS</strong> above.</li>
                                                    </ol>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setHelpPlatform(detectedPlatform);
                                                    setShowLocationHelp(true);
                                                }}
                                                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl flex items-center justify-between border border-blue-200 transition-all active:scale-[0.98]"
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    <LuSmartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                    <span>View Complete Setup Steps ({detectedPlatform === 'ios' ? 'iPhone' : 'Android'})</span>
                                                </span>
                                                <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-0.5">
                                                    View Steps <LuChevronRight className="w-3 h-3" />
                                                </span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                                            <span className="italic">
                                                {location.loading ? 'Acquiring GPS coordinates...' : 'Tap Refresh GPS to capture coordinates'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setHelpPlatform(detectedPlatform);
                                                    setShowLocationHelp(true);
                                                }}
                                                className="text-blue-600 hover:text-blue-700 font-semibold underline text-[10px] ml-1 shrink-0"
                                            >
                                                Need help?
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Optional Work Notes */}
                                {todayStatus !== 'COMPLETED' && todayStatus !== 'ON_LEAVE' && (
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                            <LuFileText className="w-3.5 h-3.5 text-slate-500" />
                                            Notes / Summary (Optional)
                                        </label>
                                        <textarea
                                            value={wfhNotes}
                                            onChange={(e) => setWfhNotes(e.target.value)}
                                            rows={2}
                                            placeholder={todayStatus === 'CHECKED_IN' ? 'End of day work summary...' : 'What are you focusing on today?...'}
                                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50/50"
                                        />
                                    </div>
                                )}

                                {/* Main Action Punch Button */}
                                {todayStatus === 'NOT_CHECKED_IN' ? (
                                    <button
                                        onClick={() => handleWfhPunch('CHECK_IN')}
                                        disabled={punchLoading}
                                        className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                    >
                                        {punchLoading ? (
                                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        ) : (
                                            <>
                                                <LuLogIn className="w-5 h-5" />
                                                <span>Check In (WFH Punch)</span>
                                            </>
                                        )}
                                    </button>
                                ) : todayStatus === 'CHECKED_IN' ? (
                                    <button
                                        onClick={() => handleWfhPunch('CHECK_OUT')}
                                        disabled={punchLoading}
                                        className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-[0.98] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                    >
                                        {punchLoading ? (
                                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        ) : (
                                            <>
                                                <LuLogOut className="w-5 h-5" />
                                                <span>Check Out (WFH Punch)</span>
                                            </>
                                        )}
                                    </button>
                                ) : todayStatus === 'COMPLETED' ? (
                                    <div className="w-full py-3.5 px-4 bg-slate-100 text-slate-600 font-bold text-xs rounded-2xl text-center border border-slate-200">
                                        Day's attendance completed & submitted for review
                                    </div>
                                ) : (
                                    <div className="w-full py-3.5 px-4 bg-purple-50 text-purple-700 font-bold text-xs rounded-2xl text-center border border-purple-200">
                                        You are on approved leave today
                                    </div>
                                )}

                                {/* Security & Device Binding Info Note */}
                                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <LuSmartphone className="w-3.5 h-3.5 text-blue-600" />
                                        Bound Mobile Hardware
                                    </span>
                                    <span className="text-emerald-700 font-semibold">
                                        Verified
                                    </span>
                                </div>
                            </div>
                        ) : (
                            /* ─── OFFICE QR BADGE VIEW (Only for Office days) ─── */
                            <>
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
                            </>
                        )}

                    </div>
                </div>

                {/* Quick Tips */}
                <div className="mt-6 max-w-sm w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/60 shadow-sm text-xs text-gray-600 flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-lg ${isWfhDay ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <LuInfo className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">
                            {isWfhDay ? 'WFH Attendance Policy:' : 'How to Scan:'}
                        </p>
                        <p className="text-gray-500 mt-0.5">
                            {isWfhDay ? (
                                'Remote attendance punches are recorded directly to the cloud and verified with your device and GPS location. Check-outs are automatically routed to your reporting manager.'
                            ) : (
                                'Hold your phone screen facing the office terminal camera. The terminal will automatically beep and record your check-in or check-out in under 1 second.'
                            )}
                        </p>
                    </div>
                </div>

                {/* Location Permission Help Modal (iOS & Android) */}
                {showLocationHelp && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
                            {/* Header */}
                            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                                        <LuMapPin className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                                            Enable Location Services
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Required for Remote WFH Attendance Punch
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowLocationHelp(false)}
                                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                                >
                                    <LuX className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Platform Selector Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-2xl mt-4 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setHelpPlatform('ios')}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        helpPlatform === 'ios'
                                            ? 'bg-white text-blue-700 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <span>Apple iPhone (iOS)</span>
                                    {detectedPlatform === 'ios' && (
                                        <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded-full">
                                            Detected
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHelpPlatform('android')}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        helpPlatform === 'android'
                                            ? 'bg-white text-blue-700 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <span>Android Device</span>
                                    {detectedPlatform === 'android' && (
                                        <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded-full">
                                            Detected
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Scrollable Step List */}
                            <div className="mt-4 space-y-3 overflow-y-auto pr-1 flex-1 text-left text-xs">
                                {helpPlatform === 'ios' ? (
                                    <>
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl mb-2 text-left">
                                            <div className="flex items-start gap-2">
                                                <span className="text-base shrink-0 mt-0.5">💡</span>
                                                <div>
                                                    <p className="font-bold text-amber-900 text-xs">Why Safari says "Not Available":</p>
                                                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-medium">
                                                        Even when <em>Safari Websites</em> is set to <em>"While Using the App"</em>, Safari enforces a separate permission per website. Follow <strong>Step 3</strong> below to unblock this website!
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                1
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-800">Turn On iPhone Location (Done ✅)</p>
                                                <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                                                    Open your phone's <strong>Settings ⚙️</strong> ➔ <strong>Privacy & Security</strong> ➔ <strong>Location Services</strong>. Toggle it <strong>ON</strong>.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                2
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-800">Safari Websites Setting (Done ✅)</p>
                                                <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                                                    In <strong>Location Services</strong>, scroll down to <strong>Safari Websites</strong> ➔ Set to <strong>"While Using the App"</strong> and turn on <strong>"Precise Location"</strong>.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/80 border border-blue-200 ring-2 ring-blue-500/20">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                3
                                            </span>
                                            <div>
                                                <p className="font-bold text-blue-900 flex items-center gap-1.5">
                                                    <span>Unblock Website in Safari</span>
                                                    <span className="text-[10px] bg-blue-600 text-white font-black px-1.5 py-0.5 rounded-full">REQUIRED</span>
                                                </p>
                                                <p className="text-blue-800 text-[11px] mt-1 leading-relaxed font-medium">
                                                    While on this webpage in Safari, look at the address bar at the bottom:
                                                </p>
                                                <ol className="list-decimal list-inside mt-1 space-y-0.5 text-blue-900 font-semibold text-[11px]">
                                                    <li>Tap the <strong>"aA"</strong> icon on the address bar.</li>
                                                    <li>Tap <strong>Website Settings</strong>.</li>
                                                    <li>Tap <strong>Location</strong> ➔ select <strong>Allow</strong>.</li>
                                                    <li>Tap <strong>Done</strong>.</li>
                                                </ol>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                4
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-800">Tap "Refresh GPS"</p>
                                                <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                                                    Return here and tap <strong>"Refresh GPS"</strong>. Safari will now provide your precise coordinates.
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                1
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-800">Turn On Phone GPS</p>
                                                <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                                                    Swipe down from the top of your screen to open Quick Settings. Ensure the <strong>Location 📍</strong> icon is turned <strong>ON</strong>.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                2
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-800">Allow Location in Chrome</p>
                                                <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                                                    Tap the <strong>Lock / Tune icon 🔒</strong> on the left side of the address bar ➔ Tap <strong>Permissions</strong> ➔ Set <strong>Location</strong> to <strong>Allow</strong>.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                3
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-800">Chrome Site Settings (If blocked)</p>
                                                <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                                                    Tap Chrome <strong>Menu (⋮)</strong> ➔ <strong>Settings</strong> ➔ <strong>Site settings</strong> ➔ <strong>Location</strong> ➔ Remove WorkPulse from Blocked list.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                4
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-800">Refresh & Punch</p>
                                                <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                                                    Return here and tap the button below to acquire your location coordinates.
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const loc = await captureLocation();
                                        if (loc && loc.lat && loc.lng) {
                                            toast.success('GPS coordinates acquired successfully!');
                                            setShowLocationHelp(false);
                                        } else {
                                            toast.error('Location still not available. Please verify settings.');
                                        }
                                    }}
                                    disabled={location.loading}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                                >
                                    <LuRefreshCw className={`w-3.5 h-3.5 ${location.loading ? 'animate-spin' : ''}`} />
                                    <span>{location.loading ? 'Acquiring GPS...' : 'Refresh GPS & Try Again'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowLocationHelp(false)}
                                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default MyBadge;
