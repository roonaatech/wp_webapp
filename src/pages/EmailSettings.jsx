import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiSave, FiSend, FiEdit2, FiInfo } from 'react-icons/fi';
import API_BASE_URL from '../config/api.config';

export default function EmailSettings() {
    const [activeTab, setActiveTab] = useState('config');
    const [loading, setLoading] = useState(false);

    // Config State
    const [config, setConfig] = useState({
        provider_type: 'SMTP',
        host: '',
        port: 587,
        secure: false,
        auth_user: '',
        auth_pass: '',
        from_name: 'WorkPulse',
        from_email: ''
    });

    // Test Email State
    const [testEmail, setTestEmail] = useState('');
    const [testLoading, setTestLoading] = useState(false);
    const [testError, setTestError] = useState(null);

    // Templates State
    const [templates, setTemplates] = useState([]);
    const [editingTemplate, setEditingTemplate] = useState(null);

    useEffect(() => {
        fetchConfig();
        fetchTemplates();
    }, []);

    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/email/config`, {
                headers: { 'x-access-token': token }
            });
            if (response.data) {
                setConfig(response.data);
            }
        } catch (err) {
            console.error('Error fetching email config:', err);
        }
    };

    const fetchTemplates = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/email/templates`, {
                headers: { 'x-access-token': token }
            });
            setTemplates(response.data);
        } catch (err) {
            console.error('Error fetching templates:', err);
        }
    };

    const handleToggleStatus = async (template) => {
        try {
            const token = localStorage.getItem('token');
            const updatedStatus = !template.is_active;
            await axios.put(`${API_BASE_URL}/api/email/templates/${template.id}`, { ...template, is_active: updatedStatus }, {
                headers: { 'x-access-token': token }
            });
            toast.success(`Template ${updatedStatus ? 'enabled' : 'disabled'} successfully`);
            fetchTemplates();
        } catch (err) {
            console.error('Error updating template status:', err);
            toast.error('Failed to update status');
        }
    };

    const handleConfigChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const saveConfig = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/email/config`, config, {
                headers: { 'x-access-token': token }
            });
            toast.success('Email configuration saved successfully');
        } catch (err) {
            console.error('Error saving config:', err);
            toast.error('Failed to save configuration');
        } finally {
            setLoading(false);
        }
    };

    const sendTestEmail = async () => {
        if (!testEmail) return toast.error('Please enter an email address');

        setTestLoading(true);
        setTestError(null); // Clear previous errors
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/email/test`, { to: testEmail }, {
                headers: { 'x-access-token': token }
            });
            toast.success('Test email sent successfully');
        } catch (err) {
            console.error('Error sending test email:', err);
            const msg = err.response?.data?.message || 'Failed to send test email';
            const details = err.response?.data?.error || err.message;

            toast.error(msg);
            setTestError(typeof details === 'object' ? JSON.stringify(details, null, 2) : details);
        } finally {
            setTestLoading(false);
        }
    };

    const handleTemplateUpdate = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/email/templates/${editingTemplate.id}`, editingTemplate, {
                headers: { 'x-access-token': token }
            });
            toast.success('Template updated successfully');
            setEditingTemplate(null);
            fetchTemplates();
        } catch (err) {
            console.error('Error updating template:', err);
            toast.error('Failed to update template');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Email Settings</h1>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
                <button
                    className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'config'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('config')}
                >
                    Configuration
                </button>
                <button
                    className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'templates'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('templates')}
                >
                    Email Templates
                </button>
            </div>

            {activeTab === 'config' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Configuration Form */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">SMTP Settings</h2>
                        <form onSubmit={saveConfig} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                                <input
                                    type="text"
                                    name="host"
                                    value={config.host || ''}
                                    onChange={handleConfigChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                    placeholder="smtp.example.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                                    <input
                                        type="number"
                                        name="port"
                                        value={config.port || ''}
                                        onChange={handleConfigChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                        placeholder="587"
                                    />
                                </div>
                                <div className="flex items-center pt-6">
                                    <input
                                        type="checkbox"
                                        id="secure"
                                        name="secure"
                                        checked={config.secure || false}
                                        onChange={handleConfigChange}
                                        className="w-4 h-4 rounded accent-blue-700"
                                    />
                                    <label htmlFor="secure" className="ml-2 text-sm text-gray-700">
                                        Secure (SSL/TLS)
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Auth User</label>
                                <input
                                    type="text"
                                    name="auth_user"
                                    value={config.auth_user || ''}
                                    onChange={handleConfigChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Auth Password</label>
                                <input
                                    type="password"
                                    name="auth_pass"
                                    value={config.auth_pass || ''}
                                    onChange={handleConfigChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                />
                            </div>
                            <hr className="my-4" />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                                    <input
                                        type="text"
                                        name="from_name"
                                        value={config.from_name || ''}
                                        onChange={handleConfigChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                                    <input
                                        type="email"
                                        name="from_email"
                                        value={config.from_email || ''}
                                        onChange={handleConfigChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
                                >
                                    <FiSave />
                                    {loading ? 'Saving...' : 'Save Configuration'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Test Email Section */}
                    <div className="bg-white rounded-lg shadow p-6 h-fit">
                        <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
                        <div className="space-y-4">
                            <p className="text-gray-600 text-sm">
                                Enter an email address to verify your SMTP settings. Ensure you have saved your configuration first.
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                                <input
                                    type="email"
                                    value={testEmail}
                                    onChange={(e) => setTestEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                    placeholder="you@example.com"
                                />
                            </div>
                            <button
                                onClick={sendTestEmail}
                                disabled={testLoading}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                            >
                                <FiSend />
                                {testLoading ? 'Sending...' : 'Send Test Email'}
                            </button>

                            {testError && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm font-bold text-red-800 mb-1">Error Details:</p>
                                    <pre className="text-xs text-red-700 whitespace-pre-wrap overflow-auto max-h-40 font-mono">
                                        {testError}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {!editingTemplate ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {templates.map(template => (
                                <div key={template.id} className="bg-white rounded-lg shadow hover:shadow-md transition p-6 border border-gray-100 relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-lg text-gray-800">{template.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={template.is_active}
                                                    onChange={() => handleToggleStatus(template)}
                                                />
                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                            <button
                                                onClick={() => setEditingTemplate(template)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"
                                                title="Edit Template"
                                            >
                                                <FiEdit2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono mb-2">{template.slug}</p>
                                    <p className="text-sm text-gray-600 line-clamp-2">{template.subject}</p>
                                    <div className="mt-3">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {template.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">Edit Template: {editingTemplate.name}</h2>
                                <button
                                    onClick={() => setEditingTemplate(null)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    Back to List
                                </button>
                            </div>
                            <form onSubmit={handleTemplateUpdate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                    <input
                                        type="text"
                                        value={editingTemplate.subject}
                                        onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Body (HTML)</label>
                                    <textarea
                                        value={editingTemplate.body}
                                        onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 font-mono text-sm"
                                        rows="10"
                                    />
                                </div>

                                {editingTemplate.variables_hint && (
                                    <div className="bg-blue-50 p-4 rounded-lg flex gap-3 items-start">
                                        <FiInfo className="text-blue-600 mt-1 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-blue-800">Available Variables</p>
                                            <p className="text-sm text-blue-700 mt-1">
                                                Use these variables in your subject or body: <br />
                                                <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-900 break-all">
                                                    {editingTemplate.variables_hint.split(',').map(v => `{{${v.trim()}}}`).join(', ')}
                                                </code>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition"
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingTemplate(null)}
                                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
