/**
 * Central Configuration for Web Admin Backend URLs
 * Change the backend URL in ONE place to update all API calls
 */

// ============================================
// BACKEND CONFIGURATION - CHANGE URL HERE ONLY
// ============================================
// Development: http://localhost:3000
// UAT/Test: https://api.workpulse-uat.roonaa.in:3353
// Production: https://api.roonaa.in:3343

const ENVIRONMENT = import.meta.env.MODE || 'development';

const API_CONFIG = {
  development: {
    baseUrl: 'http://localhost:3000',
    description: 'Local Development'
  },
  uat: {
    baseUrl: 'https://api.workpulse-uat.roonaa.in:3353',
    description: 'UAT/Test Server'
  },
  production: {
    baseUrl: 'https://api.roonaa.in:3343',
    description: 'Production Server'
  }
};

// Get current environment config
const getEnvironment = () => {
  if (ENVIRONMENT === 'production') return 'production';
  if (ENVIRONMENT === 'uat') return 'uat';
  return 'development';
};

const currentEnv = getEnvironment();
const config = API_CONFIG[currentEnv];

const API_BASE_URL = config.baseUrl;

console.log(`🌐 Web Admin connected to ${config.description}: ${API_BASE_URL}`);

// ============================================
// API ENDPOINTS
// ============================================

export const API_ENDPOINTS = {
  // Authentication
  AUTH_CHECK: `${API_BASE_URL}/api/auth/check`,

  // Admin Dashboard
  DASHBOARD_STATS: `${API_BASE_URL}/api/admin/stats`,
  ATTENDANCE_REPORTS: `${API_BASE_URL}/api/admin/reports`,

  // Approvals - Leave
  LEAVE_APPROVALS: `${API_BASE_URL}/api/admin/leave-requests`,
  LEAVE_APPROVE: (id) => `${API_BASE_URL}/api/admin/leave-requests/${id}/approve`,
  LEAVE_REJECT: (id) => `${API_BASE_URL}/api/admin/leave-requests/${id}/reject`,

  // Approvals - On-Duty
  ONDUTY_APPROVALS: `${API_BASE_URL}/api/admin/on-duty-logs`,
  ONDUTY_APPROVE: (id) => `${API_BASE_URL}/api/admin/on-duty-logs/${id}/approve`,
  ONDUTY_REJECT: (id) => `${API_BASE_URL}/api/admin/on-duty-logs/${id}/reject`,
};

export default API_BASE_URL;
