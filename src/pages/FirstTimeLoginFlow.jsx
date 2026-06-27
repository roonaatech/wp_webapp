import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'react-hot-toast'; // Wait, let's keep axios as is: import axios from 'axios' and toast from 'react-hot-toast'
import axiosInstance from 'axios'; // Actually the original was: import axios from 'axios';
import toast from 'react-hot-toast';
import { LuLock, LuShieldAlert, LuUserCheck, LuSignature, LuCheck, LuUndo2, LuArrowRight, LuPlus, LuTrash2, LuUser, LuEye, LuCalendar } from "react-icons/lu";
import API_BASE_URL from '../config/api.config';
import { formatDateOnly, getDateInputPlaceholder, isoToDisplayDate, autoFormatDateInput, validatePartialDateInput, validateAndParseDate } from '../utils/timezone.util';
import { fetchRoles, canAccessWebApp, isSelfServiceOnly } from '../utils/roleUtils';

const FirstTimeLoginFlow = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [auditData, setAuditData] = useState(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showDobModal, setShowDobModal] = useState(false);

    const handleResolveDob = () => {
        setShowDobModal(false);
        setIsEditing(true);
        setTimeout(() => {
            const dobInput = document.getElementsByName('date_of_birth')[0];
            if (dobInput) {
                dobInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                dobInput.focus();
            }
        }, 100);
    };

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

    // Editing States
    const [isEditing, setIsEditing] = useState(false);
    const [dobDisplay, setDobDisplay] = useState('');
    const dobPickerRef = useRef(null);
    const [errors, setErrors] = useState({});

    const [editForm, setEditForm] = useState({
        firstname: '',
        lastname: '',
        gender: '',
        date_of_birth: '',
        age: '',
        birthplace: '',
        blood_group: '',
        height_weight: '',
        marital_status: 'Single',
        no_of_children: 0,
        nationality: 'Indian',
        religion: '',
        hobbies: '',
        has_disability: false,
        disability_details: '',
        present_address: '',
        present_contact_no: '',
        permanent_address: '',
        permanent_contact_no: '',
        father_name: '',
        father_age: '',
        father_occupation: '',
        mother_name: '',
        mother_age: '',
        mother_occupation: '',
        bank_account_number: '',
        bank_ifsc_code: '',
        bank_name_address: ''
    });

    const [editEducations, setEditEducations] = useState([]);
    const [editExperiences, setEditExperiences] = useState([]);
    const [editFamilyMembers, setEditFamilyMembers] = useState([]);

    // Determine initial flow step
    useEffect(() => {
        if (mustCompleteDeclaration) {
            setStep(2); // Unified Audit & Declaration step
            fetchMyProfile();
        } else if (mustChangePassword) {
            setStep(1); // Password update step
            // Declaration already done, but we still need the existing profile
            // (e.g. date_of_birth) so the password submit validation/payload has it.
            fetchMyProfile();
        } else {
            navigate('/'); // Fallback if no gating flags
        }
    }, []);

    const fetchMyProfile = async () => {
        setAuditLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axiosInstance.get(`${API_BASE_URL}/api/onboarding/my-profile`, {
                headers: { 'x-access-token': token }
            });
            setAuditData(response.data);
            
            const pInfo = response.data.profile_info || {};
            setEditForm({
                firstname: response.data.firstname || '',
                lastname: response.data.lastname || '',
                gender: response.data.gender || '',
                date_of_birth: pInfo.date_of_birth ? pInfo.date_of_birth.substring(0, 10) : '',
                age: pInfo.age || '',
                birthplace: pInfo.birthplace || '',
                blood_group: pInfo.blood_group || '',
                height_weight: pInfo.height_weight || '',
                marital_status: pInfo.marital_status || 'Single',
                no_of_children: pInfo.no_of_children || 0,
                nationality: pInfo.nationality || 'Indian',
                religion: pInfo.religion || '',
                hobbies: pInfo.hobbies || '',
                has_disability: pInfo.has_disability || false,
                disability_details: pInfo.disability_details || '',
                present_address: pInfo.present_address || '',
                present_contact_no: pInfo.present_contact_no || '',
                permanent_address: pInfo.permanent_address || '',
                permanent_contact_no: pInfo.permanent_contact_no || '',
                father_name: pInfo.father_name || '',
                father_age: pInfo.father_age || '',
                father_occupation: pInfo.father_occupation || '',
                mother_name: pInfo.mother_name || '',
                mother_age: pInfo.mother_age || '',
                mother_occupation: pInfo.mother_occupation || '',
                bank_account_number: pInfo.bank_account_number || '',
                bank_ifsc_code: pInfo.bank_ifsc_code || '',
                bank_name_address: pInfo.bank_name_address || ''
            });

            if (pInfo.date_of_birth) {
                setDobDisplay(isoToDisplayDate(pInfo.date_of_birth.substring(0, 10)));
            } else {
                setDobDisplay('');
            }

            setEditEducations(response.data.educations || []);
            setEditExperiences(response.data.experiences || []);
            setEditFamilyMembers(response.data.family_members || []);

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

    // Form Change Handlers
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (errors[name]) {
            setErrors(prev => {
                const updated = { ...prev };
                delete updated[name];
                return updated;
            });
        }
    };

    const handleDobChange = (e) => {
        const formatted = autoFormatDateInput(e.target.value);
        setDobDisplay(formatted);

        // Partial validation while typing
        const partialError = validatePartialDateInput(formatted);
        if (partialError) {
            setErrors(prev => ({ ...prev, date_of_birth: partialError }));
            setEditForm(prev => ({ ...prev, date_of_birth: '', age: '' }));
            return;
        }

        // Full validation when complete
        if (formatted.length === 10) {
            const { parsed, error } = validateAndParseDate(formatted, { allowFuture: false, maxAge: 120 });
            if (error) {
                setErrors(prev => ({ ...prev, date_of_birth: error }));
                setEditForm(prev => ({ ...prev, date_of_birth: '', age: '' }));
            } else {
                const birthDate = new Date(parsed);
                const today = new Date();
                let ageVal = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) ageVal--;
                const calculatedAge = ageVal >= 0 ? ageVal : '';
                setEditForm(prev => ({ ...prev, date_of_birth: parsed, age: calculatedAge }));
                setErrors(prev => { const u = { ...prev }; delete u.date_of_birth; return u; });
            }
        } else {
            setEditForm(prev => ({ ...prev, date_of_birth: '', age: '' }));
            setErrors(prev => { const u = { ...prev }; delete u.date_of_birth; return u; });
        }
    };

    const copyAddress = () => {
        setEditForm(prev => ({
            ...prev,
            permanent_address: prev.present_address,
            permanent_contact_no: prev.present_contact_no
        }));
    };

    // Sub-forms list handlers
    const addEducation = () => setEditEducations([...editEducations, { qualification: '', specialization: '', grade: '', year_of_completion: '' }]);
    const updateEducation = (index, field, value) => {
        const newArr = [...editEducations];
        newArr[index][field] = value;
        setEditEducations(newArr);
    };
    const removeEducation = (index) => setEditEducations(editEducations.filter((_, i) => i !== index));

    const addFamily = () => setEditFamilyMembers([...editFamilyMembers, { name: '', relationship: '', education: '', work_occupation: '', marital_status: '' }]);
    const updateFamily = (index, field, value) => {
        const newFam = [...editFamilyMembers];
        newFam[index][field] = value;
        setEditFamilyMembers(newFam);
    };
    const removeFamily = (index) => setEditFamilyMembers(editFamilyMembers.filter((_, i) => i !== index));

    const addExperience = () => setEditExperiences([...editExperiences, { company_name: '', city: '', post_held: '', tenure: '', reference_contact: '' }]);
    const updateExperience = (index, field, value) => {
        const newArr = [...editExperiences];
        newArr[index][field] = value;
        setEditExperiences(newArr);
    };
    const removeExperience = (index) => setEditExperiences(editExperiences.filter((_, i) => i !== index));

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

        let clientX = e.clientX;
        let clientY = e.clientY;

        // Support mouse and touch events
        if (e.touches && e.touches[0]) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Scale coordinates to match the canvas internal resolution
        return {
            x: x * (canvas.width / rect.width),
            y: y * (canvas.height / rect.height)
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

        if (!editForm.date_of_birth) {
            setPasswordError('Date of birth is required.');
            setShowDobModal(true);
            return;
        }

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

        if (!editForm.firstname?.trim()) {
            setDeclarationError('First name is required.');
            return;
        }
        if (!editForm.lastname?.trim()) {
            setDeclarationError('Last name is required.');
            return;
        }
        if (!editForm.gender) {
            setDeclarationError('Gender selection is required.');
            return;
        }
        if (!editForm.date_of_birth) {
            setDeclarationError('Date of birth is required.');
            setShowDobModal(true);
            return;
        }

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
        if (!editForm.date_of_birth) {
            toast.error('Date of birth is required.');
            setShowDobModal(true);
            return;
        }
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                password: newPassword,
                consent_given: declarationData.consent_given,
                signature_name: declarationData.signature_name,
                onboarding_place: declarationData.onboarding_place,
                signature_data: signatureData,

                // Add edited profile fields
                firstname: editForm.firstname,
                lastname: editForm.lastname,
                gender: editForm.gender,
                date_of_birth: editForm.date_of_birth,
                age: editForm.age,
                birthplace: editForm.birthplace,
                blood_group: editForm.blood_group,
                height_weight: editForm.height_weight,
                marital_status: editForm.marital_status,
                no_of_children: editForm.no_of_children,
                nationality: editForm.nationality,
                religion: editForm.religion,
                hobbies: editForm.hobbies,
                has_disability: editForm.has_disability,
                disability_details: editForm.disability_details,
                present_address: editForm.present_address,
                present_contact_no: editForm.present_contact_no,
                permanent_address: editForm.permanent_address,
                permanent_contact_no: editForm.permanent_contact_no,
                father_name: editForm.father_name,
                father_age: editForm.father_age,
                father_occupation: editForm.father_occupation,
                mother_name: editForm.mother_name,
                mother_age: editForm.mother_age,
                mother_occupation: editForm.mother_occupation,
                bank_account_number: editForm.bank_account_number,
                bank_ifsc_code: editForm.bank_ifsc_code,
                bank_name_address: editForm.bank_name_address,

                educations: editEducations,
                experiences: editExperiences,
                family_members: editFamilyMembers
            };

            await axiosInstance.post(`${API_BASE_URL}/api/onboarding/employee/complete-declaration`, payload, {
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

    const handleSaveProfileOnly = async () => {
        setDeclarationError('');

        if (!editForm.firstname?.trim()) {
            setDeclarationError('First name is required.');
            return;
        }
        if (!editForm.lastname?.trim()) {
            setDeclarationError('Last name is required.');
            return;
        }
        if (!editForm.gender) {
            setDeclarationError('Gender selection is required.');
            return;
        }
        if (!editForm.date_of_birth) {
            setDeclarationError('Date of birth is required.');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                password: null,
                consent_given: false,
                signature_name: null,
                onboarding_place: null,
                signature_data: null,

                firstname: editForm.firstname,
                lastname: editForm.lastname,
                gender: editForm.gender,
                date_of_birth: editForm.date_of_birth,
                age: editForm.age,
                birthplace: editForm.birthplace,
                blood_group: editForm.blood_group,
                height_weight: editForm.height_weight,
                marital_status: editForm.marital_status,
                no_of_children: editForm.no_of_children,
                nationality: editForm.nationality,
                religion: editForm.religion,
                hobbies: editForm.hobbies,
                has_disability: editForm.has_disability,
                disability_details: editForm.disability_details,
                present_address: editForm.present_address,
                present_contact_no: editForm.present_contact_no,
                permanent_address: editForm.permanent_address,
                permanent_contact_no: editForm.permanent_contact_no,
                father_name: editForm.father_name,
                father_age: editForm.father_age,
                father_occupation: editForm.father_occupation,
                mother_name: editForm.mother_name,
                mother_age: editForm.mother_age,
                mother_occupation: editForm.mother_occupation,
                bank_account_number: editForm.bank_account_number,
                bank_ifsc_code: editForm.bank_ifsc_code,
                bank_name_address: editForm.bank_name_address,

                educations: editEducations,
                experiences: editExperiences,
                family_members: editFamilyMembers
            };

            await axiosInstance.post(`${API_BASE_URL}/api/onboarding/employee/complete-declaration`, payload, {
                headers: { 'x-access-token': token }
            });

            toast.success('Profile details saved successfully!');
            setIsEditing(false); // Toggle back to review mode
        } catch (err) {
            console.error('Error saving profile edits:', err);
            const errMsg = err.response?.data?.message || 'Failed to save profile details.';
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
            <div className="max-w-6xl w-full bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-10 transform transition-all">
                {/* Header indicators */}
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-5">
                    <div>
                        <h1 className="text-3xl font-black text-[#1e1b4b]">Profile Setup & Audit</h1>
                        <p className="text-base text-slate-500 mt-1.5">Please complete the mandatory first-time verification steps.</p>
                    </div>
                    {/* Stepper indicator badges */}
                    <div className="flex gap-2">
                        {mustCompleteDeclaration && (
                            <span className={`px-4 py-2 rounded-full text-base font-bold ${step === 2 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                                {mustChangePassword ? '1. Review & Sign' : 'Review & Sign Declaration'}
                            </span>
                        )}
                        {mustChangePassword && (
                            <span className={`px-4 py-2 rounded-full text-base font-bold ${step === 1 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
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
                            <h2 className="text-xl font-black text-[#1e1b4b]">Change Temporary Password</h2>
                            <p className="text-base text-slate-500">To secure your profile, please change your temporary password.</p>
                        </div>

                        {passwordError && (
                            <div className="bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-r-xl">
                                <p className="text-rose-700 text-base font-bold flex items-center gap-1.5"><LuShieldAlert size={14} /> {passwordError}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-base font-bold text-slate-700 uppercase tracking-wider mb-2">New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.password}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Minimum 6 characters"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-base"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-base font-bold text-slate-700 uppercase tracking-wider mb-2">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    placeholder="Re-type password"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-base"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {mustCompleteDeclaration && (
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="flex-1 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition text-base"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 text-base disabled:opacity-50"
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
                            <h2 className="text-xl font-black text-[#1e1b4b]">Review Profile & Sign Declaration</h2>
                            <p className="text-sm text-slate-500">Please audit the details entered by HR and execute your digital signature.</p>
                        </div>

                        <div className="flex justify-end mb-2">
                            <button
                                type="button"
                                onClick={() => setIsEditing(!isEditing)}
                                className="px-4 py-2 text-sm font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition flex items-center gap-1.5 border border-indigo-100 shadow-sm"
                            >
                                {isEditing ? (
                                    <>
                                        <LuEye size={14} /> View / Verify Details
                                    </>
                                ) : (
                                    <>
                                        <LuUser size={14} /> Edit Profile Details
                                    </>
                                )}
                            </button>
                        </div>

                        {auditLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="text-sm text-slate-500">Fetching audit profile details...</p>
                            </div>
                        ) : auditData ? (
                            <form onSubmit={handleDeclarationSubmit} className="space-y-6">
                                {declarationError && (
                                    <div className="bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-r-xl">
                                        <p className="text-rose-700 text-sm font-bold flex items-center gap-1.5"><LuShieldAlert size={14} /> {declarationError}</p>
                                    </div>
                                )}

                                {/* Scrollable dossier details */}
                                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 border border-slate-100 p-4 rounded-2xl bg-slate-50/30 shadow-inner">
                                    {isEditing ? (
                                        <div className="space-y-6">
                                            {/* Basic Credentials */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">System Account & Identity</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">First Name <span className="text-red-500 font-bold">*</span></label>
                                                        <input type="text" name="firstname" value={editForm.firstname} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" required />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Last Name <span className="text-red-500 font-bold">*</span></label>
                                                        <input type="text" name="lastname" value={editForm.lastname} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" required />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Gender <span className="text-red-500 font-bold">*</span></label>
                                                        <select name="gender" value={editForm.gender} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" required>
                                                            <option value="">Select Gender</option>
                                                            <option value="Male">Male</option>
                                                            <option value="Female">Female</option>
                                                            <option value="Transgender">Transgender</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Personal Details */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Personal Details</h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Date of Birth <span className="text-red-500 font-bold">*</span></label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                name="date_of_birth"
                                                                placeholder={getDateInputPlaceholder()}
                                                                value={dobDisplay}
                                                                onChange={handleDobChange}
                                                                className={`w-full pr-8 px-4 py-2.5 text-base rounded-xl border ${errors.date_of_birth ? 'border-red-500' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50`}
                                                                required
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => dobPickerRef.current && dobPickerRef.current.showPicker()}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 focus:outline-none transition-colors"
                                                                title="Choose date"
                                                            >
                                                                <LuCalendar className="w-4 h-4" />
                                                            </button>
                                                            <input
                                                                type="date"
                                                                ref={dobPickerRef}
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        const displayVal = isoToDisplayDate(e.target.value);
                                                                        handleDobChange({ target: { value: displayVal } });
                                                                    }
                                                                }}
                                                                style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
                                                            />
                                                        </div>
                                                        {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Age</label>
                                                        <input type="text" name="age" value={editForm.age} disabled className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Birthplace</label>
                                                        <input type="text" name="birthplace" value={editForm.birthplace} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Blood Group</label>
                                                        <input type="text" name="blood_group" value={editForm.blood_group} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Height & Weight</label>
                                                        <input type="text" name="height_weight" placeholder="e.g. 170cm / 60kg" value={editForm.height_weight} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Marital Status</label>
                                                        <select name="marital_status" value={editForm.marital_status} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50">
                                                            <option value="Single">Single</option>
                                                            <option value="Married">Married</option>
                                                            <option value="Divorced">Divorced</option>
                                                            <option value="Widowed">Widowed</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">No. of Children</label>
                                                        <input type="number" name="no_of_children" value={editForm.no_of_children} disabled={editForm.marital_status === 'Single'} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 bg-slate-50/50" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Nationality</label>
                                                        <input type="text" name="nationality" value={editForm.nationality} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Religion</label>
                                                        <input type="text" name="religion" value={editForm.religion} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                    <div className="col-span-2 sm:col-span-3">
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Hobbies</label>
                                                        <textarea name="hobbies" rows="2" value={editForm.hobbies} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-4 border-t border-slate-100 pt-3">
                                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5 select-none cursor-pointer">
                                                        <input type="checkbox" name="has_disability" checked={editForm.has_disability} onChange={handleInputChange} className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                                                        Declare any Disability?
                                                    </label>
                                                    <textarea name="disability_details" rows="2" disabled={!editForm.has_disability} placeholder={editForm.has_disability ? "Describe disability details..." : "No disability declared"} value={editForm.disability_details} onChange={handleInputChange} className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 mt-1 bg-slate-50/50" />
                                                </div>
                                            </div>

                                            {/* Addresses */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider">Addresses & Contact Details</h3>
                                                    <button type="button" onClick={copyAddress} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold border border-indigo-200 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition">Copy Present to Permanent</button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-black text-indigo-500 uppercase">Present Address</h4>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Full Address</label>
                                                            <textarea name="present_address" rows="2" value={editForm.present_address} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Local Contact No.</label>
                                                            <input type="text" name="present_contact_no" value={editForm.present_contact_no} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-black text-indigo-500 uppercase">Permanent Address</h4>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Full Address</label>
                                                            <textarea name="permanent_address" rows="2" value={editForm.permanent_address} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Permanent Contact No.</label>
                                                            <input type="text" name="permanent_contact_no" value={editForm.permanent_contact_no} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Parental Profiles */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Parental Profiles</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 space-y-2">
                                                        <p className="font-bold text-slate-600 text-xs uppercase">Father's Details</p>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
                                                            <input type="text" name="father_name" value={editForm.father_name} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">Age</label>
                                                                <input type="number" name="father_age" value={editForm.father_age} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">Occupation</label>
                                                                <input type="text" name="father_occupation" value={editForm.father_occupation} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 space-y-2">
                                                        <p className="font-bold text-slate-600 text-xs uppercase">Mother's Details</p>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Maiden Name</label>
                                                            <input type="text" name="mother_name" value={editForm.mother_name} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">Age</label>
                                                                <input type="number" name="mother_age" value={editForm.mother_age} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">Occupation</label>
                                                                <input type="text" name="mother_occupation" value={editForm.mother_occupation} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Academic Qualifications */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider">Academic Qualifications</h3>
                                                    <button type="button" onClick={addEducation} className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-lg flex items-center gap-1"><LuPlus /> Add Qualification</button>
                                                </div>
                                                {editEducations.map((edu, idx) => (
                                                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2 p-2 border border-slate-50 bg-slate-50/50 rounded-lg relative items-end">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Qualification</label>
                                                            <input type="text" placeholder="Degree / Diploma" value={edu.qualification} onChange={(e) => updateEducation(idx, 'qualification', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" required />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Specialization</label>
                                                            <input type="text" placeholder="Major" value={edu.specialization || ''} onChange={(e) => updateEducation(idx, 'specialization', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Grade / GPA</label>
                                                            <input type="text" placeholder="Grade" value={edu.grade || ''} onChange={(e) => updateEducation(idx, 'grade', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                        </div>
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">Completion Year</label>
                                                                <input type="number" placeholder="YYYY" value={edu.year_of_completion || ''} onChange={(e) => updateEducation(idx, 'year_of_completion', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                            </div>
                                                            <button type="button" onClick={() => removeEducation(idx)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg mt-4 transition"><LuTrash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {editEducations.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No educational history. Click add to declare.</p>}
                                            </div>

                                            {/* Siblings Registry */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider">Siblings Registry</h3>
                                                    <button type="button" onClick={addFamily} className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-lg flex items-center gap-1"><LuPlus /> Add Sibling</button>
                                                </div>
                                                {editFamilyMembers.map((sibling, idx) => (
                                                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-2 p-2 border border-slate-50 bg-slate-50/50 rounded-lg relative items-end">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Name</label>
                                                            <input type="text" placeholder="Full Name" value={sibling.name} onChange={(e) => updateFamily(idx, 'name', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" required />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Relationship</label>
                                                            <input type="text" placeholder="Brother / Sister" value={sibling.relationship} onChange={(e) => updateFamily(idx, 'relationship', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" required />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Education</label>
                                                            <input type="text" placeholder="Education" value={sibling.education || sibling.educational_status || ''} onChange={(e) => updateFamily(idx, 'education', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Occupation</label>
                                                            <input type="text" placeholder="Occupation" value={sibling.work_occupation || sibling.work_status || ''} onChange={(e) => updateFamily(idx, 'work_occupation', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                        </div>
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">Marital Status</label>
                                                                <select value={sibling.marital_status || 'Single'} onChange={(e) => updateFamily(idx, 'marital_status', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none">
                                                                    <option value="Single">Single</option>
                                                                    <option value="Married">Married</option>
                                                                </select>
                                                            </div>
                                                            <button type="button" onClick={() => removeFamily(idx)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg mt-4 transition"><LuTrash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {editFamilyMembers.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No sibling records. Click add to declare.</p>}
                                            </div>

                                            {/* Past Work History */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider">Past Work History</h3>
                                                    <button type="button" onClick={addExperience} className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-lg flex items-center gap-1"><LuPlus /> Add Past Job</button>
                                                </div>
                                                {editExperiences.map((exp, idx) => (
                                                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-2 p-2 border border-slate-50 bg-slate-50/50 rounded-lg relative items-end">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Company</label>
                                                            <input type="text" placeholder="Company Name" value={exp.company_name} onChange={(e) => updateExperience(idx, 'company_name', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" required />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">City</label>
                                                            <input type="text" placeholder="City" value={exp.city || ''} onChange={(e) => updateExperience(idx, 'city', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Post Held</label>
                                                            <input type="text" placeholder="Designation" value={exp.post_held} onChange={(e) => updateExperience(idx, 'post_held', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" required />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Tenure</label>
                                                            <input type="text" placeholder="e.g. 2 years" value={exp.tenure || ''} onChange={(e) => updateExperience(idx, 'tenure', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                        </div>
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">Reference Contact</label>
                                                                <input type="text" placeholder="Name/Phone" value={exp.reference_contact || ''} onChange={(e) => updateExperience(idx, 'reference_contact', e.target.value)} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 bg-white focus:outline-none" />
                                                            </div>
                                                            <button type="button" onClick={() => removeExperience(idx)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg mt-4 transition"><LuTrash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {editExperiences.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No past work history. Click add to declare.</p>}
                                            </div>

                                            {/* Bank Coordinates */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Bank Details (for Payroll Deposits)</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Account Number</label>
                                                        <input type="text" name="bank_account_number" value={editForm.bank_account_number} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">IFSC Code</label>
                                                        <input type="text" name="bank_ifsc_code" value={editForm.bank_ifsc_code} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1.5">Bank Name & Branch Address</label>
                                                        <textarea name="bank_name_address" rows="2" value={editForm.bank_name_address} onChange={handleInputChange} className="w-full px-4 py-2.5 text-base rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* Basic Credentials */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">System Account & Identity</h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-base font-semibold text-slate-700">
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Name</p><p className="mt-0.5">{editForm.firstname} {editForm.lastname}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</p><p className="mt-0.5">{auditData.email}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Gender</p><p className="mt-0.5">{editForm.gender || '—'}</p></div>
                                                </div>
                                            </div>

                                            {/* Personal Details */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Personal Details</h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-base font-semibold text-slate-700">
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date of Birth</p><p className="mt-0.5">{editForm.date_of_birth ? formatDateOnly(editForm.date_of_birth) : '—'}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Age</p><p className="mt-0.5">{editForm.age ? `${editForm.age} years` : '—'}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Birthplace</p><p className="mt-0.5">{editForm.birthplace || '—'}</p></div>
                                                    
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Blood Group</p><p className="mt-0.5">{editForm.blood_group || '—'}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Height & Weight</p><p className="mt-0.5">{editForm.height_weight || '—'}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Marital Status</p><p className="mt-0.5">{editForm.marital_status || 'Single'}</p></div>
                                                    
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">No. of Children</p><p className="mt-0.5">{editForm.no_of_children || 0}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nationality</p><p className="mt-0.5">{editForm.nationality || 'Indian'}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Religion</p><p className="mt-0.5">{editForm.religion || '—'}</p></div>
                                                    
                                                    <div className="col-span-2 sm:col-span-3"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Hobbies</p><p className="mt-0.5 whitespace-pre-wrap">{editForm.hobbies || '—'}</p></div>
                                                    
                                                    {editForm.has_disability && (
                                                        <div className="col-span-2 sm:col-span-3 p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-sm text-rose-800">
                                                            <p className="font-bold">Disability Details:</p>
                                                            <p className="mt-1 font-medium">{editForm.disability_details}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Addresses */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                    <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-3">Present Address</h3>
                                                    <p className="whitespace-pre-wrap">{editForm.present_address || '—'}</p>
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Local Contact No: <span className="text-slate-700 font-bold ml-0.5 text-base">{editForm.present_contact_no || '—'}</span></p>
                                                </div>
                                                <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                    <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-2">Permanent Address</h3>
                                                    <p className="whitespace-pre-wrap">{editForm.permanent_address || '—'}</p>
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Permanent Contact No: <span className="text-slate-700 font-bold ml-0.5 text-base">{editForm.permanent_contact_no || '—'}</span></p>
                                                </div>
                                            </div>

                                            {/* Parental Profiles */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Parental Profiles</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                                    <div className="space-y-2">
                                                        <p className="font-bold text-indigo-500 text-xs uppercase tracking-wider">Father's Record</p>
                                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                                            <div className="col-span-2"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</p><p className="mt-0.5">{editForm.father_name || '—'}</p></div>
                                                            <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Age</p><p className="mt-0.5">{editForm.father_age ? `${editForm.father_age} yrs` : '—'}</p></div>
                                                            <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Occupation</p><p className="mt-0.5">{editForm.father_occupation || '—'}</p></div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 pt-4 md:pt-0 md:pl-6">
                                                        <p className="font-bold text-indigo-500 text-xs uppercase tracking-wider">Mother's Record</p>
                                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                                            <div className="col-span-2"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Maiden Name</p><p className="mt-0.5">{editForm.mother_name || '—'}</p></div>
                                                            <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Age</p><p className="mt-0.5">{editForm.mother_age ? `${editForm.mother_age} yrs` : '—'}</p></div>
                                                            <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Occupation</p><p className="mt-0.5">{editForm.mother_occupation || '—'}</p></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Academic Qualifications */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Academic Qualifications</h3>
                                                {(!editEducations || editEducations.length === 0) ? (
                                                    <p className="text-sm text-slate-400">No educational background added.</p>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full divide-y divide-slate-100 text-base font-semibold text-slate-700">
                                                            <thead>
                                                                <tr>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Qualification</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Specialization</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Grade</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Completion Year</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {editEducations.map((edu, i) => (
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
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Siblings Registry</h3>
                                                {(!editFamilyMembers || editFamilyMembers.length === 0) ? (
                                                    <p className="text-sm text-slate-400">No sibling records added.</p>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full divide-y divide-slate-100 text-base font-semibold text-slate-700">
                                                            <thead>
                                                                <tr>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Name</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Relationship</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Education</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Occupation</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Marital Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {editFamilyMembers.map((sibling, i) => (
                                                                    <tr key={i}>
                                                                        <td className="py-2">{sibling.name}</td>
                                                                        <td className="py-2">{sibling.relationship || '—'}</td>
                                                                        <td className="py-2">{sibling.education || sibling.educational_status || '—'}</td>
                                                                        <td className="py-2">{sibling.work_occupation || sibling.work_status || '—'}</td>
                                                                        <td className="py-2">{sibling.marital_status || 'Single'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Past Work History */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Past Work History</h3>
                                                {(!editExperiences || editExperiences.length === 0) ? (
                                                    <p className="text-sm text-slate-400">No previous job history added.</p>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full divide-y divide-slate-100 text-base font-semibold text-slate-700">
                                                            <thead>
                                                                <tr>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Company</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">City</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Post Held</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Department</th>
                                                                    <th className="text-left py-1 text-xs font-bold uppercase text-slate-500 tracking-wider">Tenure</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {editExperiences.map((exp, i) => (
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
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Bank coordinates (for Payroll Deposits)</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Account Number</p><p className="mt-0.5">{editForm.bank_account_number || '—'}</p></div>
                                                    <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">IFSC Code</p><p className="mt-0.5">{editForm.bank_ifsc_code || '—'}</p></div>
                                                    <div className="col-span-2"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bank Name & Branch Address</p><p className="mt-0.5">{editForm.bank_name_address || '—'}</p></div>
                                                </div>
                                            </div>

                                            {/* Uploaded Onboarding Attachments with Secure Download query params */}
                                            <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm text-base font-semibold text-slate-700">
                                                <h3 className="text-base font-black text-indigo-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Uploaded Onboarding Attachments</h3>
                                                {(!auditData.documents || auditData.documents.length === 0) ? (
                                                    <p className="text-sm text-slate-400">No attachments uploaded by HR.</p>
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
                                    )}
                                </div>

                                {isEditing && (
                                    <div className="flex justify-end mt-4">
                                        <button
                                            type="button"
                                            onClick={handleSaveProfileOnly}
                                            disabled={loading}
                                            className="px-8 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50 text-sm uppercase tracking-wider"
                                        >
                                            {loading ? 'Saving details...' : 'Save Profile Details'}
                                        </button>
                                    </div>
                                )}

                                {/* INTEGRATED DECLARATION SIGN-OFF & SIGNATURE CANVAS */}
                                <div className="space-y-6 pt-4 border-t border-slate-100">
                                    {/* Legal Declaration Statement Box */}
                                    <div className="p-5 bg-[#faf5ff] border border-[#f3e8ff] text-purple-900 rounded-2xl text-sm leading-relaxed space-y-3 shadow-inner max-h-[160px] overflow-y-auto">
                                        <p className="font-black text-sm uppercase tracking-wider text-[#6b21a8] border-b border-[#f3e8ff] pb-1.5">Employment Sign-off Declaration</p>
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
                                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Draw Digital Signature <span className="text-red-500 font-bold">*</span></label>
                                            <button
                                                type="button"
                                                onClick={clearCanvas}
                                                className="text-slate-500 hover:text-rose-600 text-sm font-bold flex items-center gap-1 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition"
                                            >
                                                <LuUndo2 size={12} /> Clear Drawing
                                            </button>
                                        </div>
                                        <div className="border border-slate-200 rounded-2xl bg-slate-50 p-2 shadow-inner">
                                            <canvas
                                                ref={canvasRef}
                                                width={700}
                                                height={240}
                                                onMouseDown={startDrawing}
                                                onMouseMove={draw}
                                                onMouseUp={stopDrawing}
                                                onMouseLeave={stopDrawing}
                                                onTouchStart={startDrawing}
                                                onTouchMove={draw}
                                                onTouchEnd={stopDrawing}
                                                className="w-full h-[240px] bg-white rounded-xl shadow-inner border border-slate-100 cursor-crosshair touch-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Full Sign-off Name <span className="text-red-500 font-bold">*</span></label>
                                            <input
                                                type="text"
                                                value={declarationData.signature_name}
                                                onChange={(e) => setDeclarationData(prev => ({ ...prev, signature_name: e.target.value }))}
                                                placeholder="Type your official full name"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-base"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Signing Location / Place <span className="text-red-500 font-bold">*</span></label>
                                            <input
                                                type="text"
                                                value={declarationData.onboarding_place}
                                                onChange={(e) => setDeclarationData(prev => ({ ...prev, onboarding_place: e.target.value }))}
                                                placeholder="e.g. Chennai, Bangalore"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-base"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Consent Checkbox */}
                                    <label className="flex items-start gap-2.5 p-4 border border-indigo-100 bg-indigo-50/20 rounded-xl text-slate-700 text-sm font-semibold cursor-pointer select-none">
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
                                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50 text-base"
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
                            <p className="text-center text-sm text-rose-500 font-bold">Failed to load audit profile. Refresh page.</p>
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

            {/* DOB Required Modal */}
            {showDobModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-modal-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center border border-slate-100">
                        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-rose-50/50">
                            <LuShieldAlert size={42} />
                        </div>
                        <h3 className="text-2xl font-black text-[#1e1b4b] mb-2 uppercase tracking-tighter">Date of Birth Required</h3>
                        <p className="text-slate-500 mb-6 leading-relaxed text-sm">
                            A valid Date of Birth is required to complete your declaration and set your password. 
                            <br /><br />
                            Please click the button below to open edit mode and update your Date of Birth.
                        </p>
                        <button
                            onClick={handleResolveDob}
                            className="w-full py-4 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 transition-all text-xs uppercase tracking-widest shadow-lg shadow-rose-200"
                        >
                            Update Date of Birth
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FirstTimeLoginFlow;
