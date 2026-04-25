import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import AxiosInterceptorSetup from './components/AxiosInterceptorSetup';
import InactivityGuard from './components/InactivityGuard';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import API_BASE_URL from './config/api.config';
import Login from './pages/Login';
import SessionExpired from './pages/SessionExpired';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Approvals from './pages/Approvals';
import Reports from './pages/Reports';
import Activities from './pages/Activities';
import LeaveTypes from './pages/LeaveTypes';
import Roles from './pages/Roles';
import Calendar from './pages/Calendar';
import ActiveOnDuty from './pages/ActiveOnDuty';
import ApkDistribution from './pages/ApkDistribution';
import EmailSettings from './pages/EmailSettings';
import Settings from './pages/Settings';
import MyRequests from './pages/MyRequests';
import Arch from './pages/Arch';
import ShowQRCode from './pages/ShowQRCode';
import { fetchRoles } from './utils/roleUtils';


const GlobalInit = ({ children }) => {
  // Read QR params before useState so the initial value is correct on the very first render.
  // This prevents ProtectedRoute from executing (and redirecting to /login) before
  // the QR token has been validated and stored in localStorage.
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  const urlUser = urlParams.get('user');

  // false when QR params are present (block rendering until validated); true otherwise
  const [tokenValidated, setTokenValidated] = useState(!urlToken || !urlUser);

  // If token comes from URL (QR code), validate it with the server BEFORE storing
  useEffect(() => {
    const validateAndStoreQRToken = async () => {
      try {
        // Validate the token by making a lightweight authenticated request
        await axios.get(`${API_BASE_URL}/api/leavetypes`, {
          headers: { 'x-access-token': urlToken }
        });
        // Token is valid — store it
        localStorage.setItem('token', urlToken);
        localStorage.setItem('user', urlUser);
        window.history.replaceState(null, '', window.location.pathname);
        setTokenValidated(true);
        // Fetch roles and settings after successful validation
        fetchRoles();
        fetchSettings();
      } catch (err) {
        // Token is INVALID (expired, wrong secret, etc.) — reject it
        console.error('QR token validation failed:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.history.replaceState(null, '', window.location.pathname);
        window.location.href = '/session-expired';
      }
    };

    if (urlToken && urlUser) {
      validateAndStoreQRToken();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/settings`, {
        headers: { 'x-access-token': token }
      });
      if (response.data && response.data.map) {
        localStorage.setItem('settings', JSON.stringify(response.data.map));
        // Dispatch event to notify components that settings are loaded
        window.dispatchEvent(new Event('settingsLoaded'));
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    // Only run for non-QR flows (when token already exists in localStorage)
    if (!urlToken && !urlUser) {
      const token = localStorage.getItem('token');
      if (token) {
        fetchRoles();
        fetchSettings();
      }
    }
    // Expose fetchSettings globally so Login.jsx can call it
    window.refreshAppSettings = fetchSettings;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading spinner while QR token is being validated
  if (!tokenValidated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Validating session...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return children;
};

const ProtectedLayout = ({ children }) => {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-transparent transition-colors duration-300">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto">
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
};

const PublicOrProtectedLayout = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    return <ProtectedLayout>{children}</ProtectedLayout>;
  }
  return children;
};

function App() {
  return (
    <Router>
      <AxiosInterceptorSetup>
        <InactivityGuard />
        <GlobalInit>
          <Toaster
            position="top-right"
            reverseOrder={false}
            toastOptions={{
              duration: 4000,
              style: {
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              },
              success: {
                style: {
                  background: '#059669',
                  color: '#ffffff',
                },
                iconTheme: {
                  primary: '#ffffff',
                  secondary: '#059669',
                },
              },
              error: {
                style: {
                  background: '#dc2626',
                  color: '#ffffff',
                },
                iconTheme: {
                  primary: '#ffffff',
                  secondary: '#dc2626',
                },
              },
            }}
          />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/session-expired" element={<SessionExpired />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected Routes */}
            <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/users" element={<ProtectedLayout><Users /></ProtectedLayout>} />
            <Route path="/approvals" element={<ProtectedLayout><Approvals /></ProtectedLayout>} />
            <Route path="/calendar" element={<ProtectedLayout><Calendar /></ProtectedLayout>} />
            <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
            <Route path="/activities" element={<ProtectedLayout><Activities /></ProtectedLayout>} />
            <Route path="/leave-types" element={<ProtectedLayout><LeaveTypes /></ProtectedLayout>} />
            <Route path="/roles" element={<ProtectedLayout><Roles /></ProtectedLayout>} />
            <Route path="/active-onduty" element={<ProtectedLayout><ActiveOnDuty /></ProtectedLayout>} />
            <Route path="/email-settings" element={<ProtectedLayout><EmailSettings /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="/arch" element={<ProtectedLayout><Arch /></ProtectedLayout>} />
            <Route path="/apk" element={<PublicOrProtectedLayout><ApkDistribution /></PublicOrProtectedLayout>} />

            {/* Self-Service Routes (all authenticated users, no sidebar/header) */}
            <Route path="/my-requests" element={<ProtectedRoute skipWebAppCheck><MyRequests /></ProtectedRoute>} />
            <Route path="/show-qrcode" element={<ProtectedRoute><ShowQRCode /></ProtectedRoute>} />


            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </GlobalInit>
      </AxiosInterceptorSetup>
    </Router>
  );
}

export default App;
