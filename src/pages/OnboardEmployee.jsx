import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuUser, LuContact, LuGraduationCap, LuCoins, LuFileUp, LuPlus, LuTrash2, LuSave, LuArrowLeft, LuShieldAlert, LuCamera } from "react-icons/lu";
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

    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [uploadingBulk, setUploadingBulk] = useState(false);
    const [bulkUploadSummary, setBulkUploadSummary] = useState(null);
    const [dragActive, setDragActive] = useState(false);

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
        image_path: '',

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

    const [profileImage, setProfileImage] = useState(null);
    const [profileImagePreview, setProfileImagePreview] = useState(null);

    const [hasDraft, setHasDraft] = useState(false);
    const [onboardingMode, setOnboardingMode] = useState(null); // null, 'manual', or 'self_service'
    const [existingUserDetails, setExistingUserDetails] = useState(null);

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
                setOnboardingMode('manual');
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
                signature_data: '',
                image_path: profile.image_path || ''
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
        return `${d}/${m}/${y}`;
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

    const handleProfileImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) {
                toast.error("Image size must be less than 2MB");
                return;
            }
            setProfileImage(file);
            setProfileImagePreview(URL.createObjectURL(file));
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
        setExperiences(prev => [...prev, { post_held: '', department_function: '', company_name: '', city: '', tenure: '', reference_contact: '' }]);
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
                newErrors.date_of_birth = 'Date of birth is required (format: dd/mm/yyyy)';
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

        if (onboardingMode === 'self_service') {
            if (!formData.firstname?.trim()) newErrors.firstname = 'First name is required';
            if (!formData.lastname?.trim()) newErrors.lastname = 'Last name is required';
            if (!formData.gender) newErrors.gender = 'Gender selection is required';
            if (!formData.secondary_email?.trim()) {
                newErrors.secondary_email = 'Personal email is required';
            } else if (!/\S+@\S+\.\S+/.test(formData.secondary_email)) {
                newErrors.secondary_email = 'Please provide a valid email address';
            }

            setErrors(newErrors);
            return newErrors;
        }

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
            newErrors.date_of_birth = 'Date of birth is required (format: dd/mm/yyyy)';
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
            // Switch to the first tab that has an error (only in manual or edit flows)
            if (onboardingMode !== 'self_service') {
                if (validationErrors.firstname || validationErrors.lastname || validationErrors.gender || validationErrors.date_of_birth) {
                    setActiveTab('personal');
                } else if (validationErrors.email || validationErrors.password || validationErrors.role) {
                    setActiveTab('system');
                }
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

            // Append profile photo if selected
            if (profileImage) {
                uploadPayload.append('profile_image', profileImage);
            }

            // Append file attachments
            Object.keys(files).forEach(key => {
                if (files[key]) {
                    uploadPayload.append(`doc_${key}`, files[key]);
                }
            });

            let response;
            if (!id && onboardingMode === 'self_service') {
                const payload = {
                    firstname: formData.firstname,
                    lastname: formData.lastname,
                    gender: formData.gender,
                    personal_email: formData.secondary_email
                };
                response = await axios.post(`${API_BASE_URL}/api/onboarding/invite-candidate`, payload, {
                    headers: { 'x-access-token': token }
                });
                toast.success(response.data.message || 'Invitation sent to candidate successfully!');
                navigate('/users');
                return;
            }

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
                if (err.response.status === 409 && err.response.data?.existingUser) {
                    setExistingUserDetails(err.response.data.existingUser);
                    return;
                }
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

    const handleBulkFileChange = (e) => {
        const file = e.target.files[0];
        if (file && (file.type === "text/csv" || file.name.endsWith('.csv'))) {
            setBulkFile(file);
            setBulkUploadSummary(null);
        } else if (file) {
            toast.error("Please select a valid CSV file.");
        }
    };

    const handleBulkDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleBulkDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.name.endsWith('.csv') || file.type === "text/csv") {
                setBulkFile(file);
                setBulkUploadSummary(null);
            } else {
                toast.error("Please select a valid CSV file.");
            }
        }
    };

    const handleBulkUploadSubmit = async (e) => {
        e.preventDefault();
        if (!bulkFile) {
            toast.error("Please select a CSV file first.");
            return;
        }

        setUploadingBulk(true);
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('file', bulkFile);

        try {
            const response = await axios.post(`${API_BASE_URL}/api/admin/users/bulk-upload`, formData, {
                headers: {
                    'x-access-token': token,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setBulkUploadSummary(response.data);
            toast.success("CSV Upload and Sync completed!");
        } catch (err) {
            console.error("Bulk upload failed:", err);
            toast.error(err.response?.data?.message || "Failed to process bulk upload.");
        } finally {
            setUploadingBulk(false);
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

            {/* Mode Selection Screen */}
            {!id && !onboardingMode && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 max-w-6xl mx-auto">
                    <button
                        onClick={() => { setOnboardingMode('manual'); setActiveTab('personal'); }}
                        className="group flex flex-col items-center p-10 bg-white border-2 border-slate-100 hover:border-indigo-600 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left md:text-center"
                    >
                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <LuUser size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-3 text-center">Onboard Manually</h3>
                        <p className="text-slate-500 text-center text-sm font-medium">HR fills in all the employee details, forms, and documents manually directly in the portal.</p>
                    </button>

                    <button
                        onClick={() => { setOnboardingMode('self_service'); setActiveTab('system'); }}
                        className="group flex flex-col items-center p-10 bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left md:text-center"
                    >
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <LuFileUp size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-3 text-center">Candidate Self-Service</h3>
                        <p className="text-slate-500 text-center text-sm font-medium">Generate a secure link and email it to the candidate so they can fill their own details.</p>
                    </button>

                    <button
                        onClick={() => {
                            setBulkFile(null);
                            setBulkUploadSummary(null);
                            setIsBulkUploadModalOpen(true);
                        }}
                        className="group flex flex-col items-center p-10 bg-white border-2 border-slate-100 hover:border-amber-500 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left md:text-center"
                    >
                        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <LuFileUp size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-3 text-center">Bulk Import Users</h3>
                        <p className="text-slate-500 text-center text-sm font-medium">Upload a CSV file containing user credentials to sync them from ABIS to WorkPulse in bulk.</p>
                    </button>
                </div>
            )}

            {/* Back Button (if they want to switch after selecting) */}
            {!id && onboardingMode && (
                <div className="flex justify-start mb-6 -mt-2">
                    <button
                        onClick={() => setOnboardingMode(null)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 rounded-xl text-sm font-bold shadow-sm transition-all"
                    >
                        <LuArrowLeft size={16} /> Back to Options
                    </button>
                </div>
            )}

            {/* Form Content */}
            {onboardingMode && (
                <>
                    {/* Tab Navigation */}
                    {onboardingMode === 'manual' && (
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
                    )}

                    {hasDraft && onboardingMode === 'manual' && (
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
                                    <h2 className="text-lg font-black text-[#1e1b4b]">Initiate Candidate Onboarding</h2>
                                    <p className="text-xs text-slate-400">Initialize basic login and role details (Required).</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {onboardingMode === 'self_service' ? (
                                        <>
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
                                                    <option value="">Select</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                                {errors.gender && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.gender}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Personal Email <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span></label>
                                                <input
                                                    type="email"
                                                    name="secondary_email"
                                                    value={formData.secondary_email}
                                                    onChange={handleInputChange}
                                                    className={`w-full px-4 py-3 rounded-xl border ${errors.secondary_email ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                                />
                                                {errors.secondary_email && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.secondary_email}</p>}
                                            </div>
                                        </>
                                    ) : (
                                        <>
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

                                            {onboardingMode === 'manual' && !id && (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                                        Password <span className="text-red-600 font-black text-lg ml-0.5 select-none">*</span>
                                                    </label>
                                                    <input
                                                        type="password"
                                                        name="password"
                                                        value={formData.password}
                                                        onChange={handleInputChange}
                                                        placeholder="Enter password"
                                                        className={`w-full px-4 py-3 rounded-xl border ${errors.password ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} focus:outline-none focus:ring-2 bg-slate-50/50`}
                                                    />
                                                    {errors.password && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.password}</p>}
                                                </div>
                                            )}

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

                                            {!id && onboardingMode === 'manual' && (
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
                                        </>
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
                                        {onboardingMode === 'manual' && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('bank')}
                                                className="px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition"
                                            >
                                                Back
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            <LuSave size={18} />
                                            {loading
                                                ? (id ? 'Saving Profile...' : (onboardingMode === 'self_service' ? 'Sending Invite...' : 'Onboarding Employee...'))
                                                : (id ? 'Save Profile' : (onboardingMode === 'self_service' ? 'Send Invitation' : 'Onboard Employee'))}
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

                                    {/* Profile Image Upload Widget */}
                                    <div className="mb-6 flex flex-col items-center sm:flex-row sm:items-center gap-6 p-4 rounded-2xl border border-slate-100 bg-slate-50/20 backdrop-blur-sm">
                                        <div className="relative group w-24 h-24 rounded-full border-2 border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner cursor-pointer" onClick={() => document.getElementById('profile-image-upload').click()}>
                                            {profileImagePreview ? (
                                                <img src={profileImagePreview} alt="Profile Preview" className="w-full h-full object-cover" />
                                            ) : formData.image_path ? (
                                                <img src={`${API_BASE_URL}/${formData.image_path}`} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-slate-400 flex flex-col items-center justify-center">
                                                    <LuUser size={36} className="text-slate-300" />
                                                    <span className="text-[10px] font-bold mt-1 uppercase text-slate-400">Upload</span>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <LuCamera className="text-white" size={20} />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-[#1e1b4b]">Employee Profile Photo</h4>
                                            <p className="text-xs text-slate-400 mt-1 max-w-md">
                                                Upload a professional passport size photo (JPG, PNG). Max size 2MB. This image will represent the employee across all WorkPulse modules.
                                            </p>
                                            <div className="mt-3 flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => document.getElementById('profile-image-upload').click()}
                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors"
                                                >
                                                    Select Image
                                                </button>
                                                {(profileImage || formData.image_path) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setProfileImage(null);
                                                            setProfileImagePreview(null);
                                                            setFormData(prev => ({ ...prev, image_path: '' }));
                                                        }}
                                                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors"
                                                    >
                                                        Remove Image
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                id="profile-image-upload"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleProfileImageChange}
                                                className="hidden"
                                            />
                                        </div>
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
                                                placeholder="dd/mm/yyyy"
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

                                {/* Family Details (Brothers / Sisters) */}
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
                                                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Reference Contact</th>
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
                                                            <td className="p-3">
                                                                <input type="text" placeholder="Name & Phone" value={exp.reference_contact} onChange={(e) => updateExperience(idx, 'reference_contact', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
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
                </>
            )}

            {/* Existing User Conflict Modal */}
            {existingUserDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scale-up text-center">
                        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LuShieldAlert size={32} />
                        </div>
                        <h2 className="text-xl font-black text-[#1e1b4b] mb-2">Email Already in Use</h2>
                        <p className="text-sm text-slate-500 mb-6">
                            A record with this personal email already exists in the system. See details of the existing user below:
                        </p>

                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 text-left text-sm space-y-3.5">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Full Name</p>
                                <p className="font-bold text-slate-700 mt-0.5">{existingUserDetails.firstname} {existingUserDetails.lastname}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Official Email</p>
                                <p className="font-bold text-slate-700 mt-0.5">{existingUserDetails.email || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Personal Email</p>
                                <p className="font-bold text-slate-700 mt-0.5">{existingUserDetails.secondary_email || '—'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Role</p>
                                    <p className="font-bold text-slate-700 mt-0.5">{existingUserDetails.role}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mt-1 ${existingUserDetails.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                        {existingUserDetails.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setExistingUserDetails(null)}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition"
                        >
                            Understood, Close
                        </button>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {isBulkUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-xl w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-[#1e1b4b]">Bulk Import ABIS Users</h2>
                                <p className="text-sm text-gray-500 mt-1">Upload a CSV file containing user credentials to sync them to WorkPulse.</p>
                            </div>
                            <button
                                onClick={() => setIsBulkUploadModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {!bulkUploadSummary ? (
                            <form onSubmit={handleBulkUploadSubmit} className="space-y-6">
                                {/* Instructions / Guidelines */}
                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-800 space-y-2">
                                    <p className="font-bold flex items-center gap-1">ℹ️ Expected CSV Format & Headers:</p>
                                    <p>Ensure your CSV file contains a header row matching the fields below (case-insensitive):</p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse border border-blue-100/80 bg-white rounded-xl overflow-hidden mt-1 text-[11px] shadow-sm">
                                            <thead>
                                                <tr className="bg-blue-100/50 text-blue-900 font-bold border-b border-blue-100/80">
                                                    <th className="px-3 py-1.5">Header Name</th>
                                                    <th className="px-3 py-1.5">Status</th>
                                                    <th className="px-3 py-1.5">Row 1 Sample</th>
                                                    <th className="px-3 py-1.5">Row 2 Sample</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-blue-950/80 divide-y divide-blue-50/50 font-medium">
                                                <tr>
                                                    <td className="px-3 py-1.5 font-bold text-blue-900">email</td>
                                                    <td className="px-3 py-1.5 text-blue-700">Required</td>
                                                    <td className="px-3 py-1.5">bala@roonaa.com</td>
                                                    <td className="px-3 py-1.5">abirami@roonaa.com</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-1.5 font-bold text-blue-900">firstname</td>
                                                    <td className="px-3 py-1.5 text-blue-700">Required</td>
                                                    <td className="px-3 py-1.5">Balakrishnan</td>
                                                    <td className="px-3 py-1.5">Abirami</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-1.5 font-bold text-blue-900">lastname</td>
                                                    <td className="px-3 py-1.5 text-blue-700">Required</td>
                                                    <td className="px-3 py-1.5">Saivaraj</td>
                                                    <td className="px-3 py-1.5">Thiyanesh</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-1.5 font-bold text-blue-900">active</td>
                                                    <td className="px-3 py-1.5 text-slate-500">Optional</td>
                                                    <td className="px-3 py-1.5">1</td>
                                                    <td className="px-3 py-1.5">1</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-1.5 font-bold text-blue-900">gender</td>
                                                    <td className="px-3 py-1.5 text-slate-500">Optional</td>
                                                    <td className="px-3 py-1.5">Male</td>
                                                    <td className="px-3 py-1.5">Female</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-[10px] text-blue-600 mt-2">Duplicate emails will be skipped. A default onboarding profile is seeded for each imported user.</p>
                                </div>

                                {/* Drag and Drop File Picker Area */}
                                <div
                                    onDragEnter={handleBulkDrag}
                                    onDragOver={handleBulkDrag}
                                    onDragLeave={handleBulkDrag}
                                    onDrop={handleBulkDrop}
                                    className={`relative border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center transition-all ${
                                        dragActive ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-300 hover:border-indigo-400 bg-slate-50/30'
                                    }`}
                                >
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleBulkFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={uploadingBulk}
                                    />
                                    <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    {bulkFile ? (
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{bulkFile.name}</p>
                                            <p className="text-xs text-gray-400 mt-1">{(bulkFile.size / 1024).toFixed(2)} KB</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">Drag & drop your CSV file here</p>
                                            <p className="text-xs text-gray-400 mt-1">or click to browse from files</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 font-sans">
                                    <button
                                        type="button"
                                        onClick={() => setIsBulkUploadModalOpen(false)}
                                        className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-sm transition"
                                        disabled={uploadingBulk}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-sm transition flex items-center gap-1.5"
                                        disabled={uploadingBulk || !bulkFile}
                                    >
                                        {uploadingBulk ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Syncing...
                                            </>
                                        ) : (
                                            'Upload & Sync'
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-6 font-sans">
                                {/* Success / Summary Badges */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                                        <p className="text-xs text-gray-400 font-bold uppercase">Processed</p>
                                        <p className="text-2xl font-black text-[#1e1b4b] mt-1">{bulkUploadSummary.totalProcessed}</p>
                                    </div>
                                    <div className="bg-emerald-50/20 border border-emerald-100 rounded-2xl p-4 text-center">
                                        <p className="text-xs text-emerald-600 font-bold uppercase">Created</p>
                                        <p className="text-2xl font-black text-emerald-700 mt-1">{bulkUploadSummary.createdCount}</p>
                                    </div>
                                    <div className="bg-amber-50/20 border border-amber-100 rounded-2xl p-4 text-center">
                                        <p className="text-xs text-amber-600 font-bold uppercase">Ignored</p>
                                        <p className="text-2xl font-black text-amber-700 mt-1">{bulkUploadSummary.ignoredCount}</p>
                                    </div>
                                </div>

                                {/* Ignored Emails List */}
                                {bulkUploadSummary.ignoredEmails && bulkUploadSummary.ignoredEmails.length > 0 && (
                                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-3 border-b border-gray-100">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                Ignored Emails ({bulkUploadSummary.ignoredEmails.length})
                                            </p>
                                        </div>
                                        <div className="max-h-[160px] overflow-y-auto px-4 py-3 text-xs space-y-1.5 divide-y divide-gray-50 font-semibold text-slate-600">
                                            {bulkUploadSummary.ignoredEmails.map((email, idx) => (
                                                <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-slate-500">
                                                    <span>{email}</span>
                                                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100 font-black">Email already exists</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Line Errors List */}
                                {bulkUploadSummary.errors && bulkUploadSummary.errors.length > 0 && (
                                    <div className="border border-red-100 rounded-2xl overflow-hidden">
                                        <div className="bg-red-50/50 px-4 py-3 border-b border-red-100">
                                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
                                                Format Warning / Errors ({bulkUploadSummary.errors.length})
                                            </p>
                                        </div>
                                        <div className="max-h-[120px] overflow-y-auto px-4 py-3 text-xs space-y-1.5 text-red-700 font-semibold">
                                            {bulkUploadSummary.errors.map((err, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5">
                                                    <span>⚠️</span> <span>{err}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsBulkUploadModalOpen(false)}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnboardEmployee;
