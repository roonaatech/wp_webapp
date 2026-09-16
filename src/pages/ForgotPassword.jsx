import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import BrandLogo from '../components/BrandLogo';
import { LuMail, LuKeyRound, LuArrowLeft, LuCircleCheck, LuCircleAlert, LuShieldCheck } from 'react-icons/lu';

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
            await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, {
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
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 sm:p-8 font-sans relative overflow-hidden selection:bg-indigo-600 selection:text-white">
            {/* Background Ambient Orbs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-70 pointer-events-none" />

            <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-10 shadow-2xl shadow-indigo-950/10 border border-slate-200/80 text-center relative z-10">
                {/* Brand Logo */}
                <div className="mb-6 flex justify-center">
                    <BrandLogo iconSize="w-14 h-14 sm:w-16 sm:h-16" />
                </div>

                {!success ? (
                    <>
                        <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-sm">
                            <LuKeyRound size={28} />
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
                            Reset Password
                        </h1>
                        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6">
                            Enter your registered work email. We'll generate a temporary password and send it to your inbox.
                        </p>

                        {error && (
                            <div className="mb-5 bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-r-xl text-left animate-shake">
                                <p className="text-rose-700 text-xs font-semibold flex items-center gap-2">
                                    <LuCircleAlert className="flex-shrink-0" size={16} />
                                    <span>{error}</span>
                                </p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4 text-left">
                            <div>
                                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 px-1">
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
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (error) setError(null);
                                        }}
                                        placeholder="name@company.com"
                                        required
                                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-600 text-sm transition text-slate-900 placeholder-slate-400 font-medium"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 text-xs uppercase tracking-wider"
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
                        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-sm">
                            <LuCircleCheck size={36} />
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                            Temporary Password Sent!
                        </h2>
                        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                            We have sent a temporary password to <strong className="text-slate-900 font-bold">{email}</strong>.
                        </p>

                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2 mb-6">
                            <p className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                                👉 Next Steps:
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed pl-1 text-slate-600">
                                <li>Check your inbox (and spam folder) for the temporary password.</li>
                                <li>Return to the sign-in screen and log in with your email and temporary password.</li>
                                <li>You will be automatically guided to set your new permanent password.</li>
                            </ol>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/login', { state: { email } })}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition cursor-pointer text-xs uppercase tracking-wider"
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

                <div className="mt-6 flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
                    <LuShieldCheck size={14} className="text-emerald-500" />
                    <span>256-bit TLS Encrypted Session</span>
                </div>
            </div>

            <style>{`
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

export default ForgotPassword;
