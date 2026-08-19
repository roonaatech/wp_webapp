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
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
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
            border-radius: 32px;
            padding: 48px 40px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 30px 60px -15px rgba(15, 23, 42, 0.15), 0 0 50px -10px rgba(99, 102, 241, 0.2);
            animation: wpSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), wpPulseGlow 2.5s infinite ease-in-out;
        `;

        dialog.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity: 0; backdrop-filter: blur(0px); } to { opacity: 1; backdrop-filter: blur(10px); } }
                @keyframes wpSlideUp { 
                    from { opacity: 0; transform: perspective(1000px) translateY(30px) scale(0.95); } 
                    to { opacity: 1; transform: perspective(1000px) translateY(0) scale(1); } 
                }
                @keyframes wpPulseGlow {
                    0%, 100% { box-shadow: 0 30px 60px -15px rgba(15, 23, 42, 0.15), 0 0 50px -10px rgba(99, 102, 241, 0.2); }
                    50% { box-shadow: 0 30px 60px -15px rgba(15, 23, 42, 0.15), 0 0 70px -5px rgba(99, 102, 241, 0.4); }
                }
                @keyframes wpPulseGlowWarning {
                    0%, 100% { box-shadow: 0 30px 60px -15px rgba(15, 23, 42, 0.15), 0 0 50px -10px rgba(239, 68, 68, 0.3); }
                    50% { box-shadow: 0 30px 60px -15px rgba(15, 23, 42, 0.15), 0 0 70px -5px rgba(239, 68, 68, 0.55); }
                }
                @keyframes floatOrb1 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(40px, 30px) scale(1.25); }
                }
                @keyframes floatOrb2 {
                    0%, 100% { transform: translate(0, 0) scale(1.15); }
                    50% { transform: translate(-40px, -30px) scale(0.9); }
                }
                @keyframes tickPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.08); }
                }
                .inactivity-orb {
                    position: absolute;
                    width: 260px;
                    height: 260px;
                    border-radius: 9999px;
                    filter: blur(75px);
                    opacity: 0.22;
                    z-index: 1;
                    pointer-events: none;
                    transition: background 0.8s ease, transform 0.5s ease;
                }
                .inactivity-orb-1 {
                    background: #6366F1;
                    top: calc(50% - 180px);
                    left: calc(50% - 220px);
                    animation: floatOrb1 9s infinite ease-in-out;
                }
                .inactivity-orb-2 {
                    background: #EC4899;
                    bottom: calc(50% - 180px);
                    right: calc(50% - 220px);
                    animation: floatOrb2 9s infinite ease-in-out;
                }
                #inactivity-countdown-number {
                    transition: color 0.3s ease;
                }
                #inactivity-progress-ring {
                    transition: stroke-dashoffset 1s linear, stroke 0.3s ease, filter 0.3s ease;
                }
                #inactivity-warning-dialog {
                    transition: transform 0.1s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease;
                    transform-style: preserve-3d;
                }
            </style>

            <div id="inactivity-timer-container" style="position: relative; width: 110px; height: 110px; margin: 0 auto 28px; display: flex; align-items: center; justify-content: center; transform-origin: center; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                <svg style="position: absolute; transform: rotate(-90deg); width: 110px; height: 110px;">
                    <circle cx="55" cy="55" r="48" stroke="rgba(243, 244, 246, 0.8)" stroke-width="6" fill="transparent" />
                    <circle id="inactivity-progress-ring" cx="55" cy="55" r="48" stroke="url(#timer-gradient)" stroke-width="6" stroke-linecap="round" fill="transparent" stroke-dasharray="301.6" stroke-dashoffset="0" />
                    <defs>
                        <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#6366F1" />
                            <stop offset="100%" stop-color="#EC4899" />
                        </linearGradient>
                    </defs>
                </svg>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; user-select: none;">
                    <span id="inactivity-countdown-number" style="font-size: 34px; font-weight: 850; color: #1F2937; font-feature-settings: 'tnum'; font-family: system-ui, -apple-system, sans-serif; line-height: 1;">60</span>
                    <span style="font-size: 9px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.12em; margin-top: 5px;">SEC</span>
                </div>
            </div>

            <h2 style="margin: 0 0 10px; font-size: 24px; font-weight: 850; background: linear-gradient(135deg, #111827 0%, #374151 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: system-ui, -apple-system, sans-serif;">Are you still there?</h2>
            <p style="margin: 0 0 36px; font-size: 15px; color: #6B7280; line-height: 1.5; font-family: system-ui, -apple-system, sans-serif;">
                Your session is about to expire due to inactivity. Click below to continue working.
            </p>

            <div style="display: flex; gap: 14px;">
                <button id="inactivity-logout-btn" style="
                    flex: 1;
                    background: rgba(254, 226, 226, 0.45);
                    color: #EF4444;
                    border: 1.5px solid rgba(239, 68, 68, 0.25);
                    padding: 14px 20px;
                    border-radius: 14px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: system-ui, -apple-system, sans-serif;
                ">Log out</button>
                <button id="inactivity-stay-btn" style="
                    flex: 1;
                    background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
                    color: white;
                    border: none;
                    padding: 14px 20px;
                    border-radius: 14px;
                    font-size: 15px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
                    font-family: system-ui, -apple-system, sans-serif;
                ">Stay signed in</button>
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
                const offset = 301.6 * (1 - fraction);
                progressRing.style.strokeDashoffset = offset;

                // Adjust color, shadow, and pulse scale as time runs low
                if (timeRemaining <= 15) {
                    progressRing.style.stroke = '#EF4444';
                    progressRing.style.filter = 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.7))';
                    if (countText) countText.style.color = '#EF4444';
                    if (dialogCard) dialogCard.style.animation = 'wpPulseGlowWarning 2s infinite ease-in-out';
                    
                    // Trigger dynamic warm/urgent coloring of drift-orbs
                    const o1 = document.getElementById('inactivity-orb-1');
                    const o2 = document.getElementById('inactivity-orb-2');
                    if (o1) o1.style.background = '#EF4444';
                    if (o2) o2.style.background = '#F97316';

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
                    progressRing.style.filter = 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.35))';
                    if (countText) countText.style.color = '#1F2937';
                    if (dialogCard) dialogCard.style.animation = 'wpSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), wpPulseGlow 2.5s infinite ease-in-out';
                    if (timerContainer) timerContainer.style.animation = 'none';
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
            const shadowX = -(x / (rect.width / 2)) * 16;
            const shadowY = -(y / (rect.height / 2)) * 16;
            
            dialog.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            dialog.style.boxShadow = `${shadowX}px ${shadowY}px 50px rgba(15, 23, 42, 0.15), 0 0 60px rgba(99, 102, 241, 0.25)`;
        });

        dialog.addEventListener('mouseleave', () => {
            dialog.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
            dialog.style.boxShadow = '0 20px 40px -15px rgba(0, 0, 0, 0.15), 0 0 50px -10px rgba(99, 102, 241, 0.15)';
        });

        // Add click handler for the stay button
        const stayBtn = document.getElementById('inactivity-stay-btn');
        if (stayBtn) {
            stayBtn.addEventListener('click', () => {
                dismissWarning();
                resetTimer();
            });
            stayBtn.addEventListener('mouseenter', () => {
                stayBtn.style.transform = 'translateY(-2px) scale(1.02) translateZ(10px)';
                stayBtn.style.boxShadow = '0 6px 20px rgba(79, 70, 229, 0.45)';
                stayBtn.style.filter = 'brightness(1.05)';
            });
            stayBtn.addEventListener('mouseleave', () => {
                stayBtn.style.transform = 'translateY(0) scale(1) translateZ(0)';
                stayBtn.style.boxShadow = '0 4px 15px rgba(79, 70, 229, 0.3)';
                stayBtn.style.filter = 'none';
            });
        }

        // Add click handler for the logout button
        const logoutBtn = document.getElementById('inactivity-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                performLogout();
            });
            logoutBtn.addEventListener('mouseenter', () => {
                logoutBtn.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
                logoutBtn.style.color = '#ffffff';
                logoutBtn.style.borderColor = 'transparent';
                logoutBtn.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.35)';
                logoutBtn.style.transform = 'translateY(-2px) scale(1.02) translateZ(5px)';
            });
            logoutBtn.addEventListener('mouseleave', () => {
                logoutBtn.style.background = 'rgba(254, 226, 226, 0.45)';
                logoutBtn.style.color = '#EF4444';
                logoutBtn.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                logoutBtn.style.boxShadow = 'none';
                logoutBtn.style.transform = 'translateY(0) scale(1) translateZ(0)';
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
