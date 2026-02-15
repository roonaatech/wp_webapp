import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import AxiosInterceptorSetup from './components/AxiosInterceptorSetup';
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
import { fetchRoles } from './utils/roleUtils';


const GlobalInit = ({ children }) => {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchRoles();
      // Fetch application settings
      axios.get(`${API_BASE_URL}/api/settings`, {
        headers: { 'x-access-token': token }
      }).then(response => {
        if (response.data && response.data.map) {
          localStorage.setItem('settings', JSON.stringify(response.data.map));
          // Dispatch event to notify components that settings are loaded
          window.dispatchEvent(new Event('settingsLoaded'));
        }
      }).catch(err => console.error('Error fetching settings:', err));
    }
  }, []);

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
            <Route path="/apk" element={<PublicOrProtectedLayout><ApkDistribution /></PublicOrProtectedLayout>} />

            {/* Self-Service Route (all authenticated users, no sidebar/header) */}
            <Route path="/my-requests" element={<ProtectedRoute skipWebAppCheck><MyRequests /></ProtectedRoute>} />


            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </GlobalInit>
      </AxiosInterceptorSetup>
    </Router>
  );
}

export default App;
