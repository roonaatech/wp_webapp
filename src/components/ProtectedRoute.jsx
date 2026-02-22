import React from 'react';
import { Navigate } from 'react-router-dom';
import { canAccessWebApp, hasAdminPermission, isSelfServiceOnly, getCachedRoles } from '../utils/roleUtils';

const ProtectedRoute = ({ children, requiredPermission, skipWebAppCheck = false }) => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Check if user is authenticated
    if (!token) {
        return <Navigate to="/login" replace />;
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
