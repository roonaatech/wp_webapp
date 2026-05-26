import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LuArrowLeft, LuFileText, LuUser, LuMapPin, LuBuilding2, LuGraduationCap, LuFileUp, LuCheck, LuInfo, LuDownload } from "react-icons/lu";
import API_BASE_URL from '../config/api.config';
import { canManageOnboarding } from '../utils/roleUtils';
import { formatDateOnly } from '../utils/timezone.util';



const ViewEmployeeProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState([]);

    useEffect(() => {
        fetchEmployeeProfile();
        fetchRoles();
    }, [id]);

    const fetchEmployeeProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/onboarding/employee/${id}`, {
                headers: { 'x-access-token': token }
            });
            setEmployee(response.data);
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
    const roleObj = roles.find(r => r.id === employee.role);
    const roleName = roleObj ? roleObj.display_name : 'Staff';
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const canEdit = canManageOnboarding(currentUser.role);

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
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-2xl shadow-sm">
                        {employee.firstname[0]}{employee.lastname[0]}
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
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
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
                    {/* Bank Details */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-sm">
                        <h2 className="text-base font-bold text-[#1e1b4b] border-b border-slate-100 pb-3 mb-4">Bank Details</h2>
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
        </div>
    );
};

export default ViewEmployeeProfile;
