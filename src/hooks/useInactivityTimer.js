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
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
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
            padding: 32px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            animation: slideUp 0.3s ease;
        `;

        dialog.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            </style>
            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #FEF3C7, #FDE68A); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; animation: pulse 2s infinite;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            </div>
            <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1F2937;">Session Timeout Warning</h2>
            <p style="margin: 0 0 24px; font-size: 14px; color: #6B7280; line-height: 1.6;">
                You've been inactive for a while. Your session will expire in <strong style="color: #D97706;">1 minute</strong>. Move your mouse or press any key to stay logged in.
            </p>
            <button id="inactivity-stay-btn" style="
                background: linear-gradient(135deg, #2E5090, #1a3461);
                color: white;
                border: none;
                padding: 12px 32px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                transition: all 0.2s;
                box-shadow: 0 4px 6px -1px rgba(46, 80, 144, 0.3);
            ">Stay Logged In</button>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        warningDialogRef.current = overlay;

        // Add click handler for the stay button
        const stayBtn = document.getElementById('inactivity-stay-btn');
        if (stayBtn) {
            stayBtn.addEventListener('click', () => {
                dismissWarning();
                resetTimer();
            });
            stayBtn.addEventListener('mouseenter', () => {
                stayBtn.style.transform = 'translateY(-1px)';
                stayBtn.style.boxShadow = '0 6px 12px -2px rgba(46, 80, 144, 0.4)';
            });
            stayBtn.addEventListener('mouseleave', () => {
                stayBtn.style.transform = 'translateY(0)';
                stayBtn.style.boxShadow = '0 4px 6px -1px rgba(46, 80, 144, 0.3)';
            });
        }
    }, [dismissWarning]);

    const resetTimer = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return; // Don't set timers if not logged in

        lastActivityRef.current = Date.now();
        clearTimers();

        // Dismiss warning if shown (user interacted)
        if (isWarningShownRef.current) {
            dismissWarning();
        }

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

        // Throttled activity handler
        let lastUpdate = 0;
        const handleActivity = () => {
            const now = Date.now();
            if (now - lastUpdate > THROTTLE_MS || isWarningShownRef.current) {
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
