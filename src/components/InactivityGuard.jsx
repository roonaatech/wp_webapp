import useInactivityTimer from '../hooks/useInactivityTimer';

/**
 * Component that activates the inactivity timer for authenticated users.
 * Place this inside the Router so it has access to useNavigate.
 * It renders nothing — it purely manages the timer side-effect.
 */
const InactivityGuard = () => {
    // Always call the hook — the hook itself checks for token internally
    useInactivityTimer();
    return null;
};

export default InactivityGuard;
