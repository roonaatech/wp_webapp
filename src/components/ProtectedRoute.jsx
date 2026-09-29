import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import { canAccessWebApp, hasAdminPermission, isSelfServiceOnly, canAccessAttendancePortal } from '../utils/roleUtils';
import { isMobileClient } from '../utils/deviceFingerprint';
import { safeGetStoredUser } from '../utils/storageUtils';

// Module-level token verification cache to avoid duplicate verification and flickering
// when redirecting between routes (e.g. from / to /my-requests on mobile)
let verifiedTokenCache = null;
let verifiedTokenTime = 0;
const TOKEN_VERIFY_CACHE_MS = 60 * 1000; // 60 seconds

export const clearTokenVerificationCache = () => {
    verifiedTokenCache = null;
    verifiedTokenTime = 0;
};

const ProtectedRoute = ({ children, requiredPermission, skipWebAppCheck = false, skipProfileCheck = false }) => {
    const location = useLocation();
    // Normalize path by removing trailing slash (e.g. '/my-requests/' -> '/my-requests')
    const rawPath = location.pathname || '';
    const currentPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;

    // Check if token or user is passed via URL query param (e.g. launched from mobile app kiosk)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlUser = urlParams.get('user');
    if (urlToken) {
        localStorage.setItem('token', urlToken);
        if (urlUser) {
            try {
                localStorage.setItem('user', decodeURIComponent(urlUser));
            } catch (_) {
                localStorage.setItem('user', urlUser);
            }
        }
        // Clean URL to not expose token in browser address bar
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('token');
    const user = safeGetStoredUser();
    const isAttendanceRoute = currentPath === '/attendance' || currentPath.startsWith('/attendance/');

    // Check if this token was recently verified (within last 60 seconds)
    const isRecentlyVerified = Boolean(
        token &&
        token === verifiedTokenCache &&
        (Date.now() - verifiedTokenTime < TOKEN_VERIFY_CACHE_MS)
    );

    const [authState, setAuthState] = useState(() => isRecentlyVerified ? 'valid' : 'checking');

    // Check if user is authenticated
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Validate token with the backend on mount if not recently verified
    useEffect(() => {
        if (isRecentlyVerified) {
            setAuthState('valid');
            return;
        }

        let isMounted = true;
        const validateToken = async () => {
            try {
                // Lightweight request to verify token is still valid with an 8s timeout
                await axios.get(`${API_BASE_URL}/api/leavetypes`, {
                    headers: { 'x-access-token': token },
                    timeout: 8000
                });
                if (isMounted) {
                    verifiedTokenCache = token;
                    verifiedTokenTime = Date.now();
                    setAuthState('valid');
                }
            } catch (err) {
                if (!isMounted) return;

                if (err.response?.status === 401) {
                    // Service accounts never time out: do not clear session or redirect to session-expired
                    if (user.isServiceAccount) {
                        setAuthState('valid');
                        return;
                    }
                    // Token is invalid — clear and redirect
                    clearTokenVerificationCache();
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setAuthState('invalid');
                } else {
                    // Network error, timeout or other issue — allow access using cached session
                    // (don't lock out mobile users on shaky networks or background wakeup)
                    setAuthState('valid');
                }
            }
        };

        validateToken();
        return () => {
            isMounted = false;
        };
    }, [token, isRecentlyVerified]);

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

    // Check if user must change password or sign declaration (gated flow)
    if (!skipProfileCheck && !isAttendanceRoute) {
        const mustChangePassword = localStorage.getItem('mustChangePassword') === 'true';
        const mustCompleteDeclaration = localStorage.getItem('mustCompleteDeclaration') === 'true';
        if (mustChangePassword || mustCompleteDeclaration) {
            return <Navigate to="/verify-profile" replace />;
        }
    }

    // Service accounts gating checks
    if (user.isServiceAccount) {
        // Block access to self-service pages
        if (currentPath === '/my-requests' || currentPath === '/my-badge' || currentPath === '/verify-profile') {
            return <Navigate to="/unauthorized" replace />;
        }
        // Redirect home page to attendance portal or unauthorized
        if (currentPath === '/') {
            if (canAccessAttendancePortal(user.role)) {
                return <Navigate to="/attendance" replace />;
            } else {
                return <Navigate to="/unauthorized" replace />;
            }
        }
    }

    // Force all mobile users to my-requests (except /attendance which is used on common mobile kiosk devices)
    const isMobileDevice = isMobileClient();
    if (isMobileDevice && !skipWebAppCheck && !isAttendanceRoute && currentPath !== '/my-requests') {
        return <Navigate to="/my-requests" replace />;
    }

    // Skip permission checks for self-service routes like /my-requests and /my-badge
    const isSelfServiceRoute = skipWebAppCheck || currentPath === '/my-requests' || currentPath === '/my-badge';
    if (!isSelfServiceRoute) {
        // 1. Gating: If user doesn't have webapp access at all, they belong in /my-requests
        if (!canAccessWebApp(user.role)) {
            return <Navigate to="/my-requests" replace />;
        }

        // 2. Navigation: If they ONLY have web access (no management permissions), 
        // they belong in /my-requests, not the main Dashboard pages
        if (isSelfServiceOnly(user.role) && !user.isServiceAccount && currentPath !== '/my-requests') {
            return <Navigate to="/my-requests" replace />;
        }
    }

    // Check if specific permission is required (e.g., 'admin' for user management)
    if (requiredPermission === 'admin' && !hasAdminPermission(user.role)) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
                    <p className="text-sm text-gray-500 mb-6">This feature requires user management permissions.</p>
                    <button
                        onClick={() => window.location.href = '/my-requests'}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm transition-all"
                    >
                        Go to My Requests
                    </button>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;


