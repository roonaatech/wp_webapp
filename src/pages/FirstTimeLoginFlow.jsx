import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuLock, LuShieldAlert, LuUserCheck, LuSignature, LuCheck, LuUndo2, LuArrowRight } from "react-icons/lu";
import API_BASE_URL from '../config/api.config';
import { formatDateOnly } from '../utils/timezone.util';
import { fetchRoles, canAccessWebApp, isSelfServiceOnly } from '../utils/roleUtils';

const FirstTimeLoginFlow = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [auditData, setAuditData] = useState(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Initial flags from localStorage
    const mustChangePassword = localStorage.getItem('mustChangePassword') === 'true';
    const mustCompleteDeclaration = localStorage.getItem('mustCompleteDeclaration') === 'true';

    // Form States
    const [passwordData, setPasswordData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState('');
    const [savedSignature, setSavedSignature] = useState(null);

    const [declarationData, setDeclarationData] = useState({
        consent_given: false,
        signature_name: '',
        onboarding_place: '',
        signature_data: ''
    });
    const [declarationError, setDeclarationError] = useState('');

    // Determine initial flow step
    useEffect(() => {
        if (mustCompleteDeclaration) {
            setStep(2); // Unified Audit & Declaration step
            fetchMyProfile();
        } else if (mustChangePassword) {
            setStep(1); // Password update step
        } else {
            navigate('/'); // Fallback if no gating flags
        }
    }, []);

    const fetchMyProfile = async () => {
        setAuditLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/onboarding/my-profile`, {
                headers: { 'x-access-token': token }
            });
            setAuditData(response.data);
            // Pre-fill signature name with employee's own name on audit load
            setDeclarationData(prev => ({
                ...prev,
                signature_name: `${response.data.firstname} ${response.data.lastname}`
            }));
        } catch (err) {
            console.error('Error fetching audit profile:', err);
            toast.error('Failed to load profile details for auditing.');
        } finally {
            setAuditLoading(false);
        }
    };

    // Signature Canvas setup
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (step === 2 && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#1e1b4b'; // Deep Indigo ink
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, [step, auditData]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        // Support mouse and touch events
        if (e.touches && e.touches[0]) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        const coords = getCoordinates(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        setIsDrawing(true);
        e.preventDefault();
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const coords = getCoordinates(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        e.preventDefault();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // Form Navigation handlers
    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        setPasswordError('');

        if (!passwordData.password) {
            setPasswordError('New password is required.');
            return;
        }
        if (passwordData.password.length < 6) {
            setPasswordError('Password must be at least 6 characters long.');
            return;
        }
        if (passwordData.password !== passwordData.confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }

        // Directly submit both password and the saved signature (if any)
        submitDeclaration(passwordData.password, savedSignature);
    };

    const handleDeclarationSubmit = (e) => {
        e.preventDefault();
        setDeclarationError('');

        if (!declarationData.consent_given) {
            setDeclarationError('You must check the consent box to continue.');
            return;
        }
        if (!declarationData.signature_name.trim()) {
            setDeclarationError('Please type in your full signature name.');
            return;
        }
        if (!declarationData.onboarding_place.trim()) {
            setDeclarationError('Please enter your signing location/place.');
            return;
        }

        // Extract canvas signature base64 stream
        const canvas = canvasRef.current;
        if (!canvas) return;
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;

        if (canvas.toDataURL() === blank.toDataURL()) {
            setDeclarationError('Please draw your digital signature on the canvas pad.');
            return;
        }

        const base64Signature = canvas.toDataURL('image/png');
        if (mustChangePassword) {
            setSavedSignature(base64Signature);
            setStep(1);
        } else {
            submitDeclaration(null, base64Signature);
        }
    };

    const submitDeclaration = async (newPassword, signatureData = null) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                password: newPassword,
                consent_given: declarationData.consent_given,
                signature_name: declarationData.signature_name,
                onboarding_place: declarationData.onboarding_place,
                signature_data: signatureData
            };

            await axios.post(`${API_BASE_URL}/api/onboarding/employee/complete-declaration`, payload, {
                headers: { 'x-access-token': token }
            });

            // Success: Clear flags from localStorage
            localStorage.setItem('mustChangePassword', 'false');
            localStorage.setItem('mustCompleteDeclaration', 'false');

            setShowSuccessModal(true);
        } catch (err) {
            console.error('Error completing verification:', err);
            const errMsg = err.response?.data?.message || 'Failed to complete profile verification.';
            toast.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleFinishFlow = async () => {
        setShowSuccessModal(false);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (user && user.role) {
            try {
                // Ensure roles are cached/fetched
                await fetchRoles();
                
                const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobileDevice) {
                    navigate('/my-requests');
                    return;
                }

                if (!canAccessWebApp(user.role)) {
                    navigate('/my-requests');
                    return;
                }

                if (isSelfServiceOnly(user.role)) {
                    navigate('/my-requests');
                    return;
                }
            } catch (err) {
                console.error('Error redirecting after first time login flow:', err);
            }
        }
        
        navigate('/'); // Redirect to standard dashboard!
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8 font-sans">
            <div className="max-w-4xl w-full bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-10 transform transition-all">
                {/* Header indicators */}
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-5">
                    <div>
                        <h1 className="text-2xl font-black text-[#1e1b4b]">Profile Setup & Audit</h1>
                        <p className="text-xs text-slate-400 mt-0.5">Please complete the mandatory first-time verification steps.</p>
                    </div>
                    {/* Stepper indicator badges */}
                    <div className="flex gap-2">
                        {mustCompleteDeclaration && (
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${step === 2 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                                {mustChangePassword ? '1. Review & Sign' : 'Review & Sign Declaration'}
                            </span>
                        )}
                        {mustChangePassword && (
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${step === 1 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                                {mustCompleteDeclaration ? '2. Password' : 'Password'}
                            </span>
                        )}
                    </div>
                </div>

                {/* STEP 1: CHANGE PASSWORD */}
                {step === 1 && (
                    <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md mx-auto py-4">
                        <div className="text-center space-y-2 mb-6">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                                <LuLock size={26} />
                            </div>
                            <h2 className="text-lg font-black text-[#1e1b4b]">Change Temporary Password</h2>
                            <p className="text-xs text-slate-400">To secure your profile, please change your temporary password.</p>
                        </div>

                        {passwordError && (
                            <div className="bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-r-xl">
                                <p className="text-rose-700 text-xs font-bold flex items-center gap-1.5"><LuShieldAlert size={14} /> {passwordError}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.password}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Minimum 6 characters"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    placeholder="Re-type password"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {mustCompleteDeclaration && (
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="flex-1 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition text-sm"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                            >
                                {loading ? 'Completing Setup...' : 'Complete Setup'} <LuCheck size={16} />
                            </button>
                        </div>
                    </form>
                )}

                {/* STEP 2: PROFILE DETAILS AUDIT & INTEGRATED DECLARATION */}
                {step === 2 && (
                    <div className="space-y-6 py-2">
                        <div className="text-center space-y-1 mb-4">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                                <LuUserCheck size={26} />
                            </div>
                            <h2 className="text-lg font-black text-[#1e1b4b]">Review Profile & Sign Declaration</h2>
                            <p className="text-xs text-slate-400">Please audit the details entered by HR and execute your digital signature.</p>
                        </div>

                        {auditLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="text-xs text-slate-400">Fetching audit profile details...</p>
                            </div>
                        ) : auditData ? (
                            <form onSubmit={handleDeclarationSubmit} className="space-y-6">
                                {declarationError && (
                                    <div className="bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-r-xl">
                                        <p className="text-rose-700 text-xs font-bold flex items-center gap-1.5"><LuShieldAlert size={14} /> {declarationError}</p>
                                    </div>
                                )}

                                {/* Scrollable dossier details */}
                                <div className="space-y-6 max-h-[420px] overflow-y-auto pr-2 border border-slate-100 p-4 rounded-2xl bg-slate-50/30 shadow-inner">
                                    {/* Basic Credentials */}
                                    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm">
                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">System Account & Identity</h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
                                            <div><p className="text-slate-400">Name</p><p className="mt-0.5">{auditData.firstname} {auditData.lastname}</p></div>
                                            <div><p className="text-slate-400">Email</p><p className="mt-0.5">{auditData.email}</p></div>
                                            <div><p className="text-slate-400">Gender</p><p className="mt-0.5">{auditData.gender || '—'}</p></div>
                                        </div>
                                    </div>

                                    {/* Personal Details */}
                                    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm">
                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">Personal Details</h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
                                            <div><p className="text-slate-400">Date of Birth</p><p className="mt-0.5">{auditData.profile_info?.date_of_birth ? formatDateOnly(auditData.profile_info.date_of_birth) : '—'}</p></div>
                                            <div><p className="text-slate-400">Age</p><p className="mt-0.5">{auditData.profile_info?.age ? `${auditData.profile_info.age} years` : '—'}</p></div>
                                            <div><p className="text-slate-400">Birthplace</p><p className="mt-0.5">{auditData.profile_info?.birthplace || '—'}</p></div>
                                            
                                            <div><p className="text-slate-400">Blood Group</p><p className="mt-0.5">{auditData.profile_info?.blood_group || '—'}</p></div>
                                            <div><p className="text-slate-400">Height & Weight</p><p className="mt-0.5">{auditData.profile_info?.height_weight || '—'}</p></div>
                                            <div><p className="text-slate-400">Marital Status</p><p className="mt-0.5">{auditData.profile_info?.marital_status || 'Single'}</p></div>
                                            
                                            <div><p className="text-slate-400">No. of Children</p><p className="mt-0.5">{auditData.profile_info?.no_of_children || 0}</p></div>
                                            <div><p className="text-slate-400">Nationality</p><p className="mt-0.5">{auditData.profile_info?.nationality || 'Indian'}</p></div>
                                            <div><p className="text-slate-400">Religion</p><p className="mt-0.5">{auditData.profile_info?.religion || '—'}</p></div>
                                            
                                            <div className="col-span-2 sm:col-span-3"><p className="text-slate-400">Hobbies</p><p className="mt-0.5">{auditData.profile_info?.hobbies || '—'}</p></div>
                                            
                                            {auditData.profile_info?.has_disability && (
                                                <div className="col-span-2 sm:col-span-3 p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-xs text-rose-800">
                                                    <p className="font-bold">Disability Details:</p>
                                                    <p className="mt-1 font-medium">{auditData.profile_info.disability_details}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Addresses */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-xs font-semibold text-slate-700">
                                            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-2">Present Address</h3>
                                            <p className="whitespace-pre-wrap">{auditData.profile_info?.present_address || '—'}</p>
                                            <p className="text-slate-400 mt-2">Local Contact No: <span className="text-slate-700 font-bold ml-0.5">{auditData.profile_info?.present_contact_no || '—'}</span></p>
                                        </div>
                                        <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-xs font-semibold text-slate-700">
                                            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-2">Permanent Address</h3>
                                            <p className="whitespace-pre-wrap">{auditData.profile_info?.permanent_address || '—'}</p>
                                            <p className="text-slate-400 mt-2">Permanent Contact No: <span className="text-slate-700 font-bold ml-0.5">{auditData.profile_info?.permanent_contact_no || '—'}</span></p>
                                        </div>
                                    </div>

                                    {/* Parental Profiles */}
                                    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-xs font-semibold text-slate-700">
                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">Parental Profiles</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                            <div className="space-y-2">
                                                <p className="font-black text-indigo-500 text-[10px] uppercase tracking-wider">Father's Record</p>
                                                <div className="grid grid-cols-2 gap-3 mt-1">
                                                    <div className="col-span-2"><p className="text-slate-400">Full Name</p><p className="mt-0.5">{auditData.profile_info?.father_name || '—'}</p></div>
                                                    <div><p className="text-slate-400">Age</p><p className="mt-0.5">{auditData.profile_info?.father_age ? `${auditData.profile_info.father_age} yrs` : '—'}</p></div>
                                                    <div><p className="text-slate-400">Occupation</p><p className="mt-0.5">{auditData.profile_info?.father_occupation || '—'}</p></div>
                                                </div>
                                            </div>
                                            <div className="space-y-2 pt-4 md:pt-0 md:pl-6">
                                                <p className="font-black text-indigo-500 text-[10px] uppercase tracking-wider">Mother's Record</p>
                                                <div className="grid grid-cols-2 gap-3 mt-1">
                                                    <div className="col-span-2"><p className="text-slate-400">Maiden Name</p><p className="mt-0.5">{auditData.profile_info?.mother_name || '—'}</p></div>
                                                    <div><p className="text-slate-400">Age</p><p className="mt-0.5">{auditData.profile_info?.mother_age ? `${auditData.profile_info.mother_age} yrs` : '—'}</p></div>
                                                    <div><p className="text-slate-400">Occupation</p><p className="mt-0.5">{auditData.profile_info?.mother_occupation || '—'}</p></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Academic Qualifications */}
                                    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-xs font-semibold text-slate-700">
                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">Academic Qualifications</h3>
                                        {(!auditData.educations || auditData.educations.length === 0) ? (
                                            <p className="text-xs text-slate-400">No educational background added.</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                                    <thead>
                                                        <tr>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Qualification</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Specialization</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Grade</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Completion Year</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {auditData.educations.map((edu, i) => (
                                                            <tr key={i}>
                                                                <td className="py-2">{edu.qualification}</td>
                                                                <td className="py-2">{edu.specialization || '—'}</td>
                                                                <td className="py-2">{edu.grade || '—'}</td>
                                                                <td className="py-2">{edu.year_of_completion || '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Siblings Registry */}
                                    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-xs font-semibold text-slate-700">
                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">Siblings Registry</h3>
                                        {(!auditData.family_members || auditData.family_members.length === 0) ? (
                                            <p className="text-xs text-slate-400">No sibling records added.</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                                    <thead>
                                                        <tr>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Name</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Relationship</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Education</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Occupation</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Marital Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {auditData.family_members.map((sibling, i) => (
                                                            <tr key={i}>
                                                                <td className="py-2">{sibling.name}</td>
                                                                <td className="py-2">{sibling.relationship || '—'}</td>
                                                                <td className="py-2">{sibling.education || '—'}</td>
                                                                <td className="py-2">{sibling.work_occupation || '—'}</td>
                                                                <td className="py-2">{sibling.marital_status || 'Single'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Past Work History */}
                                    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-xs font-semibold text-slate-700">
                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">Past Work History</h3>
                                        {(!auditData.experiences || auditData.experiences.length === 0) ? (
                                            <p className="text-xs text-slate-400">No previous job history added.</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                                    <thead>
                                                        <tr>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Company</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">City</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Post Held</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Department</th>
                                                            <th className="text-left py-1 text-slate-400 uppercase tracking-wide">Tenure</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {auditData.experiences.map((exp, i) => (
                                                            <tr key={i}>
                                                                <td className="py-2">{exp.company_name}</td>
                                                                <td className="py-2">{exp.city || '—'}</td>
                                                                <td className="py-2">{exp.post_held || '—'}</td>
                                                                <td className="py-2">{exp.department_function || '—'}</td>
                                                                <td className="py-2">{exp.tenure || '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bank coordinates */}
                                    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-xs font-semibold text-slate-700">
                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">Bank coordinates (for Payroll Deposits)</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><p className="text-slate-400">Account Number</p><p className="mt-0.5">{auditData.profile_info?.bank_account_number || '—'}</p></div>
                                            <div><p className="text-slate-400">IFSC Code</p><p className="mt-0.5">{auditData.profile_info?.bank_ifsc_code || '—'}</p></div>
                                            <div className="col-span-2"><p className="text-slate-400">Bank Name & Branch Address</p><p className="mt-0.5">{auditData.profile_info?.bank_name_address || '—'}</p></div>
                                        </div>
                                    </div>

                                    {/* Uploaded Onboarding Attachments with Secure Download query params */}
                                    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-xs font-semibold text-slate-700">
                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">Uploaded Onboarding Attachments</h3>
                                        {(!auditData.documents || auditData.documents.length === 0) ? (
                                            <p className="text-xs text-slate-400">No attachments uploaded by HR.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                                {auditData.documents.map((doc, i) => {
                                                    const token = localStorage.getItem('token');
                                                    return (
                                                        <div key={i} className="flex items-center justify-between p-2.5 border border-slate-100 bg-slate-50/50 rounded-xl">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase flex-shrink-0">
                                                                    {doc.document_type ? doc.document_type.substring(0, 3) : 'DOC'}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-slate-700 truncate" title={doc.document_type ? doc.document_type.replace('_', ' ') : 'document'}>
                                                                        {(doc.document_type || '').replace('_', ' ').toUpperCase()}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                        {doc.file_name} ({Math.round(doc.file_size / 1024)} KB)
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <a 
                                                                href={`${API_BASE_URL}/api/onboarding/employee/${auditData.staffid}/document/${doc.id}?token=${token}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition flex-shrink-0 ml-2"
                                                            >
                                                                Download
                                                            </a>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* INTEGRATED DECLARATION SIGN-OFF & SIGNATURE CANVAS */}
                                <div className="space-y-6 pt-4 border-t border-slate-100">
                                    {/* Legal Declaration Statement Box */}
                                    <div className="p-5 bg-[#faf5ff] border border-[#f3e8ff] text-[#581c87] rounded-2xl text-xs leading-relaxed space-y-3 shadow-inner max-h-[160px] overflow-y-auto">
                                        <p className="font-black text-xs uppercase tracking-wider text-[#6b21a8] border-b border-[#f3e8ff] pb-1.5">Employment Sign-off Declaration</p>
                                        <p>
                                            I hereby declare that all the information furnished above by me is true, complete, and correct to the best of my knowledge and belief. I understand that if any of the information is found to be false or inaccurate at any stage, the company reserves the absolute right to take disciplinary action up to and including termination of my employment contract immediately without prior notice or compensation.
                                        </p>
                                        <p>
                                            I authorize the HR and administration department to register and maintain these coordinates, execute verification audits on my backgrounds, and configure standard payroll accounts.
                                        </p>
                                    </div>

                                    {/* Interactive Signature Canvas Pad */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Draw Digital Signature <span className="text-red-500 font-bold">*</span></label>
                                            <button
                                                type="button"
                                                onClick={clearCanvas}
                                                className="text-slate-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition"
                                            >
                                                <LuUndo2 size={12} /> Clear Drawing
                                            </button>
                                        </div>
                                        <div className="border border-slate-200 rounded-2xl bg-slate-50 p-2 shadow-inner">
                                            <canvas
                                                ref={canvasRef}
                                                width={700}
                                                height={180}
                                                onMouseDown={startDrawing}
                                                onMouseMove={draw}
                                                onMouseUp={stopDrawing}
                                                onMouseLeave={stopDrawing}
                                                onTouchStart={startDrawing}
                                                onTouchMove={draw}
                                                onTouchEnd={stopDrawing}
                                                className="w-full h-[160px] bg-white rounded-xl shadow-inner border border-slate-100 cursor-crosshair touch-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Full Sign-off Name <span className="text-red-500 font-bold">*</span></label>
                                            <input
                                                type="text"
                                                value={declarationData.signature_name}
                                                onChange={(e) => setDeclarationData(prev => ({ ...prev, signature_name: e.target.value }))}
                                                placeholder="Type your official full name"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-sm"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Signing Location / Place <span className="text-red-500 font-bold">*</span></label>
                                            <input
                                                type="text"
                                                value={declarationData.onboarding_place}
                                                onChange={(e) => setDeclarationData(prev => ({ ...prev, onboarding_place: e.target.value }))}
                                                placeholder="e.g. Chennai, Bangalore"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-sm"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Consent Checkbox */}
                                    <label className="flex items-start gap-2.5 p-4 border border-indigo-100 bg-indigo-50/20 rounded-xl text-slate-700 text-xs font-semibold cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={declarationData.consent_given}
                                            onChange={(e) => setDeclarationData(prev => ({ ...prev, consent_given: e.target.checked }))}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-0.5"
                                            required
                                        />
                                        <span>
                                            I have fully reviewed the pre-filled Extended Joining Form details above, declare them true and accurate, and authorize the digital signature sign-off.
                                        </span>
                                    </label>

                                    {/* Action buttons */}
                                    <div className="flex gap-3 justify-end pt-4">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {mustChangePassword ? (
                                                <>
                                                    {loading ? 'Processing...' : 'Next: Set Password'} <LuArrowRight size={18} />
                                                </>
                                            ) : (
                                                <>
                                                    <LuCheck size={18} /> {loading ? 'Submitting Declaration...' : 'Sign & Submit Declaration'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <p className="text-center text-xs text-rose-500 font-bold">Failed to load audit profile. Refresh page.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Success Gating Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-modal-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center border border-slate-100">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-emerald-50/50">
                            <LuCheck size={42} />
                        </div>
                        <h3 className="text-2xl font-black text-[#1e1b4b] mb-2 uppercase tracking-tighter">Profile Authorized!</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed text-sm">
                            Thank you! Your profile audit has been verified, password updated, and declaration signature successfully saved to the database.
                            <br /><br />
                            You are now authorized to access the system dashboard.
                        </p>
                        <button
                            onClick={handleFinishFlow}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-all text-xs uppercase tracking-widest shadow-lg shadow-indigo-200"
                        >
                            Enter Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FirstTimeLoginFlow;
