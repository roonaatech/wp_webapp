import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import AxiosInterceptorSetup from './components/AxiosInterceptorSetup';
import Login from './pages/Login';
import SessionExpired from './pages/SessionExpired';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Approvals from './pages/Approvals';
import Reports from './pages/Reports';
import Activities from './pages/Activities';
import LeaveTypes from './pages/LeaveTypes';
import Calendar from './pages/Calendar';
import ActiveOnDuty from './pages/ActiveOnDuty';

const ProtectedLayout = ({ children }) => (
  <ProtectedRoute>
    <div className="flex h-screen bg-gray-50">
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

function App() {
  return (
    <Router>
      <AxiosInterceptorSetup>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/session-expired" element={<SessionExpired />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/users" element={<ProtectedLayout><Users /></ProtectedLayout>} />
          <Route path="/approvals" element={<ProtectedLayout><Approvals /></ProtectedLayout>} />
          <Route path="/calendar" element={<ProtectedLayout><Calendar /></ProtectedLayout>} />
          <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
          <Route path="/activities" element={<ProtectedLayout><Activities /></ProtectedLayout>} />
          <Route path="/leave-types" element={<ProtectedLayout><LeaveTypes /></ProtectedLayout>} />
          <Route path="/active-onduty" element={<ProtectedLayout><ActiveOnDuty /></ProtectedLayout>} />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AxiosInterceptorSetup>
    </Router>
  );
}

export default App;
