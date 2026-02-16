import axios from 'axios';

/**
 * Axios instance with interceptors for handling authentication errors
 * Use this instead of importing axios directly in components
 */
const api = axios.create();

// Flag to prevent multiple redirects
let isRedirecting = false;

// Store interceptor IDs to allow cleanup
let apiRequestInterceptorId = null;
let apiResponseInterceptorId = null;

/**
 * Setup axios interceptors for global error handling
 * This should be called once when the app initializes
 */
export const setupAxiosInterceptors = (navigate) => {
    // Eject previous interceptors if they exist
    if (apiRequestInterceptorId !== null) {
        api.interceptors.request.eject(apiRequestInterceptorId);
    }
    if (apiResponseInterceptorId !== null) {
        api.interceptors.response.eject(apiResponseInterceptorId);
    }

    // Request interceptor - add token to all requests
    apiRequestInterceptorId = api.interceptors.request.use(
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
    apiResponseInterceptorId = api.interceptors.response.use(
        (response) => response,
        (error) => {
            const status = error.response?.status;
            const message = error.response?.data?.message?.toLowerCase() || '';

            // DON'T redirect if this is a login or password change request
            const isLoginRequest = error.config?.url?.includes('auth/signin');
            const isPasswordChangeRequest = error.config?.url?.includes('auth/change-password');
            if (isLoginRequest || isPasswordChangeRequest) {
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

// Store interceptor ID to allow cleanup
let globalResponseInterceptorId = null;

/**
 * Also setup interceptor on the global axios instance
 * This handles cases where axios is used directly instead of the api instance
 */
export const setupGlobalAxiosInterceptors = (navigate) => {
    // Eject previous interceptor if it exists
    if (globalResponseInterceptorId !== null) {
        axios.interceptors.response.eject(globalResponseInterceptorId);
    }

    // Response interceptor for global axios
    globalResponseInterceptorId = axios.interceptors.response.use(
        (response) => response,
        (error) => {
            const status = error.response?.status;
            const message = error.response?.data?.message?.toLowerCase() || '';
            const requestUrl = error.config?.url || '';

            // DON'T redirect if this is a login or password change request
            const isLoginRequest = requestUrl.includes('auth/signin');
            const isPasswordChangeRequest = requestUrl.includes('auth/change-password');

            // Debug logging
            if (status === 401) {
                console.log('🔍 Axios Interceptor - 401 Error:', {
                    url: requestUrl,
                    isPasswordChangeRequest,
                    isLoginRequest,
                    message: error.response?.data?.message
                });
            }

            if (isLoginRequest || isPasswordChangeRequest) {
                console.log('✅ Skipping redirect for:', requestUrl);
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
