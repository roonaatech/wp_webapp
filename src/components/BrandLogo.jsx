import React from 'react';

const BrandLogo = ({ className = "h-8", showText = true }) => {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* SVG Icon */}
            <div className="relative w-10 h-10 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-md">
                    <defs>
                        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#3B82F6' }} />
                            <stop offset="100%" style={{ stopColor: '#8B5CF6' }} />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradient)" strokeWidth="8" />
                    <path
                        d="M25 50 L40 50 L45 35 L55 65 L60 50 L75 50"
                        fill="none"
                        stroke="url(#logoGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle cx="50" cy="50" r="3" fill="#3B82F6" />
                </svg>
            </div>

            {showText && (
                <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        WorkPulse
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-semibold -mt-1">
                        Management
                    </span>
                </div>
            )}
        </div>
    );
};

export default BrandLogo;
