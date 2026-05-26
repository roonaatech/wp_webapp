import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuUser, LuContact, LuGraduationCap, LuCoins, LuFileUp, LuPlus, LuTrash2, LuSave } from "react-icons/lu";
import API_BASE_URL from '../config/api.config';
import { fetchRoles as fetchRolesUtil, getRoleById } from '../utils/roleUtils';
import { getAppDateFormat } from '../utils/timezone.util';

const TABS = [
    { id: 'personal', name: 'Personal Details', icon: <LuContact /> },
    { id: 'education', name: 'Education & Jobs', icon: <LuGraduationCap /> },
    { id: 'bank', name: 'Bank & Uploads', icon: <LuCoins /> },
    { id: 'system', name: 'System Account', icon: <LuUser /> }
];


const OnboardEmployee = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');
    const [roles, setRoles] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [existingDocs, setExistingDocs] = useState([]);
    const [dobDisplay, setDobDisplay] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        // System Account
        firstname: '',
        lastname: '',
        email: '',
        secondary_email: '',
        password: '',
        role: '',
        approving_manager_id: '',
        gender: '',
        abis_access: false,
        send_welcome_email: true,

        // Personal
        birthplace: '',
        height_weight: '',
        blood_group: '',
        date_of_birth: '',
        age: '',
        has_disability: false,
        disability_details: '',
        marital_status: 'Single',
        no_of_children: 0,
        hobbies: '',
        nationality: 'Indian',
        religion: '',

        // Address
        present_address: '',
        present_contact_no: '',
        permanent_address: '',
        permanent_contact_no: '',

        // Parents
        father_name: '',
        father_age: '',
        father_occupation: '',
        father_work_status: 'Working',
        mother_name: '',
        mother_age: '',
        mother_occupation: '',

        // Bank
        bank_account_number: '',
        bank_ifsc_code: '',
        bank_name_address: '',

        // Sign & Declaration
        consent_given: false,
        signature_name: '',
        onboarding_place: '',
        signature_data: ''
    });

    // Dynamic Lists State
    const [educations, setEducations] = useState([]);
    const [experiences, setExperiences] = useState([]);
    const [familyMembers, setFamilyMembers] = useState([]);

    // File Upload State
    const [files, setFiles] = useState({
        class_10: null,
        class_12: null,
        degree: null,
        academic: null,
        residence: null,
        identity: null,
        pay_slip: null,
        relieving: null,
        experience: null,
        appointment: null,
        photo: null
    });

    const [hasDraft, setHasDraft] = useState(false);

    useEffect(() => {
        const checkPermission = async () => {
            try {
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                await fetchRolesUtil(true);
                const role = getRoleById(currentUser.role);
                const canManage = role?.can_manage_onboarding == true;
                if (!canManage) {
                    navigate('/unauthorized', { replace: true });
                } else {
                    setHasPermission(true);
                }
            } catch (error) {
                console.error('Error checking onboarding permissions:', error);
                navigate('/unauthorized', { replace: true });
            } finally {
                setPermissionChecked(true);
            }
        };
        checkPermission();
    }, [navigate]);

    useEffect(() => {
        if (hasPermission) {
            fetchRoles();
            fetchManagers();
            if (id) {
                fetchEmployeeProfile();
            } else {
                // Check for local draft in NEW mode
                const savedDraft = localStorage.getItem('wp_onboarding_draft');
                if (savedDraft) {
                    setHasDraft(true);
                }
            }
        }
    }, [id, hasPermission]);

    const restoreDraft = () => {
        try {
            const savedDraft = localStorage.getItem('wp_onboarding_draft');
            if (savedDraft) {
                const { formData: savedForm, educations: savedEdu, experiences: savedExp, familyMembers: savedFam } = JSON.parse(savedDraft);
                if (savedForm) {
                    setFormData(savedForm);
                    if (savedForm.date_of_birth) {
                        setDobDisplay(formatDateForInput(savedForm.date_of_birth));
                    }
                }
                if (savedEdu) setEducations(savedEdu);
                if (savedExp) setExperiences(savedExp);
                if (savedFam) setFamilyMembers(savedFam);
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
        localStorage.removeItem('wp_onboarding_draft');
        setHasDraft(false);
        toast.success('Draft discarded.');
    };

    const saveLocalDraft = () => {
        // Enforce validation of mandatory fields for current tab
        if (!validateTab(activeTab)) {
            toast.error('Please fill in all mandatory fields on the current tab to save progress.');
            return;
        }

        try {
            const draftData = {
                formData,
                educations,
                experiences,
                familyMembers
            };
            localStorage.setItem('wp_onboarding_draft', JSON.stringify(draftData));
            toast.success('Onboarding draft saved successfully!');
        } catch (e) {
            console.error('Error saving draft:', e);
            toast.error('Failed to save draft locally.');
        }
    };

    const fetchEmployeeProfile = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/onboarding/employee/${id}`, {
                headers: { 'x-access-token': token }
            });
            const emp = response.data;
            const profile = emp.profile_info || {};

            setFormData({
                firstname: emp.firstname || '',
                lastname: emp.lastname || '',
                email: emp.email || '',
                secondary_email: emp.secondary_email || '',
                password: '', // Kept empty unless changing
                role: emp.role || '',
                approving_manager_id: emp.approving_manager_id || '',
                gender: emp.gender || '',
                abis_access: emp.abis_access || false,

                birthplace: profile.birthplace || '',
                height_weight: profile.height_weight || '',
                blood_group: profile.blood_group || '',
                date_of_birth: profile.date_of_birth || '',
                age: profile.age || '',
                has_disability: profile.has_disability || false,
                disability_details: profile.disability_details || '',
                marital_status: profile.marital_status || 'Single',
                no_of_children: profile.no_of_children || 0,
                hobbies: profile.hobbies || '',
                nationality: profile.nationality || 'Indian',
                religion: profile.religion || '',

                present_address: profile.present_address || '',
                present_contact_no: profile.present_contact_no || '',
                permanent_address: profile.permanent_address || '',
                permanent_contact_no: profile.permanent_contact_no || '',

                father_name: profile.father_name || '',
                father_age: profile.father_age || '',
                father_occupation: profile.father_occupation || '',
                father_work_status: profile.father_work_status || 'Working',
                mother_name: profile.mother_name || '',
                mother_age: profile.mother_age || '',
                mother_occupation: profile.mother_occupation || '',

                bank_account_number: profile.bank_account_number || '',
                bank_ifsc_code: profile.bank_ifsc_code || '',
                bank_name_address: profile.bank_name_address || '',

                consent_given: profile.consent_given || false,
                signature_name: profile.signature_name || '',
                onboarding_place: profile.onboarding_place || '',
                signature_data: ''
            });

            if (emp.educations) setEducations(emp.educations);
            if (emp.experiences) setExperiences(emp.experiences);
            if (emp.family_members) setFamilyMembers(emp.family_members);
            if (emp.documents) setExistingDocs(emp.documents);

            if (profile.date_of_birth) {
                setDobDisplay(formatDateForInput(profile.date_of_birth));
            }

        } catch (err) {
            console.error('Error fetching employee profile:', err);
            toast.error('Failed to load employee details.');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/roles`, {
                headers: { 'x-access-token': token }
            });
            // Filter inactive roles
            setRoles(response.data.filter(r => r.active));
        } catch (err) {
            console.error('Error fetching roles:', err);
            toast.error('Failed to load system roles.');
        }
    };

    const fetchManagers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/admin/managers-admins`, {
                headers: { 'x-access-token': token }
            });
            setManagers(response.data);
        } catch (err) {
            console.error('Error fetching managers:', err);
            toast.error('Failed to load reporting managers.');
        }
    };

    const formatDateForInput = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const [y, m, d] = parts;
        const format = getAppDateFormat();
        if (format === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
        if (format === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
        if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = parseInt(m, 10) - 1;
        const shortMonthStr = shortMonths[monthIndex] || m;
        return `${shortMonthStr} ${d}, ${y}`;
    };

    const handleDobChange = (e) => {
        const val = e.target.value;
        setDobDisplay(val);

        const format = getAppDateFormat();
        let parsed = '';

        if (format === 'DD/MM/YYYY') {
            const parts = val.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                if (d.length === 2 && m.length === 2 && y.length === 4) {
                    const dayNum = parseInt(d, 10);
                    const monthNum = parseInt(m, 10);
                    const yearNum = parseInt(y, 10);
                    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900) {
                        parsed = `${y}-${m}-${d}`;
                    }
                }
            }
        } else if (format === 'MM/DD/YYYY') {
            const parts = val.split('/');
            if (parts.length === 3) {
                const [m, d, y] = parts;
                if (m.length === 2 && d.length === 2 && y.length === 4) {
                    const dayNum = parseInt(d, 10);
                    const monthNum = parseInt(m, 10);
                    const yearNum = parseInt(y, 10);
                    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900) {
                        parsed = `${y}-${m}-${d}`;
                    }
                }
            }
        } else if (format === 'YYYY-MM-DD') {
            const parts = val.split('-');
            if (parts.length === 3) {
                const [y, m, d] = parts;
                if (y.length === 4 && m.length === 2 && d.length === 2) {
                    const dayNum = parseInt(d, 10);
                    const monthNum = parseInt(m, 10);
                    const yearNum = parseInt(y, 10);
                    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900) {
                        parsed = `${y}-${m}-${d}`;
                    }
                }
            }
        }

        if (parsed) {
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

            if (errors.date_of_birth) {
                setErrors(prev => {
                    const updated = { ...prev };
                    delete updated.date_of_birth;
                    return updated;
                });
            }
        } else {
            setFormData(prev => ({
                ...prev,
                date_of_birth: '',
                age: ''
            }));
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        setFormData(prev => ({
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

    const handleFileChange = (e, key) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(prev => ({
                ...prev,
                [key]: e.target.files[0]
            }));
        }
    };

    // Copy Address Handler
    const copyAddress = () => {
        setFormData(prev => ({
            ...prev,
            permanent_address: prev.present_address,
            permanent_contact_no: prev.present_contact_no
        }));
        toast.success('Present address copied to permanent address!');
    };

    // Dynamic Lists Actions
    const addEducation = () => {
        setEducations(prev => [...prev, { qualification: '', specialization: '', grade: '', university_city: '', year_of_completion: '' }]);
    };
    const removeEducation = (index) => {
        setEducations(prev => prev.filter((_, i) => i !== index));
    };
    const updateEducation = (index, field, val) => {
        setEducations(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
    };

    const addExperience = () => {
        setExperiences(prev => [...prev, { post_held: '', department_function: '', company_name: '', city: '', tenure: '' }]);
    };
    const removeExperience = (index) => {
        setExperiences(prev => prev.filter((_, i) => i !== index));
    };
    const updateExperience = (index, field, val) => {
        setExperiences(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
    };

    const addFamily = () => {
        setFamilyMembers(prev => [...prev, { name: '', relationship: 'Brother', work_status: '', educational_status: '', marital_status: 'Single', residing_in: '' }]);
    };
    const removeFamily = (index) => {
        setFamilyMembers(prev => prev.filter((_, i) => i !== index));
    };
    const updateFamily = (index, field, val) => {
        setFamilyMembers(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
    };

    const validateTab = (tabId) => {
        const newErrors = { ...errors };

        if (tabId === 'personal') {
            if (!formData.firstname?.trim()) {
                newErrors.firstname = 'First name is required';
            } else {
                delete newErrors.firstname;
            }

            if (!formData.lastname?.trim()) {
                newErrors.lastname = 'Last name is required';
            } else {
                delete newErrors.lastname;
            }

            if (!formData.gender) {
                newErrors.gender = 'Gender selection is required';
            } else {
                delete newErrors.gender;
            }

            if (!formData.date_of_birth) {
                newErrors.date_of_birth = `Date of birth is required (format: ${getAppDateFormat().toLowerCase()})`;
            } else {
                delete newErrors.date_of_birth;
            }
        }

        if (tabId === 'system') {
            if (!formData.email?.trim()) {
                newErrors.email = 'Official primary email is required';
            } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
                newErrors.email = 'Please provide a valid email address';
            } else {
                delete newErrors.email;
            }

            if (!id && !formData.password) {
                newErrors.password = 'Password is required';
            } else if (formData.password && formData.password.length < 6) {
                newErrors.password = 'Password must be at least 6 characters';
            } else {
                delete newErrors.password;
            }

            if (!formData.role) {
                newErrors.role = 'Role assignment is required';
            } else {
                delete newErrors.role;
            }
        }

        setErrors(newErrors);

        if (tabId === 'personal') {
            return !newErrors.firstname && !newErrors.lastname && !newErrors.gender && !newErrors.date_of_birth;
        }
        if (tabId === 'system') {
            return !newErrors.email && !newErrors.password && !newErrors.role;
        }
        return true;
    };

    const validateAll = () => {
        const newErrors = {};

        // Personal tab fields
        if (!formData.firstname?.trim()) {
            newErrors.firstname = 'First name is required';
        }
        if (!formData.lastname?.trim()) {
            newErrors.lastname = 'Last name is required';
        }
        if (!formData.gender) {
            newErrors.gender = 'Gender selection is required';
        }
        if (!formData.date_of_birth) {
            newErrors.date_of_birth = `Date of birth is required (format: ${getAppDateFormat().toLowerCase()})`;
        }

        // System tab fields
        if (!formData.email?.trim()) {
            newErrors.email = 'Official primary email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please provide a valid email address';
        }
        if (!id && !formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password && formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }
        if (!formData.role) {
            newErrors.role = 'Role assignment is required';
        }

        setErrors(newErrors);
        return newErrors;
    };

    // Submit Handler
    const handleSubmit = async (e, keepOnPage = false) => {
        if (e && e.preventDefault) e.preventDefault();

        const validationErrors = validateAll();
        if (Object.keys(validationErrors).length > 0) {
            // Switch to the first tab that has an error
            if (validationErrors.firstname || validationErrors.lastname || validationErrors.gender || validationErrors.date_of_birth) {
                setActiveTab('personal');
            } else if (validationErrors.email || validationErrors.password || validationErrors.role) {
                setActiveTab('system');
            }
            return;
        }

        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const uploadPayload = new FormData();

            // Append all standard text fields
            Object.keys(formData).forEach(key => {
                if (key === 'password' && id && !formData[key]) {
                    // Skip password in Edit Mode if it is empty
                } else {
                    uploadPayload.append(key, formData[key]);
                }
            });

            // Append dynamic arrays stringified
            uploadPayload.append('educations', JSON.stringify(educations));
            uploadPayload.append('experiences', JSON.stringify(experiences));
            uploadPayload.append('family_members', JSON.stringify(familyMembers));

            // Append file attachments
            Object.keys(files).forEach(key => {
                if (files[key]) {
                    uploadPayload.append(`doc_${key}`, files[key]);
                }
            });

            let response;
            if (id) {
                response = await axios.put(`${API_BASE_URL}/api/onboarding/employee/${id}`, uploadPayload, {
                    headers: {
                        'x-access-token': token
                    }
                });
                toast.success(response.data.message || 'Employee profile successfully updated!');
                if (!keepOnPage) {
                    navigate(`/staff-profile/${id}`);
                }
            } else {
                response = await axios.post(`${API_BASE_URL}/api/onboarding/employee`, uploadPayload, {
                    headers: {
                        'x-access-token': token
                    }
                });
                toast.success(response.data.message || 'Employee onboarded successfully!');
                // Remove local draft on successful submit
                localStorage.removeItem('wp_onboarding_draft');
                navigate('/users');
            }

        } catch (err) {
            console.error('Error submitting employee onboarding/update:', err);
            let errMsg = 'Error occurred during submission.';
            
            if (err.response) {
                if (err.response.data) {
                    if (typeof err.response.data === 'string' && err.response.data.includes('<pre>')) {
                        // Extract exact exception message from Express HTML error stack trace page
                        const match = err.response.data.match(/<pre>([\s\S]*?)<\/pre>/);
                        if (match && match[1]) {
                            // Extract first line of stack trace which contains exact exception
                            errMsg = match[1].split('\n')[0].replace(/&nbsp;/g, ' ').replace(/<br>/g, '').trim();
                        }
                    } else if (err.response.data.message) {
                        errMsg = err.response.data.message;
                    }
                }
            } else if (err.message) {
                errMsg = err.message;
            }
            
            toast.error(errMsg, { duration: 6000 });
        } finally {
            setLoading(false);
        }
    };

    if (!permissionChecked) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!hasPermission) {
        return null;
    }

    return (
        <div className="max-w-7xl mx-auto pb-12 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#1e1b4b] tracking-tight">
                        {id ? 'Edit Employee Profile' : 'Onboard New Employee'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {id 
                            ? 'Modify employee joining form details and profile settings.' 
                            : 'Fill in joining form records and initialize active system profiles directly.'}
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
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

            {hasDraft && (
                <div className="mb-6 p-5 bg-indigo-50/80 backdrop-blur border border-indigo-100 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm animate-fade-in">
                    <div>
                        <p className="text-sm font-bold text-indigo-950">Unsaved Progress Found</p>
                        <p className="text-xs text-slate-500">We found a local draft of onboarding details from a previous session.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={restoreDraft}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                        >
                            Restore Draft
                        </button>
                        <button
                            type="button"
                            onClick={clearDraft}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition"
                        >
                            Discard
                        </button>
                    </div>
                </div>
            )}

            {/* Main Form Box */}
            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-md">
                {/* 4. SYSTEM TAB */}
                {activeTab === 'system' && (
                    <div className="space-y-6">
                        <div className="border-b border-slate-100 pb-4 mb-4">
                            <h2 className="text-lg font-black text-[#1e1b4b]">Core System Credentials</h2>
                            <p className="text-xs text-slate-400">Initialize basic login and role details (Required).</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Primary Email (Official) <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className={`w-full px-4 py-3 rounded-xl border ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                />
                                {errors.email && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.email}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Secondary Email (Personal)</label>
                                <input
                                    type="email"
                                    name="secondary_email"
                                    value={formData.secondary_email}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Password {!id && <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span>}
                                    {id && <span className="text-slate-400 font-medium normal-case tracking-normal ml-1">(leave blank to keep current)</span>}
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder={id ? '••••••••' : 'Enter password'}
                                    className={`w-full px-4 py-3 rounded-xl border ${errors.password ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                />
                                {errors.password && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.password}</p>}
                                {id && !formData.password && <p className="text-slate-400 text-xs mt-1">Password is already set. Only fill this to change it.</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Assign Role <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    className={`w-full px-4 py-3 rounded-xl border ${errors.role ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                >
                                    <option value="">Select Role</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.display_name}</option>
                                    ))}
                                </select>
                                {errors.role && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.role}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Reporting Manager</label>
                                <select
                                    name="approving_manager_id"
                                    value={formData.approving_manager_id}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                >
                                    <option value="">Select Manager</option>
                                    {managers.map(m => (
                                        <option key={m.staffid || m.id} value={m.staffid || m.id}>
                                            {m.firstname} {m.lastname}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100 mt-4 md:col-span-3">
                                <input
                                    type="checkbox"
                                    name="abis_access"
                                    id="abis_access"
                                    checked={formData.abis_access}
                                    onChange={handleInputChange}
                                    className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                                <div>
                                    <label htmlFor="abis_access" className="block text-xs font-bold text-slate-700 uppercase tracking-wider cursor-pointer">
                                        Grant ABIS Application Access
                                    </label>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Allows the user to authenticate into the PHP ABIS external application.</p>
                                </div>
                            </div>

                            {!id && (
                                <div className="flex items-center gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100 mt-2 md:col-span-3">
                                    <input
                                        type="checkbox"
                                        name="send_welcome_email"
                                        id="send_welcome_email"
                                        checked={formData.send_welcome_email}
                                        onChange={handleInputChange}
                                        className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <div>
                                        <label htmlFor="send_welcome_email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider cursor-pointer">
                                            Send Welcome Email with Temporary Password
                                        </label>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Automatically emails credentials and profile completion links to the employee.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit & Navigation Footer */}
                        <div className="border-t border-slate-100 pt-6 mt-8 flex justify-between items-center">
                            <div>
                                {id ? (
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, true)}
                                        disabled={loading}
                                        className="px-5 py-3 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <LuSave size={16} /> Save Progress
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={saveLocalDraft}
                                        className="px-5 py-3 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl transition flex items-center gap-1.5"
                                    >
                                        <LuSave size={16} /> Save Draft
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('bank')}
                                    className="px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <LuSave size={18} />
                                    {loading 
                                        ? (id ? 'Saving Profile...' : 'Onboarding Employee...') 
                                        : (id ? 'Save Profile' : 'Onboard Employee')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 1. PERSONAL TAB */}
                {activeTab === 'personal' && (
                    <div className="space-y-8">
                        <div>
                            <div className="border-b border-slate-100 pb-4 mb-6">
                                <h2 className="text-lg font-black text-[#1e1b4b]">Personal Details</h2>
                                <p className="text-xs text-slate-400">Fill in background information and birthplace demographics.</p>
                            </div>

                            {/* Core Identity Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">First Name <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                    <input
                                        type="text"
                                        name="firstname"
                                        value={formData.firstname}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 rounded-xl border ${errors.firstname ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                    />
                                    {errors.firstname && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.firstname}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Last Name <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                    <input
                                        type="text"
                                        name="lastname"
                                        value={formData.lastname}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 rounded-xl border ${errors.lastname ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                    />
                                    {errors.lastname && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.lastname}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Gender <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                    <select
                                        name="gender"
                                        value={formData.gender}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 rounded-xl border ${errors.gender ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                    >
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
                                    <input
                                        type="text"
                                        name="birthplace"
                                        value={formData.birthplace}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Height / Weight</label>
                                    <input
                                        type="text"
                                        name="height_weight"
                                        placeholder="e.g. 170 cm / 60 kg"
                                        value={formData.height_weight}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Blood Group</label>
                                    <input
                                        type="text"
                                        name="blood_group"
                                        placeholder="e.g. O+"
                                        value={formData.blood_group}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Date of Birth <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                    <input
                                        type="text"
                                        name="date_of_birth"
                                        placeholder={getAppDateFormat().toLowerCase()}
                                        value={dobDisplay}
                                        onChange={handleDobChange}
                                        className={`w-full px-4 py-3 rounded-xl border ${errors.date_of_birth ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                    />
                                    {errors.date_of_birth && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.date_of_birth}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Age</label>
                                    <input
                                        type="number"
                                        name="age"
                                        value={formData.age}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-100 text-slate-600 font-semibold cursor-not-allowed"
                                        readOnly
                                        disabled
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Marital Status</label>
                                    <select
                                        name="marital_status"
                                        value={formData.marital_status}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    >
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Divorced">Divorced</option>
                                        <option value="Widowed">Widowed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">No. of Children</label>
                                    <input
                                        type="number"
                                        name="no_of_children"
                                        disabled={formData.marital_status === 'Single'}
                                        value={formData.no_of_children}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Nationality</label>
                                    <input
                                        type="text"
                                        name="nationality"
                                        value={formData.nationality}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Religion</label>
                                    <input
                                        type="text"
                                        name="religion"
                                        value={formData.religion}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Hobbies</label>
                                    <textarea
                                        name="hobbies"
                                        rows="2"
                                        value={formData.hobbies}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 select-none">
                                        <input
                                            type="checkbox"
                                            name="has_disability"
                                            checked={formData.has_disability}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                        />
                                        Declare any Disability?
                                    </label>
                                    <textarea
                                        name="disability_details"
                                        rows="2"
                                        disabled={!formData.has_disability}
                                        placeholder={formData.has_disability ? "Describe disability details..." : "Disabled"}
                                        value={formData.disability_details}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Addresses */}
                        <div>
                            <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-center">
                                <h3 className="text-md font-bold text-[#1e1b4b]">Addresses & Contacts</h3>
                                <button
                                    type="button"
                                    onClick={copyAddress}
                                    className="text-xs text-indigo-600 hover:text-white border border-indigo-200 hover:bg-indigo-600 px-3 py-1.5 rounded-lg transition"
                                >
                                    Copy Present to Permanent
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider">Present Address</h4>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Full Address</label>
                                        <textarea
                                            name="present_address"
                                            rows="3"
                                            value={formData.present_address}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Local Contact No.</label>
                                        <input
                                            type="text"
                                            name="present_contact_no"
                                            value={formData.present_contact_no}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider">Permanent Address</h4>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Full Address</label>
                                        <textarea
                                            name="permanent_address"
                                            rows="3"
                                            value={formData.permanent_address}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Permanent Contact No.</label>
                                        <input
                                            type="text"
                                            name="permanent_contact_no"
                                            value={formData.permanent_contact_no}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Parents Details */}
                        <div>
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

                        {/* Navigation Footer */}
                        <div className="border-t border-slate-100 pt-6 mt-8 flex justify-between items-center">
                            <div>
                                {id ? (
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, true)}
                                        disabled={loading}
                                        className="px-5 py-3 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <LuSave size={16} /> Save Progress
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={saveLocalDraft}
                                        className="px-5 py-3 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl transition flex items-center gap-1.5"
                                    >
                                        <LuSave size={16} /> Save Draft
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/users')}
                                    className="px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (validateTab('personal')) {
                                            setActiveTab('education');
                                        }
                                    }}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition"
                                >
                                    Next: Education & Jobs
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. EDUCATION & JOBS TAB */}
                {activeTab === 'education' && (
                    <div className="space-y-10">
                        {/* Educations */}
                        <div>
                            <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-black text-[#1e1b4b]">Educational Background</h2>
                                    <p className="text-xs text-slate-400">Map UG, Graduation, PG, or secondary qualifications.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addEducation}
                                    className="flex items-center gap-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition font-bold"
                                >
                                    <LuPlus /> Add Row
                                </button>
                            </div>

                            {educations.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                                    No qualifications registered. Click "Add Row" to populate details.
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Qualification <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></th>

                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Specialization</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Grade Attained</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">University & City</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Completion Year</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {educations.map((edu, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. PG, UG, HSC" value={edu.qualification} onChange={(e) => updateEducation(idx, 'qualification', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" required />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. B.Tech CS" value={edu.specialization} onChange={(e) => updateEducation(idx, 'specialization', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. A+ / 85%" value={edu.grade} onChange={(e) => updateEducation(idx, 'grade', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="University, City" value={edu.university_city} onChange={(e) => updateEducation(idx, 'university_city', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="number" placeholder="2024" value={edu.year_of_completion} onChange={(e) => updateEducation(idx, 'year_of_completion', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button type="button" onClick={() => removeEducation(idx)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition"><LuTrash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Experience */}
                        <div>
                            <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-black text-[#1e1b4b]">Prior Experience</h2>
                                    <p className="text-xs text-slate-400">Add past job descriptions and tenures.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addExperience}
                                    className="flex items-center gap-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition font-bold"
                                >
                                    <LuPlus /> Add Row
                                </button>
                            </div>

                            {experiences.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                                    No prior experience registered (Fresher onboarding). Click "Add Row" if they have past jobs.
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Post Held <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Department / Function</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Company Name <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></th>

                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">City</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Tenure (Years/Months)</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {experiences.map((exp, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. Lead Engineer" value={exp.post_held} onChange={(e) => updateExperience(idx, 'post_held', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" required />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. Engineering" value={exp.department_function} onChange={(e) => updateExperience(idx, 'department_function', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. Google India" value={exp.company_name} onChange={(e) => updateExperience(idx, 'company_name', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" required />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. Bangalore" value={exp.city} onChange={(e) => updateExperience(idx, 'city', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. 2 yrs 4 mos" value={exp.tenure} onChange={(e) => updateExperience(idx, 'tenure', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button type="button" onClick={() => removeExperience(idx)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition"><LuTrash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Sibling Registry */}
                        <div>
                            <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-black text-[#1e1b4b]">Family Details (Brothers / Sisters)</h2>
                                    <p className="text-xs text-slate-400">List close siblings and their occupations.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addFamily}
                                    className="flex items-center gap-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition font-bold"
                                >
                                    <LuPlus /> Add Row
                                </button>
                            </div>

                            {familyMembers.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                                    No siblings registered. Click "Add Row" if applicable.
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Name <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></th>

                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Relationship</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Current Work Status</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Educational Status</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Marital Status</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Residing In</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {familyMembers.map((fam, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="Sibling Name" value={fam.name} onChange={(e) => updateFamily(idx, 'name', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" required />
                                                    </td>
                                                    <td className="p-3">
                                                        <select value={fam.relationship} onChange={(e) => updateFamily(idx, 'relationship', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                                            <option value="Brother">Brother</option>
                                                            <option value="Sister">Sister</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. Working, Student" value={fam.work_status} onChange={(e) => updateFamily(idx, 'work_status', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="e.g. UG Complete" value={fam.educational_status} onChange={(e) => updateFamily(idx, 'educational_status', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3">
                                                        <select value={fam.marital_status} onChange={(e) => updateFamily(idx, 'marital_status', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                                            <option value="Single">Single</option>
                                                            <option value="Married">Married</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-3">
                                                        <input type="text" placeholder="City" value={fam.residing_in} onChange={(e) => updateFamily(idx, 'residing_in', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button type="button" onClick={() => removeFamily(idx)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition"><LuTrash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Navigation Footer */}
                        <div className="border-t border-slate-100 pt-6 mt-8 flex justify-between items-center">
                            <div>
                                {id ? (
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, true)}
                                        disabled={loading}
                                        className="px-5 py-3 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <LuSave size={16} /> Save Progress
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={saveLocalDraft}
                                        className="px-5 py-3 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl transition flex items-center gap-1.5"
                                    >
                                        <LuSave size={16} /> Save Draft
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('personal')}
                                    className="px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('bank')}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition"
                                >
                                    Next: Bank & Uploads
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. BANK & UPLOADS TAB */}
                {activeTab === 'bank' && (
                    <div className="space-y-8">
                        {/* Bank Details */}
                        <div>
                            <div className="border-b border-slate-100 pb-4 mb-6">
                                <h2 className="text-lg font-black text-[#1e1b4b]">Bank Details</h2>
                                <p className="text-xs text-slate-400">Initialize bank transaction accounts for official payroll deposits.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Account Number</label>
                                    <input
                                        type="text"
                                        name="bank_account_number"
                                        value={formData.bank_account_number}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Bank IFSC Code</label>
                                    <input
                                        type="text"
                                        name="bank_ifsc_code"
                                        value={formData.bank_ifsc_code}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Bank Name & Address Details</label>
                                    <input
                                        type="text"
                                        name="bank_name_address"
                                        placeholder="e.g. HDFC Bank, Chennai branch"
                                        value={formData.bank_name_address}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Documents File Upload */}
                        <div>
                            <div className="border-b border-slate-100 pb-4 mb-6">
                                <h2 className="text-lg font-black text-[#1e1b4b]">Document Submissions</h2>
                                <p className="text-xs text-slate-400">Upload high quality scanned copies of required certificates (max 10MB per file).</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { key: 'class_10', label: 'Copy of Class 10th Certificate' },
                                    { key: 'class_12', label: 'Copy of Class 12th / 10+2 Certificates' },
                                    { key: 'degree', label: 'Copy of Degree or Graduation certificates' },
                                    { key: 'academic', label: 'Academic & Professional Qualifications' },
                                    { key: 'residence', label: 'Residence Proof (Electricity bill / Passport / Voter)' },
                                    { key: 'identity', label: 'Identity Proof (PAN / DL / Passport)' },
                                    { key: 'pay_slip', label: 'Last 3 Months Pay Slip (from previous employer)' },
                                    { key: 'relieving', label: 'Relieving Letter (from previous employer)' },
                                    { key: 'experience', label: 'Experience Letter (from previous employer)' },
                                    { key: 'appointment', label: 'Appointment Letter (from previous employer)' },
                                    { key: 'photo', label: 'Passport Size Photograph (Image format)' }
                                ].map(doc => (
                                    <div key={doc.key} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-slate-100 rounded-xl bg-slate-50/40 hover:bg-slate-50 transition">
                                        <div className="mb-2 sm:mb-0">
                                            <p className="text-sm font-bold text-slate-700">{doc.label}</p>
                                            <p className="text-xs text-slate-400">
                                                {files[doc.key] 
                                                    ? `Selected: ${files[doc.key].name}` 
                                                    : (existingDocs.find(d => d.document_type === doc.key) 
                                                        ? `Existing file: ${existingDocs.find(d => d.document_type === doc.key).file_name}` 
                                                        : 'No file chosen')}
                                            </p>
                                        </div>
                                        <label className="cursor-pointer bg-white border hover:bg-indigo-50 border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-sm select-none">
                                            <LuFileUp /> Select File
                                            <input
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg"
                                                onChange={(e) => handleFileChange(e, doc.key)}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Navigation Footer */}
                        <div className="border-t border-slate-100 pt-6 mt-8 flex justify-between items-center">
                            <div>
                                {id ? (
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, true)}
                                        disabled={loading}
                                        className="px-5 py-3 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <LuSave size={16} /> Save Progress
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={saveLocalDraft}
                                        className="px-5 py-3 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl transition flex items-center gap-1.5"
                                    >
                                        <LuSave size={16} /> Save Draft
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('education')}
                                    className="px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('system')}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition"
                                >
                                    Next: System Account
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default OnboardEmployee;
