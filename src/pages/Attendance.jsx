import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as faceapi from '@vladmandic/face-api';
import API_BASE_URL from '../config/api.config';
import { LuCamera, LuCheck, LuInfo, LuUserCheck, LuLock, LuLogOut, LuMaximize, LuMinimize, LuShieldAlert } from "react-icons/lu";
import { fetchRoles, canAccessAttendancePortal } from '../utils/roleUtils';
import ModernLoader from '../components/ModernLoader';
import VirtualKeyboard from '../components/VirtualKeyboard';
import BrandLogo from '../components/BrandLogo';
import { formatTimeOnly, getCurrentInAppTimezone } from '../utils/timezone.util';

const Attendance = () => {
    const navigate = useNavigate();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    const [emailState, setEmailState] = useState('');
    const emailRef = useRef('');
    const setEmail = (val) => {
        setEmailState(val);
        emailRef.current = typeof val === 'function' ? val(emailRef.current) : val;
    };
    const email = emailState;

    const [password, setPassword] = useState('');
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Initialize Face ID system...');
    const [faceDetected, setFaceDetected] = useState(false);
    
    // Attendance status: 'unknown' | 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED' | 'loading'
    const [attendanceStatusState, setAttendanceStatusState] = useState('unknown');
    const attendanceStatusRef = useRef('unknown');
    const setAttendanceStatus = (val) => {
        setAttendanceStatusState(val);
        attendanceStatusRef.current = typeof val === 'function' ? val(attendanceStatusRef.current) : val;
    };
    const attendanceStatus = attendanceStatusState;

    const [checkInTime, setCheckInTimeState] = useState(null);
    const checkInTimeRef = useRef(null);
    const setCheckInTime = (val) => {
        setCheckInTimeState(val);
        checkInTimeRef.current = typeof val === 'function' ? val(checkInTimeRef.current) : val;
    };

    const [checkInRaw, setCheckInRawState] = useState(null);
    const checkInRawRef = useRef(null);
    const setCheckInRaw = (val) => {
        setCheckInRawState(val);
        checkInRawRef.current = typeof val === 'function' ? val(checkInRawRef.current) : val;
    };

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmModalType, setConfirmModalType] = useState('CHECK_IN');
    const [confirmModalTimestamp, setConfirmModalTimestamp] = useState('');
    const [confirmModalDuration, setConfirmModalDuration] = useState('');

    const [statusEmployeeName, setStatusEmployeeName] = useState('');

    // Auto-identification state
    const [identifiedEmployeeState, setIdentifiedEmployeeState] = useState(null); // { email, employeeName }
    const identifiedEmployeeRef = useRef(null);
    const setIdentifiedEmployee = (val) => {
        setIdentifiedEmployeeState(val);
        identifiedEmployeeRef.current = typeof val === 'function' ? val(identifiedEmployeeRef.current) : val;
    };
    const identifiedEmployee = identifiedEmployeeState;

    const identifyingRef = useRef(false); // prevent overlapping API calls

    // Result states
    const [verificationResult, setVerificationResult] = useState(null);

    // Liveness and head-turn detection state
    const [turnedLeft, setTurnedLeft] = useState(false);
    const [turnedRight, setTurnedRight] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);

    const [showPasswordFieldState, setShowPasswordFieldState] = useState(false);
    const showPasswordFieldRef = useRef(false);
    const setShowPasswordField = (val) => {
        setShowPasswordFieldState(val);
        showPasswordFieldRef.current = typeof val === 'function' ? val(showPasswordFieldRef.current) : val;
    };
    const showPasswordField = showPasswordFieldState;

    const [livenessVerified, setLivenessVerifiedState] = useState(false);
    const livenessVerifiedRef = useRef(false);
    const setLivenessVerified = (val) => {
        setLivenessVerifiedState(val);
        livenessVerifiedRef.current = typeof val === 'function' ? val(livenessVerifiedRef.current) : val;
    };
    const livenessDetectionRef = useRef(null);

    const [leftProfile, setLeftProfileState] = useState(null);
    const leftProfileRef = useRef(null);
    const setLeftProfile = (val) => {
        setLeftProfileState(val);
        leftProfileRef.current = typeof val === 'function' ? val(leftProfileRef.current) : val;
    };

    const [rightProfile, setRightProfileState] = useState(null);
    const rightProfileRef = useRef(null);
    const setRightProfile = (val) => {
        setRightProfileState(val);
        rightProfileRef.current = typeof val === 'function' ? val(rightProfileRef.current) : val;
    };

    const leftDescriptorRef = useRef(null);
    const rightDescriptorRef = useRef(null);

    // Refs for tracking head turns
    const turnedLeftRef = useRef(false);
    const turnedRightRef = useRef(false);
    const lookingCenterRef = useRef(true);
    const checkingLivenessRef = useRef(false);
    const lastFaceSeenTimeRef = useRef(0);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const detectIntervalRef = useRef(null);

    // Kiosk (full-screen lock) state
    const [kioskLocked, setKioskLocked] = useState(false);   // authorized intent to stay locked
    const [fsActive, setFsActive] = useState(false);         // currently in fullscreen
    const [kioskModal, setKioskModal] = useState(null);      // null | 'enter' | 'exit'
    const [kioskPassword, setKioskPassword] = useState('');
    const [kioskError, setKioskError] = useState('');
    const [kioskVerifying, setKioskVerifying] = useState(false);
    const kioskContainerRef = useRef(null);
    const kioskLockedRef = useRef(false);
    const [activeInput, setActiveInput] = useState(null); // 'password' | 'kioskPassword' | null

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Check Permissions on Mount
    useEffect(() => {
        const checkPermission = async () => {
            try {
                await fetchRoles(true);
                const canAccess = canAccessAttendancePortal(user.role);
                if (!canAccess) {
                    navigate('/unauthorized', { replace: true });
                } else {
                    setHasPermission(true);
                }
            } catch (err) {
                console.error('Error checking attendance permission:', err);
                navigate('/unauthorized', { replace: true });
            } finally {
                setPermissionChecked(true);
            }
        };
        checkPermission();
    }, [user.role, navigate]);

    // 1. Load Face API Models
    useEffect(() => {
        const loadModels = async () => {
            try {
                setStatusMessage('Loading facial identification models...');
                // Try loading local files first
                await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
                await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
                await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
                setModelsLoaded(true);
                setStatusMessage('System Ready. Stand in front of camera.');
            } catch (err) {
                console.log('Failed to load local models, trying CDN fallback...', err);
                try {
                    const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
                    await faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_URL);
                    await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL);
                    await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL);
                    setModelsLoaded(true);
                    setStatusMessage('System Ready (Loaded from CDN).');
                } catch (cdnErr) {
                    console.error('All model loading attempts failed:', cdnErr);
                    setStatusMessage('Failed to initialize facial models. Please contact administrator.');
                    toast.error('Face Identification Model Loading Failed.');
                }
            }
        };

        loadModels();

        return () => {
            stopCamera();
        };
    }, []);

    // Head-Turn Detection Thresholds
    // Yaw Ratio = dist(NoseTip, LeftCheek) / dist(NoseTip, RightCheek)
    // Turned Left: Ratio < 0.65
    // Turned Right: Ratio > 1.50
    const YAW_TURN_LEFT_THRESHOLD = 0.65;
    const YAW_TURN_RIGHT_THRESHOLD = 1.50;

    const captureSnapshot = () => {
        const video = videoRef.current;
        if (!video) return null;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        // Mirror the snapshot image so it matches what they see on screen
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.6);
    };

    const calculateYawRatio = (landmarks) => {
        if (!landmarks) return 1.0;
        try {
            const jaw = landmarks.getJawOutline();
            const nose = landmarks.getNose();
            
            if (!jaw || jaw.length < 15 || !nose || nose.length < 4) {
                return 1.0;
            }

            // Nose tip is nose[3] (point 30)
            const noseTip = nose[3];
            // Left cheek contour is jaw[2] (point 2)
            const leftCheek = jaw[2];
            // Right cheek contour is jaw[14] (point 14)
            const rightCheek = jaw[14];

            const dist = (pt1, pt2) => Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);

            const distLeft = dist(noseTip, leftCheek);
            const distRight = dist(noseTip, rightCheek);

            if (distRight === 0) return 1.0;
            return distLeft / distRight;
        } catch (e) {
            console.error("Error in Yaw calculation:", e);
            return 1.0;
        }
    };

    // Radius (in displayed CSS pixels) of the on-screen target ring — matches the
    // w-64 (256px) circle overlay, so recognition only triggers inside that ring.
    const CIRCLE_RADIUS_PX = 128;

    // Is the centre of a detected face box within the on-screen target circle?
    // Face-api boxes are in the video's intrinsic pixel space; map them into the
    // displayed element space (accounting for object-cover cropping). The mirror
    // (-scale-x-100) is irrelevant here because the circle is centred, so a point's
    // distance to the centre is unchanged by the horizontal flip.
    const isFaceInsideCircle = (box) => {
        const video = videoRef.current;
        if (!video || !box) return false;
        const vW = video.videoWidth, vH = video.videoHeight;
        const cW = video.clientWidth, cH = video.clientHeight;
        if (!vW || !vH || !cW || !cH) return false;

        const scale = Math.max(cW / vW, cH / vH); // object-cover scale
        const offX = (cW - vW * scale) / 2;
        const offY = (cH - vH * scale) / 2;

        const faceCx = box.x + box.width / 2;
        const faceCy = box.y + box.height / 2;
        const dispX = offX + faceCx * scale;
        const dispY = offY + faceCy * scale;

        const dx = dispX - cW / 2;
        const dy = dispY - cH / 2;

        // In fullscreen mode or once identified, the face moves more in absolute pixels.
        // We scale the allowed circle radius dynamically to prevent recognition failures.
        let allowedRadius = CIRCLE_RADIUS_PX;
        if (fsActive) {
            allowedRadius = CIRCLE_RADIUS_PX * Math.max(1, cW / 600);
        }
        if (identifiedEmployeeRef.current) {
            allowedRadius = allowedRadius * 1.6;
        }

        return Math.hypot(dx, dy) <= allowedRadius;
    };

    const detectFaceInsideCircle = async () => {
        if (!videoRef.current) return { face: null, debug: "No video element ref" };
        
        try {
            const detections = await faceapi.detectAllFaces(
                videoRef.current,
                new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
            ).withFaceLandmarks().withFaceDescriptors();

            if (!detections || detections.length === 0) {
                return { face: null, debug: "Searching..." };
            }

            const inside = detections.filter(d => isFaceInsideCircle(d.detection.box));
            if (inside.length === 0) {
                return { face: null, debug: "Move closer to center" };
            }

            // Enforce minimum face width to prevent small mobile phone screens or far away spoof attempts
            const largeEnough = inside.filter(d => d.detection.box.width >= 130);
            if (largeEnough.length === 0) {
                return { face: null, debug: "Please stand closer to camera" };
            }

            largeEnough.sort((a, b) => b.detection.box.area - a.detection.box.area);
            return { face: largeEnough[0], debug: "Face inside circle" };
        } catch (err) {
            return { face: null, debug: `Err: ${err.message}` };
        }
    };

    const calculateDuration = (checkInStr) => {
        if (!checkInStr) return '0h 0m';
        try {
            const cleanStr = checkInStr.replace(' ', 'T');
            const checkInDate = new Date(cleanStr);
            const now = new Date();
            const diffMs = now - checkInDate;
            if (isNaN(diffMs) || diffMs < 0) return '0h 0m';
            const diffHrs = diffMs / (1000 * 60 * 60);
            const hours = Math.floor(diffHrs);
            const minutes = Math.floor((diffHrs % 1) * 60);
            return `${hours}h ${minutes}m`;
        } catch (e) {
            console.error("Error calculating duration:", e);
            return '0h 0m';
        }
    };

    const handleLivenessConfirm = () => {
        if (!livenessDetectionRef.current) {
            toast.error("Scanner snapshot missing. Please re-scan.");
            return;
        }

        const nowStr = formatTimeOnly(new Date());
        setConfirmModalTimestamp(nowStr);

        if (attendanceStatusRef.current === 'CHECKED_IN') {
            setConfirmModalType('CHECK_OUT');
            const duration = calculateDuration(checkInRawRef.current);
            setConfirmModalDuration(duration);
        } else {
            setConfirmModalType('CHECK_IN');
        }

        setShowConfirmModal(true);
    };

    const executeLivenessAttendance = async () => {
        setShowConfirmModal(false);
        if (!livenessDetectionRef.current) return;
        await handlePasswordlessAttendance(livenessDetectionRef.current);
        setLivenessVerified(false);
        livenessDetectionRef.current = null;
    };

    const handleNotMe = () => {
        setEmail('');
        setIdentifiedEmployee(null);
        setAttendanceStatus('unknown');
        setTurnedLeft(false);
        setTurnedRight(false);
        turnedLeftRef.current = false;
        turnedRightRef.current = false;
        lookingCenterRef.current = true;
        setLivenessVerified(false);
        livenessDetectionRef.current = null;
        setLeftProfile(null);
        setRightProfile(null);
        leftDescriptorRef.current = null;
        rightDescriptorRef.current = null;
        setCheckInTime(null);
        setCheckInRaw(null);
        setStatusMessage("System Ready. Stand in front of camera.");
    };

    // 2. Start Webcam Stream
    const handlePasswordlessAttendance = async (detection) => {
        const currentEmail = emailRef.current;
        if (checkingLivenessRef.current || loading || !!verificationResult || !currentEmail) return;
        checkingLivenessRef.current = true;
        setLoading(true);
        setStatusMessage("Liveness verified. Logging attendance...");

        try {
            const token = localStorage.getItem('token');
            const employeeEmail = currentEmail;
            const employeeName = identifiedEmployeeRef.current ? identifiedEmployeeRef.current.employeeName : currentEmail;

            // Fetch check status if unknown
            let status = attendanceStatusRef.current;
            if (status === 'unknown') {
                const statusRes = await axios.get(`${API_BASE_URL}/api/attendance/status/${encodeURIComponent(employeeEmail)}`, {
                    headers: { 'x-access-token': token }
                });
                status = statusRes.data.status;
                setAttendanceStatus(status);
                setCheckInTime(statusRes.data.checkInTime || null);
                setCheckInRaw(statusRes.data.checkInRaw || null);
            }

            if (status === 'COMPLETED') {
                setStatusMessage(`${employeeName} has already completed attendance for today.`);
                toast.error("Attendance completed for today.");
                setLoading(false);
                checkingLivenessRef.current = false;
                return;
            }

            const action = status === 'CHECKED_IN' ? 'CHECK_OUT' : 'CHECK_IN';
            setStatusMessage(`Logging ${action === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}...`);

            // 3. Capture base64 snapshot
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const snapshotImage = canvas.toDataURL('image/jpeg', 0.8);

            // 4. Record attendance on backend without password
            const response = await axios.post(`${API_BASE_URL}/api/attendance/check-in-out-with-face`, {
                email: employeeEmail,
                faceDescriptor: Array.from(detection.descriptor),
                faceDescriptorLeft: leftDescriptorRef.current,
                faceDescriptorRight: rightDescriptorRef.current,
                snapshotImage,
                action,
                livenessVerified: true
            }, {
                headers: { 'x-access-token': token }
            });

            const { type, time, message } = response.data;

            setVerificationResult({
                success: true,
                message,
                employeeName,
                time,
                type
            });
            setStatusMessage(`${type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} logged!`);
            toast.success(`${employeeName} ${type === 'CHECK_IN' ? 'checked in' : 'checked out'} successfully!`);

            // Clear inputs and reset status
            setEmail('');
            setPassword('');
            setAttendanceStatus('unknown');
            setStatusEmployeeName('');
            setIdentifiedEmployee(null);
            setLeftProfile(null);
            setRightProfile(null);
            leftDescriptorRef.current = null;
            rightDescriptorRef.current = null;
            setCheckInTime(null);
            setCheckInRaw(null);
            setActiveInput(null);
            setFailedAttempts(0); // Reset attempts on successful logging

            setTimeout(() => {
                setVerificationResult(null);
                setStatusMessage("System Ready. Stand in front of camera.");
            }, 5000);

        } catch (err) {
            console.error("Liveness check-in error:", err);
            const serverMsg = err.response?.data?.message || "Verification failed.";
            setVerificationResult({
                success: false,
                message: serverMsg
            });
            setStatusMessage("Verification failed. Try again.");
            toast.error(serverMsg);

            setTimeout(() => {
                setVerificationResult(null);
                setStatusMessage("System Ready. Stand in front of camera.");
            }, 5000);
        } finally {
            setLoading(false);
            checkingLivenessRef.current = false;
        }
    };

    const startCamera = async () => {
        try {
            if (streamRef.current) return;
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 },
                    facingMode: "user"
                } 
            });
            videoRef.current.srcObject = stream;
            streamRef.current = stream;

            // Start running background face detection + liveness/identification with dynamic recursive setTimeout loop
            const detectFrame = async () => {
                if (!streamRef.current) return; // Stop permanently if stream is closed

                if (livenessVerifiedRef.current) {
                    // Pause active scanning while waiting for user confirm action
                    detectIntervalRef.current = setTimeout(detectFrame, 1000);
                    return;
                }
                
                if (!videoRef.current || !modelsLoaded) {
                    // Not ready yet, check again in 500ms
                    detectIntervalRef.current = setTimeout(detectFrame, 500);
                    return;
                }
                
                try {
                    const needsDesc = !emailRef.current;
                    const result = await detectFaceInsideCircle(needsDesc);
                    const detection = result ? result.face : null;
                    setFaceDetected(!!detection);

                    // No face inside the circle: clear states with grace period
                    if (!detection) {
                        const debugMsg = result ? result.debug : "No face inside circle";
                        setStatusMessage(`Scanning... (${debugMsg})`);

                        const now = Date.now();
                        if (now - lastFaceSeenTimeRef.current > 1500) {
                            // Reset head-turn detection states
                            turnedLeftRef.current = false;
                            turnedRightRef.current = false;
                            lookingCenterRef.current = true;
                            setTurnedLeft(false);
                            setTurnedRight(false);
                            setLeftProfile(null);
                            setRightProfile(null);
                            leftDescriptorRef.current = null;
                            rightDescriptorRef.current = null;
                            setCheckInTime(null);
                            setCheckInRaw(null);

                            // If not in password-fallback mode, clear identified info
                            if (!showPasswordFieldRef.current) {
                                setIdentifiedEmployee(null);
                                setEmail('');
                                setAttendanceStatus('unknown');
                            }
                        }
                    } else {
                        // Face detected! Keep track of when we last saw it
                        lastFaceSeenTimeRef.current = Date.now();

                        if (showPasswordFieldRef.current) {
                            // If password fallback is enabled, just do simple face identification auto-fill
                            if (!identifyingRef.current && !identifiedEmployeeRef.current) {
                                identifyingRef.current = true;
                                try {
                                    const token = localStorage.getItem('token');
                                    const res = await axios.post(`${API_BASE_URL}/api/attendance/identify-face`, {
                                        faceDescriptor: Array.from(detection.descriptor)
                                    }, {
                                        headers: { 'x-access-token': token }
                                    });

                                    if (res.data.matched) {
                                        setIdentifiedEmployee({ email: res.data.email, employeeName: res.data.employeeName });
                                        setEmail(res.data.email);
                                        setStatusMessage(`Recognized: ${res.data.employeeName}. Enter password.`);
                                    } else {
                                        setIdentifiedEmployee(null);
                                    }
                                } catch {
                                    // ignore
                                } finally {
                                    identifyingRef.current = false;
                                }
                            }
                        } else {
                            // Run head-turn detection & identification flow
                            // Step 1: Auto-identify if we don't have an email yet
                            const currentEmail = emailRef.current;
                            if (!currentEmail && !identifyingRef.current) {
                                identifyingRef.current = true;
                                try {
                                    const token = localStorage.getItem('token');
                                    const res = await axios.post(`${API_BASE_URL}/api/attendance/identify-face`, {
                                        faceDescriptor: Array.from(detection.descriptor)
                                    }, {
                                        headers: { 'x-access-token': token }
                                    });

                                    if (res.data.matched) {
                                        setIdentifiedEmployee({ email: res.data.email, employeeName: res.data.employeeName });
                                        setEmail(res.data.email);
                                        setFailedAttempts(0);
                                        
                                        // Fetch status for UI status cards
                                        const statusRes = await axios.get(`${API_BASE_URL}/api/attendance/status/${encodeURIComponent(res.data.email)}`, {
                                            headers: { 'x-access-token': token }
                                        });
                                        setAttendanceStatus(statusRes.data.status);
                                        setCheckInTime(statusRes.data.checkInTime || null);
                                        setCheckInRaw(statusRes.data.checkInRaw || null);
                                    } else {
                                        setIdentifiedEmployee(null);
                                        // Count as a failed attempt to log in
                                        setFailedAttempts(prev => {
                                            const newCount = prev + 1;
                                            if (newCount >= 3) {
                                                setShowPasswordField(true);
                                                setStatusMessage("Identification failed 3 times. Please log in manually.");
                                                toast.error("Failed to identify after 3 retries. Please enter credentials.");
                                            } else {
                                                setStatusMessage(`Face not recognized (Attempt ${newCount}/3).`);
                                            }
                                            return newCount;
                                        });
                                    }
                                } catch (err) {
                                    console.error("Auto-identify error:", err);
                                } finally {
                                    identifyingRef.current = false;
                                }
                            }

                            // Step 2: Run head-turn detection once identified
                            if (emailRef.current) {
                                const landmarks = detection.landmarks;
                                if (landmarks) {
                                    const yawRatio = calculateYawRatio(landmarks);
                                    const empName = identifiedEmployeeRef.current ? identifiedEmployeeRef.current.employeeName : emailRef.current;

                                    // Update center state
                                    if (yawRatio >= 0.85 && yawRatio <= 1.15) {
                                        lookingCenterRef.current = true;
                                    }

                                    // Detect Left Turn (must start from looking straight)
                                    if (yawRatio < YAW_TURN_LEFT_THRESHOLD) {
                                        if (!turnedLeftRef.current && lookingCenterRef.current) {
                                            turnedLeftRef.current = true;
                                            setTurnedLeft(true);
                                            lookingCenterRef.current = false;
                                            const snap = captureSnapshot();
                                            leftProfileRef.current = snap;
                                            setLeftProfile(snap);
                                            
                                            // Extract Left Profile descriptor asynchronously
                                            faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                                                .withFaceLandmarks().withFaceDescriptor()
                                                .then(d => {
                                                    if (d) leftDescriptorRef.current = Array.from(d.descriptor);
                                                }).catch(() => {});

                                            toast.success("Left turn detected!", { id: 'turn-left-toast' });
                                        }
                                    }
                                    // Detect Right Turn (must start from looking straight)
                                    if (yawRatio > YAW_TURN_RIGHT_THRESHOLD) {
                                        if (!turnedRightRef.current && lookingCenterRef.current) {
                                            turnedRightRef.current = true;
                                            setTurnedRight(true);
                                            lookingCenterRef.current = false;
                                            const snap = captureSnapshot();
                                            rightProfileRef.current = snap;
                                            setRightProfile(snap);
                                            
                                            // Extract Right Profile descriptor asynchronously
                                            faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                                                .withFaceLandmarks().withFaceDescriptor()
                                                .then(d => {
                                                    if (d) rightDescriptorRef.current = Array.from(d.descriptor);
                                                }).catch(() => {});

                                            toast.success("Right turn detected!", { id: 'turn-right-toast' });
                                        }
                                    }

                                    setStatusMessage(`Recognized: ${empName}. Turn left & right to confirm. (Yaw: ${yawRatio.toFixed(2)})`);

                                    if (turnedLeftRef.current && turnedRightRef.current) {
                                        livenessDetectionRef.current = detection;
                                        turnedLeftRef.current = false;
                                        turnedRightRef.current = false;
                                        setTurnedLeft(false);
                                        setTurnedRight(false);
                                        setLivenessVerified(true);
                                        setStatusMessage("Liveness verified. Tap Confirm Check-In/Out on the right panel.");
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error in detection frame:", err);
                }

                // Schedule next frame only if the stream is still active
                if (streamRef.current) {
                    const delay = emailRef.current ? 150 : 500;
                    detectIntervalRef.current = setTimeout(detectFrame, delay);
                }
            };

            // Start the loop
            detectIntervalRef.current = setTimeout(detectFrame, 500);

        } catch (err) {
            console.error("Error accessing webcam:", err);
            toast.error("Webcam access denied. Please enable browser camera permissions.");
        }
    };

    const stopCamera = () => {
        if (detectIntervalRef.current) {
            clearTimeout(detectIntervalRef.current);
            detectIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setFaceDetected(false);
    };

    // Keep camera active when screen is mounted
    useEffect(() => {
        if (modelsLoaded) {
            startCamera();
        }
    }, [modelsLoaded]);

    // Debounced email lookup to check attendance status
    const checkAttendanceStatus = useCallback(async (emailValue) => {
        if (!emailValue || !emailValue.includes('@')) {
            setAttendanceStatus('unknown');
            setStatusEmployeeName('');
            return;
        }
        try {
            setAttendanceStatus('loading');
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/attendance/status/${encodeURIComponent(emailValue)}`, {
                headers: { 'x-access-token': token }
            });
            setAttendanceStatus(res.data.status);
            setStatusEmployeeName(res.data.employeeName || '');
            setCheckInTime(res.data.checkInTime || null);
            setCheckInRaw(res.data.checkInRaw || null);
        } catch {
            setAttendanceStatus('unknown');
            setStatusEmployeeName('');
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            checkAttendanceStatus(email);
        }, 600);
        return () => clearTimeout(timer);
    }, [email, checkAttendanceStatus]);

    // 3. Process Attendance Check In/Out
    const handleVerify = async (action) => {
        if (!email || !password) {
            toast.error("Credentials are required.");
            return;
        }

        if (!modelsLoaded) {
            toast.error("Face-API models are still loading.");
            return;
        }

        setLoading(true);
        setStatusMessage("Authenticating employee credentials...");

        try {
            // Detect face descriptor — only a face centred inside the target circle counts
            setStatusMessage("Scanning face. Look directly at camera...");
            const detection = await detectFaceInsideCircle();

            if (!detection) {
                setStatusMessage("No face inside the circle! Align your face and try again.");
                toast.error("Position your face inside the circle.");
                setLoading(false);
                return;
            }

            setStatusMessage("Verifying match and saving logs...");

            // Capture base64 snapshot
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const snapshotImage = canvas.toDataURL('image/jpeg', 0.8);

            const token = localStorage.getItem('token');

            const response = await axios.post(`${API_BASE_URL}/api/attendance/check-in-out-with-face`, {
                email,
                password,
                faceDescriptor: Array.from(detection.descriptor),
                snapshotImage,
                action
            }, {
                headers: { 'x-access-token': token }
            });

            const { type, employeeName, time, message } = response.data;

            setVerificationResult({
                success: true,
                message,
                employeeName,
                time,
                type
            });
            setStatusMessage(`${type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} logged!`);
            toast.success(`${employeeName} ${type === 'CHECK_IN' ? 'checked in' : 'checked out'} successfully!`);

            // Clear inputs and reset status
            setEmail('');
            setPassword('');
            setAttendanceStatus('unknown');
            setStatusEmployeeName('');
            setIdentifiedEmployee(null);
            setActiveInput(null);

            // Automatically reset back to verification view after 5 seconds
            setTimeout(() => {
                setVerificationResult(null);
                setStatusMessage("System Ready. Stand in front of camera.");
            }, 5000);

        } catch (err) {
            console.error("Facial matching verification error:", err);
            const serverMsg = err.response?.data?.message || "Verification failed.";
            setVerificationResult({
                success: false,
                message: serverMsg
            });
            setStatusMessage("Verification failed. Try again.");
            toast.error(serverMsg);

            setTimeout(() => {
                setVerificationResult(null);
                setStatusMessage("System Ready. Stand in front of camera.");
            }, 5000);
        } finally {
            setLoading(false);
        }
    };

    // ---------- Kiosk full-screen lock ----------
    // Keep a ref in sync so global event listeners can read the latest lock state.
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

    // Capture Escape / F11 / system keys so they cannot break the lock (Chrome/Edge).
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

    // Password-gated enter/exit for the kiosk lock
    const handleKioskSubmit = async (e) => {
        e.preventDefault();
        if (!kioskPassword) { setKioskError('Password is required.'); return; }
        setKioskVerifying(true);
        setKioskError('');
        try {
            const ok = await verifyUserPassword(kioskPassword);
            if (!ok) { setKioskError('Incorrect password.'); return; }

            if (kioskModal === 'enter') {
                // Enter full screen first; only mark as locked once it actually succeeds
                await requestFs(kioskContainerRef.current);
                await lockKeyboard();
                setKioskLocked(true);
            } else {
                // Authorized exit
                setKioskLocked(false);
                unlockKeyboard();
                if (isFullscreen()) await exitFs();
            }
            setKioskModal(null);
            setKioskPassword('');
            setActiveInput(null);
        } catch (err) {
            setKioskError(err.response?.data?.message || 'Verification failed. Try again.');
        } finally {
            setKioskVerifying(false);
        }
    };

    // Enter kiosk mode (full screen) directly without a password prompt.
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

    // Re-assert full screen if it is lost while still locked (user-gesture button).
    const handleResumeFullscreen = async () => {
        await requestFs(kioskContainerRef.current);
        await lockKeyboard();
    };

    // Global guards active while the kiosk is locked
    useEffect(() => {
        const onFsChange = () => {
            const active = isFullscreen();
            setFsActive(active);
            // If full screen dropped while still locked, capture keyboard again on next resume
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
                if (k === 'Escape') openKioskModal('exit'); // Esc surfaces the password prompt instead of exiting
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

    if (!permissionChecked) {
        return <ModernLoader message="Verifying access permission..." fullScreen={true} />;
    }

    return (
        <div
            ref={kioskContainerRef}
            className={`${fsActive ? 'min-h-screen w-screen overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-10 flex flex-col justify-center relative' : 'max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 relative'}`}
        >
            {/* Exit Kiosk button (small lock icon) in top-right */}
            {kioskLocked && (
                <button
                    onClick={() => openKioskModal('exit')}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 p-3 bg-white hover:bg-gray-50 text-rose-600 hover:text-rose-700 rounded-2xl shadow-lg border border-gray-150 transition-all active:scale-95 z-40 flex items-center justify-center"
                    title="Exit Full Screen (requires password)"
                >
                    <LuLock size={18} />
                </button>
            )}

            <div className="text-center mb-8 relative flex flex-col items-center">
                <div className="mb-4">
                    <BrandLogo className="justify-center" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Front Desk Attendance Portal</h1>
                <p className="text-gray-500 mt-2 text-sm">Face recognition Check-In & Check-Out scanner.</p>

                {/* Kiosk enter control */}
                {!kioskLocked && (
                    <button
                        onClick={handleEnterKiosk}
                        className="mt-4 sm:mt-0 sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 inline-flex items-center gap-2 px-4 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition"
                        title="Lock this screen in full-screen kiosk mode"
                    >
                        <LuMaximize size={15} /> Full Screen
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                {/* Left Side: Webcam Viewport */}
                <div className="bg-[#0f172a] rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-between p-6 min-h-[400px]">
                    {/* Header bar in webcam panel */}
                    <div className="flex items-center justify-between z-10">
                        <span className="text-xs uppercase tracking-widest text-[#0ea5e9] font-black flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${faceDetected ? 'bg-emerald-500 animate-ping' : 'bg-[#0ea5e9] animate-pulse'}`} />
                            {faceDetected ? 'Face Aligned' : 'Searching for Face...'}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                            F-ID SCANNER v2.0
                        </span>
                    </div>

                    {/* Camera Feed Stream Container */}
                    <div className="my-auto relative flex justify-center items-center w-full aspect-video bg-[#1e293b] rounded-2xl overflow-hidden border border-slate-700/50">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover transform -scale-x-100"
                        />

                        {/* Scanner overlay effect */}
                        {modelsLoaded && !verificationResult && (
                            <div className="absolute inset-0 border-[3px] border-dashed border-[#0ea5e9]/30 rounded-2xl pointer-events-none flex items-center justify-center">
                                {/* Pulse scanner target box */}
                                <div className={`w-64 h-64 border-2 rounded-full pointer-events-none transition-all duration-300 ${
                                    faceDetected ? 'border-emerald-500/80 scale-105 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-[#0ea5e9]/40 scale-100'
                                }`}>
                                    {/* Scanning line indicator */}
                                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#0ea5e9] to-transparent animate-pulse absolute top-1/2 left-0" />
                                </div>
                            </div>
                        )}

                        {/* Loading Models HUD */}
                        {!modelsLoaded && (
                            <div className="absolute inset-0 bg-[#0f172a]/95 flex flex-col items-center justify-center gap-3">
                                <div className="w-10 h-10 border-4 border-[#1e293b] border-t-[#0ea5e9] rounded-full animate-spin"></div>
                                <span className="text-gray-400 text-xs tracking-widest uppercase">Initializing camera stream...</span>
                            </div>
                        )}

                        {/* Success HUD */}
                        {verificationResult && verificationResult.success && (
                            <div className="absolute inset-0 bg-emerald-950/95 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                                <LuCheck className="w-16 h-16 text-emerald-400 mb-4 animate-bounce" />
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                                    {verificationResult.type === 'CHECK_IN' ? 'Checked In' : 'Checked Out'}
                                </h3>
                                <p className="text-emerald-300 font-bold mt-1">{verificationResult.employeeName}</p>
                                <div className="mt-4 bg-emerald-900/50 border border-emerald-800 px-4 py-2 rounded-xl text-xs text-white">
                                    <span className="font-semibold block uppercase tracking-wider">Timestamp</span>
                                    <span className="text-emerald-200">{verificationResult.time}</span>
                                </div>
                            </div>
                        )}

                        {/* Mismatch HUD */}
                        {verificationResult && !verificationResult.success && (
                            <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                                <LuInfo className="w-16 h-16 text-red-400 mb-4" />
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Access Denied</h3>
                                <p className="text-red-300 font-bold mt-1 text-sm">{verificationResult.message}</p>
                                <button 
                                    onClick={() => setVerificationResult(null)}
                                    className="mt-6 px-5 py-2 bg-red-900 hover:bg-red-800 text-white rounded-xl text-xs uppercase font-black tracking-widest transition-all"
                                >
                                    Retry Verification
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bottom HUD message bar */}
                    <div className="text-left bg-slate-800/50 border border-slate-700/30 p-3 rounded-xl mt-4">
                        <span className="text-[10px] uppercase font-black text-[#0ea5e9] tracking-wider block">Scanner Console</span>
                        <p className="text-white text-xs mt-1 truncate font-mono">{statusMessage}</p>
                    </div>
                </div>

                {/* Right Side: Credential Authorization Panel */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 sm:p-10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#1e1b4b] flex items-center justify-center">
                                <LuLock size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Identity Authentication</h2>
                                <p className="text-gray-400 text-xs">Enter credentials, then select Check In or Check Out.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex flex-col text-left gap-2">
                                    <label htmlFor="email" className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Employee Identity {showPasswordField ? '' : <span className="text-gray-400 font-normal">(auto-detected)</span>}
                                    </label>
                                    
                                    {showPasswordField || !identifiedEmployee ? (
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={showPasswordField ? (e) => setEmail(e.target.value) : undefined}
                                            readOnly={!showPasswordField}
                                            placeholder={showPasswordField ? "Enter your email address" : "Face the camera to auto-detect..."}
                                            required
                                            disabled={loading || !!verificationResult}
                                            className="px-4 py-3 border rounded-xl transition-all text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 bg-white border-gray-200"
                                        />
                                    ) : (
                                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-fade-in text-left">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                                <LuUserCheck size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-gray-900 text-sm leading-tight">{identifiedEmployee.employeeName}</h4>
                                                <p className="text-xs text-gray-500 font-medium mt-0.5">{identifiedEmployee.email}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {!showPasswordField ? (
                                    <div className="space-y-4">
                                        {attendanceStatus === 'COMPLETED' ? (
                                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-4 animate-fade-in">
                                                <div className="flex justify-center items-center gap-1.5 text-amber-700 font-bold text-sm">
                                                    <LuInfo className="w-5 h-5" />
                                                    <span>Attendance Completed Today</span>
                                                </div>
                                                <p className="text-gray-500 text-xs leading-relaxed">
                                                    You have already completed both Check-In and Check-Out for today. No further action is required.
                                                </p>
                                                <div className="pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleNotMe}
                                                        className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-black uppercase tracking-widest rounded-xl transition cursor-pointer"
                                                    >
                                                        Done / Reset Scanner
                                                    </button>
                                                </div>
                                            </div>
                                        ) : livenessVerified ? (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-4 animate-fade-in">
                                                <div className="flex justify-center items-center gap-1.5 text-emerald-700 font-bold text-sm">
                                                    <LuCheck className="w-5 h-5 bg-emerald-500 text-white rounded-full p-0.5" />
                                                    <span>Liveness Verification Successful</span>
                                                </div>
                                                <p className="text-gray-500 text-xs leading-relaxed">
                                                    Your identity has been fully verified. Please confirm your action below to complete your attendance log.
                                                </p>
                                                
                                                <div className="pt-2 space-y-3">
                                                    {attendanceStatus === 'CHECKED_IN' ? (
                                                        <button
                                                            type="button"
                                                            onClick={handleLivenessConfirm}
                                                            disabled={loading || !!verificationResult}
                                                            className="w-full py-4 bg-[#1e1b4b] hover:bg-[#312e81] text-white font-black rounded-xl shadow-xl hover:shadow-indigo-950/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest cursor-pointer"
                                                        >
                                                            {loading ? (
                                                                <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                                                            ) : (
                                                                <>
                                                                    <LuLogOut className="w-4 h-4 text-[#0ea5e9]" />
                                                                    <span>Confirm Check Out</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={handleLivenessConfirm}
                                                            disabled={loading || !!verificationResult}
                                                            className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-xl hover:shadow-emerald-950/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest cursor-pointer"
                                                        >
                                                            {loading ? (
                                                                <div className="w-4 h-4 border-2 border-emerald-300 border-t-white rounded-full animate-spin"></div>
                                                            ) : (
                                                                <>
                                                                    <LuUserCheck className="w-4 h-4" />
                                                                    <span>Confirm Check In</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                    
                                                    <button
                                                        type="button"
                                                        onClick={handleNotMe}
                                                        className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-black uppercase tracking-widest rounded-xl transition"
                                                    >
                                                        Not Me? Re-Scan
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 text-center space-y-4">
                                                <div className="flex justify-center gap-1.5 text-indigo-600 font-bold text-sm">
                                                    <span>Face Liveness Scan (Turn Head)</span>
                                                </div>
                                                <p className="text-gray-500 text-xs leading-relaxed">
                                                    Position your face inside the circle, then **turn your head left**, and then **turn your head right** to log attendance.
                                                </p>
                                                <div className="flex justify-center gap-6 text-xs">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className={`w-16 h-16 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all ${leftProfile ? 'border-emerald-500 bg-white' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                                                            {leftProfile ? (
                                                                <img src={leftProfile} alt="Left Profile" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <LuCamera className="w-5 h-5 text-gray-300" />
                                                            )}
                                                        </div>
                                                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] transition-all ${turnedLeft ? 'bg-emerald-500 text-white border-emerald-500 font-bold' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                            {turnedLeft && <LuCheck size={10} />}
                                                            <span>1. Turn Left</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className={`w-16 h-16 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all ${rightProfile ? 'border-emerald-500 bg-white' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                                                            {rightProfile ? (
                                                                <img src={rightProfile} alt="Right Profile" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <LuCamera className="w-5 h-5 text-gray-300" />
                                                            )}
                                                        </div>
                                                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] transition-all ${turnedRight ? 'bg-emerald-500 text-white border-emerald-500 font-bold' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                            {turnedRight && <LuCheck size={10} />}
                                                            <span>2. Turn Right</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {email && (
                                                    <button
                                                        type="button"
                                                        onClick={handleNotMe}
                                                        className="w-full mt-2 py-2 text-xs text-red-600 hover:text-red-800 font-semibold uppercase tracking-wider transition underline"
                                                    >
                                                        Not Me? Re-Scan
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col text-left gap-1">
                                        <label htmlFor="password" className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Password</label>
                                        <input
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setActiveInput('password')}
                                            onClick={() => setActiveInput('password')}
                                            placeholder="••••••••"
                                            required
                                            disabled={loading || !!verificationResult}
                                            className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all text-sm text-gray-800 placeholder-gray-400"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Status indicator */}
                            {attendanceStatus === 'loading' && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <div className="w-3 h-3 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                                    <span>Checking attendance status...</span>
                                </div>
                            )}
                            {attendanceStatus === 'CHECKED_IN' && statusEmployeeName && (
                                <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-xl font-semibold">
                                    <LuInfo size={14} />
                                    <span>{statusEmployeeName} is currently checked in.</span>
                                </div>
                            )}
                            {attendanceStatus === 'COMPLETED' && statusEmployeeName && (
                                <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl font-semibold">
                                    <LuCheck size={14} />
                                    <span>{statusEmployeeName} has completed attendance for today.</span>
                                </div>
                            )}

                            {/* Conditional buttons based on attendance status */}
                            {showPasswordField && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3">
                                        {/* Show Check In when NOT checked in yet (or status unknown / not looked up) */}
                                        {(attendanceStatus === 'NOT_CHECKED_IN' || attendanceStatus === 'unknown') && (
                                            <button
                                                type="button"
                                                onClick={() => handleVerify('CHECK_IN')}
                                                disabled={loading || !modelsLoaded || !!verificationResult}
                                                className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-xl hover:shadow-emerald-950/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest cursor-pointer"
                                            >
                                                {loading ? (
                                                    <div className="w-4 h-4 border-2 border-emerald-300 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <LuUserCheck className="w-4 h-4" />
                                                        <span>Check In</span>
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {/* Show Check Out when already checked in */}
                                        {attendanceStatus === 'CHECKED_IN' && (
                                            <button
                                                type="button"
                                                onClick={() => handleVerify('CHECK_OUT')}
                                                disabled={loading || !modelsLoaded || !!verificationResult}
                                                className="w-full py-4 bg-[#1e1b4b] hover:bg-[#312e81] text-white font-black rounded-xl shadow-xl hover:shadow-indigo-950/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest cursor-pointer"
                                            >
                                                {loading ? (
                                                    <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <LuLogOut className="w-4 h-4 text-[#0ea5e9]" />
                                                        <span>Check Out</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPasswordField(false);
                                            setFailedAttempts(0);
                                            setTurnedLeft(false);
                                            setTurnedRight(false);
                                            setEmail('');
                                            setPassword('');
                                            setIdentifiedEmployee(null);
                                            setAttendanceStatus('unknown');
                                            setStatusMessage("System Ready. Stand in front of camera.");
                                        }}
                                        className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-black uppercase tracking-widest rounded-xl transition"
                                    >
                                        Try Blink Scanner Again
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <span className="text-[10px] text-gray-400 font-medium">
                            Please make sure your face is clearly visible under good lighting.
                        </span>
                    </div>
                </div>
            </div>

            {/* Blocking overlay: locked but full screen was dropped (e.g. via OS shortcut) */}
            {kioskLocked && !fsActive && !kioskModal && (
                <div className="fixed inset-0 z-[60] bg-[#0f172a]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 p-6 text-center">
                    <LuShieldAlert className="w-16 h-16 text-amber-400" />
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Kiosk Locked</h3>
                        <p className="text-slate-300 text-sm mt-2 max-w-md">
                            Full screen is required. Resume to continue, or an authorized user can exit with a password.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={handleResumeFullscreen}
                            className="px-6 py-3 bg-[#0ea5e9] hover:bg-sky-600 text-white font-black rounded-xl text-xs uppercase tracking-widest transition flex items-center justify-center gap-2"
                        >
                            <LuMaximize size={15} /> Resume Full Screen
                        </button>
                        <button
                            onClick={() => openKioskModal('exit')}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-xl text-xs uppercase tracking-widest transition flex items-center justify-center gap-2"
                        >
                            <LuLock size={15} /> Exit Kiosk
                        </button>
                    </div>
                </div>
            )}

            {/* Password-gated kiosk enter/exit modal */}
            {kioskModal && (
                <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <form
                        onSubmit={handleKioskSubmit}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 space-y-5 animate-fade-in"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${kioskModal === 'enter' ? 'bg-[#0f172a] text-white' : 'bg-rose-50 text-rose-600'}`}>
                                {kioskModal === 'enter' ? <LuMaximize size={20} /> : <LuMinimize size={20} />}
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-black text-gray-900">
                                    {kioskModal === 'enter' ? 'Enter Kiosk Mode' : 'Exit Kiosk Mode'}
                                </h3>
                                <p className="text-gray-400 text-xs">
                                    Authorized password required to {kioskModal === 'enter' ? 'lock' : 'unlock'} the screen.
                                </p>
                            </div>
                        </div>

                        <input
                            type="password"
                            autoFocus
                            value={kioskPassword}
                            onChange={(e) => { setKioskPassword(e.target.value); setKioskError(''); }}
                            onFocus={() => setActiveInput('kioskPassword')}
                            onClick={() => setActiveInput('kioskPassword')}
                            placeholder="Your account password"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm text-gray-800"
                        />

                        {kioskError && (
                            <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                                <LuInfo size={13} /> {kioskError}
                            </p>
                        )}

                        <div className="flex gap-3">
                            {/* Cancel closes the prompt; on exit it simply leaves the screen locked */}
                            <button
                                type="button"
                                onClick={() => { setKioskModal(null); setKioskPassword(''); setKioskError(''); setActiveInput(null); }}
                                className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={kioskVerifying}
                                className={`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-2 disabled:opacity-60 ${kioskModal === 'enter' ? 'bg-[#0f172a] hover:bg-[#1e293b]' : 'bg-rose-600 hover:bg-rose-700'}`}
                            >
                                {kioskVerifying ? (
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                ) : (
                                    kioskModal === 'enter' ? 'Lock Screen' : 'Unlock'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Action Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-modal-in">
                    <div className="bg-white rounded-[2rem] max-w-2xl w-full p-10 shadow-2xl border border-gray-100 text-center space-y-10">
                        <div className="flex flex-col items-center">
                            {confirmModalType === 'CHECK_IN' ? (
                                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                                    <LuUserCheck size={52} />
                                </div>
                            ) : (
                                <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-6">
                                    <LuLogOut size={52} />
                                </div>
                            )}
                            <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 uppercase tracking-tight animate-pulse">
                                {confirmModalType === 'CHECK_IN' ? 'Confirm Check In' : 'Confirm Check Out'}
                            </h3>
                            <p className="text-gray-500 text-base mt-2">
                                Please verify the details below before logging.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-8 space-y-5 text-left border border-slate-100">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-xs sm:text-sm">Employee</span>
                                <span className="text-gray-800 font-black text-lg sm:text-xl">{identifiedEmployee?.employeeName || email}</span>
                            </div>

                            {confirmModalType === 'CHECK_IN' ? (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-bold uppercase tracking-wider text-xs sm:text-sm">Check In Time</span>
                                    <span className="text-emerald-600 font-black text-xl sm:text-2xl">{confirmModalTimestamp}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-4">
                                        <span className="text-gray-400 font-bold uppercase tracking-wider text-xs sm:text-sm">Checked In At</span>
                                        <span className="text-gray-700 font-bold text-lg">{checkInRaw ? formatTimeOnly(checkInRaw) : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2.5">
                                        <span className="text-gray-400 font-bold uppercase tracking-wider text-xs sm:text-sm">Total Duration</span>
                                        <span className="text-rose-600 font-black text-xl sm:text-2xl">{confirmModalDuration}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-5">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowConfirmModal(false);
                                }}
                                className="flex-1 py-5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-[1.25rem] text-sm sm:text-base font-black uppercase tracking-widest transition"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={executeLivenessAttendance}
                                disabled={loading}
                                className={`flex-1 py-5 text-white rounded-[1.25rem] text-sm sm:text-base font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow-lg ${confirmModalType === 'CHECK_IN' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10' : 'bg-[#1e1b4b] hover:bg-[#312e81] shadow-indigo-650/10'}`}
                            >
                                {loading ? (
                                    <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                ) : (
                                    confirmModalType === 'CHECK_IN' ? 'Confirm In' : 'Confirm Out'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Virtual Keyboard */}
            {activeInput && (
                <VirtualKeyboard
                    value={activeInput === 'password' ? password : kioskPassword}
                    onChange={(val) => {
                        if (activeInput === 'password') {
                            setPassword(val);
                        } else if (activeInput === 'kioskPassword') {
                            setKioskPassword(val);
                            setKioskError('');
                        }
                    }}
                    onClose={() => setActiveInput(null)}
                    title={activeInput === 'password' ? "Employee Password" : "Kiosk Admin Password"}
                />
            )}
        </div>
    );
};

export default Attendance;

