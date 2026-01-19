import React from 'react';

const BrandLogo = ({ className = "h-10", showText = true, iconSize = "w-12 h-12" }) => {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* SVG Icon */}
            <div className={`relative ${iconSize} flex-shrink-0`}>
                <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-md">
                    <defs>
                        {/* Text Match Gradient: Darker Blue (#2563EB) to Darker Purple (#7C3AED) */}
                        <linearGradient id='brandGrad' x1='0%' y1='0%' x2='100%' y2='0%'>
                            <stop offset='0%' style={{ stopColor: '#2563EB' }} />
                            <stop offset='100%' style={{ stopColor: '#7C3AED' }} />
                        </linearGradient>

                        <linearGradient id='calGrad' x1='0%' y1='0%' x2='0%' y2='100%'>
                            <stop offset='0%' style={{ stopColor: '#f3f4f6' }} />
                            <stop offset='100%' style={{ stopColor: '#e5e7eb' }} />
                        </linearGradient>
                    </defs>

                    {/* 1. Outer Circle Wrap */}
                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#brandGrad)" strokeWidth="6" />

                    <g transform="translate(50 50) scale(0.75) translate(-50 -50)">
                        {/* 2. Calendar Body (Gray Scale) */}
                        <rect x="22" y="25" width="56" height="50" rx="4"
                            fill="url(#calGrad)" stroke="#9CA3AF" strokeWidth="3" />

                        {/* Calendar Rings */}
                        <path d="M35 20 v10 M65 20 v10" stroke="#9CA3AF" strokeWidth="4" strokeLinecap="round" />

                        {/* Calendar Grid (Simplified) */}
                        <g fill="#D1D5DB">
                            <rect x="28" y="40" width="8" height="8" rx="1" />
                            <rect x="40" y="40" width="8" height="8" rx="1" />
                            <rect x="52" y="40" width="8" height="8" rx="1" />
                            <rect x="64" y="40" width="8" height="8" rx="1" fill="url(#brandGrad)" /> {/* active day */}

                            <rect x="28" y="52" width="8" height="8" rx="1" />
                            <rect x="40" y="52" width="8" height="8" rx="1" />
                            <rect x="52" y="52" width="8" height="8" rx="1" />
                            <rect x="64" y="52" width="8" height="8" rx="1" />
                        </g>

                        {/* 3. Pulse Overlay (Brand Gradient) */}
                        <path d="M10 50 H24 L32 20 L44 85 L56 25 L64 60 H85"
                            fill="none" stroke="url(#brandGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Pulse Dot */}
                        <circle cx="85" cy="50" r="4" fill="url(#brandGrad)" />
                    </g>
                </svg>
            </div>

            {showText && (
                <div className="flex flex-col">
                    <span className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        WorkPulse
                    </span>
                    <span className="text-[14px] text-gray-400 uppercase tracking-[0.2em] font-semibold -mt-1">
                        Management
                    </span>
                </div>
            )}
        </div>
    );
};

export default BrandLogo;
