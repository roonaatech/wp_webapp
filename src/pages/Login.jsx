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

        try {
            const roles = await fetchRoles(true); // Force refresh roles cache
            console.log('Fetched roles for permission check:', roles);
            console.log('User role ID:', user.role, 'Type:', typeof user.role);

            // Check if user has permission to access webapp (based on role permissions)
            const hasAccess = canAccessWebApp(user.role);
            console.log('canAccessWebApp result:', hasAccess);

            if (!hasAccess) {
                // User doesn't have full webapp access but can still use My Requests
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
            // If we can't fetch roles, allow login but log the error
            // The roles will be fetched on next page load
        }

        localStorage.setItem('user', JSON.stringify(user));

        // Check if user is self-service only (no management permissions)
        // These users go to /my-requests even if they have can_access_webapp
        if (isSelfServiceOnly(user.role)) {
            toast.success(`Welcome, ${user.firstname}!`, {
                style: { background: '#059669', color: '#fff' },
                icon: '👋'
            });
            navigate('/my-requests');
            return;
        }

        toast.success(`Welcome back, ${user.firstname}!`, {
            style: {
                background: '#059669', // Green for standard login
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
        <div className="min-h-screen bg-white flex overflow-hidden">
            {/* Left Side - Login Form */}
            <div className="w-full lg:w-[65%] flex flex-col p-8 lg:p-16 xl:p-24 overflow-y-auto">
                <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center items-center text-center">
                    {/* Logo */}
                    <div className="mb-28 -mt-12">
                        <BrandLogo iconSize="w-20 h-20" />
                    </div>

                    <div className="mb-10">
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
                            Sign in to WorkPulse
                        </h1>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg animate-shake">
                                <p className="text-red-700 text-sm font-medium flex items-center gap-2">
                                    <span>⚠️</span> {error}
                                </p>
                            </div>
                        )}

                        <div className="border border-gray-200 rounded-lg p-6 space-y-6">
                            <div className="space-y-4">
                                {/* Email Field */}
                                <div className="flex items-center gap-4">
                                    <label htmlFor="email" className="text-sm font-semibold text-gray-700 w-16 flex-shrink-0">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        required
                                        className="flex-1 px-5 py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-800 placeholder-gray-400"
                                    />
                                </div>

                                {/* Password Field */}
                                <div className="flex items-center gap-4">
                                    <label htmlFor="password" className="text-sm font-semibold text-gray-700 w-16 flex-shrink-0">Password</label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password"
                                        required
                                        className="flex-1 px-5 py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-800 placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-40 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        "Sign In"
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* ABiS Credentials Instruction */}
                    <div className="mt-8 max-w-md w-full bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200/50 rounded-xl p-6 shadow-sm">
                        <div>
                            <p className="text-sm font-semibold text-gray-900 mb-1">Login Credentials</p>
                            <p className="text-xs text-gray-600">Use your <span className="font-bold text-gray-800">ABiS account</span> credentials to access WorkPulse</p>
                        </div>
                    </div>

                </div>

                {/* Mobile App Download Link */}
                <div className="mt-4 text-center animate-fade-in">
                    <Link
                        to="/apk"
                        className="inline-flex items-center justify-center gap-2 w-60 py-4 bg-white border-2 border-black text-black font-bold rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl hover:shadow-gray-300 transform hover:-translate-y-0.5 active:translate-y-0 transition-all"
                    >
                        <LuSmartphone size={20} />
                        <span>Download Mobile App</span>
                    </Link>
                </div>

                {/* Copyright Info - Moved to very bottom */}
                <div className="mt-auto flex items-center justify-center py-8 animate-fade-in opacity-60 hover:opacity-100 transition-opacity">
                    <p className="text-gray-500 text-xs font-medium text-center">
                        &copy; {new Date().getFullYear()} Roonaa Technologies India Private Limited
                    </p>
                </div>
            </div>

            {/* Right Side - Decorative Panel */}
            <div className="hidden lg:flex lg:w-[35%] relative bg-gradient-to-br from-blue-600 to-purple-600 items-center justify-center p-20 overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

                {/* Floating "Card" UI Elements simulation */}
                <div className="relative z-10 w-full max-w-lg aspect-square">
                    {/* Main decorative SVG */}
                    <svg viewBox="0 0 500 500" className="w-full h-full drop-shadow-2xl animate-float">
                        <defs>
                            <linearGradient id="svgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#fff" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#fff" stopOpacity="0.05" />
                            </linearGradient>
                        </defs>
                        <rect x="50" y="50" width="400" height="400" rx="40" fill="url(#svgGrad)" />
                        <circle cx="250" cy="250" r="120" stroke="white" strokeWidth="2" fill="none" opacity="0.2" />
                        <circle cx="250" cy="250" r="150" stroke="white" strokeWidth="2" fill="none" opacity="0.1" />

                        {/* Pulse line simulation */}
                        <path
                            d="M100 250 L180 250 L210 200 L240 300 L270 240 L300 250 L400 250"
                            stroke="white"
                            strokeWidth="8"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="animate-draw-pulse"
                            style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.8))' }}
                        />

                        {/* Floating elements */}
                        <rect x="350" y="100" width="40" height="60" rx="10" fill="white" opacity="0.3" />
                        <circle cx="100" cy="400" r="30" fill="white" opacity="0.2" />
                        <path d="M400 350 L430 380 L370 380 Z" fill="white" opacity="0.25" />
                    </svg>
                </div>

            </div>

            {/* Welcome / Setup Required Modal */}
            {showWelcomeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all animate-modal-in">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">👋</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Welcome to WorkPulse!</h3>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            We're excited to have you on board.
                            <br /><br />
                            Your profile setup is incomplete.
                            <br />
                            <span className="text-blue-600 font-semibold mt-2 block">Please contact your administrator to configure your account before you can log in.</span>
                        </p>
                        <button
                            onClick={() => setShowWelcomeModal(false)}
                            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
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

            <style jsx>{`
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

