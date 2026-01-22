/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api.config';
import { LuDownload, LuUpload, LuTrash2, LuEye, LuEyeOff, LuSmartphone, LuHistory } from "react-icons/lu";

const ApkDistribution = () => {
    const [latestApk, setLatestApk] = useState(null);
    const [apkList, setApkList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // Auth state
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const isAdmin = user.role === 1;

    // Form state
    const [file, setFile] = useState(null);
    const [version, setVersion] = useState('');
    const [releaseNotes, setReleaseNotes] = useState('');
    const [isVisible, setIsVisible] = useState(true);

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

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !version) {
            toast.error("Please provide file and version");
            return;
        }

        setIsUploading(true);
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
                }
            });
            toast.success("APK uploaded successfully");
            setFile(null);
            setVersion('');
            setReleaseNotes('');
            // Reset file input
            const fileInput = document.getElementById('apkFileInput');
            if (fileInput) fileInput.value = '';
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || "Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownload = async (id, filename) => {
        try {
            const headers = token ? { 'x-access-token': token } : {};
            const response = await axios.get(`${API_BASE_URL}/api/apk/download/${id}`, {
                headers,
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            toast.error("Download failed");
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
        <div className={`space-y-8 animate-fade-in mb-10 ${!token ? 'min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center' : ''}`}>
            {/* Header for non-logged in users */}
            {!token && (
                <div className="w-full max-w-4xl flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span className="bg-blue-600 text-white p-2 rounded-lg"><LuSmartphone size={24} /></span>
                        WorkPulse
                    </h1>
                    <a href="/login" className="text-blue-600 font-medium hover:underline">
                        Login to Dashboard
                    </a>
                </div>
            )}

            <div className={token ? "" : "w-full max-w-4xl"}>
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
                                        className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold flex items-center gap-3 hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0"
                                    >
                                        <LuDownload size={20} />
                                        Download APK
                                    </button>
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
                                            onChange={(e) => setFile(e.target.files[0])}
                                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Version Number</label>
                                        <input
                                            type="text"
                                            value={version}
                                            onChange={(e) => setVersion(e.target.value)}
                                            placeholder="e.g. 1.0.5"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Release Notes</label>
                                        <textarea
                                            value={releaseNotes}
                                            onChange={(e) => setReleaseNotes(e.target.value)}
                                            rows="4"
                                            placeholder="What's new in this version?"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                                        disabled={isUploading}
                                        className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        {isUploading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Download"
                                                            >
                                                                <LuDownload size={18} />
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
    );
};

export default ApkDistribution;
