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
    LuShieldCheck,
    LuRefreshCw,
    LuScanLine,
    LuArrowRight,
    LuClock,
    LuUser,
    LuCircleCheck,
    LuLogOut,
    LuLogIn,
    LuCamera,
    LuCameraOff,
    LuPower,
    LuSwitchCamera,
    LuSparkles,
    LuX
} from "react-icons/lu";
import { fetchRoles, canAccessAttendancePortal } from '../utils/roleUtils';
import ModernLoader from '../components/ModernLoader';
import BrandLogo from '../components/BrandLogo';
import { formatTimeOnly, formatDateOnly, formatInTimezone, getAppTimezone, getAppDateFormat, getAppTimeFormat, getCurrentInAppTimezone } from '../utils/timezone.util';

const Attendance = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    // Camera & Video
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const scanLoopRef = useRef(null);
    const barcodeDetectorRef = useRef(null);
    const canvasRef = useRef(null);
    const isScanningRef = useRef(false);
    const videoFrameCallbackIdRef = useRef(null);
    const animFrameIdRef = useRef(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [privacyBlur, setPrivacyBlur] = useState(true); // Privacy shield active by default

    // Inactivity Standby / Power-Saving State (5 minutes timeout)
    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (300,000 ms)
    const [scannerSleeping, setScannerSleeping] = useState(false);
    const inactivityTimerRef = useRef(null);
    const scannerSleepingRef = useRef(false);

    useEffect(() => {
        scannerSleepingRef.current = scannerSleeping;
    }, [scannerSleeping]);

    const handleInactivitySleep = () => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
        stopCamera();
        setScannerSleeping(true);
        scannerSleepingRef.current = true;
        setStatusMessage('Scanner paused due to inactivity. Tap "Open Scanner" to resume.');
    };

    const resetInactivityTimer = () => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
        if (!scannerSleepingRef.current) {
            inactivityTimerRef.current = setTimeout(() => {
                handleInactivitySleep();
            }, INACTIVITY_TIMEOUT_MS);
        }
    };

    const handleWakeScanner = async () => {
        setScannerSleeping(false);
        scannerSleepingRef.current = false;
        setStatusMessage('QR Scanner Ready. Scan your badge.');
        await startCamera();
        resetInactivityTimer();
    };

    // User activity listener to keep scanner awake during active kiosk interactions
    const lastUserActivityRef = useRef(0);
    const handleUserActivity = () => {
        if (scannerSleepingRef.current) return;
        const now = Date.now();
        if (now - lastUserActivityRef.current > 2000) {
            lastUserActivityRef.current = now;
            resetInactivityTimer();
        }
    };

    // Initialize native hardware-accelerated BarcodeDetector (Chrome/Chromium native, <5ms detection)
    useEffect(() => {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
                barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
            } catch (err) {
                console.warn('Native BarcodeDetector not available, using jsQR fallback:', err);
            }
        }
    }, []);

    // Status & Results
    const [statusMessage, setStatusMessage] = useState('QR Scanner Ready. Scan your badge.');
    const [qrConfirmation, setQrConfirmation] = useState(null); // { confirmationToken, type, employeeName, time, avatarUrl, duration, message }
    const [confirmCountdown, setConfirmCountdown] = useState(15);
    const confirmTimerRef = useRef(null);
    const qrProcessingRef = useRef(false);
    const lastScannedQrRef = useRef('');
    const lastScannedTimeRef = useRef(0);
    const lastScanTimeRef = useRef(0);
    const lastJsQrScanRef = useRef(0);
    const qrConfirmationRef = useRef(null);

    useEffect(() => {
        qrConfirmationRef.current = qrConfirmation;
    }, [qrConfirmation]);

    // Dedicated Right-Panel Notification & Live Status state
    const [panelNotification, setPanelNotification] = useState(null); // { type, title, message, detail, employeeName, avatarUrl, time, duration }
    const panelNotificationTimerRef = useRef(null);

    const triggerPanelNotification = (type, title, message, extras = {}) => {
        if (panelNotificationTimerRef.current) clearTimeout(panelNotificationTimerRef.current);
        setPanelNotification({ type, title, message, ...extras });
        panelNotificationTimerRef.current = setTimeout(() => {
            setPanelNotification(null);
        }, type === 'success' ? 6500 : 5000);
    };

    // Live Clock & System Settings Timezone Synchronization
    const [currentTime, setCurrentTime] = useState(new Date());
    const [, setSettingsVersion] = useState(0);

    // Sync system settings on mount & listen for dynamic settings changes
    useEffect(() => {
        const syncSettings = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            try {
                const res = await axios.get(`${API_BASE_URL}/api/settings`, {
                    headers: { 'x-access-token': token }
                });
                if (res.data && res.data.map) {
                    localStorage.setItem('settings', JSON.stringify(res.data.map));
                    setSettingsVersion(v => v + 1);
                }
            } catch (err) {
                console.warn("Could not sync settings in Attendance:", err);
            }
        };

        syncSettings();

        const onSettingsLoaded = () => setSettingsVersion(v => v + 1);
        window.addEventListener('settingsLoaded', onSettingsLoaded);
        return () => window.removeEventListener('settingsLoaded', onSettingsLoaded);
    }, []);

    // Live clock timer (1-second tick)
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Timezone-aware clock formatters based on System Settings
    const formatLiveTime = (date) => {
        try {
            const tz = getAppTimezone();
            const timeFmt = getAppTimeFormat();
            return new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: timeFmt !== '24h'
            }).format(date);
        } catch (_) {
            return formatTimeOnly(date);
        }
    };

    const formatLiveDate = (date) => {
        try {
            const tz = getAppTimezone();
            const dateFmt = getAppDateFormat();
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                weekday: 'short',
                month: 'short',
                day: '2-digit',
                year: 'numeric'
            }).formatToParts(date);
            const p = {};
            parts.forEach(part => { p[part.type] = part.value; });

            if (dateFmt === 'DD/MM/YYYY') return `${p.weekday}, ${p.day}/${p.month}/${p.year}`;
            if (dateFmt === 'MM/DD/YYYY') return `${p.weekday}, ${p.month}/${p.day}/${p.year}`;
            if (dateFmt === 'YYYY-MM-DD') return `${p.weekday}, ${p.year}-${p.month}-${p.day}`;
            return `${p.weekday}, ${p.month} ${p.day}, ${p.year}`;
        } catch (_) {
            return formatDateOnly(date);
        }
    };

    const getTimezoneAbbr = (date) => {
        try {
            const tz = getAppTimezone();
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'short'
            }).formatToParts(date);
            return parts.find(p => p.type === 'timeZoneName')?.value || tz.split('/').pop().replace(/_/g, ' ');
        } catch (_) {
            return '';
        }
    };

    // Kiosk Fullscreen Lock State
    const [kioskLocked, setKioskLocked] = useState(false);
    const [fsActive, setFsActive] = useState(false);
    const [kioskModal, setKioskModal] = useState(null); // null | 'enter' | 'exit'
    const [kioskPassword, setKioskPassword] = useState('');
    const [kioskError, setKioskError] = useState('');
    const [kioskVerifying, setKioskVerifying] = useState(false);
    const kioskContainerRef = useRef(null);
    const kioskLockedRef = useRef(false);

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
                    ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 60, min: 30 } }
                    : { facingMode: "user", width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 60, min: 30 } }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setCameraActive(true);
                runDetectionLoop();
                resetInactivityTimer();
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setCameraError(err.message || 'Unable to access camera. Please verify permissions.');
            setCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoFrameCallbackIdRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
            try {
                videoRef.current.cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
            } catch (_) {}
            videoFrameCallbackIdRef.current = null;
        }
        if (animFrameIdRef.current) {
            cancelAnimationFrame(animFrameIdRef.current);
            animFrameIdRef.current = null;
        }
        if (scanLoopRef.current) {
            clearTimeout(scanLoopRef.current);
            scanLoopRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        isScanningRef.current = false;
        setCameraActive(false);
    };

    useEffect(() => {
        if (hasPermission && !scannerSleepingRef.current) {
            startCamera();
            resetInactivityTimer();
        }
        return () => {
            stopCamera();
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
                inactivityTimerRef.current = null;
            }
        };
    }, [hasPermission, selectedDeviceId]);

    // Thermally-Optimized QR Detection Loop:
    // 1. Native BarcodeDetector runs GPU-accelerated (~40ms interval / ~25 FPS) with near-zero CPU usage.
    // 2. Pure JS software fallback (jsQR) is throttled to ~10 FPS (100ms) with 480px downscale to prevent CPU heating.
    // 3. Pauses completely when document is hidden, processing a scan, or confirmation modal is active.
    const runDetectionLoop = () => {
        if (!streamRef.current || !videoRef.current) return;
        const video = videoRef.current;

        // Initialize reusable offscreen canvas for fallback
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const scanFrame = async () => {
            if (!streamRef.current || !videoRef.current) return;

            const scheduleNext = () => {
                if (streamRef.current && videoRef.current) {
                    if ('requestVideoFrameCallback' in video) {
                        videoFrameCallbackIdRef.current = video.requestVideoFrameCallback(scanFrame);
                    } else {
                        animFrameIdRef.current = requestAnimationFrame(scanFrame);
                    }
                }
            };

            // Thermal & battery guard: pause when backgrounded, sleeping, modal is showing, or scan in flight
            if (
                document.hidden ||
                scannerSleepingRef.current ||
                video.readyState < 2 ||
                qrProcessingRef.current ||
                isScanningRef.current ||
                qrConfirmationRef.current
            ) {
                scheduleNext();
                return;
            }

            const now = performance.now();
            const hasNativeDetector = !!barcodeDetectorRef.current;

            // Frame throttling:
            // GPU BarcodeDetector: 40ms interval (~25 fps) -> instantaneous & 0% CPU
            // CPU jsQR fallback: 100ms interval (~10 fps) -> <100ms response & <5% CPU
            const minInterval = hasNativeDetector ? 40 : 100;
            if (now - lastScanTimeRef.current < minInterval) {
                scheduleNext();
                return;
            }

            lastScanTimeRef.current = now;
            isScanningRef.current = true;

            try {
                let detectedPayload = null;

                // 1. Hardware GPU-accelerated BarcodeDetector (Chrome native, <5ms)
                if (hasNativeDetector) {
                    try {
                        const barcodes = await barcodeDetectorRef.current.detect(video);
                        if (barcodes && barcodes.length > 0) {
                            for (const barcode of barcodes) {
                                const val = (barcode.rawValue || '').trim();
                                if (val.startsWith('WPQR.')) {
                                    detectedPayload = val;
                                    break;
                                }
                            }
                        }
                    } catch (_) {
                        // Native detector error fallback
                    }
                }

                // 2. High-speed jsQR fallback:
                // Only runs if native detector is absent, or once every 400ms as a backup safety net
                const shouldRunJsQr = !detectedPayload && video.videoWidth > 0 && video.videoHeight > 0 && ctx &&
                    (!hasNativeDetector || (now - lastJsQrScanRef.current >= 400));

                if (shouldRunJsQr) {
                    lastJsQrScanRef.current = now;
                    // Downscale to 480px sweet spot: cuts pixel copy & math by >65% without loss of QR clarity
                    const maxDim = 480;
                    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
                    const sw = Math.round(video.videoWidth * scale);
                    const sh = Math.round(video.videoHeight * scale);

                    if (sw > 0 && sh > 0) {
                        if (canvas.width !== sw || canvas.height !== sh) {
                            canvas.width = sw;
                            canvas.height = sh;
                        }

                        ctx.drawImage(video, 0, 0, sw, sh);
                        const imageData = ctx.getImageData(0, 0, sw, sh);

                        if (imageData && imageData.data) {
                            const code = jsQR(imageData.data, sw, sh, {
                                inversionAttempts: "attemptBoth"
                            });

                            if (code && code.data && code.data.startsWith('WPQR.')) {
                                detectedPayload = code.data;
                            }
                        }
                    }
                }

                if (detectedPayload) {
                    await handleQrScanned(detectedPayload);
                }
            } catch (_) {
                // Suppress loop spam
            } finally {
                isScanningRef.current = false;
                scheduleNext();
            }
        };

        if ('requestVideoFrameCallback' in video) {
            videoFrameCallbackIdRef.current = video.requestVideoFrameCallback(scanFrame);
        } else {
            animFrameIdRef.current = requestAnimationFrame(scanFrame);
        }
    };

    // Handler for Scanned QR Badge
    const handleQrScanned = async (qrPayload) => {
        resetInactivityTimer();
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
            if (data && data.requiresConfirmation) {
                const formattedTime = data.time || formatTimeOnly(data.timestamp || new Date());
                setQrConfirmation({
                    ...data,
                    time: formattedTime
                });
                setStatusMessage(`Confirmation required for ${data.employeeName}`);
                triggerPanelNotification('info', 'Badge Recognized', `Confirming ${data.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} for ${data.employeeName}`, {
                    employeeName: data.employeeName,
                    avatarUrl: data.avatarUrl,
                    time: formattedTime
                });
                setConfirmCountdown(15);
                if (confirmTimerRef.current) clearInterval(confirmTimerRef.current);
                confirmTimerRef.current = setInterval(() => {
                    setConfirmCountdown(prev => {
                        if (prev <= 1) {
                            clearInterval(confirmTimerRef.current);
                            setQrConfirmation(null);
                            qrProcessingRef.current = false;
                            setStatusMessage("QR Scanner Ready. Scan your badge.");
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
                return;
            }

            if (data && data.success) {
                playSuccessChime();
                const formattedTime = data.time || formatTimeOnly(data.timestamp || new Date());
                const msg = data.message || `${data.employeeName} recorded ${data.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}`;
                triggerPanelNotification('success', data.type === 'CHECK_IN' ? 'Check-In Recorded' : 'Check-Out Recorded', msg, {
                    employeeName: data.employeeName,
                    avatarUrl: data.avatarUrl,
                    time: formattedTime,
                    duration: data.duration
                });

                setTimeout(() => {
                    qrProcessingRef.current = false;
                    setStatusMessage("QR Scanner Ready. Scan your badge.");
                }, 2000);
            }
        } catch (err) {
            console.error("QR Badge scan error:", err);
            playErrorBeep();
            const serverMsg = err.response?.data?.message || "Invalid or expired QR badge.";
            triggerPanelNotification('error', 'Badge Scan Rejected', serverMsg, {
                detail: 'Please refresh your Smart Badge on the mobile app and try again.'
            });
            setStatusMessage(serverMsg);

            setTimeout(() => {
                qrProcessingRef.current = false;
                setStatusMessage("QR Scanner Ready. Scan your badge.");
            }, 2200);
        }
    };

    const handleCancelConfirmation = () => {
        resetInactivityTimer();
        if (confirmTimerRef.current) clearInterval(confirmTimerRef.current);
        const actionLabel = qrConfirmation?.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out';
        setQrConfirmation(null);
        qrProcessingRef.current = false;
        setStatusMessage("QR Scanner Ready. Scan your badge.");
        triggerPanelNotification('info', `${actionLabel} Cancelled`, 'Badge verification was cancelled.');
    };

    const handleAcceptConfirmation = async () => {
        if (!qrConfirmation) return;
        resetInactivityTimer();
        if (confirmTimerRef.current) clearInterval(confirmTimerRef.current);
        const pendingToken = qrConfirmation.confirmationToken;
        setQrConfirmation(null);
        setStatusMessage("Recording attendance...");

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE_URL}/api/attendance/scan-qr-badge`, {
                confirmed: true,
                confirmationToken: pendingToken
            }, {
                headers: { 'x-access-token': token }
            });

            const data = response.data;
            if (data && data.success) {
                playSuccessChime();
                const formattedTime = data.time || formatTimeOnly(data.timestamp || new Date());
                const msg = data.message || `${data.employeeName} recorded ${data.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}`;
                triggerPanelNotification('success', data.type === 'CHECK_IN' ? 'Check-In Confirmed' : 'Check-Out Confirmed', msg, {
                    employeeName: data.employeeName,
                    avatarUrl: data.avatarUrl,
                    time: formattedTime,
                    duration: data.duration
                });

                setTimeout(() => {
                    qrProcessingRef.current = false;
                    setStatusMessage("QR Scanner Ready. Scan your badge.");
                }, 2000);
            }
        } catch (err) {
            console.error("Confirmation error:", err);
            playErrorBeep();
            const serverMsg = err.response?.data?.message || "Failed to confirm attendance.";
            triggerPanelNotification('error', 'Confirmation Failed', serverMsg);
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

    const isKioskMode = fsActive || kioskLocked;

    return (
        <div
            ref={kioskContainerRef}
            onPointerDown={handleUserActivity}
            onKeyDown={handleUserActivity}
            className={`dark ${
                isKioskMode
                    ? 'fixed inset-0 h-screen w-screen overflow-hidden bg-[#050811] text-white p-3 sm:p-4 lg:p-5 flex flex-col select-none z-50'
                    : 'w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col text-white bg-[#050811] rounded-3xl border border-slate-800 shadow-2xl relative'
            }`}
        >

            {/* Top Bar / Header */}
            <div className="flex items-center justify-between gap-4 mb-3 sm:mb-4 pb-3 border-b border-slate-800/80 flex-shrink-0">
                <div className="flex items-center gap-3 sm:gap-4">
                    <BrandLogo textTheme="dark" />
                    <div className="hidden sm:block h-8 w-[1px] bg-slate-800" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase drop-shadow-sm">
                                Attendance Kiosk
                            </h1>
                            {scannerSleeping ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-500/30 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Standby Mode
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Live QR Scanner
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Front-Desk Dynamic Smart Badge Terminal
                        </p>
                    </div>
                </div>

                {/* Clock & Kiosk Actions */}
                <div className="flex items-center gap-3">
                    <div className="px-3.5 py-2 bg-slate-900/90 rounded-2xl border border-slate-800 text-right shadow-sm">
                        <div className="text-sm sm:text-base font-black font-mono tracking-tight text-white flex items-center justify-end gap-1.5" id="kiosk-live-clock">
                            <span>{formatLiveTime(currentTime)}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-end gap-1.5" id="kiosk-live-date">
                            <span>{formatLiveDate(currentTime)}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono">
                                {getTimezoneAbbr(currentTime)}
                            </span>
                        </div>
                    </div>

                    {kioskLocked ? (
                        <button
                            onClick={() => openKioskModal('exit')}
                            className="p-2.5 sm:px-3.5 sm:py-2.5 bg-slate-900/90 hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 rounded-2xl shadow-xl border border-rose-900/50 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                            title="Exit Kiosk Mode (Password Required)"
                        >
                            <LuLock size={18} />
                            <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Exit</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleEnterKiosk}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
                            title="Lock this terminal in full-screen kiosk mode"
                        >
                            <LuMaximize size={16} />
                            <span>Kiosk Mode</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Terminal Grid - takes 100% of remaining vertical height */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
                {/* Left 8 Columns: Camera Viewfinder HUD */}
                <div className="lg:col-span-8 bg-[#0b0f19] rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80 relative flex flex-col justify-between p-4 sm:p-5 h-full min-h-0">
                    {/* Viewfinder Header */}
                    <div className="flex items-center justify-between z-10 flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                                scannerSleeping 
                                    ? 'bg-amber-400' 
                                    : cameraActive 
                                        ? 'bg-emerald-500 animate-ping' 
                                        : 'bg-rose-500'
                            }`} />
                            <span className={`text-xs uppercase tracking-widest font-black ${
                                scannerSleeping ? 'text-amber-400' : cameraActive ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                                {scannerSleeping ? 'Scanner in Standby' : cameraActive ? 'Badge Scanner Active' : 'Camera Offline'}
                            </span>
                            {cameraActive && !scannerSleeping && (
                                <button
                                    type="button"
                                    onClick={() => setPrivacyBlur(prev => !prev)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition cursor-pointer ${
                                        privacyBlur
                                            ? 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60 shadow-sm hover:bg-indigo-900/90'
                                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700'
                                    }`}
                                    title={privacyBlur ? "Privacy Shield is Active (Faces & Background Blurred). Click to disable." : "Privacy Shield is OFF. Click to enable."}
                                >
                                    <LuShieldCheck size={13} className={privacyBlur ? "text-indigo-400" : "text-slate-500"} />
                                    <span>{privacyBlur ? "Privacy Shield On" : "Privacy Shield Off"}</span>
                                </button>
                            )}
                            {cameraActive && !scannerSleeping && (
                                <button
                                    type="button"
                                    onClick={handleInactivitySleep}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
                                    title="Pause scanner to conserve hardware power"
                                >
                                    <LuPower size={13} className="text-amber-400" />
                                    <span>Pause</span>
                                </button>
                            )}
                        </div>

                        {/* Camera device selector if multiple */}
                        {devices.length > 1 && !scannerSleeping && (
                            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
                                <LuSwitchCamera size={14} className="text-slate-400" />
                                <select
                                    value={selectedDeviceId}
                                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                                    className="bg-transparent text-[11px] font-bold text-slate-200 focus:outline-none cursor-pointer"
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

                    {/* Camera Video Feed - expands to fill the entire remaining card height */}
                    <div className="flex-1 min-h-0 relative my-3 w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                        {scannerSleeping ? (
                            /* Standby / Eco Mode Screen */
                            <div className="p-6 sm:p-8 text-center max-w-md mx-auto flex flex-col items-center justify-center animate-fadeIn relative z-10">
                                {/* Ambient decorative glow */}
                                <div className="absolute w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

                                <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-3xl bg-slate-900/90 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)] mb-4 sm:mb-5">
                                    <LuCameraOff size={38} strokeWidth={2} className="text-amber-400" />
                                </div>

                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-widest bg-amber-950/80 text-amber-400 border border-amber-500/30 mb-2.5 sm:mb-3 shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    Standby Power-Saver
                                </span>

                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
                                    Scanner in Standby
                                </h2>

                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mb-5 sm:mb-6 font-medium">
                                    Camera hardware paused after 5 minutes of inactivity to eliminate hardware resource and battery consumption.
                                </p>

                                <button
                                    onClick={handleWakeScanner}
                                    id="open-scanner-btn"
                                    className="inline-flex items-center gap-3 px-8 py-3.5 sm:px-10 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-sm sm:text-base font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-500/25 transition-all duration-200 transform hover:scale-[1.03] active:scale-95 cursor-pointer"
                                >
                                    <LuCamera size={22} className="stroke-[2.5]" />
                                    <span>Open Scanner</span>
                                </button>

                                <span className="text-[10px] sm:text-[11px] text-slate-500 mt-3 font-semibold">
                                    Tap to re-enable camera & resume badge scanning
                                </span>
                            </div>
                        ) : cameraError ? (
                            <div className="p-6 text-center text-rose-400">
                                <LuShieldAlert size={36} className="mx-auto mb-2 text-rose-500" />
                                <p className="text-xs font-bold">{cameraError}</p>
                                <button
                                    onClick={startCamera}
                                    className="mt-3 px-4 py-2 bg-rose-900/50 hover:bg-rose-900 text-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto cursor-pointer"
                                >
                                    <LuRefreshCw size={14} /> Retry Camera
                                </button>
                            </div>
                        ) : null}

                        {/* Video element stays mounted for instant ref binding */}
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`w-full h-full object-cover transform -scale-x-100 transition-all duration-500 ${
                                scannerSleeping || cameraError ? 'hidden' : ''
                            } ${
                                privacyBlur ? 'filter blur-2xl brightness-90 contrast-105' : ''
                            }`}
                        />

                        {/* Large Animated Scanner Reticle Target Area */}
                        {cameraActive && !scannerSleeping && !qrConfirmation && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                                <div className="w-72 h-72 sm:w-88 sm:h-88 md:w-[380px] md:h-[380px] lg:w-[440px] lg:h-[440px] max-w-[88%] max-h-[80%] border-2 border-emerald-400/80 rounded-3xl relative shadow-[0_0_40px_rgba(16,185,129,0.35)] flex items-center justify-center">
                                    {/* Large Corner Brackets */}
                                    <div className="absolute -top-1.5 -left-1.5 w-10 h-10 sm:w-12 sm:h-12 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
                                    <div className="absolute -top-1.5 -right-1.5 w-10 h-10 sm:w-12 sm:h-12 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
                                    <div className="absolute -bottom-1.5 -left-1.5 w-10 h-10 sm:w-12 sm:h-12 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
                                    <div className="absolute -bottom-1.5 -right-1.5 w-10 h-10 sm:w-12 sm:h-12 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />

                                    {/* Animated Laser Scanning Line */}
                                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute shadow-[0_0_14px_#34d399] animate-bounce" style={{ animationDuration: '2s' }} />

                                    <div className="text-center bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-emerald-500/40 shadow-lg">
                                        <LuQrCode className="w-6 h-6 mx-auto text-emerald-400 mb-1" />
                                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-300">
                                            Align Smart Badge
                                        </span>
                                        {privacyBlur && (
                                            <div className="text-[9px] font-bold text-slate-400 mt-0.5 tracking-wider uppercase">
                                                Identity Shielded
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Viewfinder Footer status bar */}
                    <div className="flex items-center justify-between z-10 pt-3 border-t border-slate-800 text-xs flex-shrink-0">
                        <div className="flex items-center gap-2 text-slate-300 font-medium">
                            {scannerSleeping ? (
                                <LuPower size={16} className="text-amber-400" />
                            ) : (
                                <LuScanLine size={16} className="text-emerald-400 animate-pulse" />
                            )}
                            <span>{statusMessage}</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {scannerSleeping ? 'Hardware Sleeping' : 'AES-256 Dynamic QR'}
                        </span>
                    </div>
                </div>

                {/* Right 4 Columns: Instructions & Security Features */}
                <div className="lg:col-span-4 flex flex-col gap-4 h-full min-h-0">
                    {/* Instructions Card - Dark Theme with high-contrast text */}
                    <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-2xl flex-1 min-h-0 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-3 rounded-2xl bg-indigo-950/80 text-indigo-400 border border-indigo-800/80 shadow-sm">
                                    <LuSparkles size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                                        How to Check In / Out
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Zero-touch contactless badge scanning
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3.5 text-xs sm:text-sm">
                                <div className="flex items-start gap-3.5 p-3.5 sm:p-4 bg-slate-800/70 hover:bg-slate-800/90 rounded-2xl border border-slate-700/60 transition">
                                    <span className="w-6 h-6 rounded-xl bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-indigo-600/30">
                                        1
                                    </span>
                                    <p className="text-slate-300 font-medium leading-relaxed">
                                        Open your <strong className="text-white font-bold">WorkPulse Mobile App</strong> or <strong className="text-white font-bold">Web Portal</strong> and navigate to <strong className="text-indigo-400 font-bold">My Smart Badge</strong>.
                                    </p>
                                </div>

                                <div className="flex items-start gap-3.5 p-3.5 sm:p-4 bg-slate-800/70 hover:bg-slate-800/90 rounded-2xl border border-slate-700/60 transition">
                                    <span className="w-6 h-6 rounded-xl bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-indigo-600/30">
                                        2
                                    </span>
                                    <p className="text-slate-300 font-medium leading-relaxed">
                                        Hold your phone screen <strong className="text-white font-bold">6-12 inches</strong> in front of this camera inside the scanning box.
                                    </p>
                                </div>

                                <div className="flex items-start gap-3.5 p-3.5 sm:p-4 bg-slate-800/70 hover:bg-slate-800/90 rounded-2xl border border-slate-700/60 transition">
                                    <span className="w-6 h-6 rounded-xl bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-emerald-600/30">
                                        3
                                    </span>
                                    <p className="text-slate-300 font-medium leading-relaxed">
                                        The kiosk instantly verifies your badge and records your <strong className="text-emerald-400 font-bold">Check-In / Check-Out</strong> with audio confirmation!
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Dedicated Live Notification & Status Tile (Fills the empty space) */}
                        <div className="flex-1 my-3 flex flex-col justify-center min-h-[140px]">
                            {panelNotification ? (
                                <div
                                    className={`w-full rounded-2xl p-4 sm:p-5 border transition-all duration-300 animate-scaleUp relative overflow-hidden ${
                                        panelNotification.type === 'error'
                                            ? 'bg-rose-950/70 border-rose-500/70 text-white shadow-[0_0_35px_rgba(244,63,94,0.3)]'
                                            : panelNotification.type === 'success'
                                            ? 'bg-emerald-950/70 border-emerald-500/70 text-white shadow-[0_0_35px_rgba(16,185,129,0.3)]'
                                            : 'bg-indigo-950/70 border-indigo-500/70 text-white shadow-[0_0_35px_rgba(99,102,241,0.3)]'
                                    }`}
                                >
                                    {/* Ambient Glow */}
                                    <div
                                        className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-2xl opacity-35 pointer-events-none ${
                                            panelNotification.type === 'error'
                                                ? 'bg-rose-500'
                                                : panelNotification.type === 'success'
                                                ? 'bg-emerald-500'
                                                : 'bg-indigo-500'
                                        }`}
                                    />

                                    {/* ERROR CARD */}
                                    {panelNotification.type === 'error' && (
                                        <div className="flex items-start gap-3.5 relative z-10">
                                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-900/90 border border-rose-500/50 text-rose-300 flex items-center justify-center flex-shrink-0 shadow-lg">
                                                <LuShieldAlert size={26} strokeWidth={2.5} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-rose-400 uppercase tracking-wider">
                                                        {panelNotification.title || 'Scan Rejected'}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-900/80 text-rose-200 border border-rose-600/60">
                                                        REJECTED
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-white mt-1 leading-snug break-words">
                                                    {panelNotification.message}
                                                </p>
                                                {panelNotification.detail && (
                                                    <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">
                                                        {panelNotification.detail}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* SUCCESS CARD */}
                                    {panelNotification.type === 'success' && (
                                        <div className="flex items-start gap-3.5 relative z-10">
                                            {panelNotification.avatarUrl ? (
                                                <img
                                                    src={`${API_BASE_URL}/${panelNotification.avatarUrl}`}
                                                    alt={panelNotification.employeeName}
                                                    className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-400 shadow-md flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-900/90 border border-emerald-500/50 text-emerald-300 flex items-center justify-center flex-shrink-0 shadow-lg font-black text-lg">
                                                    {panelNotification.employeeName?.charAt(0) || <LuCheck size={26} strokeWidth={3} />}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                                                        {panelNotification.title || 'Attendance Logged'}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-900/80 text-emerald-200 border border-emerald-600/60">
                                                        {panelNotification.time || 'CONFIRMED'}
                                                    </span>
                                                </div>
                                                <h4 className="text-base font-black text-white mt-0.5 truncate">
                                                    {panelNotification.employeeName}
                                                </h4>
                                                <p className="text-xs text-emerald-200/90 mt-0.5 leading-snug">
                                                    {panelNotification.message}
                                                </p>
                                                {panelNotification.duration && (
                                                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-300 bg-emerald-900/50 px-2 py-0.5 rounded-lg border border-emerald-800/60">
                                                        <LuClock size={12} />
                                                        <span>Worked: {panelNotification.duration}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* INFO / CANCELLED CARD */}
                                    {panelNotification.type === 'info' && (
                                        <div className="flex items-start gap-3.5 relative z-10">
                                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-900/90 border border-indigo-500/50 text-indigo-300 flex items-center justify-center flex-shrink-0 shadow-lg">
                                                <LuSparkles size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">
                                                    {panelNotification.title || 'Status Update'}
                                                </span>
                                                <p className="text-sm font-bold text-white mt-1 leading-snug">
                                                    {panelNotification.message}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                scannerSleeping ? (
                                    <div className="w-full rounded-2xl p-4 sm:p-5 border border-amber-900/60 bg-amber-950/20 flex items-center gap-3.5 text-slate-300">
                                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-900/40 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-400 shadow-inner">
                                            <LuPower size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                                                    Standby Mode Active
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1 leading-snug">
                                                Camera hardware paused to eliminate CPU & GPU draw. Click "Open Scanner" to resume.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    /* Idle / Live Terminal Ready State */
                                    <div className="w-full rounded-2xl p-4 sm:p-5 border border-slate-800/80 bg-slate-950/50 flex items-center gap-3.5 text-slate-400">
                                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center flex-shrink-0 text-emerald-400 shadow-inner">
                                            <LuScanLine size={24} className="animate-pulse" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                                    Terminal Ready
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1 leading-snug">
                                                Live scan notifications & verification status will appear right here.
                                            </p>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Security Badges Footer */}
                        <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 xl:grid-cols-2 gap-2.5 flex-shrink-0">
                            <div className="p-3 bg-indigo-950/40 rounded-2xl border border-indigo-900/50">
                                <div className="flex items-center gap-1.5 text-indigo-400 font-black text-[11px] uppercase tracking-wider mb-1">
                                    <LuShieldCheck size={14} />
                                    <span>5s Dynamic QR</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                    Anti-screenshot auto-refreshing security tokens.
                                </p>
                            </div>

                            <div className="p-3 bg-emerald-950/40 rounded-2xl border border-emerald-900/50">
                                <div className="flex items-center gap-1.5 text-emerald-400 font-black text-[11px] uppercase tracking-wider mb-1">
                                    <LuCircleCheck size={14} />
                                    <span>Single Device</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                    Enforced single-device anti-proxy protection.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog Overlay (YES / NO) */}
            {qrConfirmation && (
                <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
                    <div className={`relative w-full max-w-lg bg-slate-900 border-2 rounded-3xl p-6 sm:p-8 text-center shadow-2xl animate-scaleUp overflow-hidden ${
                        qrConfirmation.type === 'CHECK_IN' ? 'border-emerald-500/50' : 'border-amber-500/50'
                    }`}>
                        {/* Ambient background glow */}
                        <div className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none ${
                            qrConfirmation.type === 'CHECK_IN' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        <div className={`absolute -bottom-24 -left-24 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none ${
                            qrConfirmation.type === 'CHECK_IN' ? 'bg-teal-500' : 'bg-orange-500'
                        }`} />

                        {/* Top Close / Dismiss 'X' button */}
                        <button
                            type="button"
                            onClick={handleCancelConfirmation}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                            title="Cancel"
                        >
                            <LuX size={22} />
                        </button>

                        {/* Avatar & Action Icon Badge */}
                        <div className="relative inline-block mb-4 mt-2">
                            {qrConfirmation.avatarUrl ? (
                                <img
                                    src={`${API_BASE_URL}/${qrConfirmation.avatarUrl}`}
                                    alt={qrConfirmation.employeeName}
                                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 shadow-2xl mx-auto ${
                                        qrConfirmation.type === 'CHECK_IN'
                                            ? 'border-emerald-500 shadow-emerald-500/20'
                                            : 'border-amber-500 shadow-amber-500/20'
                                    }`}
                                />
                            ) : (
                                <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center text-3xl font-black shadow-2xl border-4 mx-auto ${
                                    qrConfirmation.type === 'CHECK_IN'
                                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-emerald-500/20'
                                        : 'bg-amber-950/80 border-amber-500 text-amber-400 shadow-amber-500/20'
                                }`}>
                                    {qrConfirmation.employeeName?.charAt(0) || <LuUser size={40} />}
                                </div>
                            )}
                            <div className={`absolute -bottom-2 -right-2 p-2 rounded-2xl text-white shadow-xl border-2 border-slate-900 ${
                                qrConfirmation.type === 'CHECK_IN' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}>
                                {qrConfirmation.type === 'CHECK_IN' ? <LuLogIn size={18} /> : <LuLogOut size={18} />}
                            </div>
                        </div>

                        {/* Action Type Badge */}
                        <div className="mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm ${
                                qrConfirmation.type === 'CHECK_IN'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}>
                                {qrConfirmation.type === 'CHECK_IN' ? <LuLogIn size={14} /> : <LuLogOut size={14} />}
                                <span>{qrConfirmation.type === 'CHECK_IN' ? 'CONFIRM CHECK-IN' : 'CONFIRM CHECK-OUT'}</span>
                            </span>
                        </div>

                        {/* Employee Name */}
                        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            {qrConfirmation.employeeName}
                        </h2>

                        {/* Time & Duration Info Pills */}
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                            <div className="text-xs font-bold text-slate-300 bg-slate-800/90 px-3.5 py-1.5 rounded-xl border border-slate-700/80 inline-flex items-center gap-1.5 shadow-sm">
                                <LuClock size={14} className="text-slate-400" />
                                <span>Time: {qrConfirmation.time || formatLiveTime(currentTime)}</span>
                                <span className="text-[10px] font-mono text-indigo-400 font-bold ml-1">({getTimezoneAbbr(currentTime)})</span>
                            </div>
                            {qrConfirmation.duration && (
                                <div className="text-xs font-bold text-slate-300 bg-slate-800/90 px-3.5 py-1.5 rounded-xl border border-slate-700/80 inline-flex items-center gap-1.5 shadow-sm">
                                    <span className="text-slate-400">Worked Duration:</span>
                                    <span className="text-amber-400 font-mono font-bold">{qrConfirmation.duration}</span>
                                </div>
                            )}
                        </div>

                        {/* Confirmation Question */}
                        <p className="text-sm font-medium text-slate-300 mt-4 leading-relaxed">
                            {qrConfirmation.type === 'CHECK_IN'
                                ? 'Would you like to record Check-In for this employee?'
                                : 'Would you like to record Check-Out for this employee?'}
                        </p>

                        {/* Auto-cancel countdown */}
                        <div className="mt-2 text-xs text-slate-400 font-mono">
                            Auto-cancelling in <span className="text-amber-400 font-black">{confirmCountdown}s</span>
                        </div>

                        {/* Two Big Action Buttons: CANCEL (NO) and PROCEED (YES) */}
                        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 mt-6 pt-2">
                            <button
                                type="button"
                                onClick={handleCancelConfirmation}
                                className="w-full py-4 px-4 rounded-2xl border-2 border-slate-700 bg-slate-800 hover:bg-slate-750 hover:border-slate-600 text-slate-200 font-bold text-sm sm:text-base transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <LuX size={20} className="text-rose-400" />
                                <span>NO, Cancel</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleAcceptConfirmation}
                                className={`w-full py-4 px-4 rounded-2xl text-white font-black text-sm sm:text-base transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                                    qrConfirmation.type === 'CHECK_IN'
                                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50'
                                        : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/50'
                                }`}
                            >
                                <LuCheck size={22} strokeWidth={3} />
                                <span>YES, Proceed</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit / Enter Kiosk Password Confirmation Modal */}
            {kioskModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-800 text-white animate-scaleUp">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-5 text-white shadow-sm">
                            <LuLock size={26} />
                        </div>
                        <h3 className="text-xl font-black text-white text-center mb-1">
                            {kioskModal === 'exit' ? 'Exit Kiosk Mode' : 'Lock in Kiosk Mode'}
                        </h3>
                        <p className="text-xs text-slate-400 text-center leading-relaxed mb-5">
                            Please enter your account password to verify authorization and exit the kiosk lock.
                        </p>

                        <form onSubmit={handleKioskSubmit} className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    value={kioskPassword}
                                    onChange={(e) => setKioskPassword(e.target.value)}
                                    placeholder="Enter your password..."
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none text-white placeholder-slate-500"
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
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition cursor-pointer"
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
