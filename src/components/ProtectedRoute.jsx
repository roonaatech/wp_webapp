import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredRole }) => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Check if user is authenticated
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Check if user has required role (Admin=1, Manager=2, or Leader=3)
    if (user.role !== 1 && user.role !== 2 && user.role !== 3) {
        return <Navigate to="/login" replace />;
    }

    // Check if specific role is required (e.g., Admin only for user management)
    if (requiredRole && user.role !== requiredRole) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
                    <p className="text-sm text-gray-500">Required role: Admin</p>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
