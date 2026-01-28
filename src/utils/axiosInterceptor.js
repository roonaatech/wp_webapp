import axios from 'axios';

/**
 * Axios instance with interceptors for handling authentication errors
 * Use this instead of importing axios directly in components
 */
const api = axios.create();

// Flag to prevent multiple redirects
let isRedirecting = false;

/**
 * Setup axios interceptors for global error handling
 * This should be called once when the app initializes
 */
export const setupAxiosInterceptors = (navigate) => {
    // Request interceptor - add token to all requests
    api.interceptors.request.use(
        (config) => {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers['x-access-token'] = token;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor - handle 401/403 errors
    api.interceptors.response.use(
        (response) => response,
        (error) => {
            const status = error.response?.status;
            const message = error.response?.data?.message?.toLowerCase() || '';

            // DON'T redirect if this is a login request
            const isLoginRequest = error.config?.url?.includes('auth/signin');
            if (isLoginRequest) {
                return Promise.reject(error);
            }

            // Handle 403 Forbidden (permission denied)
            if (status === 403) {
                // Prevent multiple redirects
                if (!isRedirecting) {
                    isRedirecting = true;

                    // Don't clear token/user data for 403 - user is authenticated but lacks permission
                    // Navigate to unauthorized page
                    navigate('/unauthorized', { replace: true });

                    // Reset flag after a short delay
                    setTimeout(() => {
                        isRedirecting = false;
                    }, 1000);
                }
                return Promise.reject(error);
            }

            // Handle 401 Unauthorized (session expired)
            if (status === 401) {
                // Prevent multiple redirects
                if (!isRedirecting) {
                    isRedirecting = true;

                    // Clear stored auth data
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');

                    // Determine the reason for session expiry
                    let reason = 'expired';
                    // Check for inactive user
                    if (message.includes('inactive')) {
                        reason = 'inactive';
                    } else if (message.includes('token') && message.includes('expired')) {
                        reason = 'expired';
                    }

                    // Navigate to session expired page
                    navigate('/session-expired', {
                        state: { reason },
                        replace: true
                    });

                    // Reset flag after a short delay
                    setTimeout(() => {
                        isRedirecting = false;
                    }, 1000);
                }
            }

            return Promise.reject(error);
        }
    );
};

/**
 * Also setup interceptor on the global axios instance
 * This handles cases where axios is used directly instead of the api instance
 */
export const setupGlobalAxiosInterceptors = (navigate) => {
    // Response interceptor for global axios
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            const status = error.response?.status;
            const message = error.response?.data?.message?.toLowerCase() || '';

            // DON'T redirect if this is a login request
            const isLoginRequest = error.config?.url?.includes('auth/signin');
            if (isLoginRequest) {
                return Promise.reject(error);
            }

            // Handle 403 Forbidden (permission denied)
            if (status === 403) {
                // Prevent multiple redirects
                if (!isRedirecting) {
                    isRedirecting = true;

                    // Don't clear token/user data for 403 - user is authenticated but lacks permission
                    // Navigate to unauthorized page
                    navigate('/unauthorized', { replace: true });

                    // Reset flag after a short delay
                    setTimeout(() => {
                        isRedirecting = false;
                    }, 1000);
                }
                return Promise.reject(error);
            }

            // Handle 401 Unauthorized (session expired)
            if (status === 401) {
                // Prevent multiple redirects
                if (!isRedirecting) {
                    isRedirecting = true;

                    // Clear stored auth data
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');

                    // Determine the reason for session expiry
                    let reason = 'expired';
                    // Check for inactive user
                    if (message.includes('inactive')) {
                        reason = 'inactive';
                    } else if (message.includes('token') && message.includes('expired')) {
                        reason = 'expired';
                    }

                    // Navigate to session expired page
                    navigate('/session-expired', {
                        state: { reason },
                        replace: true
                    });

                    // Reset flag after a short delay
                    setTimeout(() => {
                        isRedirecting = false;
                    }, 1000);
                }
            }

            return Promise.reject(error);
        }
    );
};

export default api;
