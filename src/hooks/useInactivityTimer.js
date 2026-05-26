import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
const THROTTLE_MS = 30000; // Only update timestamp every 30 seconds to avoid excessive writes
const WARNING_BEFORE_MS = 60 * 1000; // Show warning 1 minute before expiry

/**
 * Custom hook that monitors user activity and logs them out
 * after 15 minutes of inactivity. Shows a warning 1 minute before.
 */
const useInactivityTimer = () => {
    const navigate = useNavigate();
    const timeoutRef = useRef(null);
    const warningTimeoutRef = useRef(null);
    const intervalRef = useRef(null);
    const lastActivityRef = useRef(Date.now());
    const isWarningShownRef = useRef(false);
    const warningDialogRef = useRef(null);

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

        // Create a warning overlay
        const overlay = document.createElement('div');
        overlay.id = 'inactivity-warning-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(2px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 480px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            animation: slideUp 0.3s ease;
        `;

        dialog.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            </style>
            
            <h2 style="margin: 0 0 32px; font-size: 24px; font-weight: 600; color: #111827;">Your session is expiring in ...</h2>
            
            <div style="width: 160px; height: 160px; margin: 0 auto 32px; position: relative; display: flex; align-items: center; justify-content: center;">
                <svg width="160" height="160" viewBox="0 0 160 160" style="position: absolute; inset: 0; transform: rotate(-90deg);">
                    <defs>
                        <mask id="progress-mask">
                            <circle id="inactivity-progress-sweep" cx="80" cy="80" r="70" fill="none" stroke="white" stroke-width="16" 
                                    stroke-dasharray="439.82" stroke-dashoffset="0" style="transition: stroke-dashoffset 1s linear;" />
                        </mask>
                    </defs>
                    <!-- Background ticks -->
                    <circle cx="80" cy="80" r="70" fill="none" stroke="#DBEAFE" stroke-width="8" stroke-dasharray="3 3.10865" />
                    <!-- Active ticks -->
                    <circle cx="80" cy="80" r="70" fill="none" stroke="#1D4ED8" stroke-width="8" stroke-dasharray="3 3.10865" mask="url(#progress-mask)" />
                </svg>
                
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1;">
                    <span id="inactivity-countdown-text" style="font-size: 48px; font-weight: 700; color: #1D4ED8; line-height: 1; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;">60</span>
                    <span style="font-size: 16px; font-weight: 600; color: #1D4ED8; margin-top: 4px;">sec</span>
                </div>
            </div>

            <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
                To stay logged in, click on the button below
            </p>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 0 0 24px;" />
            
            <div style="display: flex; gap: 16px; justify-content: center;">
                <button id="inactivity-logout-btn" style="
                    background: white;
                    color: #1D4ED8;
                    border: 1px solid #1D4ED8;
                    padding: 12px 24px;
                    border-radius: 10px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    flex: 1;
                    max-width: 180px;
                    transition: all 0.2s;
                ">Logout</button>
                <button id="inactivity-stay-btn" style="
                    background: #112586;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 10px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    flex: 1;
                    max-width: 180px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(17, 37, 134, 0.3);
                ">Stay Logged In</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        warningDialogRef.current = overlay;

        // Start countdown timer
        let timeLeft = Math.floor(WARNING_BEFORE_MS / 1000);
        const countText = document.getElementById('inactivity-countdown-text');
        const progressSweep = document.getElementById('inactivity-progress-sweep');
        const circumference = 439.82;
        
        intervalRef.current = setInterval(() => {
            timeLeft -= 1;
            if (countText) countText.innerText = timeLeft;
            if (progressSweep) {
                const fraction = timeLeft / Math.floor(WARNING_BEFORE_MS / 1000);
                progressSweep.style.strokeDashoffset = circumference - (fraction * circumference);
            }
            if (timeLeft <= 0) {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        }, 1000);

        // Add click handler for the stay button
        const stayBtn = document.getElementById('inactivity-stay-btn');
        if (stayBtn) {
            stayBtn.addEventListener('click', () => {
                dismissWarning();
                resetTimer();
            });
            stayBtn.addEventListener('mouseenter', () => {
                stayBtn.style.transform = 'translateY(-1px)';
                stayBtn.style.boxShadow = '0 6px 12px -2px rgba(17, 37, 134, 0.4)';
            });
            stayBtn.addEventListener('mouseleave', () => {
                stayBtn.style.transform = 'translateY(0)';
                stayBtn.style.boxShadow = '0 4px 6px -1px rgba(17, 37, 134, 0.3)';
            });
        }

        // Add click handler for the logout button
        const logoutBtn = document.getElementById('inactivity-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                performLogout();
            });
            logoutBtn.addEventListener('mouseenter', () => {
                logoutBtn.style.background = '#EFF6FF';
            });
            logoutBtn.addEventListener('mouseleave', () => {
                logoutBtn.style.background = 'white';
            });
        }
    }, [dismissWarning]);

    const resetTimer = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return; // Don't set timers if not logged in

        lastActivityRef.current = Date.now();
        clearTimers();

        // Set warning timer (fires 1 min before logout)
        warningTimeoutRef.current = setTimeout(() => {
            showWarning();
        }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

        // Set logout timer
        timeoutRef.current = setTimeout(() => {
            performLogout();
        }, INACTIVITY_TIMEOUT_MS);
    }, [clearTimers, performLogout, showWarning, dismissWarning]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return; // Don't activate if not logged in

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

        // Register event listeners
        ACTIVITY_EVENTS.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        // Start initial timer
        resetTimer();

        // Cleanup
        return () => {
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            clearTimers();
            // Clean up warning dialog if present
            if (warningDialogRef.current && warningDialogRef.current.parentNode) {
                warningDialogRef.current.parentNode.removeChild(warningDialogRef.current);
            }
        };
    }, [resetTimer, clearTimers]);

    return null;
};

export default useInactivityTimer;
