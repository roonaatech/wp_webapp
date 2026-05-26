import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import BrandLogo from '../components/BrandLogo';
import { LuSmartphone } from "react-icons/lu";
import { fetchRoles, canAccessWebApp, isSelfServiceOnly, getRoleDisplayName } from '../utils/roleUtils';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showInactiveModal, setShowInactiveModal] = useState(false);
    const [showNotAuthorizedModal, setShowNotAuthorizedModal] = useState(false);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, message: '' });
    const navigate = useNavigate();

    const processLoginSuccess = async (data) => {
        // Backend returns user data at root level, not nested under 'user'
        const user = {
            id: data.id,
            staffid: data.staffid,
            userid: data.userid, // Include userid to check if WorkPulse-only (null) or external (not null)
            firstname: data.firstname,
            lastname: data.lastname,
            email: data.email,
            role: data.role,
            gender: data.gender // Include gender for validation
        };

        // --- Role & Gender Validation (First Time / Setup Required) ---
        // If role is missing (0/null) OR gender is missing (null/empty string)
        if (!user.role || !user.gender) {
            setShowWelcomeModal(true);
            setLoading(false);
            // DO NOT SAVE TOKEN - prevent login
            return;
        }
        // -----------------------------------------------------------

        // Fetch roles from API and cache them for permission checks
        // Store token temporarily to make the API call
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('mustChangePassword', data.mustChangePassword ? 'true' : 'false');
        localStorage.setItem('mustCompleteDeclaration', data.mustCompleteDeclaration ? 'true' : 'false');

        try {
            const roles = await fetchRoles(true); // Force refresh roles cache

            // Also refresh application settings (timezone, etc)
            if (window.refreshAppSettings) {
                await window.refreshAppSettings();
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

            // 1. Gating: If user doesn't have webapp access at all, they shouldn't see dashboard pages
            if (!canAccessWebApp(user.role)) {
                localStorage.setItem('user', JSON.stringify(user));
                toast.success(`Welcome, ${user.firstname}!`, {
                    style: { background: '#059669', color: '#fff' },
                    icon: '👋'
                });
                navigate('/my-requests'); // Redirect to my-requests if no webapp access
                return;
            }

            // 2. Navigation: If they ONLY have web access (no management permissions),
            // they belong in /my-requests, not the main Dashboard pages
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
            // Retry with forceLocal flag
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
            // Check the actual error message to differentiate between inactive and not authorized
            const serverMessage = err.response?.data?.message || '';
            if (serverMessage.toLowerCase().includes('access denied') ||
                serverMessage.toLowerCase().includes('permission')) {
                // User is active but doesn't have webapp access permission
                setShowNotAuthorizedModal(true);
                errorMsg = 'You do not have permission to access the web application.';
            } else {
                // Account is inactive
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
                email,
                password
            });

            if (response.data.requiresConfirmation) {
                // Show custom confirmation modal
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

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8 sm:px-8 lg:p-16">
            <div className="max-w-md w-full flex flex-col items-center text-center">
                {/* Logo */}
                <div className="mb-8 sm:mb-14">
                    <BrandLogo iconSize="w-16 h-16 sm:w-24 sm:h-24" />
                </div>

                <div className="mb-8 sm:mb-10 text-center">
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
                        Sign in to WorkPulse
                    </h1>
                    <p className="text-gray-500 text-sm">Welcome back! Please enter your details.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6 w-full">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg animate-shake text-left">
                            <p className="text-red-700 text-sm font-medium flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </p>
                        </div>
                    )}

                    <div className="border border-gray-200 rounded-2xl p-5 sm:p-8 space-y-6 shadow-sm">
                        <div className="space-y-4 sm:space-y-5">
                            {/* Email Field */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-left">
                                <label htmlFor="email" className="text-sm font-semibold text-gray-700 sm:w-16 flex-shrink-0">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    className="flex-1 w-full px-4 py-3 sm:px-5 sm:py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e1b4b]/10 focus:border-[#1e1b4b] transition-all text-gray-800 placeholder-gray-400 text-sm"
                                />
                            </div>

                            {/* Password Field */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-left">
                                <label htmlFor="password" className="text-sm font-semibold text-gray-700 sm:w-16 flex-shrink-0">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    required
                                    className="flex-1 w-full px-4 py-3 sm:px-5 sm:py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e1b4b]/10 focus:border-[#1e1b4b] transition-all text-gray-800 placeholder-gray-400 text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full max-w-[200px] py-4 bg-[#1e1b4b] text-white font-black rounded-xl shadow-xl shadow-indigo-950/10 hover:shadow-indigo-950/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-70 text-xs uppercase tracking-widest"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 bg-[#0ea5e9] rounded-full animate-pulse mr-1" />
                                        Sign In
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>

                {/* ABiS Credentials Instruction */}
                <div className="mt-10 max-w-md w-full bg-gray-50 border border-gray-100 rounded-2xl p-6">
                    <div className="text-center">
                        <p className="text-xs font-black text-[#1e1b4b] mb-1 uppercase tracking-tighter opacity-70">Login Credentials</p>
                        <p className="text-[11px] text-gray-500">Use your <span className="font-bold text-[#1e1b4b]">ABiS Application</span> account credentials to access WorkPulse</p>
                    </div>
                </div>

                {/* Mobile App Download Link */}
                <div className="mt-8 text-center w-full">
                    <Link
                        to="/apk"
                        className="inline-flex items-center justify-center gap-2 w-full max-w-[260px] py-4 bg-white border border-gray-200 text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
                    >
                        <LuSmartphone size={20} />
                        <span>Download Mobile App</span>
                    </Link>
                </div>

                {/* Copyright Info */}
                <div className="mt-8 sm:mt-16 opacity-40 hover:opacity-100 transition-opacity">
                    <p className="text-gray-500 text-[10px] font-medium text-center">
                        &copy; {new Date().getFullYear()} Roonaa Technologies India Private Limited
                    </p>
                </div>
            </div>

            {/* Welcome / Setup Required Modal */}
            {showWelcomeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in border border-[#1e1b4b]/5">
                        <div className="w-20 h-20 bg-[#f0f9ff] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-[#f0f9ff]">
                            <span className="text-4xl">👋</span>
                        </div>
                        <h3 className="text-2xl font-black text-[#1e1b4b] mb-2 uppercase tracking-tighter">Welcome to WorkPulse!</h3>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            We're excited to have you on board.
                            <br /><br />
                            Your profile setup is incomplete.
                            <br />
                            <span className="text-[#0ea5e9] font-black mt-2 block uppercase text-xs tracking-widest">Please contact administrator.</span>
                        </p>
                        <button
                            onClick={() => setShowWelcomeModal(false)}
                            className="w-full py-4 bg-[#1e1b4b] text-white rounded-xl font-black hover:bg-indigo-950 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-xs uppercase tracking-widest shadow-xl shadow-indigo-950/20"
                        >
                            Okay, Got it
                        </button>
                    </div>
                </div>
            )}

            {/* Modal remains same but styled for the new theme */}
            {showInactiveModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🚫</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Account Inactive</h3>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            Your account is currently inactive. You cannot access the WorkPulse system.
                            <br />
                            <span className="text-blue-600 font-semibold mt-2 block">Please contact your administrator.</span>
                        </p>
                        <button
                            onClick={() => setShowInactiveModal(false)}
                            className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Not Authorized Modal - for users without webapp access permission */}
            {showNotAuthorizedModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🔒</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h3>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            You do not have permission to access the web application.
                            <br />
                            <span className="text-amber-600 font-semibold mt-2 block">Please contact your administrator to request access.</span>
                        </p>
                        <button
                            onClick={() => setShowNotAuthorizedModal(false)}
                            className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal for Local Auth */}
            {confirmationModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🛡️</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">Authentication Update</h3>

                        <div className="text-gray-600 mb-8 leading-relaxed space-y-3 text-left bg-gray-50 p-4 rounded-xl">
                            <p>
                                We noticed a delay in reaching the primary directory server. This sometimes happens due to routine maintenance or network checks.
                            </p>
                            <p className="font-medium text-gray-800">
                                Good news: You can still log in securely!
                            </p>
                            <p>
                                Your local account is ready to go. Would you like to proceed with local sign-in to access your dashboard immediately?
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    setConfirmationModal({ ...confirmationModal, isOpen: false });
                                    setLoading(false);
                                }}
                                className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmLogin}
                                className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 transform hover:-translate-y-0.5 active:translate-y-0 transition-all"
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
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
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

