import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const ShowQRCode = () => {
    const printRef = useRef();

    // Get the base URL dynamically
    const baseUrl = window.location.origin;
    const apkUrl = `${baseUrl}/apk`;
    const myRequestsUrl = `${baseUrl}/my-requests`;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Print Button - Hidden during print */}
            <div className="no-print mb-4 flex justify-end">
                <button
                    onClick={handlePrint}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors"
                >
                    🖨️ Print Poster
                </button>
            </div>

            {/* Poster Content */}
            <div ref={printRef} className="max-w-4xl mx-auto bg-white rounded-lg shadow-2xl p-12 print:shadow-none print:p-4 print:max-w-none">
                {/* Header */}
                <div className="text-center mb-6 border-b-4 border-emerald-600 pb-4 print:mb-4 print:pb-3 print:border-b-2">
                    <div className="flex items-center justify-center gap-4 mb-2 print:gap-2 print:mb-1">
                        <div className="header-logo w-20 h-20 flex-shrink-0">
                            <svg viewBox="0 0 100 100" className="w-full h-full" style={{ display: 'block' }}>
                                <defs>
                                    <linearGradient id='logoGrad' x1='0%' y1='0%' x2='100%' y2='0%'>
                                        <stop offset='0%' stopColor='#2563EB' />
                                        <stop offset='100%' stopColor='#7C3AED' />
                                    </linearGradient>
                                    <linearGradient id='calGrad' x1='0%' y1='0%' x2='0%' y2='100%'>
                                        <stop offset='0%' stopColor='#f3f4f6' />
                                        <stop offset='100%' stopColor='#e5e7eb' />
                                    </linearGradient>
                                </defs>
                                <circle cx="50" cy="50" r="46" fill="none" stroke="url(#logoGrad)" strokeWidth="6" />
                                <g transform="translate(50 50) scale(0.75) translate(-50 -50)">
                                    <rect x="22" y="25" width="56" height="50" rx="4" fill="url(#calGrad)" stroke="#9CA3AF" strokeWidth="3" />
                                    <path d="M35 20 v10 M65 20 v10" stroke="#9CA3AF" strokeWidth="4" strokeLinecap="round" />
                                    <g fill="#D1D5DB">
                                        <rect x="28" y="40" width="8" height="8" rx="1" />
                                        <rect x="40" y="40" width="8" height="8" rx="1" />
                                        <rect x="52" y="40" width="8" height="8" rx="1" />
                                        <rect x="64" y="40" width="8" height="8" rx="1" fill="url(#logoGrad)" />
                                        <rect x="28" y="52" width="8" height="8" rx="1" />
                                        <rect x="40" y="52" width="8" height="8" rx="1" />
                                        <rect x="52" y="52" width="8" height="8" rx="1" />
                                        <rect x="64" y="52" width="8" height="8" rx="1" />
                                    </g>
                                    <path d="M10 50 H24 L32 20 L44 85 L56 25 L64 60 H85" fill="none" stroke="url(#logoGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="85" cy="50" r="4" fill="url(#logoGrad)" />
                                </g>
                            </svg>
                        </div>
                        <h1 className="text-6xl font-bold text-gray-800 print:text-4xl">
                            WorkPulse
                        </h1>
                    </div>
                    <p className="text-xl text-gray-600 print:text-base">
                        Employee Leave, Time-Off and On-Duty Management System
                    </p>
                </div>

                {/* Main Content - Two Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 print:grid-cols-2 print:gap-4 print:mb-5">

                    {/* Mobile App QR Code */}
                    <div className="flex flex-col items-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 print:p-3">
                        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 print:w-12 print:h-12 print:mb-2">
                            <svg className="w-10 h-10 text-white print:w-7 print:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2 print:text-lg print:mb-1">
                            Download Mobile App
                        </h2>
                        <p className="text-sm text-gray-600 mb-4 text-center print:text-xs print:mb-2">
                            <span className="font-bold text-white bg-blue-600 px-3 py-1 rounded-full inline-block">For Android users only</span><br />Scan to download the WorkPulse app
                        </p>
                        <div className="bg-white p-4 rounded-lg shadow-md print:p-2">
                            <QRCodeSVG
                                value={apkUrl}
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </div>
                        <p className="mt-4 text-xs text-gray-500 text-center print:mt-2 print:text-[9px]">
                            {apkUrl}
                        </p>
                    </div>

                    {/* Web Portal QR Code */}
                    <div className="flex flex-col items-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border-2 border-emerald-300 print:p-3">
                        <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mb-4 print:w-12 print:h-12 print:mb-2">
                            <svg className="w-10 h-10 text-white print:w-7 print:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2 print:text-lg print:mb-1">
                            Web Portal
                        </h2>
                        <p className="text-sm text-gray-600 mb-4 text-center print:text-xs print:mb-2">
                            <span className="font-bold text-white bg-emerald-600 px-3 py-1 rounded-full inline-block">For iPhone & Android users</span><br />Scan to access My Requests portal
                        </p>
                        <div className="bg-white p-4 rounded-lg shadow-md print:p-2">
                            <QRCodeSVG
                                value={myRequestsUrl}
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </div>
                        <p className="mt-4 text-xs text-gray-500 text-center print:mt-2 print:text-[9px]">
                            {myRequestsUrl}
                        </p>
                    </div>
                </div>

                {/* Features Section */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6 print:p-4 print:mb-5">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 text-center print:text-lg print:mb-3">
                        What You Can Do
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-4">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-2 print:w-12 print:h-12 print:mb-2" style={{ borderRadius: '50%', backgroundColor: '#9333ea' }}>
                                <svg className="w-7 h-7 text-white print:w-6 print:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-gray-700 print:text-xs">Leave</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center mb-2 print:w-12 print:h-12 print:mb-2" style={{ borderRadius: '50%', backgroundColor: '#ea580c' }}>
                                <svg className="w-7 h-7 text-white print:w-6 print:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-gray-700 print:text-xs">Time-Off</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mb-2 print:w-12 print:h-12 print:mb-2" style={{ borderRadius: '50%', backgroundColor: '#4f46e5' }}>
                                <svg className="w-7 h-7 text-white print:w-6 print:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-gray-700 print:text-xs">On-Duty</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center mb-2 print:w-12 print:h-12 print:mb-2" style={{ borderRadius: '50%', backgroundColor: '#0d9488' }}>
                                <svg className="w-7 h-7 text-white print:w-6 print:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-gray-700 print:text-xs">Status</p>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded mb-6 print:p-4 print:border-l-4 print:mb-5">
                    <h3 className="font-bold text-gray-800 mb-2 print:text-base print:mb-2">📋 How to Use:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 print:text-sm print:space-y-1">
                        <li>Open camera or QR app</li>
                        <li>Point at QR code</li>
                        <li>Tap notification</li>
                        <li>Login</li>
                    </ol>
                </div>

                {/* Footer */}
                <div className="text-center mt-8 pt-6 border-t border-gray-200 print:mt-0 print:pt-5 print:border-t">
                    <p className="text-sm text-gray-500 print:text-sm">
                        For support, contact HR team
                    </p>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                    @page {
                        size: letter portrait;
                        margin: 0.25in;
                    }
                    /* Compact layout for print */
                    .max-w-4xl {
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0.2in !important;
                    }
                    /* Logo sizing for print */
                    .header-logo {
                        width: 40px !important;
                        height: 40px !important;
                        max-width: 40px !important;
                        max-height: 40px !important;
                        overflow: hidden !important;
                        flex-shrink: 0 !important;
                    }
                    .header-logo svg {
                        width: 40px !important;
                        height: 40px !important;
                        max-width: 40px !important;
                        max-height: 40px !important;
                    }
                    /* QR code sizes for print */
                    .bg-white svg {
                        width: 160px !important;
                        height: 160px !important;
                    }
                    /* Preserve feature icon colors */
                    .bg-purple-600 {
                        background-color: #9333ea !important;
                    }
                    .bg-orange-600 {
                        background-color: #ea580c !important;
                    }
                    .bg-indigo-600 {
                        background-color: #4f46e5 !important;
                    }
                    .bg-teal-600 {
                        background-color: #0d9488 !important;
                    }
                    .bg-blue-600 {
                        background-color: #2563eb !important;
                    }
                    .bg-emerald-600 {
                        background-color: #059669 !important;
                    }
                    /* Ensure circular badges remain circular in print */
                    .rounded-full {
                        border-radius: 9999px !important;
                    }
                    /* Feature icon circles */
                    .w-12.h-12.rounded-full {
                        width: 3rem !important;
                        height: 3rem !important;
                        border-radius: 9999px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ShowQRCode;
