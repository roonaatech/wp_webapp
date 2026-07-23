import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
const THROTTLE_MS = 30000; // Only update timestamp every 30 seconds to avoid excessive writes
const WARNING_BEFORE_MS = 60 * 1000; // Show warning 1 minute before expiry

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
            background: #ffffff;
            border-radius: 20px;
            padding: 36px 32px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            animation: wpSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        dialog.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes wpSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes wpBadgePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
            </style>

            <div style="width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 9999px; background: #FEF3C7; display: flex; align-items: center; justify-content: center; animation: wpBadgePulse 2s ease-in-out infinite;">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 7v5l3 2"></path>
                </svg>
            </div>

            <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #111827;">Are you still there?</h2>
            <p style="margin: 0 0 24px; font-size: 15px; color: #6B7280; line-height: 1.5;">
                For your security, you'll be signed out in
                <span id="inactivity-countdown-text" style="font-weight: 700; color: #B45309;">60</span> seconds.
            </p>

            <div style="width: 100%; height: 8px; background: #F3F4F6; border-radius: 9999px; overflow: hidden; margin: 0 0 28px;">
                <div id="inactivity-progress-bar" style="height: 100%; width: 100%; background: #F59E0B; border-radius: 9999px; transition: width 1s linear, background 0.4s ease;"></div>
            </div>

            <div style="display: flex; gap: 12px;">
                <button id="inactivity-logout-btn" style="
                    flex: 1;
                    background: #ffffff;
                    color: #374151;
                    border: 1px solid #E5E7EB;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                ">Log out</button>
                <button id="inactivity-stay-btn" style="
                    flex: 1;
                    background: #4F46E5;
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 10px -2px rgba(79, 70, 229, 0.4);
                ">Stay signed in</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        warningDialogRef.current = overlay;

        // Start countdown timer
        const totalSeconds = Math.floor(WARNING_BEFORE_MS / 1000);
        let timeLeft = totalSeconds;
        const countText = document.getElementById('inactivity-countdown-text');
        const progressBar = document.getElementById('inactivity-progress-bar');

        intervalRef.current = setInterval(() => {
            timeLeft -= 1;
            if (countText) {
                countText.innerText = timeLeft;
                // Emphasise urgency in the final stretch
                if (timeLeft <= 10) countText.style.color = '#DC2626';
            }
            if (progressBar) {
                const fraction = Math.max(0, timeLeft / totalSeconds);
                progressBar.style.width = `${fraction * 100}%`;
                progressBar.style.background = timeLeft <= 10 ? '#EF4444' : '#F59E0B';
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
                stayBtn.style.background = '#4338CA';
                stayBtn.style.boxShadow = '0 6px 14px -2px rgba(79, 70, 229, 0.5)';
            });
            stayBtn.addEventListener('mouseleave', () => {
                stayBtn.style.transform = 'translateY(0)';
                stayBtn.style.background = '#4F46E5';
                stayBtn.style.boxShadow = '0 4px 10px -2px rgba(79, 70, 229, 0.4)';
            });
        }

        // Add click handler for the logout button
        const logoutBtn = document.getElementById('inactivity-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                performLogout();
            });
            logoutBtn.addEventListener('mouseenter', () => {
                logoutBtn.style.background = '#F9FAFB';
                logoutBtn.style.borderColor = '#D1D5DB';
            });
            logoutBtn.addEventListener('mouseleave', () => {
                logoutBtn.style.background = '#ffffff';
                logoutBtn.style.borderColor = '#E5E7EB';
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
    }, [resetTimer, clearTimers, dismissWarning, isExempt]);

    return null;
};

export default useInactivityTimer;
