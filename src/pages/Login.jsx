import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import BrandLogo from '../components/BrandLogo';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showInactiveModal, setShowInactiveModal] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/signin`, {
                email,
                password
            });

            if (response.data.accessToken) {
                // Backend returns user data at root level, not nested under 'user'
                const user = {
                    id: response.data.id,
                    staffid: response.data.staffid,
                    firstname: response.data.firstname,
                    lastname: response.data.lastname,
                    email: response.data.email,
                    role: response.data.role
                };

                // Check if user has admin or manager role (role 1 or 2)
                if (user.role !== 1 && user.role !== 2) {
                    setError('Access denied. Only Admin and Manager roles can access this system.');
                    setLoading(false);
                    return;
                }

                localStorage.setItem('token', response.data.accessToken);
                localStorage.setItem('user', JSON.stringify(user));
                navigate('/');
            }
        } catch (err) {
            console.error('Login error details:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });

            if (err.response?.status === 404) {
                setError('User not found. Please check your email.');
            } else if (err.response?.status === 401) {
                setError('Invalid password.');
            } else if (err.response?.status === 403) {
                setShowInactiveModal(true);
            } else if (err.message === 'Network Error' || !err.response) {
                setError('Cannot connect to server. Please make sure the backend is running on port 3000.');
            } else {
                setError(err.response?.data?.message || 'Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex overflow-hidden">
            {/* Left Side - Login Form */}
            <div className="w-full lg:w-[45%] flex flex-col p-8 lg:p-16 xl:p-24 overflow-y-auto">
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

                        <div className="space-y-4">
                            {/* Email Field */}
                            <div>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-800 placeholder-gray-400"
                                />
                            </div>

                            {/* Password Field */}
                            <div>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    required
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-800 placeholder-gray-400"
                                />
                            </div>
                        </div>

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
                    </form>

                </div>

                {/* Secure Access Badge - Moved to very bottom */}
                <div className="mt-auto flex items-center justify-center gap-4 py-8 animate-fade-in opacity-50 hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 flex items-center justify-center text-xl">✅</div>
                    <div className="text-left">
                        <p className="text-gray-900 font-bold text-sm">Secure Access</p>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Multi-Factor Authenticated</p>
                    </div>
                </div>
            </div>

            {/* Right Side - Decorative Panel */}
            <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 items-center justify-center p-20 overflow-hidden">
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

            {/* Modal remains same but styled for the new theme */}
            {showInactiveModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transform transition-all">
                        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-5xl">🚫</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Account Inactive</h3>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            Your account is currently inactive. You cannot access the WorkPulse system.
                            <br />
                            <span className="text-blue-600 font-semibold mt-2 block">Please contact your administrator.</span>
                        </p>
                        <button
                            onClick={() => setShowInactiveModal(false)}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
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

