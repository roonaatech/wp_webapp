import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import BrandLogo from '../components/BrandLogo';
import {
    LuSmartphone,
    LuKeyRound,
    LuMail,
    LuLock,
    LuCircleCheck,
    LuCircleAlert,
    LuX,
    LuArrowRight,
    LuMapPin,
    LuActivity,
    LuShieldCheck,
    LuSparkles,
    LuCheck,
    LuClock
} from "react-icons/lu";
import { fetchRoles, canAccessWebApp, isSelfServiceOnly, getRoleDisplayName, canAccessAttendancePortal } from '../utils/roleUtils';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Remember Me and Credentials State
    const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('remember_me') === 'true');
    const [email, setEmail] = useState(() => {
        if (location.state?.email) return location.state.email;
        if (localStorage.getItem('remember_me') === 'true') {
            return localStorage.getItem('saved_email') || '';
        }
        return '';
    });
    const [password, setPassword] = useState(() => {
        if (localStorage.getItem('remember_me') === 'true') {
            return localStorage.getItem('saved_password') || '';
        }
        return '';
    });

    // Login state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showInactiveModal, setShowInactiveModal] = useState(false);
    const [showNotAuthorizedModal, setShowNotAuthorizedModal] = useState(false);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, message: '' });

    // Forgot Password Modal State
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [forgotError, setForgotError] = useState(null);

    // Sync email from location state if passed from another page
    useEffect(() => {
        if (location.state?.email) {
            setEmail(location.state.email);
        }
    }, [location.state]);

    const processLoginSuccess = async (data) => {
        const user = {
            id: data.id,
            staffid: data.staffid,
            userid: data.userid,
            firstname: data.firstname,
            lastname: data.lastname,
            email: data.email,
            role: data.role,
            gender: data.gender,
            isServiceAccount: data.isServiceAccount === true
        };

        // Role & Gender Validation (First Time / Setup Required)
        if (!user.role || (!user.gender && !user.isServiceAccount)) {
            setShowWelcomeModal(true);
            setLoading(false);
            return;
        }

        // Persist or clear Remember Me credentials based on preference
        try {
            if (rememberMe) {
                localStorage.setItem('remember_me', 'true');
                localStorage.setItem('saved_email', email.trim());
                localStorage.setItem('saved_password', password);
            } else {
                localStorage.setItem('remember_me', 'false');
                localStorage.removeItem('saved_email');
                localStorage.removeItem('saved_password');
            }
        } catch (storageErr) {
            console.error('Error saving credentials preference:', storageErr);
        }

        // Fetch roles from API and cache them for permission checks
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('mustChangePassword', data.mustChangePassword ? 'true' : 'false');
        localStorage.setItem('mustCompleteDeclaration', data.mustCompleteDeclaration ? 'true' : 'false');

        try {
            const roles = await fetchRoles(true);

            if (window.refreshAppSettings) {
                await window.refreshAppSettings();
            }

            // Service accounts handling
            if (user.isServiceAccount) {
                localStorage.setItem('user', JSON.stringify(user));
                toast.success(`Welcome, ${user.firstname}!`, {
                    style: { background: '#059669', color: '#fff' },
                    icon: '👋'
                });
                if (canAccessAttendancePortal(user.role)) {
                    navigate('/attendance');
                } else {
                    navigate('/unauthorized');
                }
                return;
            }

            // Force all mobile users to my-requests
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobileDevice) {
                localStorage.setItem('user', JSON.stringify(user));
                toast.success(`Welcome, ${user.firstname}!`, {
                    style: { background: '#059669', color: '#fff' },
                    icon: '👋'
                });
                navigate('/my-requests');
                return;
            }

            // Gating: If user doesn't have webapp access at all
            if (!canAccessWebApp(user.role)) {
                localStorage.setItem('user', JSON.stringify(user));
                toast.success(`Welcome, ${user.firstname}!`, {
                    style: { background: '#059669', color: '#fff' },
                    icon: '👋'
                });
                navigate('/my-requests');
                return;
            }

            // Navigation: If self-service only
            if (isSelfServiceOnly(user.role)) {
                localStorage.setItem('user', JSON.stringify(user));
                toast.success(`Welcome, ${user.firstname}!`, {
                    style: { background: '#059669', color: '#fff' },
                    icon: '👋'
                });
                navigate('/my-requests');
                return;
            }
        } catch (roleError) {
            console.error('Error fetching roles:', roleError);
        }

        localStorage.setItem('user', JSON.stringify(user));

        toast.success(`Welcome back, ${user.firstname}!`, {
            style: {
                background: '#059669',
                color: '#fff'
            },
            icon: '👋'
        });
        navigate('/');
    };

    const handleConfirmLogin = async () => {
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        setLoading(true);

        try {
            const retryResponse = await axios.post(`${API_BASE_URL}/api/auth/signin`, {
                email,
                password,
                forceLocal: true
            });

            if (retryResponse.data.accessToken) {
                processLoginSuccess(retryResponse.data);
            }
        } catch (err) {
            handleLoginError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLoginError = (err) => {
        console.error('Login error details:', {
            status: err.response?.status,
            data: err.response?.data,
            message: err.message
        });

        let errorMsg = 'Login failed. Please try again.';
        if (err.response?.status === 404) {
            errorMsg = 'User not found. Please check your email.';
        } else if (err.response?.status === 401) {
            errorMsg = 'Invalid password.';
        } else if (err.response?.status === 403) {
            const serverMessage = err.response?.data?.message || '';
            if (serverMessage.toLowerCase().includes('access denied') ||
                serverMessage.toLowerCase().includes('permission')) {
                setShowNotAuthorizedModal(true);
                errorMsg = 'You do not have permission to access the web application.';
            } else {
                setShowInactiveModal(true);
                errorMsg = 'Account is inactive.';
            }
        } else if (err.message === 'Network Error' || !err.response) {
            errorMsg = 'Cannot connect to server. Please make sure the backend is running on port 3000.';
        } else {
            errorMsg = err.response?.data?.message || 'Login failed. Please try again.';
        }
        setError(errorMsg);
        toast.error(errorMsg);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/signin`, {
                email: email.trim(),
                password
            });

            if (response.data.requiresConfirmation) {
                setConfirmationModal({
                    isOpen: true,
                    message: response.data.message
                });
                setLoading(false);
            } else if (response.data.accessToken) {
                processLoginSuccess(response.data);
            } else {
                setLoading(false);
            }
        } catch (err) {
            handleLoginError(err);
            setLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        if (!forgotEmail.trim()) {
            setForgotError('Please enter your work email address.');
            return;
        }

        setForgotLoading(true);
        setForgotError(null);

        try {
            await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, {
                email: forgotEmail.trim()
            });
            setForgotSuccess(true);
            toast.success('Temporary password sent to your email!');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to send password reset. Please check your email and try again.';
            setForgotError(message);
            toast.error(message);
        } finally {
            setForgotLoading(false);
        }
    };

    const openForgotPasswordModal = () => {
        setForgotEmail(email || '');
        setForgotSuccess(false);
        setForgotError(null);
        setShowForgotPasswordModal(true);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-3 sm:p-6 lg:p-10 font-sans relative overflow-hidden selection:bg-indigo-600 selection:text-white">
            {/* Ambient Background Gradient Orbs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/3 -right-32 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-violet-400/10 rounded-full blur-3xl pointer-events-none" />

            {/* Background Dot Texture */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-70 pointer-events-none" />

            {/* Main Executive SaaS Container Card */}
            <div className="max-w-6xl xl:max-w-7xl w-full bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-950/10 border border-slate-200/80 overflow-hidden flex flex-col lg:flex-row relative z-10 min-h-[660px]">

                {/* Left Column: Expanded Live Executive Intelligence Panel (Desktop) */}
                <div className="hidden lg:flex lg:w-1/2 xl:w-7/12 flex-col justify-between p-8 xl:p-11 bg-gradient-to-br from-[#0b0f19] via-[#111827] to-[#1e1b4b] text-white m-3.5 rounded-[2rem] relative overflow-hidden border border-slate-800/80 shadow-inner">
                    {/* Glowing Mesh Backdrop inside left column */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

                    {/* Top Bar: Brand & Live Status */}
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <BrandLogo iconSize="w-11 h-11" className="text-white" />
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-[10px] font-bold text-slate-200 uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Cloud v2.11.5</span>
                            </div>
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/20 border border-indigo-400/25 text-indigo-300 text-[11px] font-bold tracking-wide mb-3">
                            <LuSparkles size={13} className="text-indigo-300" />
                            <span>Enterprise Workforce System</span>
                        </div>

                        <h2 className="text-2xl xl:text-3xl font-black text-white tracking-tight leading-snug">
                            Precision Attendance & Team Operations
                        </h2>
                        <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-lg leading-relaxed">
                            Everything you need to automate workforce attendance, enforce geofencing, manage leaves, and maintain audit-ready compliance.
                        </p>
                    </div>

                    {/* 4 Feature Highlight Points (2x2 Grid) */}
                    <div className="relative z-10 my-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Highlight 1: Geofencing */}
                        <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/[0.09] hover:bg-white/[0.09] transition-all duration-200 group text-left shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 mb-2.5 group-hover:scale-105 transition">
                                <LuMapPin size={18} />
                            </div>
                            <h3 className="text-xs font-bold text-white mb-1">Smart GPS Geofencing</h3>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                Accurate perimeter detection ensuring check-ins occur only within designated office or site coordinates.
                            </p>
                        </div>

                        {/* Highlight 2: Hierarchical Approvals */}
                        <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/[0.09] hover:bg-white/[0.09] transition-all duration-200 group text-left shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 mb-2.5 group-hover:scale-105 transition">
                                <LuActivity size={18} />
                            </div>
                            <h3 className="text-xs font-bold text-white mb-1">Hierarchical Approvals</h3>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                Autonomous multi-tier routing for leave applications, overtime, and shift exception overrides.
                            </p>
                        </div>

                        {/* Highlight 3: AI Facial Biometrics */}
                        <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/[0.09] hover:bg-white/[0.09] transition-all duration-200 group text-left shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 mb-2.5 group-hover:scale-105 transition">
                                <LuShieldCheck size={18} />
                            </div>
                            <h3 className="text-xs font-bold text-white mb-1">Facial Biometrics</h3>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                Anti-spoof facial recognition technology guaranteeing proxy-free and tamper-proof clock-in logs.
                            </p>
                        </div>

                        {/* Highlight 4: Live Analytics & Audits */}
                        <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/[0.09] hover:bg-white/[0.09] transition-all duration-200 group text-left shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 mb-2.5 group-hover:scale-105 transition">
                                <LuClock size={18} />
                            </div>
                            <h3 className="text-xs font-bold text-white mb-1">Presence & Compliance</h3>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                Real-time team visibility, automated shift tracking, and exportable audit-ready compliance reports.
                            </p>
                        </div>
                    </div>

                    {/* Bottom Security Guarantee */}
                    <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/10 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <LuShieldCheck size={15} className="text-emerald-400" />
                            <span>256-bit TLS Protected</span>
                        </div>
                        <span>&copy; {new Date().getFullYear()} WorkPulse</span>
                    </div>
                </div>

                {/* Right Column: Clean Executive Sign In Chamber */}
                <div className="w-full lg:w-1/2 xl:w-5/12 p-6 sm:p-10 xl:p-12 flex flex-col justify-between text-left">
                    {/* Top Mobile Brand Banner */}
                    <div className="flex lg:hidden items-center justify-between mb-6 pb-4 border-b border-slate-100">
                        <BrandLogo iconSize="w-9 h-9" />
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                            v2.11.5
                        </span>
                    </div>

                    <div className="my-auto max-w-md w-full mx-auto">
                        {/* Title & Greeting */}
                        <div className="mb-7">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1.5">
                                Welcome back
                            </h1>
                            <p className="text-slate-500 text-xs sm:text-sm">
                                Sign in to your corporate workspace to continue.
                            </p>
                        </div>

                        {/* Error Banner */}
                        {error && (
                            <div className="mb-5 bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-r-2xl animate-shake shadow-xs">
                                <p className="text-rose-700 text-xs sm:text-sm font-semibold flex items-center gap-2">
                                    <LuCircleAlert className="flex-shrink-0" size={16} />
                                    <span>{error}</span>
                                </p>
                            </div>
                        )}

                        {/* Login Form */}
                        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                            {/* Email Field */}
                            <div>
                                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                    Work Email Address
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition">
                                        <LuMail size={17} />
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="name@company.com"
                                        required
                                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-600 text-sm transition text-slate-900 placeholder-slate-400 font-medium"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Password
                                    </label>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition">
                                        <LuLock size={17} />
                                    </div>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-600 text-sm transition text-slate-900 placeholder-slate-400 font-medium"
                                    />
                                </div>
                            </div>

                            {/* Remember Me & Forgot Password Row */}
                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500/30 cursor-pointer transition"
                                    />
                                    <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition">
                                        Remember me
                                    </span>
                                </label>

                                <button
                                    type="button"
                                    onClick={openForgotPasswordModal}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer hover:underline"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            {/* Gradient Action Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/35 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 text-xs uppercase tracking-widest cursor-pointer"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span>Sign In to Dashboard</span>
                                            <LuArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Mobile App Download Card */}
                        <div className="mt-7 pt-5 border-t border-slate-100">
                            <Link
                                to="/apk"
                                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl transition group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition">
                                        <LuSmartphone size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition">
                                            WorkPulse Mobile App
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            Download APK for GPS punch-in
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200">
                                    Get APK
                                </span>
                            </Link>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-8 text-center text-slate-400 text-[11px]">
                        <p>&copy; {new Date().getFullYear()} Roonaa Technologies India Private Limited. All rights reserved.</p>
                    </div>
                </div>
            </div>

            {/* Forgot Password Modal */}
            {showForgotPasswordModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center transform transition-all animate-modal-in border border-slate-100 relative">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setShowForgotPasswordModal(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                            <LuX size={18} />
                        </button>

                        {!forgotSuccess ? (
                            <>
                                <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-sm">
                                    <LuKeyRound size={28} />
                                </div>

                                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">
                                    Reset Your Password
                                </h3>
                                <p className="text-slate-500 text-xs leading-relaxed mb-5 text-center">
                                    Enter your registered work email. We'll generate a temporary password and send it to your inbox.
                                </p>

                                {forgotError && (
                                    <div className="mb-4 bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-xl text-left animate-shake">
                                        <p className="text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                                            <LuCircleAlert className="flex-shrink-0" size={14} />
                                            <span>{forgotError}</span>
                                        </p>
                                    </div>
                                )}

                                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-left">
                                    <div>
                                        <label htmlFor="modal-forgot-email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                            Work Email Address
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <LuMail size={16} />
                                            </div>
                                            <input
                                                id="modal-forgot-email"
                                                type="email"
                                                value={forgotEmail}
                                                onChange={(e) => {
                                                    setForgotEmail(e.target.value);
                                                    if (forgotError) setForgotError(null);
                                                }}
                                                placeholder="name@company.com"
                                                required
                                                autoFocus
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition text-slate-900"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2.5 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotPasswordModal(false)}
                                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                                        >
                                            {forgotLoading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <span>Send Password</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div className="animate-fadeIn py-2">
                                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-sm">
                                    <LuCircleCheck size={30} />
                                </div>

                                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">
                                    Temporary Password Sent!
                                </h3>
                                <p className="text-slate-600 text-xs leading-relaxed mb-4">
                                    We sent a temporary password to <strong className="text-slate-900 font-bold">{forgotEmail}</strong>.
                                </p>

                                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-left text-xs text-slate-600 space-y-1.5 mb-5">
                                    <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                        👉 Next Steps:
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600 pl-1">
                                        <li>Check your inbox (and spam folder) for the password.</li>
                                        <li>Log in using your email and the temporary password.</li>
                                        <li>You'll be prompted to set your new permanent password.</li>
                                    </ol>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmail(forgotEmail);
                                        setShowForgotPasswordModal(false);
                                    }}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 text-xs uppercase tracking-wider transition cursor-pointer"
                                >
                                    Back to Sign In
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Welcome / Setup Required Modal */}
            {showWelcomeModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in border border-slate-100">
                        <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-sky-50">
                            <span className="text-4xl">👋</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Welcome to WorkPulse!</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed text-sm">
                            We're excited to have you on board.
                            <br /><br />
                            Your profile setup is incomplete.
                            <br />
                            <span className="text-sky-600 font-bold mt-2 block uppercase text-xs tracking-widest">Please contact your administrator.</span>
                        </p>
                        <button
                            onClick={() => setShowWelcomeModal(false)}
                            className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all text-xs uppercase tracking-widest shadow-lg shadow-slate-900/20 cursor-pointer"
                        >
                            Okay, Got it
                        </button>
                    </div>
                </div>
            )}

            {/* Inactive Modal */}
            {showInactiveModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in border border-slate-100">
                        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🚫</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Account Inactive</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed text-sm">
                            Your account is currently inactive. You cannot access the WorkPulse system.
                            <br />
                            <span className="text-indigo-600 font-semibold mt-2 block">Please contact your administrator.</span>
                        </p>
                        <button
                            onClick={() => setShowInactiveModal(false)}
                            className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all cursor-pointer text-xs uppercase tracking-wider"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Not Authorized Modal */}
            {showNotAuthorizedModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in border border-slate-100">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🔒</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed text-sm">
                            You do not have permission to access the web application.
                            <br />
                            <span className="text-amber-600 font-semibold mt-2 block">Please contact your administrator to request access.</span>
                        </p>
                        <button
                            onClick={() => setShowNotAuthorizedModal(false)}
                            className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all cursor-pointer text-xs uppercase tracking-wider"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal for Local Auth */}
            {confirmationModal.isOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in border border-slate-100">
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🛡️</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-4">Authentication Update</h3>

                        <div className="text-slate-600 mb-8 leading-relaxed space-y-3 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-sm">
                            <p>
                                We noticed a delay in reaching the primary directory server. This sometimes happens due to routine maintenance or network checks.
                            </p>
                            <p className="font-semibold text-slate-800">
                                Good news: You can still log in securely!
                            </p>
                            <p>
                                Your local account is ready to go. Would you like to proceed with local sign-in to access your dashboard immediately?
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setConfirmationModal({ ...confirmationModal, isOpen: false });
                                    setLoading(false);
                                }}
                                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer text-xs uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmLogin}
                                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer text-xs uppercase tracking-wider"
                            >
                                Yes, Log Me In
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes modal-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-modal-in {
                    animation: modal-in 0.2s ease-out forwards;
                }
                .animate-shake {
                    animation: shake 0.82s cubic-bezier(.36,.07,.19,.97) both;
                }
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
            `}</style>
        </div>
    );
};

export default Login;
