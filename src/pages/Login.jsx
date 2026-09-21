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
    LuEye,
    LuEyeOff,
    LuCircleCheck,
    LuCircleAlert,
    LuX,
    LuArrowRight,
    LuSparkles,
    LuShieldCheck
} from "react-icons/lu";
import { fetchRoles, canAccessWebApp, isSelfServiceOnly, canAccessAttendancePortal } from '../utils/roleUtils';
import packageJson from '../../package.json';

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
    const [showPassword, setShowPassword] = useState(false);

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

        // Store active session token and user info
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('user', JSON.stringify(user));

        // Fetch dynamic roles and app settings
        try {
            await fetchRoles();
            if (window.refreshAppSettings) {
                window.refreshAppSettings();
            }
        } catch (roleErr) {
            console.error('Error refreshing roles on login:', roleErr);
        }

        // Check first-time login profile completion
        if (data.isFirstTimeLogin) {
            navigate('/verify-profile');
            return;
        }

        // Check if user is mobile client
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Attendance Portal Only access (Kiosk or Dedicated Portal User)
        if (canAccessAttendancePortal(user.role) && !canAccessWebApp(user.role)) {
            navigate('/attendance');
            return;
        }

        // Self-Service Only or Mobile Access
        if (isSelfServiceOnly(user.role) || isMobile) {
            navigate('/my-requests');
            return;
        }

        // Full Web App Access
        if (canAccessWebApp(user.role)) {
            navigate('/');
            return;
        }

        // Unauthorized fallback
        setShowNotAuthorizedModal(true);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setLoading(false);
    };

    const handleConfirmLogin = async () => {
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        setLoading(true);
        setError(null);

        try {
            const retryResponse = await axios.post(`${API_BASE_URL}/api/auth/signin`, {
                email: email.trim(),
                password,
                confirmed: true
            });

            if (retryResponse.data.accessToken) {
                processLoginSuccess(retryResponse.data);
            }
        } catch (err) {
            handleLoginError(err);
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

        if (err.response) {
            if (err.response.status === 401) {
                errorMsg = err.response.data?.message || 'Invalid email or password.';
            } else if (err.response.status === 403) {
                if (err.response.data?.isInactive) {
                    setShowInactiveModal(true);
                    setLoading(false);
                    return;
                }
                errorMsg = err.response.data?.message || 'Access denied. Please contact your administrator.';
            } else if (err.response.status === 404) {
                errorMsg = 'Authentication service endpoint not found. Please contact support.';
            } else if (err.response.status === 500) {
                errorMsg = err.response.data?.message || 'Internal server error during login. Please try again later.';
            } else {
                errorMsg = err.response.data?.message || 'Login failed. Please try again.';
            }
        } else if (err.request) {
            errorMsg = 'Cannot connect to server. Please check your internet connection.';
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
        <div className="min-h-[100dvh] w-full relative flex flex-col justify-between font-sans overflow-x-hidden bg-slate-50 selection:bg-indigo-600 selection:text-white">
            {/* HR Team & Workplace Collaboration Background */}
            <div
                className="absolute inset-0 bg-cover bg-right lg:bg-center bg-no-repeat transition-all duration-700"
                style={{
                    backgroundImage: `url('/login_hr_bg.jpg?v=in')`
                }}
            >
                {/* Luminous Solid-to-Feathered White Backdrop: full coverage on mobile, feathered on desktop */}
                <div className="absolute inset-0 lg:right-auto lg:w-[68%] xl:w-[62%] bg-gradient-to-b from-white/95 via-white/90 to-white/95 lg:bg-gradient-to-r lg:from-white lg:via-white/95 lg:to-transparent backdrop-blur-[1px]" />

                {/* Soft Radial White Glow directly centering behind the login card on desktop */}
                <div className="hidden lg:block absolute top-1/2 left-0 md:left-10 lg:left-16 xl:left-24 -translate-y-1/2 w-[600px] h-[750px] bg-white/95 rounded-full blur-3xl pointer-events-none" />

                {/* Overall subtle natural white tint */}
                <div className="absolute inset-0 bg-white/20 pointer-events-none" />
            </div>

            {/* Top Header / WorkPulse Brand Logo & Status */}
            <header className="relative z-20 px-4 sm:px-8 lg:px-12 pt-4 sm:pt-8 flex items-center justify-between">
                <div className="flex items-center">
                    {/* Official WorkPulse Brand Logo with Gradient */}
                    <BrandLogo iconSize="w-9 h-9 sm:w-11 sm:h-11" />
                </div>

                {/* Right Status Pill with signature WorkPulse palette */}
                <div className="hidden sm:flex items-center gap-3">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-indigo-100/90 backdrop-blur-md text-[11px] font-bold text-indigo-900 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Portal - v{packageJson.version}</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area: Centered on mobile, shifted on desktop */}
            <main className="relative z-20 flex-1 flex items-center justify-center md:justify-start px-3 sm:px-8 lg:px-16 py-4 sm:py-8">
                <div className="w-full max-w-md mx-auto md:mx-0 md:ml-6 lg:ml-14 xl:ml-20 2xl:ml-28">
                    {/* Floating Login Card */}
                    <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-xl sm:shadow-2xl shadow-indigo-950/10 border-2 border-slate-300/90 p-5 sm:p-8 md:p-10 text-left transition-all">
                        {/* Title & Greeting with WorkPulse Gradient Highlights */}
                        <div className="text-center mb-5 sm:mb-7">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-[10px] font-bold uppercase tracking-wider mb-2">
                                <LuSparkles size={12} className="text-indigo-600 shrink-0" />
                                <span>Human Resources & Workforce</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1">
                                Employee Login
                            </h1>
                            <p className="text-slate-500 text-xs sm:text-sm font-normal">
                                Sign in to access your attendance & HR workspace
                            </p>
                        </div>

                        {/* Error Banner */}
                        {error && (
                            <div className="mb-4 sm:mb-5 bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-xl animate-shake shadow-xs">
                                <p className="text-rose-700 text-xs font-semibold flex items-center gap-2">
                                    <LuCircleAlert className="flex-shrink-0" size={15} />
                                    <span>{error}</span>
                                </p>
                            </div>
                        )}

                        {/* Login Form */}
                        <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-4">
                            {/* Work Email / Username Field */}
                            <div>
                                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Work Email Address
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition">
                                        <LuMail size={17} />
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="username email"
                                        autoCapitalize="none"
                                        spellCheck="false"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="name@company.com"
                                        required
                                        className="w-full pl-10 pr-4 py-3 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-600 transition shadow-xs"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Password
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition">
                                        <LuLock size={17} />
                                    </div>
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        className="w-full pl-10 pr-12 py-3 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-600 transition shadow-xs"
                                    />
                                    {/* Password Visibility Toggle with generous touch target */}
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-slate-400 hover:text-indigo-600 active:text-indigo-700 focus:outline-none cursor-pointer transition touch-manipulation"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me & Forgot Password Row */}
                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 cursor-pointer select-none group touch-manipulation">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500/30 cursor-pointer transition"
                                    />
                                    <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition">
                                        Remember me
                                    </span>
                                </label>

                                <button
                                    type="button"
                                    onClick={openForgotPasswordModal}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer hover:underline touch-manipulation p-1"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            {/* WorkPulse Gradient Action Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full min-h-[48px] py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-xs sm:text-sm uppercase tracking-wider cursor-pointer touch-manipulation"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <span>Sign In to WorkPulse</span>
                                            <LuArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Below Card Links & Info with WorkPulse Palette */}
                    <div className="mt-4 sm:mt-5 text-center space-y-2.5">
                        <p className="text-xs text-slate-500 font-normal">
                            Are you new?{' '}
                            <span className="font-bold text-indigo-900">
                                Contact your HR Administrator
                            </span>
                        </p>

                        {/* Secondary Shortcut: Mobile APK */}
                        <div className="pt-0.5">
                            <Link
                                to="/apk"
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-white/95 hover:bg-white border border-slate-200/90 text-xs font-bold text-indigo-900 shadow-xs hover:border-indigo-300 transition group touch-manipulation"
                            >
                                <LuSmartphone size={14} className="text-indigo-600 shrink-0 group-hover:scale-110 transition" />
                                <span>Get Mobile APK</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Footer */}
            <footer className="relative z-20 px-4 sm:px-12 pb-4 sm:pb-6 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-0 text-[10px] sm:text-[11px] text-slate-500 text-center sm:text-left">
                <div className="flex items-center gap-1.5">
                    <LuShieldCheck size={14} className="text-emerald-600 shrink-0" />
                    <span>256-Bit Encrypted • Aayi Technologies Pvt Ltd</span>
                </div>
                <span>&copy; {new Date().getFullYear()} WorkPulse • All rights reserved</span>
            </footer>

            {/* Forgot Password Modal */}
            {showForgotPasswordModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-8 max-h-[90dvh] overflow-y-auto text-center transform transition-all animate-modal-in border border-slate-100 relative">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setShowForgotPasswordModal(false)}
                            className="absolute top-3 sm:top-4 right-3 sm:right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                            <LuX size={18} />
                        </button>

                        {!forgotSuccess ? (
                            <>
                                <div className="w-12 sm:w-14 h-12 sm:h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 text-indigo-600 shadow-xs">
                                    <LuKeyRound size={26} />
                                </div>

                                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mb-1">
                                    Reset Your Password
                                </h3>
                                <p className="text-slate-500 text-xs leading-relaxed mb-4 sm:mb-5 text-center">
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
                                                inputMode="email"
                                                autoCapitalize="none"
                                                spellCheck="false"
                                                value={forgotEmail}
                                                onChange={(e) => {
                                                    setForgotEmail(e.target.value);
                                                    if (forgotError) setForgotError(null);
                                                }}
                                                placeholder="name@company.com"
                                                required
                                                autoFocus
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-base sm:text-sm transition text-slate-900"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2.5 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotPasswordModal(false)}
                                            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                                        >
                                            {forgotLoading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <span>Send Password</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div className="animate-fadeIn py-2">
                                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-xs">
                                    <LuCircleCheck size={28} />
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
                                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 text-xs uppercase tracking-wider transition cursor-pointer"
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
                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5 ring-4 ring-indigo-50">
                            <span className="text-3xl">👋</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Welcome to WorkPulse!</h3>
                        <p className="text-slate-500 mb-6 leading-relaxed text-xs sm:text-sm">
                            Your profile setup is incomplete.
                            <br />
                            <span className="text-indigo-600 font-bold mt-2 block uppercase text-xs tracking-widest">Please contact your administrator.</span>
                        </p>
                        <button
                            onClick={() => setShowWelcomeModal(false)}
                            className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all text-xs uppercase tracking-widest shadow-lg shadow-slate-900/20 cursor-pointer"
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
                        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <span className="text-3xl">🚫</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Account Inactive</h3>
                        <p className="text-slate-500 mb-6 leading-relaxed text-xs sm:text-sm">
                            Your account is currently inactive. You cannot access the WorkPulse system.
                            <br />
                            <span className="text-rose-600 font-semibold mt-2 block">Please contact your administrator.</span>
                        </p>
                        <button
                            onClick={() => setShowInactiveModal(false)}
                            className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all cursor-pointer text-xs uppercase tracking-wider"
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
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <span className="text-3xl">🔒</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h3>
                        <p className="text-slate-500 mb-6 leading-relaxed text-xs sm:text-sm">
                            You do not have permission to access the web application.
                            <br />
                            <span className="text-amber-700 font-semibold mt-2 block">Please contact your administrator to request access.</span>
                        </p>
                        <button
                            onClick={() => setShowNotAuthorizedModal(false)}
                            className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all cursor-pointer text-xs uppercase tracking-wider"
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
                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
                            <LuShieldCheck size={32} className="text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Authentication Update</h3>

                        <div className="text-slate-600 mb-6 leading-relaxed space-y-2 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs sm:text-sm">
                            <p>
                                We noticed a delay reaching the directory server. You can still log in securely using your local account credentials.
                            </p>
                            <p className="font-semibold text-slate-800">
                                Would you like to proceed with local sign-in now?
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setConfirmationModal({ ...confirmationModal, isOpen: false });
                                    setLoading(false);
                                }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer text-xs uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmLogin}
                                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer text-xs uppercase tracking-wider"
                            >
                                Yes, Log In
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
