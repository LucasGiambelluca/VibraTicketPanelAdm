import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { LoginModalProvider } from './contexts/LoginModalContext';
import { RegisterModalProvider } from './contexts/RegisterModalContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import AdminLogin from './pages/AdminLogin';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/admin/AdminDashboard';

function App() {
  return (
    <AuthProvider>
      <LoginModalProvider>
        <RegisterModalProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AdminLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route 
                path="/admin/*" 
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'ORGANIZER', 'PRODUCER', 'DOOR']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
            
            {/* Global Modals */}
            <LoginModal />
            <RegisterModal />
          </BrowserRouter>
        </RegisterModalProvider>
      </LoginModalProvider>
    </AuthProvider>
  );
}

export default App;
