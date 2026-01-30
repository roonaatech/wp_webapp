import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Unauthorized = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleGoHome = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                    {/* Lock Icon */}
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
                        <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-3">
                        Access Denied
                    </h1>

                    <p className="text-gray-600 mb-2 leading-relaxed">
                        You don't have permission to access this page.
                    </p>
                    
                    <p className="text-sm text-gray-500 mb-8">
                        Please contact your administrator if you believe you should have access to this resource.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={handleGoBack}
                            className="inline-flex items-center justify-center px-6 py-3 bg-[#2E5090] text-white font-semibold rounded-lg hover:bg-[#243d6a] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 w-full"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Go Back
                        </button>

                        <button
                            onClick={handleGoHome}
                            className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all duration-200 w-full"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Go to Dashboard
                        </button>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>
                        Need help? Contact your system administrator
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;
