import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';
import API_BASE_URL from '../config/api.config';
import {
    LuQrCode,
    LuCheck,
    LuLock,
    LuMaximize,
    LuShieldAlert,
    LuRefreshCw,
    LuScanLine,
    LuArrowRight,
    LuClock,
    LuUser,
    LuCircleCheck,
    LuLogOut,
    LuLogIn,
    LuCamera,
    LuSwitchCamera,
    LuSparkles
} from "react-icons/lu";
import { fetchRoles, canAccessAttendancePortal } from '../utils/roleUtils';
import ModernLoader from '../components/ModernLoader';
import BrandLogo from '../components/BrandLogo';
import { formatTimeOnly, getCurrentInAppTimezone } from '../utils/timezone.util';

const Attendance = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    // Camera & Video
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const scanLoopRef = useRef(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState('');

    // Status & Results
    const [statusMessage, setStatusMessage] = useState('QR Scanner Ready. Scan your badge.');
    const [qrResult, setQrResult] = useState(null); // { success, type, employeeName, time, avatarUrl, duration, message }
    const qrProcessingRef = useRef(false);
    const lastScannedQrRef = useRef('');
    const lastScannedTimeRef = useRef(0);

    // Real-time terminal scan history
    const [recentScans, setRecentScans] = useState([]);

    // Live Clock
    const [currentTime, setCurrentTime] = useState(new Date());

    // Kiosk Fullscreen Lock State
    const [kioskLocked, setKioskLocked] = useState(false);
    const [fsActive, setFsActive] = useState(false);
    const [kioskModal, setKioskModal] = useState(null); // null | 'enter' | 'exit'
    const [kioskPassword, setKioskPassword] = useState('');
    const [kioskError, setKioskError] = useState('');
    const [kioskVerifying, setKioskVerifying] = useState(false);
    const kioskContainerRef = useRef(null);
    const kioskLockedRef = useRef(false);

    // Live clock timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Synthesized Web Audio Chimes
    const playSuccessChime = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const audioCtx = new AudioCtx();
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880.00, now + 0.1); // A5
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } catch (_) {}
    };

    const playErrorBeep = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const audioCtx = new AudioCtx();
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now); // A3
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } catch (_) {}
    };

    // 1. Verify Kiosk Access Permission on Mount
    useEffect(() => {
        const checkPermission = async () => {
            try {
                const freshRoles = await fetchRoles(true);
                const roleId = typeof user?.role === 'object' ? (user.role?.id || user.role?.roleId) : user?.role;
                const roleObj = freshRoles.find(r => r.id === parseInt(roleId));

                const allowed = roleObj 
                    ? (roleObj.can_access_attendance_portal === true || roleObj.can_access_attendance_portal === 1 || roleObj.can_access_attendance_portal === 'true' || roleObj.can_access_kiosk === true)
                    : canAccessAttendancePortal(user?.role);

                setHasPermission(!!allowed);
            } catch (err) {
                console.error('Error checking kiosk attendance permission:', err);
                setHasPermission(false);
            } finally {
                setPermissionChecked(true);
            }
        };
        checkPermission();
    }, [user?.role]);

    // 2. Discover available camera devices
    useEffect(() => {
        if (!hasPermission) return;
        const getDevices = async () => {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                    const allDevices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevs = allDevices.filter(d => d.kind === 'videoinput');
                    setDevices(videoDevs);
                    if (videoDevs.length > 0 && !selectedDeviceId) {
                        setSelectedDeviceId(videoDevs[0].deviceId);
                    }
                }
            } catch (e) {
                console.error("Error enumerating devices:", e);
            }
        };
        getDevices();
    }, [hasPermission]);

    // 3. Start Camera and Fast QR Detection Loop
    const startCamera = async () => {
        stopCamera();
        setCameraError('');
        try {
            const constraints = {
                video: selectedDeviceId 
                    ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                    : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setCameraActive(true);
                runDetectionLoop();
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setCameraError(err.message || 'Unable to access camera. Please verify permissions.');
            setCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (scanLoopRef.current) {
            clearTimeout(scanLoopRef.current);
            scanLoopRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
    };

    useEffect(() => {
        if (hasPermission) {
            startCamera();
        }
        return () => {
            stopCamera();
        };
    }, [hasPermission, selectedDeviceId]);

    // High-performance QR Detection Loop with jsQR
    const runDetectionLoop = () => {
        if (!streamRef.current || !videoRef.current) return;

        const scanFrame = async () => {
            if (!streamRef.current) return;

            if (
                videoRef.current &&
                videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
                !qrProcessingRef.current
            ) {
                try {
                    const video = videoRef.current;
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 480;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert"
                    });

                    if (code && code.data && code.data.startsWith('WPQR.')) {
                        await handleQrScanned(code.data);
                    }
                } catch (qrErr) {
                    console.error("QR frame scan error:", qrErr);
                }
            }

            if (streamRef.current) {
                scanLoopRef.current = setTimeout(scanFrame, 100); // 10 scans/second
            }
        };

        scanLoopRef.current = setTimeout(scanFrame, 100);
    };

    // Handler for Scanned QR Badge
    const handleQrScanned = async (qrPayload) => {
        const now = Date.now();
        if (qrProcessingRef.current) return;
        if (lastScannedQrRef.current === qrPayload && now - lastScannedTimeRef.current < 3500) {
            return; // debounce identical QR scan
        }

        qrProcessingRef.current = true;
        lastScannedQrRef.current = qrPayload;
        lastScannedTimeRef.current = now;

        try {
            playSuccessChime();
            setStatusMessage("Verifying dynamic badge...");
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE_URL}/api/attendance/scan-qr-badge`, {
                qrPayload
            }, {
                headers: { 'x-access-token': token }
            });

            const data = response.data;
            if (data && data.success) {
                setQrResult(data);
                toast.success(data.message || `${data.employeeName} recorded ${data.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}`);
                
                // Add to recent local scan activity
                setRecentScans(prev => [{
                    id: Date.now(),
                    employeeName: data.employeeName,
                    type: data.type,
                    time: data.time || new Date().toLocaleTimeString(),
                    avatarUrl: data.avatarUrl,
                    duration: data.duration
                }, ...prev.slice(0, 9)]);

                // Auto dismiss celebration modal in 2.8 seconds
                setTimeout(() => {
                    setQrResult(null);
                    qrProcessingRef.current = false;
                    setStatusMessage("QR Scanner Ready. Scan your badge.");
                }, 2800);
            }
        } catch (err) {
            console.error("QR Badge scan error:", err);
            playErrorBeep();
            const serverMsg = err.response?.data?.message || "Invalid or expired QR badge.";
            toast.error(serverMsg);
            setStatusMessage(serverMsg);

            setTimeout(() => {
                qrProcessingRef.current = false;
                setStatusMessage("QR Scanner Ready. Scan your badge.");
            }, 2200);
        }
    };

    // ---------- Kiosk full-screen lock ----------
    useEffect(() => { kioskLockedRef.current = kioskLocked; }, [kioskLocked]);

    const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

    const requestFs = async (el) => {
        if (!el) return;
        if (el.requestFullscreen) return el.requestFullscreen();
        if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    };

    const exitFs = async () => {
        if (document.exitFullscreen) return document.exitFullscreen();
        if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    };

    const lockKeyboard = async () => {
        try { if (navigator.keyboard?.lock) await navigator.keyboard.lock(); } catch { /* not supported */ }
    };
    const unlockKeyboard = () => {
        try { navigator.keyboard?.unlock?.(); } catch { /* no-op */ }
    };

    const verifyUserPassword = async (pwd) => {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API_BASE_URL}/api/auth/verify-password`, { password: pwd }, {
            headers: { 'x-access-token': token }
        });
        return res.data?.success === true;
    };

    const openKioskModal = (mode) => {
        setKioskError('');
        setKioskPassword('');
        setKioskModal(mode);
    };

    const handleKioskSubmit = async (e) => {
        e.preventDefault();
        if (!kioskPassword) { setKioskError('Password is required.'); return; }
        setKioskVerifying(true);
        setKioskError('');
        try {
            const ok = await verifyUserPassword(kioskPassword);
            if (!ok) { setKioskError('Incorrect password.'); return; }

            if (kioskModal === 'enter') {
                await requestFs(kioskContainerRef.current);
                await lockKeyboard();
                setKioskLocked(true);
            } else {
                setKioskLocked(false);
                unlockKeyboard();
                if (isFullscreen()) await exitFs();
            }
            setKioskModal(null);
            setKioskPassword('');
        } catch (err) {
            setKioskError(err.response?.data?.message || 'Verification failed. Try again.');
        } finally {
            setKioskVerifying(false);
        }
    };

    const handleEnterKiosk = async () => {
        try {
            await requestFs(kioskContainerRef.current);
            await lockKeyboard();
            setKioskLocked(true);
        } catch (err) {
            console.error("Error entering kiosk mode:", err);
            toast.error("Failed to enter Full Screen mode.");
        }
    };

    useEffect(() => {
        const onFsChange = () => {
            const active = isFullscreen();
            setFsActive(active);
            if (!active && kioskLockedRef.current) {
                unlockKeyboard();
            }
        };
        const onKeyDown = (e) => {
            if (!kioskLockedRef.current) return;
            const k = e.key;
            const ctrl = e.ctrlKey || e.metaKey;
            const blocked =
                k === 'Escape' || k === 'F11' || k === 'F5' ||
                (ctrl && ['r', 'w', 'n', 't', 'p'].includes((k || '').toLowerCase()));
            if (blocked) {
                e.preventDefault();
                e.stopPropagation();
                if (k === 'Escape') openKioskModal('exit');
            }
        };
        const onContextMenu = (e) => { if (kioskLockedRef.current) e.preventDefault(); };
        const onBeforeUnload = (e) => {
            if (kioskLockedRef.current) { e.preventDefault(); e.returnValue = ''; }
        };

        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('contextmenu', onContextMenu, true);
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('webkitfullscreenchange', onFsChange);
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('contextmenu', onContextMenu, true);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, []);

    // Render loading screen while permission is validating
    if (!permissionChecked) {
        return <ModernLoader message="Verifying Kiosk Access Permission..." fullScreen={true} />;
    }

    // Unauthorized View
    if (!hasPermission) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-scaleUp">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6 text-amber-600 shadow-sm">
                        <LuShieldAlert size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                        Kiosk Access Required
                    </h2>
                    <p className="text-sm text-slate-500 leading-relaxed mb-6">
                        Your account role does not have permission to operate the Attendance Kiosk Terminal. 
                        Please contact your administrator to grant <strong className="text-slate-800">"Access Kiosk Attendance Terminal"</strong> permission.
                    </p>
                    <div className="space-y-3">
                        <Link
                            to="/my-requests"
                            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                        >
                            Go to My Requests
                        </Link>
                        <Link
                            to="/"
                            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2"
                        >
                            Return to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={kioskContainerRef}
            className={`${fsActive ? 'min-h-screen w-screen overflow-y-auto bg-slate-950 p-4 sm:p-6 lg:p-10 flex flex-col justify-between relative' : 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative'}`}
        >
            {/* Exit Kiosk button (Lock icon) in top-right */}
            {kioskLocked && (
                <button
                    onClick={() => openKioskModal('exit')}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 p-3.5 bg-slate-900/90 hover:bg-rose-950 text-rose-400 hover:text-rose-300 rounded-2xl shadow-xl border border-rose-900/40 transition-all active:scale-95 z-40 flex items-center justify-center backdrop-blur-md"
                    title="Exit Kiosk Mode (Password Required)"
                >
                    <LuLock size={20} />
                </button>
            )}

            {/* Top Bar / Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <BrandLogo />
                    <div className="hidden sm:block h-8 w-[1px] bg-slate-200 dark:bg-slate-800" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                                Attendance Kiosk
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                Live QR Scanner
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Front-Desk Dynamic Smart Badge Terminal
                        </p>
                    </div>
                </div>

                {/* Clock & Fullscreen action */}
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-right">
                        <div className="text-base sm:text-lg font-black font-mono tracking-tight text-slate-900 dark:text-white">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                    </div>

                    {!kioskLocked && (
                        <button
                            onClick={handleEnterKiosk}
                            className="inline-flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-600/20 transition active:scale-95"
                            title="Lock this terminal in full-screen kiosk mode"
                        >
                            <LuMaximize size={16} />
                            <span>Kiosk Mode</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Terminal Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Left 7 Columns: Camera Viewfinder HUD */}
                <div className="lg:col-span-7 bg-[#0b0f19] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative flex flex-col justify-between p-5 min-h-[460px]">
                    {/* Viewfinder Header */}
                    <div className="flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${cameraActive ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                            <span className="text-xs uppercase tracking-widest font-black text-emerald-400">
                                {cameraActive ? 'Badge Scanner Active' : 'Camera Offline'}
                            </span>
                        </div>

                        {/* Camera device selector if multiple */}
                        {devices.length > 1 && (
                            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
                                <LuSwitchCamera size={14} className="text-slate-400" />
                                <select
                                    value={selectedDeviceId}
                                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                                    className="bg-transparent text-[11px] font-bold text-slate-300 focus:outline-none cursor-pointer"
                                >
                                    {devices.map((d, i) => (
                                        <option key={d.deviceId || i} value={d.deviceId} className="bg-slate-900 text-white">
                                            {d.label || `Camera ${i + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Camera Video Feed */}
                    <div className="my-auto relative flex justify-center items-center w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                        {cameraError ? (
                            <div className="p-6 text-center text-rose-400">
                                <LuShieldAlert size={36} className="mx-auto mb-2 text-rose-500" />
                                <p className="text-xs font-bold">{cameraError}</p>
                                <button
                                    onClick={startCamera}
                                    className="mt-3 px-4 py-2 bg-rose-900/50 hover:bg-rose-900 text-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto"
                                >
                                    <LuRefreshCw size={14} /> Retry Camera
                                </button>
                            </div>
                        ) : (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover transform -scale-x-100"
                            />
                        )}

                        {/* Animated Scanner Reticle */}
                        {cameraActive && !qrResult && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                                <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/80 rounded-3xl relative shadow-[0_0_35px_rgba(16,185,129,0.3)] flex items-center justify-center">
                                    {/* Corner Brackets */}
                                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                                    {/* Animated Laser Scanning Line */}
                                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute shadow-[0_0_12px_#34d399] animate-bounce" style={{ animationDuration: '2s' }} />

                                    <div className="text-center bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/30">
                                        <LuQrCode className="w-5 h-5 mx-auto text-emerald-400 mb-0.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                                            Align Smart Badge
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Celebration / Scan Success Card Overlay */}
                        {qrResult && (
                            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn z-30">
                                <div className="relative mb-3">
                                    {qrResult.avatarUrl ? (
                                        <img
                                            src={`${API_BASE_URL}/${qrResult.avatarUrl}`}
                                            alt={qrResult.employeeName}
                                            className="w-24 h-24 rounded-full object-cover border-4 border-emerald-400 shadow-2xl"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-4 border-emerald-400 flex items-center justify-center text-emerald-400 text-3xl font-black shadow-2xl">
                                            {qrResult.employeeName?.charAt(0) || '✓'}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-2 -right-2 p-2 bg-emerald-500 text-white rounded-full shadow-lg">
                                        <LuCheck size={20} strokeWidth={3} />
                                    </div>
                                </div>

                                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 shadow-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {qrResult.type === 'CHECK_IN' ? <LuLogIn size={14} /> : <LuLogOut size={14} />}
                                    <span>{qrResult.type === 'CHECK_IN' ? 'Check-In Recorded' : 'Check-Out Recorded'}</span>
                                </div>

                                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                    {qrResult.employeeName}
                                </h2>

                                <p className="text-emerald-300 font-mono text-base font-bold mt-1">
                                    {qrResult.time}
                                </p>

                                {qrResult.duration && (
                                    <div className="mt-2 text-xs font-bold text-slate-300 bg-slate-900/80 px-3 py-1 rounded-xl border border-slate-700">
                                        Worked Duration: <span className="text-emerald-400 font-mono">{qrResult.duration}</span>
                                    </div>
                                )}

                                <p className="text-xs text-slate-400 mt-3 font-medium">
                                    {qrResult.message || 'Attendance logged successfully! Have a great day.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Viewfinder Footer status bar */}
                    <div className="flex items-center justify-between z-10 pt-3 border-t border-slate-800 text-xs">
                        <div className="flex items-center gap-2 text-slate-400 font-medium">
                            <LuScanLine size={16} className="text-emerald-400 animate-pulse" />
                            <span>{statusMessage}</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                            AES-256 Dynamic QR
                        </span>
                    </div>
                </div>

                {/* Right 5 Columns: Instructions & Recent Activity */}
                <div className="lg:col-span-5 flex flex-col justify-between gap-6">
                    {/* Instructions Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                <LuSparkles size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    How to Check In / Out
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Zero-touch instant badge scanning
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    1
                                </span>
                                <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    Open your <strong>WorkPulse Mobile App</strong> or <strong>Web Portal</strong> and navigate to <strong>My Smart Badge</strong>.
                                </p>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    2
                                </span>
                                <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    Hold your phone's screen <strong>6-12 inches</strong> in front of this camera inside the scanning box.
                                </p>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    3
                                </span>
                                <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    The kiosk instantly captures attendance and provides audio & visual confirmation!
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Recent Kiosk Scans Activity Feed */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <LuClock size={18} className="text-slate-400" />
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                    Today's Recent Scans
                                </h3>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                                Terminal Session Log
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2.5 max-h-56 pr-1">
                            {recentScans.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                                    <LuQrCode size={28} className="mx-auto mb-2 opacity-40" />
                                    <p>No badge scans recorded in this session yet.</p>
                                </div>
                            ) : (
                                recentScans.map((scan) => (
                                    <div
                                        key={scan.id}
                                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800"
                                    >
                                        <div className="flex items-center gap-3">
                                            {scan.avatarUrl ? (
                                                <img
                                                    src={`${API_BASE_URL}/${scan.avatarUrl}`}
                                                    alt={scan.employeeName}
                                                    className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {scan.employeeName?.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                                    {scan.employeeName}
                                                </h4>
                                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                                    {scan.time}
                                                </span>
                                            </div>
                                        </div>

                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            scan.type === 'CHECK_IN'
                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                        }`}>
                                            {scan.type === 'CHECK_IN' ? 'In' : 'Out'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exit / Enter Kiosk Password Confirmation Modal */}
            {kioskModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5 text-slate-900 dark:text-white shadow-sm">
                            <LuLock size={26} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-1">
                            {kioskModal === 'exit' ? 'Exit Kiosk Mode' : 'Lock in Kiosk Mode'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed mb-5">
                            Please enter your account password to verify authorization and exit the kiosk lock.
                        </p>

                        <form onSubmit={handleKioskSubmit} className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    value={kioskPassword}
                                    onChange={(e) => setKioskPassword(e.target.value)}
                                    placeholder="Enter your password..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                                    autoFocus
                                />
                                {kioskError && (
                                    <p className="text-xs text-rose-500 mt-1.5 font-bold">{kioskError}</p>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setKioskModal(null)}
                                    disabled={kioskVerifying}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={kioskVerifying}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {kioskVerifying ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        'Confirm'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
