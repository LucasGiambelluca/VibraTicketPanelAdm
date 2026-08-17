import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { LoginModalProvider } from './contexts/LoginModalContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginModal from './components/LoginModal';
import AdminLogin from './pages/AdminLogin';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import VenueLayoutBuilder from './pages/VenueLayoutBuilder';
import PrinterSettings from './pages/admin/PrinterSettings';

function App() {
  return (
    <AuthProvider>
      <LoginModalProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AdminLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route
                path="/admin/venues/:venueId/layout"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'ORGANIZER', 'PRODUCER', 'DOOR']}>
                    <VenueLayoutBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/impresora"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'ORGANIZER', 'PRODUCER', 'DOOR', 'BOLETERIA']}>
                    <PrinterSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'ORGANIZER', 'PRODUCER', 'DOOR', 'BOLETERIA']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route path="/" element={<Navigate to="/login" replace />} />
              {/* Catch-all: antes cualquier URL desconocida era pantalla en blanco */}
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>

            {/* Global Modals */}
            <LoginModal />
          </BrowserRouter>
      </LoginModalProvider>
    </AuthProvider>
  );
}

export default App;
