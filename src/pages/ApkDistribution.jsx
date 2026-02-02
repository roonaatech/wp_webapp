/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import BrandLogo from '../components/BrandLogo';
import { LuDownload, LuUpload, LuTrash2, LuEye, LuEyeOff, LuSmartphone, LuHistory } from "react-icons/lu";
import { hasAdminPermission } from '../utils/roleUtils';

const ApkDistribution = () => {
    const [latestApk, setLatestApk] = useState(null);
    const [apkList, setApkList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);

    // Auth state
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const isAdmin = hasAdminPermission(user.role);

    // Form state
    const [file, setFile] = useState(null);
    const [version, setVersion] = useState('');
    const [releaseNotes, setReleaseNotes] = useState('');
    const [isVisible, setIsVisible] = useState(true);
    const [isParsingApk, setIsParsingApk] = useState(false);
    const [versionAutoDetected, setVersionAutoDetected] = useState(false);
    const [duplicateVersionModal, setDuplicateVersionModal] = useState({ show: false, version: '' });
    const [parseError, setParseError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const headers = token ? { 'x-access-token': token } : {};

            // Fetch latest APK
            try {
                const latestRes = await axios.get(`${API_BASE_URL}/api/apk/latest`, { headers });
                setLatestApk(latestRes.data);
            } catch (err) {
                if (err.response && err.response.status !== 404) {
                    console.error("Error fetching latest APK", err);
                } else {
                    setLatestApk(null);
                }
            }

            // Fetch list if admin
            if (isAdmin && token) {
                const listRes = await axios.get(`${API_BASE_URL}/api/apk/list`, { headers });
                setApkList(listRes.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Parse APK with retry logic
    const parseApkWithRetry = async (formData, retries = 2) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await axios.post(`${API_BASE_URL}/api/apk/parse`, formData, {
                    headers: {
                        'x-access-token': token,
                        'Content-Type': 'multipart/form-data'
                    },
                    timeout: 60000 // 60 second timeout for large APK files
                });
                return response;
            } catch (err) {
                console.error(`APK parse attempt ${attempt + 1} failed:`, err.message);
                if (attempt === retries) {
                    throw err;
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) {
            setFile(null);
            return;
        }

        // Validate file size (warn if over 50MB)
        const fileSizeMB = selectedFile.size / (1024 * 1024);
        if (fileSizeMB > 100) {
            toast.error("File is too large (over 100MB). Please use a smaller APK.");
            return;
        }

        setFile(selectedFile);
        setVersionAutoDetected(false);
        setParseError(null);
        
        // Parse APK to extract version
        setIsParsingApk(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await parseApkWithRetry(formData);

            if (response.data.success && response.data.version) {
                // Combine version and build number (e.g., "1.3.0+7")
                const fullVersion = response.data.versionCode 
                    ? `${response.data.version}+${response.data.versionCode}`
                    : response.data.version;
                
                // Check if this version already exists
                const existingVersion = apkList.find(apk => apk.version === fullVersion);
                if (existingVersion) {
                    setDuplicateVersionModal({ show: true, version: fullVersion });
                    setVersion('');
                    setVersionAutoDetected(false);
                    // Reset file input
                    const fileInput = document.getElementById('apkFileInput');
                    if (fileInput) fileInput.value = '';
                    setFile(null);
                } else {
                    setVersion(fullVersion);
                    setVersionAutoDetected(true);
                    toast.success(`Version ${fullVersion} detected from APK`);
                }
            } else {
                setParseError('Could not extract version from APK');
            }
        } catch (err) {
            console.error("Could not parse APK version:", err);
            const errorMsg = err.code === 'ECONNABORTED' 
                ? 'Request timed out. The server is taking too long to process the APK.'
                : err.response?.data?.message || 'Failed to parse APK file';
            setParseError(errorMsg);
        } finally {
            setIsParsingApk(false);
        }
    };

    // Retry parsing for the current file
    const retryParsing = () => {
        const fileInput = document.getElementById('apkFileInput');
        if (fileInput && fileInput.files[0]) {
            handleFileChange({ target: { files: [fileInput.files[0]] } });
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !version) {
            toast.error("Please provide file and version");
            return;
        }
        if (!releaseNotes.trim()) {
            toast.error("Please provide release notes");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('version', version);
        formData.append('release_notes', releaseNotes);
        formData.append('is_visible', isVisible);

        try {
            await axios.post(`${API_BASE_URL}/api/apk/upload`, formData, {
                headers: {
                    'x-access-token': token,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percent);
                    }
                }
            });
            toast.success("APK uploaded successfully");
            setFile(null);
            setVersion('');
            setReleaseNotes('');
            setVersionAutoDetected(false);
            setParseError(null);
            // Reset file input
            const fileInput = document.getElementById('apkFileInput');
            if (fileInput) fileInput.value = '';
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || "Upload failed");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDownload = async (id, filename) => {
        try {
            setDownloadingId(id);
            setDownloadProgress(0);
            
            const headers = token ? { 'x-access-token': token } : {};
            const response = await axios.get(`${API_BASE_URL}/api/apk/download/${id}`, {
                headers,
                responseType: 'blob',
                onDownloadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setDownloadProgress(percent);
                    }
                }
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Download complete!");
        } catch (err) {
            toast.error("Download failed");
        } finally {
            setDownloadingId(null);
            setDownloadProgress(0);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this version?")) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/apk/${id}`, {
                headers: { 'x-access-token': token }
            });
            toast.success("Deleted successfully");
            fetchData();
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const toggleVisibility = async (id, currentStatus) => {
        try {
            await axios.put(`${API_BASE_URL}/api/apk/${id}/visibility`,
                { is_visible: !currentStatus },
                { headers: { 'x-access-token': token } }
            );
            toast.success("Visibility updated");
            fetchData();
        } catch (err) {
            toast.error("Update failed");
        }
    };

    return (
        <div className={`space-y-8 animate-fade-in mb-10 ${!token ? 'min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-between' : ''}`}>
            <div className={`${!token ? 'w-full max-w-4xl' : ''}`}>
                {/* Logo only for non-logged in users - minimal header */}
                {!token && (
                    <div className="mb-8">
                        <div className="flex items-center gap-4">
                            <BrandLogo size={40} />
                        </div>
                    </div>
                )}

                <div className={token ? "" : "w-full"}>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mobile App Distribution</h1>
                            <p className="text-gray-500 mt-2">Download the latest version of the WorkPulse mobile app.</p>
                        </div>
                    </div>

                    {/* Latest Version Card */}
                    <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-10">
                            <LuSmartphone size={200} />
                        </div>

                        <div className="relative z-10">
                            {isLoading ? (
                                <div className="animate-pulse space-y-4">
                                <div className="h-8 bg-white/20 w-48 rounded"></div>
                                <div className="h-4 bg-white/20 w-32 rounded"></div>
                            </div>
                        ) : latestApk ? (
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                                <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20">
                                    <LuSmartphone size={48} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-3xl font-bold">v{latestApk.version}</h2>
                                        <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">Latest Stable</span>
                                    </div>
                                    <p className="text-blue-100 mb-4">Released on {new Date(latestApk.upload_date).toLocaleDateString()}</p>
                                    {latestApk.release_notes && (
                                        <div className="bg-black/20 rounded-xl p-4 mb-6 max-w-2xl backdrop-blur-sm">
                                            <h3 className="font-semibold mb-2 text-sm uppercase tracking-wider text-blue-200">Release Notes</h3>
                                            <p className="text-sm whitespace-pre-wrap">{latestApk.release_notes}</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => handleDownload('latest', latestApk.filename)}
                                        disabled={downloadingId === 'latest'}
                                        className={`bg-white text-blue-600 px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg transform active:translate-y-0 ${downloadingId === 'latest' ? 'opacity-90 cursor-wait' : 'hover:bg-blue-50 hover:shadow-xl hover:-translate-y-1'}`}
                                    >
                                        {downloadingId === 'latest' ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                {downloadProgress > 0 ? `Downloading ${downloadProgress}%` : 'Starting download...'}
                                            </>
                                        ) : (
                                            <>
                                                <LuDownload size={20} />
                                                Download APK
                                            </>
                                        )}
                                    </button>
                                    
                                    {/* Progress bar */}
                                    {downloadingId === 'latest' && downloadProgress > 0 && (
                                        <div className="mt-4 w-full max-w-xs">
                                            <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className="bg-white h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${downloadProgress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <LuSmartphone size={32} />
                                </div>
                                <h3 className="text-xl font-bold mb-2">No Version Available</h3>
                                <p className="text-blue-200">Please check back later for updates.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin Section */}
                {isAdmin && token && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                        {/* Upload Form */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-full">
                                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <span className="p-2 bg-blue-100 text-blue-600 rounded-lg"><LuUpload size={20} /></span>
                                    Upload New Version
                                </h3>

                                <form onSubmit={handleUpload} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">APK File</label>
                                        <input
                                            id="apkFileInput"
                                            type="file"
                                            accept=".apk"
                                            onChange={handleFileChange}
                                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            required
                                            disabled={isParsingApk}
                                        />
                                        {isParsingApk && (
                                            <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
                                                <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                                                <span>Reading version from APK... This may take a moment for large files.</span>
                                            </div>
                                        )}
                                        {parseError && !isParsingApk && (
                                            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-red-700">{parseError}</p>
                                                        <button
                                                            type="button"
                                                            onClick={retryParsing}
                                                            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800 underline"
                                                        >
                                                            Retry parsing
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Version Number <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={version}
                                                onChange={(e) => setVersion(e.target.value)}
                                                placeholder={isParsingApk ? "Reading from APK..." : "Select APK file to auto-detect"}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                                                required
                                                disabled={true}
                                                readOnly
                                            />
                                            {versionAutoDetected && !isParsingApk && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                                    Auto-detected
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Version is automatically extracted from the APK file</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Release Notes <span className="text-red-500">*</span></label>
                                        <textarea
                                            value={releaseNotes}
                                            onChange={(e) => setReleaseNotes(e.target.value)}
                                            rows="4"
                                            placeholder="What's new in this version?"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            required
                                        ></textarea>
                                    </div>

                                    <div className="flex items-center gap-2 mb-4">
                                        <input
                                            type="checkbox"
                                            id="isVisible"
                                            checked={isVisible}
                                            onChange={(e) => setIsVisible(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <label htmlFor="isVisible" className="text-gray-700 text-sm">Make visible immediately</label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isUploading || !version}
                                        className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-70 relative overflow-hidden"
                                    >
                                        {isUploading ? (
                                            <>
                                                {/* Progress bar background */}
                                                <div 
                                                    className="absolute inset-0 bg-green-600 transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                ></div>
                                                <div className="relative flex items-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    <span>Uploading... {uploadProgress}%</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>Upload Version</>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Version History List */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-full">
                                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <span className="p-2 bg-purple-100 text-purple-600 rounded-lg"><LuHistory size={20} /></span>
                                    Version History
                                </h3>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="pb-4 font-semibold text-gray-500 text-sm pl-4">Version</th>
                                                <th className="pb-4 font-semibold text-gray-500 text-sm">Date</th>
                                                <th className="pb-4 font-semibold text-gray-500 text-sm">Status</th>
                                                <th className="pb-4 font-semibold text-gray-500 text-sm text-right pr-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {apkList.map((apk) => (
                                                <tr key={apk.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="py-4 pl-4 font-medium text-gray-900">{apk.version}</td>
                                                    <td className="py-4 text-gray-500 text-sm">
                                                        {new Date(apk.upload_date).toLocaleDateString()}
                                                        <div className="text-xs text-gray-400">{new Date(apk.upload_date).toLocaleTimeString()}</div>
                                                    </td>
                                                    <td className="py-4">
                                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${apk.is_visible
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-gray-100 text-gray-500'
                                                            }`}>
                                                            {apk.is_visible ? 'Visible' : 'Hidden'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 pr-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => toggleVisibility(apk.id, apk.is_visible)}
                                                                className={`p-2 rounded-lg transition-colors ${apk.is_visible
                                                                        ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                                                        : 'text-green-600 hover:bg-green-50'
                                                                    }`}
                                                                title={apk.is_visible ? "Hide" : "Show"}
                                                            >
                                                                {apk.is_visible ? <LuEye size={18} /> : <LuEyeOff size={18} />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownload(apk.id, apk.filename)}
                                                                disabled={downloadingId === apk.id}
                                                                className={`p-2 rounded-lg transition-colors ${downloadingId === apk.id ? 'text-blue-400 cursor-wait' : 'text-blue-600 hover:bg-blue-50'}`}
                                                                title="Download"
                                                            >
                                                                {downloadingId === apk.id ? (
                                                                    <svg className="animate-spin h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                ) : (
                                                                    <LuDownload size={18} />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(apk.id)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <LuTrash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {apkList.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="py-8 text-center text-gray-500">
                                                        No history available.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* Sign In Button at bottom for non-logged in users */}
            {!token && (
                <div className="w-full max-w-4xl mt-auto">
                    <a 
                        href="/login" 
                        className="w-full block px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:shadow-lg text-center shadow-lg"
                    >
                        Sign In to Dashboard →
                    </a>
                </div>
            )}

            {/* Duplicate Version Modal */}
            {duplicateVersionModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            {/* Warning Icon */}
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            
                            {/* Title */}
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                Version Already Exists
                            </h3>
                            
                            {/* Message */}
                            <p className="text-gray-600 mb-2">
                                The version <span className="font-semibold text-orange-600">{duplicateVersionModal.version}</span> has already been uploaded.
                            </p>
                            <p className="text-gray-500 text-sm mb-6">
                                Please increment the build number in your Flutter project and rebuild the APK.
                            </p>

                            {/* Code hint */}
                            <div className="w-full bg-gray-50 rounded-lg p-3 mb-6 text-left">
                                <p className="text-xs text-gray-500 mb-1">Example command:</p>
                                <code className="text-sm text-blue-600 font-mono">
                                    flutter build apk --build-number=<span className="text-orange-500">[increment]</span>
                                </code>
                            </div>
                            
                            {/* Button */}
                            <button
                                onClick={() => setDuplicateVersionModal({ show: false, version: '' })}
                                className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-semibold hover:bg-black transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApkDistribution;
