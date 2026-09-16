import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import BrandLogo from '../components/BrandLogo';
import { LuMail, LuKeyRound, LuArrowLeft, LuCircleCheck, LuCircleAlert } from 'react-icons/lu';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, {
                email: email.trim()
            });

            setSuccess(true);
            toast.success('Temporary password sent to your email!');
        } catch (err) {
            console.error('Forgot password error:', err);
            const message = err.response?.data?.message || 'Failed to send password reset. Please try again.';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8 sm:px-8 lg:p-16 font-sans">
            <div className="max-w-md w-full flex flex-col items-center">
                {/* Brand Logo */}
                <div className="mb-8">
                    <BrandLogo iconSize="w-16 h-16 sm:w-20 sm:h-20" />
                </div>

                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-9 shadow-xl shadow-slate-200/50 w-full text-center">
                    {!success ? (
                        <>
                            <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-indigo-600 shadow-sm">
                                <LuKeyRound size={28} />
                            </div>

                            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                                Forgot Password?
                            </h1>
                            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6">
                                Enter your registered work email address below. We'll generate a temporary password and send it to your inbox.
                            </p>

                            {error && (
                                <div className="mb-5 bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-r-xl text-left animate-shake">
                                    <p className="text-rose-700 text-xs font-semibold flex items-center gap-2">
                                        <LuCircleAlert className="flex-shrink-0" size={16} />
                                        <span>{error}</span>
                                    </p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5 text-left">
                                <div>
                                    <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                        Work Email Address
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <LuMail size={18} />
                                        </div>
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                if (error) setError(null);
                                            }}
                                            placeholder="name@company.com"
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition text-slate-900"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 text-xs uppercase tracking-wider transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <span>Send Temporary Password</span>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="animate-fadeIn py-2">
                            <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center justify-center mx-auto mb-5 text-emerald-600 shadow-sm">
                                <LuCircleCheck size={36} />
                            </div>

                            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                                Temporary Password Sent!
                            </h2>
                            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                                We have sent a temporary password to <strong className="text-slate-900 font-bold">{email}</strong>.
                            </p>

                            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2 mb-6">
                                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <span>👉</span> Next Steps:
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed pl-1">
                                    <li>Check your inbox (and spam folder) for the temporary password.</li>
                                    <li>Return to the sign-in screen and log in with your email and temporary password.</li>
                                    <li>You will be automatically guided to set your new permanent password.</li>
                                </ol>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate('/login', { state: { email } })}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer text-xs uppercase tracking-wider"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    )}

                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition"
                        >
                            <LuArrowLeft size={14} />
                            <span>Return to Sign In</span>
                        </Link>
                    </div>
                </div>

                {/* Copyright */}
                <p className="mt-8 text-slate-400 text-[11px] font-medium text-center">
                    &copy; {new Date().getFullYear()} Roonaa Technologies India Private Limited
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;
