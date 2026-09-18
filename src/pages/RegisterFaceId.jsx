import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as faceapi from '@vladmandic/face-api';
import API_BASE_URL from '../config/api.config';
import {
    LuScanFace,
    LuCamera,
    LuCheck,
    LuSearch,
    LuUser,
    LuUserCheck,
    LuUserX,
    LuRefreshCw,
    LuShieldAlert,
    LuArrowLeft,
    LuSparkles,
    LuChevronRight,
    LuCircleAlert,
    LuCalendar,
    LuMail,
    LuBadgeCheck,
    LuBuilding,
    LuInfo
} from 'react-icons/lu';
import { canRegisterFaceId, getRoleDisplayName, getRoleColor } from '../utils/roleUtils';
import ModernLoader from '../components/ModernLoader';

const RegisterFaceId = () => {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const hasPermission = canRegisterFaceId(currentUser.role);

    // Staff list state
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unregistered' | 'registered'
    const [selectedUser, setSelectedUser] = useState(null);

    // Face detection and camera states
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [registeringFace, setRegisteringFace] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);

    // Multi-angle registration steps: 'FRONT' | 'LEFT' | 'RIGHT' | 'CONFIRM'
    const [registrationStep, setRegistrationStep] = useState('FRONT');
    const registrationStepRef = useRef('FRONT');

    // Captured profiles
    const [frontProfileSnap, setFrontProfileSnap] = useState(null);
    const [leftProfileSnap, setLeftProfileSnap] = useState(null);
    const [rightProfileSnap, setRightProfileSnap] = useState(null);

    const frontDescriptorRef = useRef(null);
    const leftDescriptorRef = useRef(null);
    const rightDescriptorRef = useRef(null);

    const faceVideoRef = useRef(null);
    const faceStreamRef = useRef(null);
    const faceDetectIntervalRef = useRef(null);

    // Initial load: fetch all users
    useEffect(() => {
        if (hasPermission) {
            fetchAllUsers();
        }
    }, [hasPermission]);

    // Cleanup camera stream and intervals on unmount
    useEffect(() => {
        return () => {
            stopFaceCamera();
        };
    }, []);

    const fetchAllUsers = async () => {
        try {
            setLoadingUsers(true);
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.get(`${API_BASE_URL}/api/admin/users?limit=1000`, {
                headers: { 'x-access-token': token }
            });

            const userList = response.data?.users || response.data || [];
            // Filter out inactive users if desired, or show active
            const activeUsers = userList.filter(u => u.active !== 0 && u.active !== '0');
            setUsers(activeUsers);
        } catch (error) {
            console.error('Error fetching users for face registration:', error);
            toast.error('Failed to load employee directory.');
        } finally {
            setLoadingUsers(false);
        }
    };

    // Filtered users based on search and registration status
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const hasFace = !!(u.face_image_path || u.face_registered_at);
            if (statusFilter === 'unregistered' && hasFace) return false;
            if (statusFilter === 'registered' && !hasFace) return false;

            if (!searchTerm.trim()) return true;
            const query = searchTerm.toLowerCase();
            const fullName = `${u.firstname || ''} ${u.lastname || ''}`.toLowerCase();
            const email = (u.email || '').toLowerCase();
            const staffId = String(u.staffid || u.userid || '').toLowerCase();
            return fullName.includes(query) || email.includes(query) || staffId.includes(query);
        });
    }, [users, searchTerm, statusFilter]);

    // Counts for tabs
    const counts = useMemo(() => {
        let total = users.length;
        let registered = 0;
        let unregistered = 0;
        users.forEach(u => {
            if (u.face_image_path || u.face_registered_at) {
                registered++;
            } else {
                unregistered++;
            }
        });
        return { total, registered, unregistered };
    }, [users]);

    // Select employee
    const handleSelectUser = (user) => {
        if (cameraActive) {
            stopFaceCamera();
        }
        setSelectedUser(user);
        setRegistrationSuccess(false);
        setFrontProfileSnap(null);
        setLeftProfileSnap(null);
        setRightProfileSnap(null);
        frontDescriptorRef.current = null;
        leftDescriptorRef.current = null;
        rightDescriptorRef.current = null;
        setRegistrationStep('FRONT');
        registrationStepRef.current = 'FRONT';
    };

    // Load Face API Models
    const loadFaceModels = async () => {
        if (modelsLoaded) return true;
        setLoadingModels(true);
        try {
            await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
            await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
            await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
            setModelsLoaded(true);
            setLoadingModels(false);
            return true;
        } catch (err) {
            console.log('Failed loading local models, trying CDN...', err);
            try {
                const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
                await faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL);
                setModelsLoaded(true);
                setLoadingModels(false);
                return true;
            } catch (cdnErr) {
                console.error('All model loading attempts failed:', cdnErr);
                toast.error('Face Recognition Model Loading Failed.');
                setLoadingModels(false);
                return false;
            }
        }
    };

    const calculateYawRatio = (landmarks) => {
        if (!landmarks) return 1.0;
        try {
            const jaw = landmarks.getJawOutline();
            const nose = landmarks.getNose();
            if (!jaw || jaw.length < 15 || !nose || nose.length < 4) return 1.0;
            const noseTip = nose[3];
            const leftCheek = jaw[2];
            const rightCheek = jaw[14];
            const dist = (pt1, pt2) => Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);
            const distLeft = dist(noseTip, leftCheek);
            const distRight = dist(noseTip, rightCheek);
            if (distRight === 0) return 1.0;
            return distLeft / distRight;
        } catch {
            return 1.0;
        }
    };

    const captureRegistrationSnapshot = () => {
        const video = faceVideoRef.current;
        if (!video) return null;
        const vW = video.videoWidth || 640;
        const vH = video.videoHeight || 480;
        const dW = video.clientWidth || vW;
        const dH = video.clientHeight || vH;
        const scale = Math.max(dW / vW, dH / vH);
        const vD = Math.min(160 / scale, vW, vH);
        const sx = Math.max(0, (vW - vD) / 2);
        const sy = Math.max(0, (vH - vD) / 2);
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, sx, sy, vD, vD, 0, 0, 320, 320);
        return canvas.toDataURL('image/jpeg', 0.85);
    };

    // Callback ref to connect video element to camera stream as soon as it mounts
    const handleVideoRef = (element) => {
        faceVideoRef.current = element;
        if (element && faceStreamRef.current) {
            if (element.srcObject !== faceStreamRef.current) {
                element.srcObject = faceStreamRef.current;
            }
            element.play?.().catch(() => {});
        }
    };

    // Ensure video element receives camera stream as soon as cameraActive becomes true
    useEffect(() => {
        if (cameraActive && faceStreamRef.current && faceVideoRef.current) {
            if (faceVideoRef.current.srcObject !== faceStreamRef.current) {
                faceVideoRef.current.srcObject = faceStreamRef.current;
            }
            faceVideoRef.current.play?.().catch(() => {});
        }
    }, [cameraActive]);

    const startFaceCamera = async () => {
        try {
            const hasModels = await loadFaceModels();
            if (!hasModels) return;

            setRegistrationStep('FRONT');
            registrationStepRef.current = 'FRONT';
            setFrontProfileSnap(null);
            setLeftProfileSnap(null);
            setRightProfileSnap(null);
            frontDescriptorRef.current = null;
            leftDescriptorRef.current = null;
            rightDescriptorRef.current = null;
            setRegistrationSuccess(false);

            // Mount camera view so video element is rendered into DOM
            setCameraActive(true);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            faceStreamRef.current = stream;

            if (faceVideoRef.current) {
                faceVideoRef.current.srcObject = stream;
                faceVideoRef.current.play?.().catch(() => {});
            }

            faceDetectIntervalRef.current = setInterval(async () => {
                const video = faceVideoRef.current;
                if (video && video.readyState >= 2 && faceapi.nets.ssdMobilenetv1.params) {
                    try {
                        const detection = await faceapi.detectSingleFace(
                            video,
                            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
                        ).withFaceLandmarks().withFaceDescriptor();

                        if (!detection) {
                            setFaceDetected(false);
                            return;
                        }
                        setFaceDetected(true);

                        if (registrationStepRef.current === 'CONFIRM') return;

                        const yawRatio = calculateYawRatio(detection.landmarks);

                        if (registrationStepRef.current === 'FRONT') {
                            if (yawRatio >= 0.85 && yawRatio <= 1.15) {
                                const snap = captureRegistrationSnapshot();
                                frontDescriptorRef.current = Array.from(detection.descriptor);
                                setFrontProfileSnap(snap);
                                registrationStepRef.current = 'LEFT';
                                setRegistrationStep('LEFT');
                                toast.success('Front profile captured! Now turn your head LEFT.', { id: 'reg-front' });
                            }
                        } else if (registrationStepRef.current === 'LEFT') {
                            if (yawRatio < 0.65) {
                                const snap = captureRegistrationSnapshot();
                                leftDescriptorRef.current = Array.from(detection.descriptor);
                                setLeftProfileSnap(snap);
                                registrationStepRef.current = 'RIGHT';
                                setRegistrationStep('RIGHT');
                                toast.success('Left profile captured! Now turn your head RIGHT.', { id: 'reg-left' });
                            }
                        } else if (registrationStepRef.current === 'RIGHT') {
                            if (yawRatio > 1.50) {
                                const snap = captureRegistrationSnapshot();
                                rightDescriptorRef.current = Array.from(detection.descriptor);
                                setRightProfileSnap(snap);
                                registrationStepRef.current = 'CONFIRM';
                                setRegistrationStep('CONFIRM');
                                stopFaceCamera();
                                toast.success('All 3 profiles captured! Review and submit.', { id: 'reg-right' });
                            }
                        }
                    } catch (err) {
                        console.error('Error in face registration loop:', err);
                    }
                }
            }, 250);
        } catch (err) {
            console.error('Error accessing camera:', err);
            toast.error('Webcam access was denied or is unavailable. Please allow camera permissions.');
            setCameraActive(false);
        }
    };

    const stopFaceCamera = () => {
        if (faceDetectIntervalRef.current) {
            clearInterval(faceDetectIntervalRef.current);
            faceDetectIntervalRef.current = null;
        }
        if (faceStreamRef.current) {
            faceStreamRef.current.getTracks().forEach(track => track.stop());
            faceStreamRef.current = null;
        }
        if (faceVideoRef.current) {
            faceVideoRef.current.srcObject = null;
        }
        setFaceDetected(false);
        setCameraActive(false);
    };

    const handleSaveFaceRegistration = async () => {
        if (!selectedUser) return;
        if (!frontDescriptorRef.current || !leftDescriptorRef.current || !rightDescriptorRef.current) {
            toast.error('Multi-angle facial registration is incomplete. Please repeat the scan.');
            return;
        }

        setRegisteringFace(true);
        try {
            const token = localStorage.getItem('token');
            const targetId = selectedUser.staffid || selectedUser.id;

            const response = await axios.post(
                `${API_BASE_URL}/api/admin/users/${targetId}/register-face`,
                {
                    faceDescriptor: frontDescriptorRef.current,
                    faceDescriptorLeft: leftDescriptorRef.current,
                    faceDescriptorRight: rightDescriptorRef.current,
                    profileImage: frontProfileSnap,
                    imageLeft: leftProfileSnap,
                    imageRight: rightProfileSnap
                },
                {
                    headers: { 'x-access-token': token }
                }
            );

            toast.success(response.data?.message || 'Face ID successfully registered!');
            setRegistrationSuccess(true);

            // Update user in local state list
            const updatedUsers = users.map(u => {
                if ((u.staffid || u.id) === targetId) {
                    return {
                        ...u,
                        face_registered_at: new Date().toISOString(),
                        face_image_path: response.data?.user?.face_image_path || u.face_image_path
                    };
                }
                return u;
            });
            setUsers(updatedUsers);

            if (selectedUser) {
                setSelectedUser(prev => ({
                    ...prev,
                    face_registered_at: new Date().toISOString(),
                    face_image_path: response.data?.user?.face_image_path || prev.face_image_path
                }));
            }
        } catch (err) {
            console.error('Error saving face registration:', err);
            toast.error(err.response?.data?.message || 'Failed to register Face ID.');
        } finally {
            setRegisteringFace(false);
        }
    };

    // Permission Guard
    if (!hasPermission) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
                    <LuShieldAlert size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
                <p className="text-slate-500 max-w-md mb-6 text-sm">
                    You do not have permission to register staff Face IDs. Please contact your system administrator.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition shadow-sm cursor-pointer"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 shadow-xs">
                            <LuScanFace size={22} />
                        </span>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Register Face ID</h1>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                        Enroll employee facial biometrics across 3 angles for lightning-fast, spoof-proof attendance check-in.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchAllUsers}
                        className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:text-slate-900 transition text-sm shadow-2xs flex items-center gap-2 cursor-pointer"
                        title="Refresh Staff Directory"
                    >
                        <LuRefreshCw size={16} className={loadingUsers ? 'animate-spin' : ''} />
                        <span className="text-xs font-semibold hidden md:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Main Master-Detail Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Panel: Employee Directory & Search (5 cols) */}
                <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col h-[760px]">
                    {/* Panel Header & Filter Tabs */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                        <div className="relative">
                            <LuSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name, email, or staff ID..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-400"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-semibold px-1"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Status Filter Chips */}
                        <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 rounded-xl text-xs font-semibold">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`flex-1 py-1.5 px-2 rounded-lg transition text-center cursor-pointer ${
                                    statusFilter === 'all'
                                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                All ({counts.total})
                            </button>
                            <button
                                onClick={() => setStatusFilter('unregistered')}
                                className={`flex-1 py-1.5 px-2 rounded-lg transition text-center cursor-pointer ${
                                    statusFilter === 'unregistered'
                                        ? 'bg-white text-amber-700 shadow-2xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Unregistered ({counts.unregistered})
                            </button>
                            <button
                                onClick={() => setStatusFilter('registered')}
                                className={`flex-1 py-1.5 px-2 rounded-lg transition text-center cursor-pointer ${
                                    statusFilter === 'registered'
                                        ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Registered ({counts.registered})
                            </button>
                        </div>
                    </div>

                    {/* Staff List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                        {loadingUsers ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-3">
                                <ModernLoader />
                                <span className="text-xs text-slate-400 font-medium">Loading staff members...</span>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="py-20 text-center px-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                                    <LuUserX size={24} />
                                </div>
                                <p className="text-sm font-bold text-slate-700">No staff found</p>
                                <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filter.</p>
                            </div>
                        ) : (
                            filteredUsers.map((user) => {
                                const isSelected = selectedUser && (selectedUser.staffid || selectedUser.id) === (user.staffid || user.id);
                                const isRegistered = !!(user.face_image_path || user.face_registered_at);
                                const photoPath = user.profile_info?.image_path || user.documents?.find(d => d.document_type === 'photo')?.file_path;
                                const profilePhoto = photoPath
                                    ? `${API_BASE_URL}/${photoPath.replace(/\\/g, '/')}`
                                    : null;

                                return (
                                    <button
                                        key={user.staffid || user.id}
                                        type="button"
                                        onClick={() => handleSelectUser(user)}
                                        className={`w-full text-left p-3 rounded-2xl transition flex items-center gap-3 cursor-pointer ${
                                            isSelected
                                                ? 'bg-indigo-50/80 border border-indigo-200/80 shadow-2xs'
                                                : 'hover:bg-slate-50 border border-transparent'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            {profilePhoto ? (
                                                <img
                                                    src={profilePhoto}
                                                    alt={user.firstname}
                                                    className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                                                />
                                            ) : (
                                                <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 font-black text-sm flex items-center justify-center border border-slate-200">
                                                    {(user.firstname?.[0] || 'U').toUpperCase()}
                                                    {(user.lastname?.[0] || '').toUpperCase()}
                                                </div>
                                            )}

                                            {/* Face Registered Dot Badge */}
                                            {isRegistered ? (
                                                <span
                                                    className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center ring-2 ring-white text-[9px]"
                                                    title="Face ID Available"
                                                >
                                                    <LuCheck size={10} strokeWidth={3} />
                                                </span>
                                            ) : (
                                                <span
                                                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full ring-2 ring-white"
                                                    title="Not Registered"
                                                />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <span className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                                                    {user.firstname} {user.lastname}
                                                </span>
                                                <span className="text-[11px] font-mono text-slate-400 flex-shrink-0">
                                                    #{user.staffid || user.userid}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate mb-1">
                                                {user.email}
                                            </p>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getRoleColor(user.role)}`}>
                                                    {getRoleDisplayName(user.role)}
                                                </span>
                                                {isRegistered ? (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                                                        Face ID Available
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md">
                                                        Not Enrolled
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <LuChevronRight size={16} className={`flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel: Biometric Enrollment Workspace (7 cols) */}
                <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col min-h-[760px]">
                    {!selectedUser ? (
                        /* Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center my-auto">
                            <div className="w-20 h-20 rounded-3xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-5 shadow-xs">
                                <LuScanFace size={38} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-1.5">No Staff Selected</h3>
                            <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
                                Select an employee from the directory on the left to capture and enroll their facial biometrics.
                            </p>
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                <LuInfo size={14} className="text-indigo-600" />
                                <span>3-angle scans ensure highest identification accuracy</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 md:p-8 flex flex-col flex-1 space-y-6">
                            {/* Selected User Header Card */}
                            {(() => {
                                const selectedPhotoPath = selectedUser.profile_info?.image_path || selectedUser.documents?.find(d => d.document_type === 'photo')?.file_path;
                                const selectedUserProfilePhoto = selectedPhotoPath
                                    ? `${API_BASE_URL}/${selectedPhotoPath.replace(/\\/g, '/')}`
                                    : null;

                                return (
                                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            {selectedUserProfilePhoto ? (
                                                <img
                                                    src={selectedUserProfilePhoto}
                                                    alt={`${selectedUser.firstname} ${selectedUser.lastname}`}
                                                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm flex-shrink-0 tracking-wider">
                                                    {(selectedUser.firstname?.[0] || 'U').toUpperCase()}
                                                    {(selectedUser.lastname?.[0] || '').toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <h2 className="text-base font-black text-slate-900 flex items-center gap-2 flex-wrap leading-tight">
                                                    <span>{selectedUser.firstname} {selectedUser.lastname}</span>
                                                    {(selectedUser.face_image_path || selectedUser.face_registered_at) && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                            <LuCheck size={11} strokeWidth={3} /> Face ID Available
                                                        </span>
                                                    )}
                                                </h2>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                                    <span className="flex items-center gap-1.5">
                                                        <LuMail size={13} className="text-slate-400 flex-shrink-0" />
                                                        <span className="truncate">{selectedUser.email}</span>
                                                    </span>
                                                    <span className="font-mono text-slate-400 font-medium">
                                                        ID: #{selectedUser.staffid || selectedUser.userid}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {(selectedUser.face_image_path || selectedUser.face_registered_at) ? (
                                            <div className="flex items-center gap-2.5 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex-shrink-0 shadow-2xs">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                                    <LuScanFace size={18} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Biometrics</span>
                                                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                                        <LuCheck size={12} strokeWidth={3} /> Face ID Available
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2.5 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex-shrink-0 shadow-2xs">
                                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                                                    <LuScanFace size={18} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Biometrics</span>
                                                    <span className="text-xs font-semibold text-amber-700">
                                                        Not Registered
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Success State Screen */}
                            {registrationSuccess ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-emerald-50/40 rounded-3xl border border-emerald-100 my-auto">
                                    <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
                                        <LuBadgeCheck size={44} />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">Face ID Successfully Enrolled!</h3>
                                    <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
                                        Multi-angle biometric vectors have been securely encrypted and stored for{' '}
                                        <strong className="text-slate-800">{selectedUser.firstname} {selectedUser.lastname}</strong>.
                                        They can now immediately check in via the Face Attendance Portal.
                                    </p>
                                    <div className="flex flex-wrap items-center justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedUser(null);
                                                setRegistrationSuccess(false);
                                            }}
                                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition shadow-sm cursor-pointer"
                                        >
                                            Register Another Staff
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => startFaceCamera()}
                                            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer"
                                        >
                                            Re-scan This Staff
                                        </button>
                                    </div>
                                </div>
                            ) : !cameraActive && registrationStep !== 'CONFIRM' ? (
                                /* Pre-scan Intro Card */
                                <div className="flex-1 flex flex-col space-y-5">
                                    <button
                                        type="button"
                                        onClick={startFaceCamera}
                                        disabled={loadingModels}
                                        className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-base transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-center"
                                    >
                                        {loadingModels ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Loading AI Facial Models...
                                            </>
                                        ) : (
                                            <>
                                                <LuCamera size={20} />
                                                {selectedUser.face_image_path ? 'Start Scanner to Update Face ID' : 'Start Face Scanner'}
                                            </>
                                        )}
                                    </button>

                                    <div className="bg-gradient-to-br from-indigo-50/50 via-sky-50/30 to-white rounded-3xl p-6 md:p-8 border border-indigo-100/80 space-y-6">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 mb-1">
                                                {selectedUser.face_image_path ? 'Update Existing Face ID' : 'Guided 3-Angle Facial Scan'}
                                            </h3>
                                            <p className="text-sm text-slate-600 leading-relaxed">
                                                Our AI biometric engine captures three synchronized perspectives of the employee's face to ensure 99.8% verification reliability regardless of lighting or angle.
                                            </p>
                                        </div>

                                        {/* 3 Step Visual Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                                                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center mb-2">
                                                    1
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-800 mb-0.5">Front Profile</h4>
                                                <p className="text-[11px] text-slate-500 leading-snug">
                                                    Look straight directly into the camera frame.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                                                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center mb-2">
                                                    2
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-800 mb-0.5">Left Turn</h4>
                                                <p className="text-[11px] text-slate-500 leading-snug">
                                                    Gently turn head ~30 degrees to the left.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                                                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center mb-2">
                                                    3
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-800 mb-0.5">Right Turn</h4>
                                                <p className="text-[11px] text-slate-500 leading-snug">
                                                    Gently turn head ~30 degrees to the right.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-800">
                                            <LuCircleAlert size={17} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                            <span>
                                                For best results, ensure the employee is well-lit from the front and avoids wearing tinted sunglasses or hats that obscure facial landmarks.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : cameraActive ? (
                                /* Live Camera Scanner Mode */
                                <div className="flex-1 flex flex-col justify-between space-y-4">
                                    {/* Progress Step Bar */}
                                    <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                                        <div className={`flex items-center gap-2 text-xs font-bold ${
                                            registrationStep === 'FRONT' ? 'text-indigo-600' : frontProfileSnap ? 'text-emerald-600' : 'text-slate-400'
                                        }`}>
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                                                frontProfileSnap ? 'bg-emerald-500 text-white' : registrationStep === 'FRONT' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {frontProfileSnap ? <LuCheck size={12} strokeWidth={3} /> : '1'}
                                            </span>
                                            <span>Front</span>
                                        </div>
                                        <div className="h-0.5 flex-1 bg-slate-200" />
                                        <div className={`flex items-center gap-2 text-xs font-bold ${
                                            registrationStep === 'LEFT' ? 'text-indigo-600' : leftProfileSnap ? 'text-emerald-600' : 'text-slate-400'
                                        }`}>
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                                                leftProfileSnap ? 'bg-emerald-500 text-white' : registrationStep === 'LEFT' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {leftProfileSnap ? <LuCheck size={12} strokeWidth={3} /> : '2'}
                                            </span>
                                            <span>Turn Left</span>
                                        </div>
                                        <div className="h-0.5 flex-1 bg-slate-200" />
                                        <div className={`flex items-center gap-2 text-xs font-bold ${
                                            registrationStep === 'RIGHT' ? 'text-indigo-600' : rightProfileSnap ? 'text-emerald-600' : 'text-slate-400'
                                        }`}>
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                                                rightProfileSnap ? 'bg-emerald-500 text-white' : registrationStep === 'RIGHT' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {rightProfileSnap ? <LuCheck size={12} strokeWidth={3} /> : '3'}
                                            </span>
                                            <span>Turn Right</span>
                                        </div>
                                    </div>

                                    {/* Video Stream Container */}
                                    <div className="relative w-full aspect-[4/3] max-h-[380px] bg-slate-950 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center mx-auto">
                                        <video
                                            ref={handleVideoRef}
                                            autoPlay
                                            muted
                                            playsInline
                                            className="w-full h-full object-cover transform -scale-x-100"
                                            onLoadedMetadata={(e) => {
                                                e.target.play?.().catch(() => {});
                                            }}
                                        />

                                        {/* Oval Biometric Framing Overlay */}
                                        <div className="absolute inset-0 border-2 border-dashed border-sky-400/20 rounded-3xl pointer-events-none flex items-center justify-center">
                                            <div className={`w-48 h-56 border-2 rounded-[48%] pointer-events-none transition-all duration-300 relative ${
                                                faceDetected ? 'border-emerald-500/90 bg-emerald-500/10 scale-105 shadow-[0_0_25px_rgba(16,185,129,0.3)]' : 'border-sky-400/40 scale-100'
                                            }`}>
                                                {/* Scanning Laser Line */}
                                                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse absolute top-1/2 left-0" />
                                            </div>
                                        </div>

                                        {/* Live Face Detection Badge */}
                                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md transition ${
                                                faceDetected
                                                    ? 'bg-emerald-500/80 text-white shadow-sm'
                                                    : 'bg-slate-900/70 text-slate-300'
                                            }`}>
                                                {faceDetected ? '● Face Aligned' : '○ Align Face in Oval'}
                                            </span>

                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900/80 text-white backdrop-blur-md">
                                                {registrationStep === 'FRONT' && '1 / 3 - Front'}
                                                {registrationStep === 'LEFT' && '2 / 3 - Left'}
                                                {registrationStep === 'RIGHT' && '3 / 3 - Right'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Real-time Guidance Prompt */}
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                                        <p className="text-sm font-bold text-slate-800">
                                            {registrationStep === 'FRONT' && (
                                                faceDetected ? 'Front view detected! Hold still to capture...' : 'Look straight into the camera center.'
                                            )}
                                            {registrationStep === 'LEFT' && 'Turn head gently to the LEFT.'}
                                            {registrationStep === 'RIGHT' && 'Turn head gently to the RIGHT.'}
                                        </p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={stopFaceCamera}
                                            className="flex-1 py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer flex items-center justify-center text-center whitespace-nowrap"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => startFaceCamera()}
                                            className="flex-1 py-3 px-5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-sm transition cursor-pointer flex items-center justify-center text-center whitespace-nowrap"
                                        >
                                            Restart Scan
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Confirmation Screen ('CONFIRM' step) */
                                <div className="flex-1 flex flex-col justify-between space-y-6 animate-fadeIn">
                                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-3xl p-6 text-center space-y-5">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
                                            <LuCheck size={28} strokeWidth={3} />
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">All 3 Profiles Captured!</h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Review the captured biometric angles before saving to the employee record.
                                            </p>
                                        </div>

                                        {/* 3 Snapshot Cards */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-white p-2 rounded-2xl border border-emerald-200 shadow-2xs text-center">
                                                <img
                                                    src={frontProfileSnap}
                                                    alt="Front Profile"
                                                    className="w-full aspect-square rounded-xl object-cover border border-slate-100 mb-1.5"
                                                />
                                                <span className="text-[11px] font-bold text-slate-700 block">1. Front</span>
                                                <span className="text-[9px] text-emerald-600 font-semibold">Verified</span>
                                            </div>

                                            <div className="bg-white p-2 rounded-2xl border border-emerald-200 shadow-2xs text-center">
                                                <img
                                                    src={leftProfileSnap}
                                                    alt="Left Profile"
                                                    className="w-full aspect-square rounded-xl object-cover border border-slate-100 mb-1.5"
                                                />
                                                <span className="text-[11px] font-bold text-slate-700 block">2. Left</span>
                                                <span className="text-[9px] text-emerald-600 font-semibold">Verified</span>
                                            </div>

                                            <div className="bg-white p-2 rounded-2xl border border-emerald-200 shadow-2xs text-center">
                                                <img
                                                    src={rightProfileSnap}
                                                    alt="Right Profile"
                                                    className="w-full aspect-square rounded-xl object-cover border border-slate-100 mb-1.5"
                                                />
                                                <span className="text-[11px] font-bold text-slate-700 block">3. Right</span>
                                                <span className="text-[9px] text-emerald-600 font-semibold">Verified</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Confirm & Save Actions */}
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => startFaceCamera()}
                                            disabled={registeringFace}
                                            className="flex-1 py-3.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center text-center whitespace-nowrap"
                                        >
                                            Retake Scan
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveFaceRegistration}
                                            disabled={registeringFace}
                                            className="flex-[2] py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 text-center whitespace-nowrap"
                                        >
                                            {registeringFace ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                                    <span>Registering Face ID...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <LuBadgeCheck size={18} className="flex-shrink-0" />
                                                    <span>Save & Register Face ID</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegisterFaceId;
