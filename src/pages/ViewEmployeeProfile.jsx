import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuArrowLeft, LuFileText, LuUser, LuMapPin, LuBuilding2, LuGraduationCap, LuFileUp, LuCheck, LuInfo, LuDownload, LuMail } from "react-icons/lu";
import API_BASE_URL from '../config/api.config';
import { canManageOnboarding } from '../utils/roleUtils';
import { formatDateOnly } from '../utils/timezone.util';



const ViewEmployeeProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState([]);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [managers, setManagers] = useState([]);
    const [approvalForm, setApprovalForm] = useState({ email: '', role: '', approving_manager_id: '', abis_access: false });
    const [approvalErrors, setApprovalErrors] = useState({});
    const [approving, setApproving] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxImage, setLightboxImage] = useState('');
    const [resendingEmail, setResendingEmail] = useState(false);

    useEffect(() => {
        fetchEmployeeProfile();
        fetchRoles();
        fetchManagers();
    }, [id]);

    const fetchEmployeeProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/onboarding/employee/${id}`, {
                headers: { 'x-access-token': token }
            });
            setEmployee(response.data);
            setApprovalForm({
                email: response.data.email || '',
                role: response.data.role || '',
                approving_manager_id: response.data.approving_manager_id || '',
                abis_access: response.data.abis_access || false
            });
        } catch (err) {
            console.error('Error fetching employee profile:', err);
            toast.error('Failed to load employee profile.');
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
            setRoles(response.data);
        } catch (err) {
            console.error('Error fetching roles:', err);
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
        }
    };

    const handleDownload = async (docId, fileName) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/onboarding/employee/${id}/document/${docId}`, {
                headers: { 'x-access-token': token },
                responseType: 'blob'
            });

            // Create a downloadable blob URL
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error downloading document:', err);
            toast.error('Failed to download document file.');
        }
    };


    const handleApproveSubmit = async (e) => {
        e.preventDefault();
        setApprovalErrors({});

        if (!approvalForm.email) {
            setApprovalErrors(prev => ({ ...prev, email: 'Official email is required.' }));
            return;
        }
        if (!approvalForm.role) {
            setApprovalErrors(prev => ({ ...prev, role: 'Role assignment is required.' }));
            return;
        }

        setApproving(true);
        const token = localStorage.getItem('token');
        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/onboarding/employee/${id}/approve`,
                {
                    email: approvalForm.email,
                    role: approvalForm.role,
                    approving_manager_id: approvalForm.approving_manager_id || null,
                    abis_access: approvalForm.abis_access
                },
                {
                    headers: { 'x-access-token': token }
                }
            );
            toast.success(response.data.message || 'Onboarding approved and finalized successfully!');
            setIsApproveModalOpen(false);
            fetchEmployeeProfile();
        } catch (err) {
            console.error('Error approving onboarding:', err);
            toast.error(err.response?.data?.message || 'Failed to approve onboarding.');
        } finally {
            setApproving(false);
        }
    };

    const handleResendWelcomeEmail = async () => {
        setResendingEmail(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE_URL}/api/onboarding/employee/${id}/resend-welcome`, {}, {
                headers: { 'x-access-token': token }
            });
            toast.success(response.data.message || 'Welcome email resent successfully!');
        } catch (err) {
            console.error('Error resending welcome email:', err);
            toast.error(err.response?.data?.message || 'Failed to resend welcome email.');
        } finally {
            setResendingEmail(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!employee) {
        return (
            <div className="text-center py-12 bg-white border border-slate-100 rounded-3xl max-w-2xl mx-auto shadow-sm">
                <LuInfo className="mx-auto text-amber-500 mb-4" size={48} />
                <h2 className="text-xl font-bold text-[#1e1b4b]">Employee Profile Not Found</h2>

                <p className="text-slate-500 mt-2">The requested employee joining record could not be located in the database.</p>
                <Link to="/users" className="inline-flex items-center gap-1.5 mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition">
                    <LuArrowLeft /> Back to Staff Members
                </Link>
            </div>
        );
    }

    const profile = employee.profile_info || {};

    const missingGender = !employee.gender;
    const missingManager = !employee.approving_manager_id;
    const missingEmail = !employee.email;
    const missingDob = !profile.date_of_birth;
    const missingDeclaration = !profile.consent_given || profile.onboarding_status === 'Pending_Candidate';

    const isUpdateRequired = (missingGender || missingManager || missingEmail || missingDob || missingDeclaration) &&
        profile.onboarding_status !== 'Pending_HR_Approval';

    const getProfileCompletion = () => {
        if (!employee) return 0;
        const prof = employee.profile_info || {};
        const checks = [
            !!employee.firstname,
            !!employee.lastname,
            !!employee.email,
            !!employee.gender,
            !!prof.image_path,
            !!prof.date_of_birth,
            !!prof.birthplace,
            !!prof.blood_group,
            !!prof.present_address,
            !!prof.present_contact_no,
            !!prof.permanent_address,
            !!prof.permanent_contact_no,
            !!prof.father_name,
            !!prof.mother_name,
            !!prof.bank_account_number,
            !!prof.bank_ifsc_code,
            !!prof.bank_name_address,
            !!(employee.educations && employee.educations.length > 0),
            !!prof.consent_given,
            !!prof.signature_path
        ];
        const filled = checks.filter(Boolean).length;
        return Math.round((filled / checks.length) * 100);
    };

    const roleObj = roles.find(r => r.id === employee.role);
    const roleName = roleObj ? roleObj.display_name : 'Staff';
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userRoleObj = roles.find(r => r.id === parseInt(currentUser.role));
    const canEdit = userRoleObj
        ? userRoleObj.can_manage_onboarding == true
        : canManageOnboarding(currentUser.role);

    // Checklist documents mapping
    const checklistDocs = [
        { key: 'class_10', label: 'Class 10th Certificate' },
        { key: 'class_12', label: 'Class 12th Certificate' },
        { key: 'degree', label: 'Degree Certificate' },
        { key: 'academic', label: 'Academic & Professional Credentials' },
        { key: 'residence', label: 'Residence Proof Document' },
        { key: 'identity', label: 'Identity Proof Document' },
        { key: 'pay_slip', label: 'Original Pay Slips (Last 3 Months)' },
        { key: 'relieving', label: 'Relieving Letter' },
        { key: 'experience', label: 'Experience Letter' },
        { key: 'appointment', label: 'Appointment Letter' },
        { key: 'photo', label: 'Passport Size Photograph' }
    ];

    return (
        <div className="max-w-7xl mx-auto pb-16 font-sans">
            {/* Back Navigation */}
            <button
                onClick={() => navigate('/users')}
                className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition font-bold mb-6 select-none text-sm"
            >
                <LuArrowLeft /> Back to Staff Members
            </button>

            {/* Profile Overview Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex items-center gap-5">
                    <div className="relative w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
                        {profile.image_path ? (
                            <img
                                src={`${API_BASE_URL}/${profile.image_path.replace(/\\/g, '/')}`}
                                alt={`${employee.firstname} ${employee.lastname}`}
                                className="w-full h-full object-cover rounded-2xl cursor-zoom-in hover:brightness-95 transition duration-200"
                                onClick={() => {
                                    setLightboxImage(`${API_BASE_URL}/${profile.image_path.replace(/\\/g, '/')}`);
                                    setIsLightboxOpen(true);
                                }}
                            />
                        ) : (
                            <span className="text-indigo-600 font-extrabold text-2xl">
                                {employee.firstname[0]}{employee.lastname[0]}
                            </span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl font-black text-[#1e1b4b]">{employee.firstname} {employee.lastname}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${employee.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                {employee.active ? 'Active' : 'Inactive'}
                            </span>
                            {employee.abis_access && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    ABIS Enabled
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 font-medium text-sm mt-1">{roleName} • {employee.email}</p>

                        {/* Profile Completion Score Progress Bar */}
                        <div className="flex items-center gap-3 mt-3">
                            <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner border border-slate-200/50">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${getProfileCompletion() === 100
                                            ? 'bg-emerald-500'
                                            : getProfileCompletion() >= 75
                                                ? 'bg-indigo-600'
                                                : getProfileCompletion() >= 40
                                                    ? 'bg-amber-500'
                                                    : 'bg-rose-500'
                                        }`}
                                    style={{ width: `${getProfileCompletion()}%` }}
                                ></div>
                            </div>
                            <span className={`text-xs font-black tracking-tight ${getProfileCompletion() === 100
                                    ? 'text-emerald-600'
                                    : getProfileCompletion() >= 75
                                        ? 'text-indigo-600'
                                        : getProfileCompletion() >= 40
                                            ? 'text-amber-600'
                                            : 'text-rose-600'
                                }`}>
                                {getProfileCompletion()}% Completed
                            </span>
                        </div>

                        {/* Update Required Warning Box inside Header card */}
                        {isUpdateRequired && (
                            <div className="mt-2.5 text-xs text-orange-700 font-bold flex items-center gap-1.5 flex-wrap select-none">
                                <LuInfo size={14} className="text-orange-500 flex-shrink-0" />
                                <span className="text-orange-950 font-black">Update Required:</span>
                                <span className="text-orange-700 font-medium">
                                    Missing {(() => {
                                        const items = [
                                            missingGender && "Gender",
                                            missingManager && "Reporting Manager",
                                            missingEmail && "Primary Email",
                                            missingDob && "Date of Birth",
                                            missingDeclaration && "Declaration"
                                        ].filter(Boolean);
                                        if (items.length === 0) return "";
                                        if (items.length === 1) return items[0];
                                        return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
                                    })()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    {canEdit && profile.onboarding_status === 'Pending_HR_Approval' && (
                        <button
                            onClick={() => setIsApproveModalOpen(true)}
                            className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition text-sm shadow-sm"
                        >
                            Approve & Finalize Onboarding
                        </button>
                    )}
                    {canEdit && !profile.consent_given && (
                        <button
                            onClick={handleResendWelcomeEmail}
                            disabled={resendingEmail}
                            className="flex-1 md:flex-none px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold rounded-xl transition text-sm shadow-sm flex items-center justify-center gap-1.5"
                        >
                            {resendingEmail ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Resending...
                                </>
                            ) : (
                                <>
                                    <LuMail size={16} />
                                    Resend Welcome Email
                                </>
                            )}
                        </button>
                    )}
                    {canEdit && (
                        <button
                            onClick={() => navigate(`/onboard/${id}`)}
                            className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-sm shadow-sm"
                        >
                            Edit Profile
                        </button>
                    )}
                    <button
                        onClick={() => navigate(`/users`)}
                        className="flex-1 md:flex-none px-6 py-2.5 bg-slate-50 border hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Main Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1 & 2: Main Joining Profile Details */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Extended Personal details */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                            <span className="text-indigo-600"><LuUser /></span> Extended Personal Details
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6 text-sm">
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Date of Birth</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.date_of_birth ? formatDateOnly(profile.date_of_birth) : 'Not filled'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Birthplace</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.birthplace || 'Not filled'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Blood Group</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.blood_group || 'Not filled'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Height / Weight</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.height_weight || 'Not filled'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Age</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.age ? `${profile.age} years` : 'Not filled'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Marital Status</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.marital_status || 'Single'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No. of Children</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.no_of_children || 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nationality</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.nationality || 'Indian'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Religion</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.religion || 'Not filled'}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Hobbies</p>
                                <p className="font-semibold text-slate-700 mt-1">{profile.hobbies || 'None'}</p>
                            </div>
                            {profile.has_disability && (
                                <div className="col-span-2 sm:col-span-3 p-4 border border-amber-100 bg-amber-50/20 rounded-xl">
                                    <p className="text-xs text-amber-800 font-bold uppercase tracking-wider">Disability Details</p>
                                    <p className="font-semibold text-slate-700 mt-1">{profile.disability_details}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Address block */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                            <span className="text-indigo-600"><LuMapPin /></span> Contact & Address Details
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
                                <p className="text-xs text-indigo-600 font-black uppercase tracking-wider mb-2">Present Address</p>
                                <p className="font-semibold text-slate-700 whitespace-pre-wrap">{profile.present_address || 'Not filled'}</p>
                                <p className="text-xs text-slate-400 font-bold mt-3">Local Contact No.</p>
                                <p className="font-bold text-slate-700 mt-0.5">{profile.present_contact_no || 'Not filled'}</p>
                            </div>
                            <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
                                <p className="text-xs text-indigo-600 font-black uppercase tracking-wider mb-2">Permanent Address</p>
                                <p className="font-semibold text-slate-700 whitespace-pre-wrap">{profile.permanent_address || 'Not filled'}</p>
                                <p className="text-xs text-slate-400 font-bold mt-3">Permanent Contact No.</p>
                                <p className="font-bold text-slate-700 mt-0.5">{profile.permanent_contact_no || 'Not filled'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Parents Registry */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                            <span className="text-indigo-600"><LuBuilding2 /></span> Parental Profiles
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="p-4 border border-slate-100 rounded-2xl">
                                <p className="text-xs font-black text-slate-500 uppercase border-b border-slate-100 pb-2 mb-3">Father's Details</p>
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-400">Full Name: <span className="font-bold text-slate-700 ml-1">{profile.father_name || 'Not filled'}</span></p>
                                    <p className="text-xs text-slate-400">Age: <span className="font-bold text-slate-700 ml-1">{profile.father_age ? `${profile.father_age} yrs` : 'Not filled'}</span></p>
                                    <p className="text-xs text-slate-400">Occupation: <span className="font-bold text-slate-700 ml-1">{profile.father_occupation || 'Not filled'}</span></p>
                                </div>
                            </div>

                            <div className="p-4 border border-slate-100 rounded-2xl">
                                <p className="text-xs font-black text-slate-500 uppercase border-b border-slate-100 pb-2 mb-3">Mother's Details</p>
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-400">Maiden Name: <span className="font-bold text-slate-700 ml-1">{profile.mother_name || 'Not filled'}</span></p>
                                    <p className="text-xs text-slate-400">Age: <span className="font-bold text-slate-700 ml-1">{profile.mother_age ? `${profile.mother_age} yrs` : 'Not filled'}</span></p>
                                    <p className="text-xs text-slate-400">Occupation: <span className="font-bold text-slate-700 ml-1">{profile.mother_occupation || 'Not filled'}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Educational qualifications */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                            <span className="text-indigo-600"><LuGraduationCap /></span> Qualifications Background
                        </h2>
                        {(!employee.educations || employee.educations.length === 0) ? (
                            <div className="text-center py-6 text-slate-400 text-sm">No qualifications registered.</div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Qualification</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Specialization</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Grade</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">University / Board</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Completion Year</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                        {employee.educations.map((edu, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3">{edu.qualification}</td>
                                                <td className="px-4 py-3">{edu.specialization || '—'}</td>
                                                <td className="px-4 py-3">{edu.grade || '—'}</td>
                                                <td className="px-4 py-3">{edu.university_city || '—'}</td>
                                                <td className="px-4 py-3">{edu.year_of_completion || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Dynamic lists for siblings & job history */}
                    <div className="grid grid-cols-1 gap-8">
                        {/* Sibling profiles */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                            <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-5">Brothers & Sisters Registry</h2>
                            {(!employee.family_members || employee.family_members.length === 0) ? (
                                <div className="text-center py-6 text-slate-400 text-sm">No siblings registered.</div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Relationship</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Work Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Educational Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Marital Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Residing In</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                            {employee.family_members.map((fam, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3">{fam.name}</td>
                                                    <td className="px-4 py-3">{fam.relationship}</td>
                                                    <td className="px-4 py-3">{fam.work_status || '—'}</td>
                                                    <td className="px-4 py-3">{fam.educational_status || '—'}</td>
                                                    <td className="px-4 py-3">{fam.marital_status || '—'}</td>
                                                    <td className="px-4 py-3">{fam.residing_in || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Prior Experience */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                            <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-5">Employment History</h2>
                            {(!employee.experiences || employee.experiences.length === 0) ? (
                                <div className="text-center py-6 text-slate-400 text-sm">No prior experience registered (Fresher onboarding).</div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Post Held</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Department</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">City</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tenure</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                            {employee.experiences.map((exp, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3">{exp.post_held}</td>
                                                    <td className="px-4 py-3">{exp.department_function || '—'}</td>
                                                    <td className="px-4 py-3">{exp.company_name}</td>
                                                    <td className="px-4 py-3">{exp.city || '—'}</td>
                                                    <td className="px-4 py-3">{exp.tenure || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: Attachments, Bank and Signature box */}
                <div className="space-y-8">
                    {/* Document Attachments Inventory */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                            <span className="text-indigo-600"><LuFileText /></span> Attachments Verification
                        </h2>

                        <div className="space-y-3.5">
                            {checklistDocs.map(doc => {
                                const uploadedDoc = (employee.documents || []).find(d => d.document_type === doc.key);
                                return (
                                    <div key={doc.key} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                                        <div className="max-w-[70%]">
                                            <p className="text-xs font-bold text-slate-700 truncate" title={doc.label}>{doc.label}</p>
                                            {uploadedDoc ? (
                                                <p className="text-[10px] text-slate-400 font-semibold truncate" title={uploadedDoc.file_name}>
                                                    {uploadedDoc.file_name}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                                                    <LuInfo size={10} /> Missing
                                                </p>

                                            )}
                                        </div>

                                        {uploadedDoc ? (
                                            <button
                                                onClick={() => handleDownload(uploadedDoc.id, uploadedDoc.file_name)}
                                                className="text-xs bg-white border border-slate-200 hover:border-indigo-400 text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition shadow-sm"
                                                title="Download Attachment"
                                            >
                                                <LuDownload size={14} />
                                            </button>
                                        ) : (
                                            <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                                                —
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bank Details */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <h2 className="text-base font-bold text-[#1e1b4b]">Bank Details</h2>
                        </div>
                        <div className="space-y-3.5">
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Account Number</p>
                                <p className="font-semibold text-slate-700 mt-0.5">{profile.bank_account_number || 'Not filled'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Bank IFSC Code</p>
                                <p className="font-semibold text-slate-700 mt-0.5">{profile.bank_ifsc_code || 'Not filled'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Bank Name & Address</p>
                                <p className="font-semibold text-slate-700 mt-0.5">{profile.bank_name_address || 'Not filled'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Digital Signature & Consent Sign-off */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-sm">
                        <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                            <span className="text-indigo-600"><LuCheck /></span> Declaration & Signature
                        </h2>


                        <div className="space-y-4">
                            {profile.consent_given ? (
                                <div className="flex items-start gap-2 p-3 bg-emerald-50/20 border border-emerald-100 rounded-xl text-emerald-800 text-xs">
                                    <LuCheck className="mt-0.5 flex-shrink-0 font-bold text-emerald-600" size={14} />
                                    <div>
                                        <p className="font-bold text-emerald-900">Consent coordinates validated</p>
                                        <p className="mt-0.5 text-emerald-700">Declaration text confirmed by onboarder.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 p-3 bg-amber-50/40 border border-amber-200 rounded-xl text-amber-800 text-xs">
                                    <LuInfo className="mt-0.5 flex-shrink-0 text-amber-600" size={14} />
                                    <div>
                                        <p className="font-bold text-amber-900">Consent Pending</p>
                                        <p className="mt-0.5 text-amber-700">Pending employee's login and declaration submission.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Sign Name</p>
                                    <p className="font-bold text-slate-700 mt-0.5">{profile.signature_name || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Onboard Place</p>
                                    <p className="font-bold text-slate-700 mt-0.5">{profile.onboarding_place || '—'}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Signing Date</p>
                                    <p className="font-bold text-slate-700 mt-0.5">
                                        {profile.signature_date ? new Date(profile.signature_date).toLocaleString() : '—'}
                                    </p>
                                </div>
                            </div>

                            {profile.signature_path && (
                                <div className="border-t border-slate-100 pt-4">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Digital Signature Drawing</p>
                                    <div className="border border-slate-100 rounded-xl bg-slate-50 p-2 shadow-inner">
                                        <img
                                            src={`${API_BASE_URL}/${profile.signature_path.replace(/\\/g, '/')}`}
                                            alt="Employee digital signature drawing"
                                            className="w-full h-auto max-h-[120px] object-contain rounded-lg bg-white shadow-inner"
                                            onError={(e) => {
                                                // Fallback if direct relative path doesn't load
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Approval Modal */}
            {isApproveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-[#1e1b4b] mb-2">Approve & Finalize Onboarding</h3>
                        <p className="text-sm text-slate-500 mb-6">Assign official credentials and system access details to finalize onboarding for this employee.</p>

                        <form onSubmit={handleApproveSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Official Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={approvalForm.email}
                                    onChange={(e) => setApprovalForm(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 text-sm"
                                    placeholder="e.g. employee@company.com"
                                />
                                {approvalErrors.email && <p className="text-xs text-rose-500 mt-1 font-bold">{approvalErrors.email}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Assign Role</label>
                                <select
                                    required
                                    value={approvalForm.role}
                                    onChange={(e) => setApprovalForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 text-sm"
                                >
                                    <option value="">Select system role...</option>
                                    {roles
                                        .filter(r => {
                                            if (!userRoleObj) return true;
                                            return r.hierarchy_level >= userRoleObj.hierarchy_level;
                                        })
                                        .map(r => (
                                            <option key={r.id} value={r.id}>{r.display_name}</option>
                                        ))
                                    }
                                </select>
                                {approvalErrors.role && <p className="text-xs text-rose-500 mt-1 font-bold">{approvalErrors.role}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Reporting Manager</label>
                                <select
                                    value={approvalForm.approving_manager_id}
                                    onChange={(e) => setApprovalForm(prev => ({ ...prev, approving_manager_id: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 text-sm"
                                >
                                    <option value="">Select reporting manager...</option>
                                    {managers.map(m => (
                                        <option key={m.staffid} value={m.staffid}>{m.firstname} {m.lastname} ({m.role_name || 'Manager/Admin'})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3 py-2">
                                <input
                                    type="checkbox"
                                    id="abis_access"
                                    checked={approvalForm.abis_access}
                                    onChange={(e) => setApprovalForm(prev => ({ ...prev, abis_access: e.target.checked }))}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="abis_access" className="text-sm font-semibold text-slate-700 select-none cursor-pointer">
                                    Enable ABIS Access
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsApproveModalOpen(false)}
                                    className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition"
                                    disabled={approving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-sm transition flex items-center gap-1.5"
                                    disabled={approving}
                                >
                                    {approving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Approving...
                                        </>
                                    ) : (
                                        'Confirm & Approve'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {isLightboxOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md cursor-zoom-out select-none animate-in fade-in duration-200"
                    onClick={() => setIsLightboxOpen(false)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsLightboxOpen(false)}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 border border-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition shadow-lg text-sm font-black"
                            title="Close preview"
                        >
                            ✕
                        </button>
                        <img
                            src={lightboxImage}
                            alt="Bigger employee profile photo"
                            className="max-w-full max-h-[85vh] rounded-3xl object-contain shadow-2xl border border-white/10 bg-black/20"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewEmployeeProfile;
