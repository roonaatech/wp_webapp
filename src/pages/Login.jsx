import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo Section */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-700 to-blue-800 rounded-2xl mb-4 shadow-lg overflow-hidden">
                        <img src="/abis_icon.png" alt="WorkPulse" className="w-14 h-14" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        WorkPulse
                    </h1>
                    <p className="text-gray-600 mt-2">Leave & On-Duty Management System</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-800 text-sm font-medium">⚠️ {error}</p>
                        </div>
                    )}

                    {/* Email Field */}
                    <div className="mb-6">
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-colors"
                        />
                    </div>

                    {/* Password Field */}
                    <div className="mb-6">
                        <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-colors"
                        />
                    </div>

                    {/* Login Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-700 to-blue-800 text-white font-semibold py-3 rounded-lg hover:from-blue-800 hover:to-blue-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Signing in...
                            </>
                        ) : (
                            <>
                                🔐 Sign In
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="my-6 relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Support</span>
                        </div>
                    </div>

                    {/* Support Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-xs text-gray-600 text-center">
                            Contact IT support if you need assistance accessing the system
                        </p>
                    </div>
                </form>

                {/* Footer */}
                <p className="text-center text-gray-600 text-sm mt-6">
                    Contact IT support if you need assistance
                </p>
            </div>
        </div>
    );
};

export default Login;
