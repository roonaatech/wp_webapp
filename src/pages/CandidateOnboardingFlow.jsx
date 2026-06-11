import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuUser, LuContact, LuGraduationCap, LuFileText, LuSave, LuUndo2, LuFileUp, LuCoins, LuCheck, LuPlus, LuTrash2, LuShieldAlert } from "react-icons/lu";
import API_BASE_URL from '../config/api.config';

const TABS = [
    { id: 'personal', name: 'Personal Details', icon: <LuContact /> },
    { id: 'education', name: 'Education & Jobs', icon: <LuGraduationCap /> },
    { id: 'bank', name: 'Bank & Uploads', icon: <LuCoins /> },
    { id: 'declaration', name: 'Declaration & Sign', icon: <LuFileText /> }
];

const getAppDateFormat = () => {
    return localStorage.getItem('system_date_format') || 'DD/MM/YYYY';
};

const CandidateOnboardingFlow = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [validToken, setValidToken] = useState(false);
    const [candidateData, setCandidateData] = useState(null);

    const [activeTab, setActiveTab] = useState('personal');
    const [errors, setErrors] = useState({});
    const [dobDisplay, setDobDisplay] = useState('');

    // Forms
    const [formData, setFormData] = useState({
        firstname: '', lastname: '', email: '', gender: '',
        date_of_birth: '', age: '', birthplace: '', blood_group: '', height_weight: '',
        nationality: 'Indian', religion: '', marital_status: 'Single', no_of_children: 0,
        hobbies: '', present_address: '', permanent_address: '', present_contact_no: '',
        permanent_contact_no: '', has_disability: false, disability_details: '',
        father_name: '', father_age: '', father_occupation: '', father_work_status: 'Working', mother_name: '', mother_age: '', mother_occupation: '',
        bank_account_number: '', bank_ifsc_code: '', bank_name_address: '',
        consent_given: false, signature_name: '', onboarding_place: '', signature_data: ''
    });

    const [educations, setEducations] = useState([]);
    const [familyMembers, setFamilyMembers] = useState([]);
    const [experiences, setExperiences] = useState([]);
    const [files, setFiles] = useState({});
    const [hasDraft, setHasDraft] = useState(false);

    useEffect(() => {
        if (token) {
            const savedDraft = localStorage.getItem(`wp_candidate_onboarding_draft_${token}`);
            if (savedDraft) {
                setHasDraft(true);
            }
        }
    }, [token]);

    const saveLocalDraft = () => {
        try {
            const draftData = {
                formData,
                educations,
                experiences,
                familyMembers,
                dobDisplay
            };
            localStorage.setItem(`wp_candidate_onboarding_draft_${token}`, JSON.stringify(draftData));
            toast.success('Onboarding draft saved successfully!');
            setHasDraft(true);
        } catch (e) {
            console.error('Error saving draft:', e);
            toast.error('Failed to save draft locally.');
        }
    };

    const restoreDraft = () => {
        try {
            const savedDraft = localStorage.getItem(`wp_candidate_onboarding_draft_${token}`);
            if (savedDraft) {
                const { formData: savedForm, educations: savedEdu, experiences: savedExp, familyMembers: savedFam, dobDisplay: savedDobDisplay } = JSON.parse(savedDraft);
                
                setFormData(prev => ({
                    ...prev,
                    ...savedForm,
                    firstname: prev.firstname || savedForm.firstname,
                    lastname: prev.lastname || savedForm.lastname,
                    email: prev.email || savedForm.email,
                    gender: prev.gender || savedForm.gender
                }));

                if (savedEdu) setEducations(savedEdu);
                if (savedExp) setExperiences(savedExp);
                if (savedFam) setFamilyMembers(savedFam);
                if (savedDobDisplay) setDobDisplay(savedDobDisplay);

                toast.success('Onboarding draft successfully restored!');
            }
        } catch (e) {
            console.error('Error restoring draft:', e);
            toast.error('Failed to restore draft.');
        } finally {
            setHasDraft(false);
        }
    };

    const clearDraft = () => {
        localStorage.removeItem(`wp_candidate_onboarding_draft_${token}`);
        setHasDraft(false);
        toast.success('Draft discarded.');
    };

    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (!token) {
            setFetching(false);
            return;
        }
        fetchCandidate();
    }, [token]);

    const fetchCandidate = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/onboarding/candidate/${token}`);
            setCandidateData(response.data);
            setFormData(prev => ({
                ...prev,
                firstname: response.data.firstname || '',
                lastname: response.data.lastname || '',
                email: response.data.email || '',
                gender: response.data.gender || '',
                signature_name: `${response.data.firstname || ''} ${response.data.lastname || ''}`.trim()
            }));
            setValidToken(true);
        } catch (err) {
            console.error('Error fetching candidate:', err);
            toast.error(err.response?.data?.message || 'Invalid or Expired Token');
        } finally {
            setFetching(false);
        }
    };

    // Signature Canvas Handlers
    useEffect(() => {
        if (activeTab === 'declaration' && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#1e1b4b';
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, [activeTab]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
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

    const copyAddress = () => {
        setFormData(prev => ({
            ...prev,
            permanent_address: prev.present_address,
            permanent_contact_no: prev.present_contact_no
        }));
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
        if (errors[name]) {
            setErrors({ ...errors, [name]: '' });
        }
    };

    const handleDobChange = (e) => {
        let val = e.target.value;
        
        // Remove all non-digits
        let digits = val.replace(/\D/g, '');
        if (digits.length > 8) digits = digits.substring(0, 8);
        
        let formatted = digits;
        if (digits.length > 2 && digits.length <= 4) {
            formatted = `${digits.substring(0, 2)}/${digits.substring(2)}`;
        } else if (digits.length > 4) {
            formatted = `${digits.substring(0, 2)}/${digits.substring(2, 4)}/${digits.substring(4)}`;
        }
        
        setDobDisplay(formatted);

        let parsed = '';
        let dobError = null;

        // Instant realistic validation
        if (formatted.length >= 2) {
            const day = parseInt(formatted.substring(0, 2), 10);
            if (day < 1 || day > 31) {
                dobError = "Day must be between 01 and 31";
            }
        }
        if (!dobError && formatted.length >= 5) {
            const month = parseInt(formatted.substring(3, 5), 10);
            if (month < 1 || month > 12) {
                dobError = "Month must be between 01 and 12";
            }
        }
        if (!dobError && formatted.length === 10) {
            const parts = formatted.split('/');
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            
            const currentYear = new Date().getFullYear();
            if (y < 1900) {
                dobError = "Year must be 1900 or later";
            } else if (y > currentYear) {
                dobError = "Date of birth cannot be in the future";
            } else {
                const daysInMonth = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                if (d > daysInMonth[m - 1]) {
                    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    dobError = `${monthNames[m - 1]} ${y} only has ${daysInMonth[m - 1]} days`;
                } else {
                    const dateObj = new Date(y, m - 1, d);
                    const today = new Date();
                    if (dateObj > today) {
                        dobError = "Date of birth cannot be in the future";
                    } else if (today.getFullYear() - y > 120) {
                        dobError = "Please enter a realistic year";
                    } else {
                        parsed = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                    }
                }
            }
        }

        if (dobError) {
            setErrors(prev => ({ ...prev, date_of_birth: dobError }));
            setFormData(prev => ({
                ...prev,
                date_of_birth: '',
                age: ''
            }));
        } else if (formatted.length === 10 && parsed) {
            let calculatedAge = '';
            const birthDate = new Date(parsed);
            const today = new Date();
            let ageVal = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                ageVal--;
            }
            calculatedAge = ageVal >= 0 ? ageVal : '';

            setFormData(prev => ({
                ...prev,
                date_of_birth: parsed,
                age: calculatedAge
            }));

            setErrors(prev => {
                const updated = { ...prev };
                delete updated.date_of_birth;
                return updated;
            });
        } else {
            setFormData(prev => ({
                ...prev,
                date_of_birth: '',
                age: ''
            }));
            
            if (formatted.length < 10) {
                setErrors(prev => {
                    const updated = { ...prev };
                    if (updated.date_of_birth && (
                        updated.date_of_birth.includes("only has") || 
                        updated.date_of_birth.includes("future") || 
                        updated.date_of_birth.includes("realistic year") ||
                        updated.date_of_birth.includes("1900 or later")
                    )) {
                        delete updated.date_of_birth;
                    }
                    return updated;
                });
            }
        }
    };

    const handleFileChange = (e, docKey) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error('File size should not exceed 10MB');
                return;
            }
            setFiles(prev => ({ ...prev, [docKey]: file }));
        }
    };

    // Array Adders
    const addEducation = () => setEducations([...educations, { qualification: '', specialization: '', grade: '', year_of_completion: '' }]);
    const updateEducation = (index, field, value) => {
        const newArr = [...educations];
        newArr[index][field] = value;
        setEducations(newArr);
    };
    const removeEducation = (index) => setEducations(educations.filter((_, i) => i !== index));

    const addFamily = () => setFamilyMembers([...familyMembers, { name: '', relationship: '', education: '', work_occupation: '', marital_status: '' }]);
    const updateFamily = (index, field, value) => {
        const newFam = [...familyMembers];
        newFam[index][field] = value;
        setFamilyMembers(newFam);
    };
    const removeFamily = (index) => setFamilyMembers(familyMembers.filter((_, i) => i !== index));

    const addExperience = () => setExperiences([...experiences, { company_name: '', city: '', post_held: '', tenure: '', reference_contact: '' }]);
    const updateExperience = (index, field, value) => {
        const newArr = [...experiences];
        newArr[index][field] = value;
        setExperiences(newArr);
    };
    const removeExperience = (index) => setExperiences(experiences.filter((_, i) => i !== index));

    const validateAll = () => {
        const newErrors = {};

        // Personal tab fields
        if (!formData.firstname?.trim()) newErrors.firstname = 'First name is required';
        if (!formData.lastname?.trim()) newErrors.lastname = 'Last name is required';
        if (!formData.gender) newErrors.gender = 'Gender selection is required';
        if (!formData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required (format: dd/mm/yyyy)';

        // Declaration Tab
        if (activeTab === 'declaration') {
            if (!formData.consent_given) newErrors.consent_given = 'You must check the consent box to continue.';
            if (!formData.signature_name?.trim()) newErrors.signature_name = 'Please type in your full signature name.';
            if (!formData.onboarding_place?.trim()) newErrors.onboarding_place = 'Please enter your signing location/place.';

            const canvas = canvasRef.current;
            if (canvas) {
                const blank = document.createElement('canvas');
                blank.width = canvas.width;
                blank.height = canvas.height;
                if (canvas.toDataURL() === blank.toDataURL()) {
                    newErrors.signature_data = 'Please draw your digital signature on the canvas pad.';
                }
            }
        }

        setErrors(newErrors);
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationErrors = validateAll();
        if (Object.keys(validationErrors).length > 0) {
            if (validationErrors.firstname || validationErrors.lastname || validationErrors.gender || validationErrors.date_of_birth) {
                setActiveTab('personal');
            } else if (validationErrors.signature_name || validationErrors.onboarding_place || validationErrors.consent_given || validationErrors.signature_data) {
                setActiveTab('declaration');
            }
            return;
        }

        setLoading(true);

        try {
            const uploadPayload = new FormData();

            // Append all standard text fields
            Object.keys(formData).forEach(key => {
                if (key !== 'signature_data') {
                    uploadPayload.append(key, formData[key]);
                }
            });

            // Extract signature
            const canvas = canvasRef.current;
            if (canvas) {
                uploadPayload.append('signature_data', canvas.toDataURL('image/png'));
            }

            uploadPayload.append('educations', JSON.stringify(educations));
            uploadPayload.append('experiences', JSON.stringify(experiences));
            uploadPayload.append('family_members', JSON.stringify(familyMembers));

            Object.keys(files).forEach(key => {
                if (files[key]) {
                    uploadPayload.append(`doc_${key}`, files[key]);
                }
            });

            const response = await axios.post(`${API_BASE_URL}/api/onboarding/candidate/${token}/submit`, uploadPayload);
            localStorage.removeItem(`wp_candidate_onboarding_draft_${token}`);
            toast.success(response.data.message || 'Onboarding form submitted successfully!');
            navigate('/login');

        } catch (err) {
            console.error('Error submitting candidate form:', err);
            let errMsg = 'Error occurred during submission.';
            if (err.response?.data?.message) {
                errMsg = err.response.data.message;
            }
            toast.error(errMsg, { duration: 6000 });
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!validToken) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-md text-center max-w-sm w-full">
                    <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LuShieldAlert size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Invalid Session</h2>
                    <p className="text-sm text-slate-500 mb-6">The onboarding link provided is invalid, expired, or has already been submitted.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
            <div className="max-w-7xl mx-auto pb-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[#1e1b4b] tracking-tight">
                            Complete Your Onboarding Profile
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Welcome! Please fill in your joining details to initiate your employment profile.
                        </p>
                    </div>
                </div>

                {hasDraft && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl mt-0.5">
                                <LuShieldAlert size={20} />
                            </span>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Unsaved Progress Found</h3>
                                <p className="text-xs text-slate-500">We found a local draft of your onboarding details from a previous session.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={restoreDraft}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                            >
                                Restore Draft
                            </button>
                            <button
                                type="button"
                                onClick={clearDraft}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white/40 backdrop-blur-md border border-slate-200/80 rounded-2xl p-2.5 mb-8 shadow-sm flex flex-wrap gap-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300
                                ${activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                    : 'text-slate-600 hover:bg-white/60 hover:text-indigo-600'
                                }
                            `}
                        >
                            <span className="text-base">{tab.icon}</span>
                            {tab.name}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-md">
                    {/* 1. PERSONAL TAB */}
                    {activeTab === 'personal' && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4 mb-4">
                                <h2 className="text-lg font-black text-[#1e1b4b]">Personal Details</h2>
                                <p className="text-xs text-slate-400">Basic identification and personal backgrounds.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">First Name <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                    <input type="text" name="firstname" value={formData.firstname} onChange={handleInputChange} className={`w-full px-4 py-3 rounded-xl border ${errors.firstname ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`} />
                                    {errors.firstname && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.firstname}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Last Name <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                    <input type="text" name="lastname" value={formData.lastname} onChange={handleInputChange} className={`w-full px-4 py-3 rounded-xl border ${errors.lastname ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`} />
                                    {errors.lastname && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.lastname}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Gender <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                    <select name="gender" value={formData.gender} onChange={handleInputChange} className={`w-full px-4 py-3 rounded-xl border ${errors.gender ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}>
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Transgender">Transgender</option>
                                    </select>
                                    {errors.gender && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.gender}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Birthplace</label>
                                    <input type="text" name="birthplace" value={formData.birthplace} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Height / Weight</label>
                                    <input type="text" name="height_weight" placeholder="e.g. 170 cm / 60 kg" value={formData.height_weight} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Blood Group</label>
                                    <input type="text" name="blood_group" placeholder="e.g. O+" value={formData.blood_group} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Date of Birth <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                    <input type="text" name="date_of_birth" placeholder="dd/mm/yyyy" value={dobDisplay} onChange={handleDobChange} className={`w-full px-4 py-3 rounded-xl border ${errors.date_of_birth ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`} />
                                    {errors.date_of_birth && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.date_of_birth}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Age</label>
                                    <input type="number" name="age" value={formData.age} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Marital Status</label>
                                    <select name="marital_status" value={formData.marital_status} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50">
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Divorced">Divorced</option>
                                        <option value="Widowed">Widowed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">No. of Children</label>
                                    <input type="number" name="no_of_children" disabled={formData.marital_status === 'Single'} value={formData.no_of_children} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 disabled:opacity-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Nationality</label>
                                    <input type="text" name="nationality" value={formData.nationality} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Religion</label>
                                    <input type="text" name="religion" value={formData.religion} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Hobbies</label>
                                    <textarea name="hobbies" rows="2" value={formData.hobbies} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 select-none">
                                        <input type="checkbox" name="has_disability" checked={formData.has_disability} onChange={handleInputChange} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                                        Declare any Disability?
                                    </label>
                                    <textarea name="disability_details" rows="2" disabled={!formData.has_disability} placeholder={formData.has_disability ? "Describe disability details..." : "Disabled"} value={formData.disability_details} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 disabled:opacity-50" />
                                </div>
                            </div>

                            {/* Addresses */}
                            <div className="border-t border-slate-100 pt-6 mt-8">
                                <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-center">
                                    <h3 className="text-md font-bold text-[#1e1b4b]">Addresses & Contacts</h3>
                                    <button type="button" onClick={copyAddress} className="text-xs text-indigo-600 hover:text-white border border-indigo-200 hover:bg-indigo-600 px-3 py-1.5 rounded-lg transition">Copy Present to Permanent</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider">Present Address</h4>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Full Address</label>
                                            <textarea name="present_address" rows="3" value={formData.present_address} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Local Contact No.</label>
                                            <input type="text" name="present_contact_no" value={formData.present_contact_no} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider">Permanent Address</h4>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Full Address</label>
                                            <textarea name="permanent_address" rows="3" value={formData.permanent_address} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Permanent Contact No.</label>
                                            <input type="text" name="permanent_contact_no" value={formData.permanent_contact_no} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Parents Details */}
                            <div className="border-t border-slate-100 pt-6 mt-8">
                                <div className="border-b border-slate-100 pb-4 mb-6">
                                    <h3 className="text-md font-bold text-[#1e1b4b]">Parental Profiles</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/30 space-y-4">
                                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider border-b border-slate-100 pb-2">Father's Details</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="block text-xs text-slate-500 mb-1">Full Name</label>
                                                <input type="text" name="father_name" value={formData.father_name} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">Age</label>
                                                <input type="number" name="father_age" value={formData.father_age} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">Occupation</label>
                                                <input type="text" name="father_occupation" value={formData.father_occupation} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/30 space-y-4">
                                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider border-b border-slate-100 pb-2">Mother's Details</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="block text-xs text-slate-500 mb-1">Maiden Name</label>
                                                <input type="text" name="mother_name" value={formData.mother_name} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">Age</label>
                                                <input type="number" name="mother_age" value={formData.mother_age} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">Occupation</label>
                                                <input type="text" name="mother_occupation" value={formData.mother_occupation} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Family Details */}
                            <div className="border-t border-slate-100 pt-6 mt-8">
                                <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-black text-[#1e1b4b]">Family Details (Brothers / Sisters)</h2>
                                        <p className="text-xs text-slate-400">List dependents / nominees for HR & Insurance records.</p>
                                    </div>
                                    <button type="button" onClick={addFamily} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center gap-1"><LuPlus /> Add Member</button>
                                </div>
                                {familyMembers.map((fam, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50 relative items-center">
                                        <input type="text" placeholder="Full Name" value={fam.name} onChange={(e) => updateFamily(index, 'name', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-3" />
                                        <input type="text" placeholder="Relationship" value={fam.relationship} onChange={(e) => updateFamily(index, 'relationship', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2" />
                                        <input type="text" placeholder="Education" value={fam.education} onChange={(e) => updateFamily(index, 'education', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2" />
                                        <input type="text" placeholder="Occupation" value={fam.work_occupation} onChange={(e) => updateFamily(index, 'work_occupation', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2" />
                                        <select value={fam.marital_status} onChange={(e) => updateFamily(index, 'marital_status', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2">
                                            <option value="">Marital Status</option>
                                            <option value="Single">Single</option>
                                            <option value="Married">Married</option>
                                        </select>
                                        <button type="button" onClick={() => removeFamily(index)} className="text-rose-500 hover:bg-rose-50 hover:text-rose-700 p-2 rounded-lg flex items-center justify-center transition md:col-span-1 md:self-center self-end w-fit ml-auto md:ml-0"><LuTrash2 size={18} /></button>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-slate-100 pt-6 mt-8 flex justify-between items-center">
                                <button type="button" onClick={saveLocalDraft} className="px-6 py-3 border border-indigo-200 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition flex items-center gap-1.5 shadow-sm">
                                    <LuSave size={16} /> Save Draft
                                </button>
                                <button type="button" onClick={() => setActiveTab('education')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition">Next: Education & Jobs</button>
                            </div>
                        </div>
                    )}

                    {/* 2. EDUCATION & EXP TAB */}
                    {activeTab === 'education' && (
                        <div className="space-y-8">
                            <div>
                                <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-black text-[#1e1b4b]">Academic Qualifications</h2>
                                    </div>
                                    <button type="button" onClick={addEducation} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center gap-1"><LuPlus /> Add Record</button>
                                </div>
                                {educations.map((edu, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50 relative items-center">
                                        <input type="text" placeholder="Qualification" value={edu.qualification} onChange={(e) => updateEducation(index, 'qualification', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-3" />
                                        <input type="text" placeholder="Specialization" value={edu.specialization} onChange={(e) => updateEducation(index, 'specialization', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-3" />
                                        <input type="text" placeholder="Grade/Percentage" value={edu.grade} onChange={(e) => updateEducation(index, 'grade', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2" />
                                        <input type="text" placeholder="Year of Completion" value={edu.year_of_completion} onChange={(e) => updateEducation(index, 'year_of_completion', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-3" />
                                        <button type="button" onClick={() => removeEducation(index)} className="text-rose-500 hover:bg-rose-50 hover:text-rose-700 p-2 rounded-lg flex items-center justify-center transition md:col-span-1 md:self-center self-end w-fit ml-auto md:ml-0"><LuTrash2 size={18} /></button>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-black text-[#1e1b4b]">Work Experience</h2>
                                    </div>
                                    <button type="button" onClick={addExperience} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center gap-1"><LuPlus /> Add Record</button>
                                </div>
                                {experiences.map((exp, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50 relative items-center">
                                        <input type="text" placeholder="Company Name" value={exp.company_name} onChange={(e) => updateExperience(index, 'company_name', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-3" />
                                        <input type="text" placeholder="City" value={exp.city} onChange={(e) => updateExperience(index, 'city', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2" />
                                        <input type="text" placeholder="Post Held" value={exp.post_held} onChange={(e) => updateExperience(index, 'post_held', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2" />
                                        <input type="text" placeholder="Tenure (e.g. 2 yrs)" value={exp.tenure} onChange={(e) => updateExperience(index, 'tenure', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2" />
                                        <input type="text" placeholder="Reference Contact" value={exp.reference_contact} onChange={(e) => updateExperience(index, 'reference_contact', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2" />
                                        <button type="button" onClick={() => removeExperience(index)} className="text-rose-500 hover:bg-rose-50 hover:text-rose-700 p-2 rounded-lg flex items-center justify-center transition md:col-span-1 md:self-center self-end w-fit ml-auto md:ml-0"><LuTrash2 size={18} /></button>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-slate-100 pt-6 mt-8 flex justify-between items-center">
                                <button type="button" onClick={() => setActiveTab('personal')} className="px-6 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl transition">Back</button>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={saveLocalDraft} className="px-6 py-3 border border-indigo-200 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition flex items-center gap-1.5 shadow-sm">
                                        <LuSave size={16} /> Save Draft
                                    </button>
                                    <button type="button" onClick={() => setActiveTab('bank')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition">Next: Bank & Uploads</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. BANK & DOCUMENTS TAB */}
                    {activeTab === 'bank' && (
                        <div className="space-y-8">
                            <div>
                                <div className="border-b border-slate-100 pb-4 mb-4">
                                    <h2 className="text-lg font-black text-[#1e1b4b]">Bank Coordinates</h2>
                                    <p className="text-xs text-slate-400">Payroll deposit information.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Bank Account Number</label>
                                        <input type="text" name="bank_account_number" value={formData.bank_account_number} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Bank IFSC Code</label>
                                        <input type="text" name="bank_ifsc_code" value={formData.bank_ifsc_code} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="border-b border-slate-100 pb-4 mb-6">
                                    <h2 className="text-lg font-black text-[#1e1b4b]">Document Submissions</h2>
                                    <p className="text-xs text-slate-400">Upload high quality scanned copies of required certificates (max 10MB per file).</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                        { key: 'class_10', label: 'Copy of Class 10th Certificate' },
                                        { key: 'class_12', label: 'Copy of Class 12th Certificate' },
                                        { key: 'degree', label: 'Copy of Degree or Graduation certificates' },
                                        { key: 'academic', label: 'Copy of other academic certificates' },
                                        { key: 'residence', label: 'Residence Proof (Electricity bill / Passport / Bank passbook)' },
                                        { key: 'identity', label: 'Identity Proof (PAN / DL / Passport)' },
                                        { key: 'pay_slip', label: 'Last 3 month’s pay slip' },
                                        { key: 'relieving', label: 'Relieving letter from previous employers' },
                                        { key: 'experience', label: 'Experience letter from previous employers' },
                                        { key: 'appointment', label: 'Copy of appointment letter from previous employers' },
                                        { key: 'photo', label: 'Passport Size Photograph (Image format)' }
                                    ].map(doc => (
                                        <div key={doc.key} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-slate-100 rounded-xl bg-slate-50/40 hover:bg-slate-50 transition">
                                            <div className="mb-2 sm:mb-0">
                                                <p className="text-sm font-bold text-slate-700">{doc.label}</p>
                                                <p className="text-xs text-slate-400">
                                                    {files[doc.key] ? `Selected: ${files[doc.key].name}` : 'No file chosen'}
                                                </p>
                                            </div>
                                            <label className="cursor-pointer bg-white border hover:bg-indigo-50 border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-sm select-none">
                                                <LuFileUp /> Select File
                                                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleFileChange(e, doc.key)} className="hidden" />
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-6 mt-8 flex justify-between items-center">
                                <button type="button" onClick={() => setActiveTab('education')} className="px-6 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl transition">Back</button>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={saveLocalDraft} className="px-6 py-3 border border-indigo-200 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition flex items-center gap-1.5 shadow-sm">
                                        <LuSave size={16} /> Save Draft
                                    </button>
                                    <button type="button" onClick={() => setActiveTab('declaration')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition">Next: Declaration & Sign</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. DECLARATION TAB */}
                    {activeTab === 'declaration' && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4 mb-4">
                                <h2 className="text-lg font-black text-[#1e1b4b]">Declaration & Digital Signature</h2>
                                <p className="text-xs text-slate-400">Review the legal terms and provide your digital signature.</p>
                            </div>

                            <div className="p-5 bg-[#faf5ff] border border-[#f3e8ff] text-[#581c87] rounded-2xl text-xs leading-relaxed space-y-3 shadow-inner">
                                <p className="font-black text-xs uppercase tracking-wider text-[#6b21a8] border-b border-[#f3e8ff] pb-1.5">Employment Sign-off Declaration</p>
                                <p>I hereby declare that all the information furnished above by me is true, complete, and correct to the best of my knowledge and belief. I understand that if any of the information is found to be false or inaccurate at any stage, the company reserves the absolute right to take disciplinary action up to and including termination of my employment contract immediately without prior notice or compensation.</p>
                                <p>I authorize the HR and administration department to register and maintain these coordinates, execute verification audits on my backgrounds, and configure standard payroll accounts.</p>
                            </div>

                            {errors.signature_data && <p className="text-red-500 text-xs font-semibold">{errors.signature_data}</p>}

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Draw Digital Signature <span className="text-red-500 font-bold">*</span></label>
                                    <button type="button" onClick={clearCanvas} className="text-slate-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition"><LuUndo2 size={12} /> Clear Drawing</button>
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
                                    <input type="text" name="signature_name" value={formData.signature_name} onChange={handleInputChange} className={`w-full px-4 py-3 rounded-xl border ${errors.signature_name ? 'border-red-500' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50`} />
                                    {errors.signature_name && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.signature_name}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Signing Location / Place <span className="text-red-500 font-bold">*</span></label>
                                    <input type="text" name="onboarding_place" value={formData.onboarding_place} onChange={handleInputChange} className={`w-full px-4 py-3 rounded-xl border ${errors.onboarding_place ? 'border-red-500' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50`} />
                                    {errors.onboarding_place && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.onboarding_place}</p>}
                                </div>
                            </div>

                            <label className={`flex items-start gap-2.5 p-4 border ${errors.consent_given ? 'border-red-300 bg-red-50/20' : 'border-indigo-100 bg-indigo-50/20'} rounded-xl text-slate-700 text-xs font-semibold cursor-pointer select-none`}>
                                <input type="checkbox" name="consent_given" checked={formData.consent_given} onChange={handleInputChange} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-0.5" />
                                <div>
                                    <span>I have fully reviewed the pre-filled Extended Joining Form details above, declare them true and accurate, and authorize the digital signature sign-off.</span>
                                    {errors.consent_given && <p className="text-red-500 mt-1">{errors.consent_given}</p>}
                                </div>
                            </label>

                            <div className="border-t border-slate-100 pt-6 mt-8 flex justify-between items-center">
                                <button type="button" onClick={() => setActiveTab('bank')} className="px-6 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl transition">Back</button>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={saveLocalDraft} className="px-6 py-3 border border-indigo-200 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition flex items-center gap-1.5 shadow-sm">
                                        <LuSave size={16} /> Save Draft
                                    </button>
                                    <button type="submit" disabled={loading} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50">
                                        <LuSave size={18} /> {loading ? 'Submitting Form...' : 'Submit Onboarding Form'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default CandidateOnboardingFlow;
