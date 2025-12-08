import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { useLoginModal } from '../contexts/LoginModalContext';

/**
 * ProtectedRoute - Componente para proteger rutas que requieren autenticación
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componente hijo a renderizar si está autenticado
 * @param {string[]} props.allowedRoles - Array de roles permitidos (opcional)
 * @param {string} props.redirectTo - Ruta a la que redirigir si no está autenticado (default: '/login')
 */
export default function ProtectedRoute({ 
  children, 
  allowedRoles = [], 
  redirectTo = '/login' 
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const { openLoginModal, isLoginModalVisible } = useLoginModal();
  const location = useLocation();
  const hasTriedToOpenModal = useRef(false);

  // Si no está autenticado, abrir modal UNA SOLA VEZ
  useEffect(() => {
    if (!loading && !isAuthenticated && !isLoginModalVisible && !hasTriedToOpenModal.current) {
      hasTriedToOpenModal.current = true;
      openLoginModal(() => {
        // Callback después de login exitoso
        hasTriedToOpenModal.current = false; // Reset para futuras necesidades
      });
    }
    
    // Reset si el usuario se autenticó
    if (isAuthenticated) {
      hasTriedToOpenModal.current = false;
    }
  }, [loading, isAuthenticated, isLoginModalVisible, openLoginModal, location.pathname]);

  // Mostrar spinner mientras se carga la autenticación
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        gap: 16
      }}>
        <Spin size="large" />
        <div style={{ color: '#1890ff', fontSize: 16, fontWeight: 500 }}>Verificando autenticación...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // FALLBACK: Verificar localStorage directamente como última oportunidad
    // Esto maneja el caso edge donde React no ha terminado de actualizar el estado
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      // Dar tiempo a que useAuth termine de actualizar el estado
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          gap: 16
        }}>
          <Spin size="large" />
          <div style={{ color: '#1890ff', fontSize: 16, fontWeight: 500 }}>Restaurando sesión...</div>
        </div>
      );
    }
    
    // No hay sesión en absoluto - mostrar mensaje
    return (
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Acceso Restringido</h2>
          <p>Debes iniciar sesión para acceder a esta página</p>
        </div>
      </div>
    );
  }

  // Si hay roles permitidos, verificar que el usuario tenga uno de ellos
  if (allowedRoles.length > 0 && (!user?.role || !allowedRoles.includes(user.role))) {
    return (
      <Navigate 
        to="/" 
        state={{ 
          from: location,
          error: 'No tienes permisos para acceder a esta página'
        }} 
        replace 
      />
    );
  }

  // Usuario autenticado y con permisos correctos
  return children;
}

/**
 * AdminRoute - Atajo para rutas que solo pueden acceder ADMIN
 */
export function AdminRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      {children}
    </ProtectedRoute>
  );
}

/**
 * OrganizerRoute - Atajo para rutas que pueden acceder ADMIN y ORGANIZER
 */
export function OrganizerRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'ORGANIZER']}>
      {children}
    </ProtectedRoute>
  );
}

/**
 * CustomerRoute - Atajo para rutas que solo pueden acceder CUSTOMER
 */
export function CustomerRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['CUSTOMER']}>
      {children}
    </ProtectedRoute>
  );
}
