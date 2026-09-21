import React from 'react';

const BrandLogo = ({ className = "h-10", showText = true, iconSize = "w-12 h-12", textTheme = "light" }) => {
    return (
        <div className={`flex items-center gap-3 select-none ${className}`}>
            {/* SVG Icon - Thick, Bright, and Clear */}
            <div className={`relative ${iconSize} flex-shrink-0 drop-shadow-md`}>
                <svg viewBox="0 0 100 100" className="w-full h-full filter">
                    <defs>
                        {/* High-vibrancy Electric Blue to Punchy Violet Gradient */}
                        <linearGradient id='brandGradVibrant' x1='0%' y1='0%' x2='100%' y2='0%'>
                            <stop offset='0%' stopColor='#2563EB' />
                            <stop offset='50%' stopColor='#4F46E5' />
                            <stop offset='100%' stopColor='#9333EA' />
                        </linearGradient>

                        {/* Crisp Solid Calendar Body Fill */}
                        <linearGradient id='calGradSolid' x1='0%' y1='0%' x2='0%' y2='100%'>
                            <stop offset='0%' stopColor='#FFFFFF' />
                            <stop offset='100%' stopColor='#F8FAFC' />
                        </linearGradient>
                    </defs>

                    {/* 1. Outer Circle Wrap - Bold & Thick (Stroke 7.5) */}
                    <circle 
                        cx="50" 
                        cy="50" 
                        r="45" 
                        fill="none" 
                        stroke="url(#brandGradVibrant)" 
                        strokeWidth="7.5" 
                    />

                    <g transform="translate(50 50) scale(0.74) translate(-50 -50)">
                        {/* 2. Calendar Body - Crisp & High Contrast */}
                        <rect 
                            x="22" 
                            y="25" 
                            width="56" 
                            height="50" 
                            rx="6"
                            fill="url(#calGradSolid)" 
                            stroke="#334155" 
                            strokeWidth="3.5" 
                        />

                        {/* Calendar Rings */}
                        <path 
                            d="M35 18 v11 M65 18 v11" 
                            stroke="#1E293B" 
                            strokeWidth="5" 
                            strokeLinecap="round" 
                        />

                        {/* Calendar Grid (Clean Slate Dots) */}
                        <g fill="#94A3B8">
                            <rect x="28" y="40" width="8" height="8" rx="2" />
                            <rect x="40" y="40" width="8" height="8" rx="2" />
                            <rect x="52" y="40" width="8" height="8" rx="2" />
                            <rect x="64" y="40" width="8" height="8" rx="2" fill="url(#brandGradVibrant)" /> {/* active day */}

                            <rect x="28" y="52" width="8" height="8" rx="2" />
                            <rect x="40" y="52" width="8" height="8" rx="2" />
                            <rect x="52" y="52" width="8" height="8" rx="2" />
                            <rect x="64" y="52" width="8" height="8" rx="2" />
                        </g>

                        {/* 3. Pulse Wave Overlay - Bold & Thick (Stroke 7.5) */}
                        <path 
                            d="M10 50 H23 L32 18 L44 85 L56 24 L65 58 H85"
                            fill="none" 
                            stroke="url(#brandGradVibrant)" 
                            strokeWidth="7.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                        />

                        {/* Pulse End Dot - Bold */}
                        <circle cx="85" cy="50" r="5.5" fill="url(#brandGradVibrant)" />
                    </g>
                </svg>
            </div>

            {/* Typography - Bold, Thick, Bright, and High Contrast */}
            {showText && (
                <div className="flex flex-col text-left leading-none">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#9333EA] filter drop-shadow-xs">
                        WorkPulse
                    </span>
                    <span className={`text-[12px] sm:text-[13px] font-black uppercase tracking-[0.28em] mt-1 ${
                        textTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                        MANAGEMENT
                    </span>
                </div>
            )}
        </div>
    );
};

export default BrandLogo;
