import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Contexto para controlar el modal de registro globalmente
 */
const RegisterModalContext = createContext();

export function RegisterModalProvider({ children }) {
  const [isRegisterModalVisible, setIsRegisterModalVisible] = useState(false);
  const [onSuccessCallback, setOnSuccessCallback] = useState(null);

  const openRegisterModal = useCallback((onSuccess) => {
    setIsRegisterModalVisible(true);
    if (onSuccess && typeof onSuccess === 'function') {
      setOnSuccessCallback(() => onSuccess);
    } else {
      setOnSuccessCallback(null);
    }
  }, []);

  const closeRegisterModal = useCallback(() => {
    setIsRegisterModalVisible(false);
    setOnSuccessCallback(null);
  }, []);

  const handleRegisterSuccess = useCallback((user) => {
    // Ejecutar callback solo si existe y es una función
    if (onSuccessCallback && typeof onSuccessCallback === 'function') {
      try {
        onSuccessCallback(user);
      } catch (error) {
        console.error('❌ Error ejecutando callback de registro:', error);
      }
    }
    closeRegisterModal();
  }, [onSuccessCallback, closeRegisterModal]);

  const value = {
    isRegisterModalVisible,
    openRegisterModal,
    closeRegisterModal,
    handleRegisterSuccess
  };

  return (
    <RegisterModalContext.Provider value={value}>
      {children}
    </RegisterModalContext.Provider>
  );
}

export function useRegisterModal() {
  const context = useContext(RegisterModalContext);
  if (!context) {
    throw new Error('useRegisterModal debe usarse dentro de RegisterModalProvider');
  }
  return context;
}
