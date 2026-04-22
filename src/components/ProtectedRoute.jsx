import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import { canAccessWebApp, hasAdminPermission, isSelfServiceOnly, getCachedRoles } from '../utils/roleUtils';

const ProtectedRoute = ({ children, requiredPermission, skipWebAppCheck = false }) => {
    const [authState, setAuthState] = useState('checking'); // 'checking' | 'valid' | 'invalid'
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Check if user is authenticated
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Validate token with the backend on mount
    useEffect(() => {
        const validateToken = async () => {
            try {
                // Lightweight request to verify token is still valid
                await axios.get(`${API_BASE_URL}/api/leavetypes`, {
                    headers: { 'x-access-token': token }
                });
                setAuthState('valid');
            } catch (err) {
                if (err.response?.status === 401) {
                    // Token is invalid — clear and redirect
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setAuthState('invalid');
                } else {
                    // Network error or other issue — allow access (don't lock out on network blips)
                    setAuthState('valid');
                }
            }
        };
        validateToken();
    }, [token]);

    // Show loading while checking
    if (authState === 'checking') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
                    <p style={{ color: '#6b7280', fontSize: 14 }}>Verifying session...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    // Token was invalid
    if (authState === 'invalid') {
        return <Navigate to="/session-expired" replace />;
    }

    // Force all mobile users to my-requests
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobileDevice && !skipWebAppCheck) {
        return <Navigate to="/my-requests" replace />;
    }

    // Skip permission checks for self-service routes like /my-requests
    if (!skipWebAppCheck) {
        // 1. Gating: If user doesn't have webapp access at all, they shouldn't see dashboard pages
        if (!canAccessWebApp(user.role)) {
            return <Navigate to="/my-requests" replace />;
        }

        // 2. Navigation: If they ONLY have web access (no management permissions), 
        // they belong in /my-requests, not the main Dashboard pages
        if (isSelfServiceOnly(user.role)) {
            return <Navigate to="/my-requests" replace />;
        }
    }

    // Check if specific permission is required (e.g., 'admin' for user management)
    if (requiredPermission === 'admin' && !hasAdminPermission(user.role)) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
                    <p className="text-sm text-gray-500">This feature requires user management permissions.</p>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;

