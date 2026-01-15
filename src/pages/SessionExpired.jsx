import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const SessionExpired = () => {
    const location = useLocation();
    const reason = location.state?.reason || 'expired';
    
    const isLogout = reason === 'logout';
    const isUnauthorized = reason === 'unauthorized';
    
    const getTitle = () => {
        if (isLogout) return 'Logged Out Successfully';
        if (isUnauthorized) return 'Access Denied';
        return 'Session Expired';
    };
    
    const getMessage = () => {
        if (isLogout) return 'You have been successfully logged out of the system.';
        if (isUnauthorized) return 'You do not have permission to access this resource. Please login with appropriate credentials.';
        return 'Your session has expired due to inactivity or the authentication token is no longer valid. Please login again to continue.';
    };
    
    const getIcon = () => {
        if (isLogout) {
            return (
                <svg className="w-20 h-20 text-green-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        }
        if (isUnauthorized) {
            return (
                <svg className="w-20 h-20 text-red-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
            );
        }
        return (
            <svg className="w-20 h-20 text-amber-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        );
    };
    
    const getBackgroundColor = () => {
        if (isLogout) return 'from-green-50 to-white';
        if (isUnauthorized) return 'from-red-50 to-white';
        return 'from-amber-50 to-white';
    };

    return (
        <div className={`min-h-screen bg-gradient-to-b ${getBackgroundColor()} flex items-center justify-center p-4`}>
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                    {getIcon()}
                    
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">
                        {getTitle()}
                    </h1>
                    
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        {getMessage()}
                    </p>
                    
                    <Link
                        to="/login"
                        className="inline-flex items-center justify-center px-6 py-3 bg-[#2E5090] text-white font-semibold rounded-lg hover:bg-[#243d6a] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 w-full"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Go to Login
                    </Link>
                    
                    {!isLogout && (
                        <p className="text-sm text-gray-500 mt-6">
                            If you believe this is an error, please contact your administrator.
                        </p>
                    )}
                </div>
                
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-400">
                        ABiS WorkPulse
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SessionExpired;
