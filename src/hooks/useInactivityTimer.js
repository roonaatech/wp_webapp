import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
const THROTTLE_MS = 30000; // Only update timestamp every 30 seconds to avoid excessive writes

// Routes that must never auto-logout on inactivity (e.g. the always-on front-desk
// attendance kiosk, which can sit idle between employees).
const INACTIVITY_EXEMPT_PATHS = ['/attendance'];

/**
 * Custom hook that monitors user activity and logs them out
 * after 15 minutes of inactivity. Shows a warning 1 minute before.
 */
const useInactivityTimer = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isExempt = INACTIVITY_EXEMPT_PATHS.includes(location.pathname);
    const timeoutRef = useRef(null);
    const warningTimeoutRef = useRef(null);
    const intervalRef = useRef(null);
    const lastActivityRef = useRef(Date.now());
    const isWarningShownRef = useRef(false);
    const warningDialogRef = useRef(null);

    // Helper to get inactivity timeout from settings in localStorage
    const getInactivityTimeoutMs = useCallback(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('settings') || '{}');
            const minutes = parseInt(stored.inactivity_timeout, 10);
            if (!isNaN(minutes) && minutes > 0) {
                return minutes * 60 * 1000;
            }
        } catch (e) {
            console.error('Failed to parse settings for inactivity timeout:', e);
        }
        return 5 * 60 * 1000; // Default to 5 minutes
    }, []);

    // Helper to get inactivity warning duration from settings in localStorage
    const getWarningDurationMs = useCallback(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('settings') || '{}');
            const seconds = parseInt(stored.inactivity_warning_duration, 10);
            if (!isNaN(seconds) && seconds >= 10) {
                return seconds * 1000;
            }
        } catch (e) {
            console.error('Failed to parse settings for inactivity warning duration:', e);
        }
        return 60 * 1000; // Default to 60 seconds
    }, []);

    const clearTimers = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current);
            warningTimeoutRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const performLogout = useCallback(() => {
        clearTimers();
        // Remove warning dialog if present
        if (warningDialogRef.current && warningDialogRef.current.parentNode) {
            warningDialogRef.current.parentNode.removeChild(warningDialogRef.current);
            warningDialogRef.current = null;
        }
        isWarningShownRef.current = false;

        // Clear auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Navigate to session expired with inactivity reason
        navigate('/session-expired', {
            state: { reason: 'inactivity' },
            replace: true
        });
    }, [navigate, clearTimers]);

    const dismissWarning = useCallback(() => {
        if (warningDialogRef.current && warningDialogRef.current.parentNode) {
            warningDialogRef.current.parentNode.removeChild(warningDialogRef.current);
            warningDialogRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        isWarningShownRef.current = false;
    }, []);

    const showWarning = useCallback(() => {
        if (isWarningShownRef.current) return;
        isWarningShownRef.current = true;

        // Create a warning overlay with glassmorphism
        const overlay = document.createElement('div');
        overlay.id = 'inactivity-warning-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            overflow: hidden;
        `;

        const orb1 = document.createElement('div');
        orb1.className = 'inactivity-orb inactivity-orb-1';
        orb1.id = 'inactivity-orb-1';
        
        const orb2 = document.createElement('div');
        orb2.className = 'inactivity-orb inactivity-orb-2';
        orb2.id = 'inactivity-orb-2';

        const dialog = document.createElement('div');
        dialog.id = 'inactivity-warning-dialog';
        dialog.style.cssText = `
            position: relative;
            z-index: 10;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            border-top: 1px solid rgba(255, 255, 255, 0.7);
            border-radius: 36px;
            padding: 56px 48px;
            max-width: 480px;
            width: 90%;
            text-align: center;
            box-shadow: 0 35px 70px -15px rgba(15, 23, 42, 0.22), 0 0 80px -10px rgba(99, 102, 241, 0.3);
            animation: wpSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), wpPulseGlow 2.5s infinite ease-in-out;
        `;

        dialog.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity: 0; backdrop-filter: blur(0px); } to { opacity: 1; backdrop-filter: blur(15px); } }
                @keyframes wpSlideUp { 
                    from { opacity: 0; transform: perspective(1000px) translateY(30px) scale(0.95); } 
                    to { opacity: 1; transform: perspective(1000px) translateY(0) scale(1); } 
                }
                @keyframes wpPulseGlow {
                    0%, 100% { box-shadow: 0 35px 70px -15px rgba(15, 23, 42, 0.22), 0 0 50px -10px rgba(99, 102, 241, 0.2); }
                    50% { box-shadow: 0 35px 70px -15px rgba(15, 23, 42, 0.22), 0 0 70px -5px rgba(99, 102, 241, 0.4); }
                }
                @keyframes wpPulseGlowWarning {
                    0%, 100% { box-shadow: 0 35px 70px -15px rgba(15, 23, 42, 0.22), 0 0 50px -10px rgba(239, 68, 68, 0.3); }
                    50% { box-shadow: 0 35px 70px -15px rgba(15, 23, 42, 0.22), 0 0 70px -5px rgba(239, 68, 68, 0.55); }
                }
                @keyframes floatOrb1 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(50px, 40px) scale(1.3); }
                }
                @keyframes floatOrb2 {
                    0%, 100% { transform: translate(0, 0) scale(1.2); }
                    50% { transform: translate(-50px, -40px) scale(0.95); }
                }
                @keyframes tickPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.08); }
                }
                @keyframes screenVignettePulse {
                    0%, 100% { box-shadow: inset 0 0 40px rgba(239, 68, 68, 0); }
                    50% { box-shadow: inset 0 0 50px rgba(239, 68, 68, 0.45); }
                }
                @keyframes subtleShake {
                    0%, 100% { transform: perspective(1000px) scale(1) translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: perspective(1000px) scale(1) translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: perspective(1000px) scale(1) translateX(4px); }
                }
                @keyframes ringBell {
                    0%, 100% { transform: rotate(0deg); }
                    15%, 45%, 75% { transform: rotate(12deg); }
                    30%, 60%, 90% { transform: rotate(-12deg); }
                }
                @keyframes textFlash {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(239, 68, 68, 0)); }
                    50% { transform: scale(1.12); filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.7)); color: #EF4444; }
                }
                @keyframes floatOrb1Urgent {
                    0%, 100% { transform: translate(0, 0) scale(1.1); }
                    50% { transform: translate(60px, -45px) scale(1.4); }
                }
                @keyframes floatOrb2Urgent {
                    0%, 100% { transform: translate(0, 0) scale(1.3); }
                    50% { transform: translate(-60px, 45px) scale(1.0); }
                }
                .anim-stagger-1 { animation: wpSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
                .anim-stagger-2 { animation: wpSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: 0.08s; }
                .anim-stagger-3 { animation: wpSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: 0.16s; }
                .anim-stagger-4 { animation: wpSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: 0.24s; }
                
                .inactivity-orb {
                    position: absolute;
                    width: 300px;
                    height: 300px;
                    border-radius: 9999px;
                    filter: blur(85px);
                    opacity: 0.25;
                    z-index: 1;
                    pointer-events: none;
                    transition: background 0.8s ease, transform 0.5s ease, opacity 0.5s ease;
                }
                .inactivity-orb-1 {
                    background: #6366F1;
                    top: calc(50% - 200px);
                    left: calc(50% - 250px);
                    animation: floatOrb1 9s infinite ease-in-out;
                }
                .inactivity-orb-2 {
                    background: #EC4899;
                    bottom: calc(50% - 200px);
                    right: calc(50% - 250px);
                    animation: floatOrb2 9s infinite ease-in-out;
                }
                #inactivity-warning-dialog {
                    transition: transform 0.1s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease;
                    transform-style: preserve-3d;
                }
            </style>

            <div id="inactivity-timer-container" class="anim-stagger-1" style="position: relative; width: 140px; height: 140px; margin: 0 auto 32px; display: flex; align-items: center; justify-content: center; transform-origin: center; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                <svg style="position: absolute; transform: rotate(-90deg); width: 140px; height: 140px;">
                    <circle cx="70" cy="70" r="60" stroke="rgba(243, 244, 246, 0.8)" stroke-width="8" fill="transparent" />
                    <circle id="inactivity-progress-ring" cx="70" cy="70" r="60" stroke="url(#timer-gradient)" stroke-width="8" stroke-linecap="round" fill="transparent" stroke-dasharray="377" stroke-dashoffset="0" />
                    <defs>
                        <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#6366F1" />
                            <stop offset="100%" stop-color="#EC4899" />
                        </linearGradient>
                    </defs>
                </svg>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; user-select: none;">
                    <span id="inactivity-countdown-number" style="font-size: 38px; font-weight: 900; color: #1F2937; font-feature-settings: 'tnum'; font-family: system-ui, -apple-system, sans-serif; line-height: 1;">60</span>
                    <span style="font-size: 10px; font-weight: 750; color: #9CA3AF; letter-spacing: 0.15em; margin-top: 6px;">SECONDS</span>
                </div>
            </div>

            <div id="inactivity-bell-container" class="anim-stagger-2" style="text-align: center; margin-bottom: 12px; height: 32px; display: flex; align-items: center; justify-content: center;">
                <svg id="inactivity-warning-bell" style="width: 32px; height: 32px; fill: none; stroke: #9CA3AF; stroke-width: 2; transition: stroke 0.3s ease, transform 0.2s, filter 0.3s ease;" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
            </div>

            <h2 class="anim-stagger-2" style="margin: 0 0 12px; font-size: 26px; font-weight: 900; background: linear-gradient(135deg, #111827 0%, #374151 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: system-ui, -apple-system, sans-serif;">Are you still there?</h2>
            <p class="anim-stagger-3" style="margin: 0 0 40px; font-size: 15.5px; color: #4B5563; line-height: 1.6; font-family: system-ui, -apple-system, sans-serif;">
                Your session is about to expire due to inactivity. Click below to continue working.
            </p>

            <div class="anim-stagger-4" style="display: flex; gap: 16px;">
                <button id="inactivity-logout-btn" style="
                    flex: 1;
                    background: rgba(254, 226, 226, 0.45);
                    color: #EF4444;
                    border: 1.5px solid rgba(239, 68, 68, 0.25);
                    padding: 16px 24px;
                    border-radius: 16px;
                    font-size: 15.5px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: system-ui, -apple-system, sans-serif;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <svg style="width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.5; margin-right: 8px; transition: transform 0.25s;" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                </button>
                <button id="inactivity-stay-btn" style="
                    flex: 1;
                    background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
                    color: white;
                    border: none;
                    padding: 16px 24px;
                    border-radius: 16px;
                    font-size: 15.5px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
                    font-family: system-ui, -apple-system, sans-serif;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <svg style="width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.5; margin-right: 8px; transition: transform 0.25s;" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Stay signed in
                </button>
            </div>
        `;

        overlay.appendChild(orb1);
        overlay.appendChild(orb2);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        warningDialogRef.current = overlay;

        // Start countdown timer
        const warningDurationMs = getWarningDurationMs();
        const totalSeconds = Math.floor(warningDurationMs / 1000);
        let timeLeft = totalSeconds;
        const countText = document.getElementById('inactivity-countdown-number');
        const progressRing = document.getElementById('inactivity-progress-ring');
        const dialogCard = document.getElementById('inactivity-warning-dialog');
        const timerContainer = document.getElementById('inactivity-timer-container');

        const updateRingOffset = (timeRemaining) => {
            if (progressRing) {
                const fraction = Math.max(0, timeRemaining / totalSeconds);
                const offset = 377 * (1 - fraction);
                progressRing.style.strokeDashoffset = offset;

                // Adjust color, shadow, pulse scale, alarm bell, and flashing text as time runs low
                const bell = document.getElementById('inactivity-warning-bell');

                if (timeRemaining <= 15) {
                    progressRing.style.stroke = '#EF4444';
                    progressRing.style.filter = 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.8))';
                    
                    // Ring the alarm bell
                    if (bell) {
                        bell.style.stroke = '#EF4444';
                        bell.style.animation = 'ringBell 0.8s infinite ease-in-out';
                        bell.style.filter = 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))';
                    }

                    // Flashing text alarm
                    if (countText) {
                        countText.style.animation = 'textFlash 1s infinite ease-in-out';
                    }
                    
                    // Shake modal on entering warning threshold (15s), then pulse
                    if (timeRemaining === 15) {
                        if (dialogCard) {
                            dialogCard.style.animation = 'subtleShake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both';
                            setTimeout(() => {
                                if (isWarningShownRef.current) {
                                    const currSeconds = parseInt(countText ? countText.innerText : '0', 10);
                                    if (currSeconds <= 15 && dialogCard) {
                                        dialogCard.style.animation = 'wpPulseGlowWarning 2s infinite ease-in-out';
                                    }
                                }
                            }, 600);
                        }
                    } else if (dialogCard && (!dialogCard.style.animation || !dialogCard.style.animation.includes('subtleShake'))) {
                        dialogCard.style.animation = 'wpPulseGlowWarning 2s infinite ease-in-out';
                    }

                    // Ambient screen border pulse to gain attention
                    if (overlay) {
                        overlay.style.animation = 'screenVignettePulse 2s infinite ease-in-out';
                    }
                    
                    // Trigger dynamic warm/urgent coloring and acceleration of drift-orbs
                    const o1 = document.getElementById('inactivity-orb-1');
                    const o2 = document.getElementById('inactivity-orb-2');
                    if (o1) {
                        o1.style.background = '#EF4444';
                        o1.style.opacity = '0.35';
                        o1.style.animation = 'floatOrb1Urgent 3s infinite ease-in-out';
                    }
                    if (o2) {
                        o2.style.background = '#F97316';
                        o2.style.opacity = '0.35';
                        o2.style.animation = 'floatOrb2Urgent 3s infinite ease-in-out';
                    }

                    // Accelerate countdown pulse under 10 seconds to create urgency
                    if (timerContainer) {
                        if (timeRemaining <= 10) {
                            timerContainer.style.animation = 'tickPulse 0.5s infinite cubic-bezier(0.25, 0.8, 0.25, 1)';
                        } else {
                            timerContainer.style.animation = 'tickPulse 1s infinite cubic-bezier(0.25, 0.8, 0.25, 1)';
                        }
                    }
                } else {
                    progressRing.style.stroke = 'url(#timer-gradient)';
                    progressRing.style.filter = 'drop-shadow(0 0 5px rgba(99, 102, 241, 0.4))';
                    if (countText) {
                        countText.style.color = '#1F2937';
                        countText.style.animation = 'none';
                    }
                    if (dialogCard) dialogCard.style.animation = 'wpSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), wpPulseGlow 2.5s infinite ease-in-out';
                    if (timerContainer) timerContainer.style.animation = 'none';
                    if (overlay) {
                        overlay.style.animation = 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
                    }
                    if (bell) {
                        bell.style.stroke = '#9CA3AF';
                        bell.style.animation = 'none';
                        bell.style.filter = 'none';
                    }
                    const o1 = document.getElementById('inactivity-orb-1');
                    const o2 = document.getElementById('inactivity-orb-2');
                    if (o1) {
                        o1.style.background = '#6366F1';
                        o1.style.opacity = '0.25';
                        o1.style.animation = 'floatOrb1 9s infinite ease-in-out';
                    }
                    if (o2) {
                        o2.style.background = '#EC4899';
                        o2.style.opacity = '0.25';
                        o2.style.animation = 'floatOrb2 9s infinite ease-in-out';
                    }
                }
            }
        };

        // Initialize progress ring
        updateRingOffset(timeLeft);

        intervalRef.current = setInterval(() => {
            timeLeft -= 1;
            if (countText) {
                countText.innerText = timeLeft;
            }
            updateRingOffset(timeLeft);

            if (timeLeft <= 0) {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        }, 1000);

        // 3D Parallax Tilt Effect
        dialog.addEventListener('mousemove', (e) => {
            const rect = dialog.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Limit tilt rotation to max 6 degrees for subtle premium feel
            const rotateX = -(y / (rect.height / 2)) * 6;
            const rotateY = (x / (rect.width / 2)) * 6;
            
            // Shift box shadow slightly opposite to cursor to enhance 3D depth
            const shadowX = -(x / (rect.width / 2)) * 20;
            const shadowY = -(y / (rect.height / 2)) * 20;
            
            dialog.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            dialog.style.boxShadow = `${shadowX}px ${shadowY}px 60px rgba(15, 23, 42, 0.18), 0 0 70px rgba(99, 102, 241, 0.3)`;
        });

        dialog.addEventListener('mouseleave', () => {
            dialog.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
            dialog.style.boxShadow = '0 35px 70px -15px rgba(15, 23, 42, 0.22), 0 0 80px -10px rgba(99, 102, 241, 0.3)';
        });

        // Add click handler for the stay button
        const stayBtn = document.getElementById('inactivity-stay-btn');
        if (stayBtn) {
            const stayIcon = stayBtn.querySelector('svg');
            stayBtn.addEventListener('click', () => {
                dismissWarning();
                resetTimer();
            });
            stayBtn.addEventListener('mouseenter', () => {
                stayBtn.style.transform = 'translateY(-3px) scale(1.025) translateZ(12px)';
                stayBtn.style.boxShadow = '0 8px 25px rgba(79, 70, 229, 0.5)';
                stayBtn.style.filter = 'brightness(1.08)';
                if (stayIcon) stayIcon.style.transform = 'scale(1.15) rotate(5deg)';
            });
            stayBtn.addEventListener('mouseleave', () => {
                stayBtn.style.transform = 'translateY(0) scale(1) translateZ(0)';
                stayBtn.style.boxShadow = '0 4px 15px rgba(79, 70, 229, 0.3)';
                stayBtn.style.filter = 'none';
                if (stayIcon) stayIcon.style.transform = 'scale(1) rotate(0deg)';
            });
        }

        // Add click handler for the logout button
        const logoutBtn = document.getElementById('inactivity-logout-btn');
        if (logoutBtn) {
            const logoutIcon = logoutBtn.querySelector('svg');
            logoutBtn.addEventListener('click', () => {
                performLogout();
            });
            logoutBtn.addEventListener('mouseenter', () => {
                logoutBtn.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
                logoutBtn.style.color = '#ffffff';
                logoutBtn.style.borderColor = 'transparent';
                logoutBtn.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.4)';
                logoutBtn.style.transform = 'translateY(-3px) scale(1.025) translateZ(8px)';
                if (logoutIcon) logoutIcon.style.transform = 'translateX(3px) scale(1.1)';
            });
            logoutBtn.addEventListener('mouseleave', () => {
                logoutBtn.style.background = 'rgba(254, 226, 226, 0.45)';
                logoutBtn.style.color = '#EF4444';
                logoutBtn.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                logoutBtn.style.boxShadow = 'none';
                logoutBtn.style.transform = 'translateY(0) scale(1) translateZ(0)';
                if (logoutIcon) logoutIcon.style.transform = 'translateX(0) scale(1)';
            });
        }
    }, [dismissWarning, getWarningDurationMs]);

    const resetTimer = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return; // Don't set timers if not logged in

        const timeoutMs = getInactivityTimeoutMs();
        const warningDurationMs = getWarningDurationMs();

        lastActivityRef.current = Date.now();
        clearTimers();

        // Set warning timer (fires warningDurationMs before logout)
        const warningDelay = Math.max(0, timeoutMs - warningDurationMs);
        warningTimeoutRef.current = setTimeout(() => {
            showWarning();
        }, warningDelay);

        // Set logout timer
        timeoutRef.current = setTimeout(() => {
            performLogout();
        }, timeoutMs);
    }, [clearTimers, performLogout, showWarning, dismissWarning, getInactivityTimeoutMs, getWarningDurationMs]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return; // Don't activate if not logged in

        // On exempt routes (attendance kiosk), disable auto-logout entirely:
        // tear down any running timers / warning and skip registering activity listeners.
        if (isExempt) {
            clearTimers();
            dismissWarning();
            return;
        }

        // Throttled activity handler — ignored while warning is visible
        let lastUpdate = 0;
        const handleActivity = () => {
            if (isWarningShownRef.current) return;
            const now = Date.now();
            if (now - lastUpdate > THROTTLE_MS) {
                lastUpdate = now;
                resetTimer();
            }
        };

        // Listen for settings updates to immediately recalculate remaining time
        const handleSettingsUpdate = () => {
            resetTimer();
        };
        window.addEventListener('settingsLoaded', handleSettingsUpdate);

        // Register event listeners
        ACTIVITY_EVENTS.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        // Start initial timer
        resetTimer();

        // Cleanup
        return () => {
            window.removeEventListener('settingsLoaded', handleSettingsUpdate);
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            clearTimers();
            // Clean up warning dialog if present
            if (warningDialogRef.current && warningDialogRef.current.parentNode) {
                warningDialogRef.current.parentNode.removeChild(warningDialogRef.current);
            }
        };
    }, [resetTimer, clearTimers, dismissWarning, isExempt]);

    return null;
};

export default useInactivityTimer;
