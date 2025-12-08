import { useState, useEffect, createContext, useContext } from 'react';
import { authApi, usersApi } from '../services/apiService';

// ============================================
// AUTH CONTEXT
// ============================================
const AuthContext = createContext(null);

// ============================================
// AUTH PROVIDER
// ============================================
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================
  // INICIALIZACIÓN - Verificar sesión restaurando desde localStorage
  // ============================================
  useEffect(() => {
    const initAuth = () => {
      
      try {
        // Verificar si hay un token en localStorage
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (!token || !storedUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Intentar parsear el usuario guardado
        try {
          const parsedUser = JSON.parse(storedUser);
          
          // React 18 automáticamente hace batch de estos updates
          setUser(parsedUser);
          setLoading(false);
          
          // Validar con el backend en segundo plano
          usersApi.getMe()
            .then(response => {
              const res = response.data || response;
              // Robust extraction matching login logic
              const userData = res.user || res.data?.user || res.data;
              
              if (userData) {
                // Ensure we preserve the token if it's not in the refresh response
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const mergedUser = { ...currentUser, ...userData };
                
                setUser(mergedUser);
                localStorage.setItem('user', JSON.stringify(mergedUser));
              }
            })
            .catch(err => {
              // Si la validación en segundo plano falla con 401, la sesión expiró
              if (err.response?.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setUser(null);
              } else {
                console.error('❌ Error en validación de sesión:', err);
              }
            });
        } catch (parseError) {
          console.error('❌ Error parseando usuario guardado:', parseError);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('❌ Error fatal al verificar sesión:', err);
        setUser(null);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // ============================================
  // LOGIN
  // ============================================
  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      // Llamar a la API de login
      const response = await authApi.login(credentials);
      
      // Extraer datos
      const res = response.data || response;
      
      // Soporte para diferentes estructuras: { user: ... }, { data: { user: ... } }, { data: ... }
      const userData = res.user || res.data?.user || res.data;

      if (!userData) {
        throw new Error('Respuesta inválida del servidor: No se encontraron datos de usuario');
      }
      
      // Extraer token si viene en la respuesta JSON
      const token = res.token || res.data?.token || userData?.token;
      
      // IMPORTANTE: El backend puede enviar el token como HTTPOnly cookie
      // En ese caso, no vendrá en response.data.token
      // Pero igual debemos guardar el usuario en localStorage para que init lo restaure
      if (token) {
        localStorage.setItem('token', token);
      } else {
        // Crear un placeholder token para indicar que hay sesión activa
        localStorage.setItem('token', 'cookie-based-auth');
      }
      
      // SIEMPRE guardar usuario en localStorage
      localStorage.setItem('user', JSON.stringify(userData));

      // Actualizar estado
      setUser(userData);
      
      return userData;
    } catch (err) {
      console.error('❌ Error detallado en login:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error al iniciar sesión';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // REGISTER
  // ============================================
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Llamar a la API de registro
      const response = await authApi.register(userData);
      
      // Extraer datos (el token ya está en la cookie)
      const res = response.data || response;
      const newUser = res.user || res.data?.user || res.data;
      
      if (!newUser) {
        throw new Error('Respuesta inválida del servidor');
      }
      
      // Extraer token si viene en la respuesta
      const token = res.token || res.data?.token || newUser?.token;
      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(newUser));
      }

      // Actualizar estado
      setUser(newUser);
      
      return newUser;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al registrar usuario';
      setError(errorMessage);
      console.error('❌ Error en registro:', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // LOGOUT
  // ============================================
  const logout = async () => {
    try {
      // Llamar al backend para borrar la cookie
      await authApi.logout();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      // Limpiar estado local independientemente del resultado
      setUser(null);
      setError(null);
      // Opcional: Redirigir o recargar si es necesario
      // window.location.href = '/login'; // DESHABILITADO: Evitar bucles de redirección
    }
  };

  // ============================================
  // REFRESH USER - Actualizar datos del usuario
  // ============================================
  const refreshUser = async () => {
    try {
      const response = await usersApi.getMe();
      const res = response.data || response;
      const userData = res.user || res.data?.user || res.data;
      
      // Actualizar estado
      setUser(userData);
      
      return userData;
    } catch (err) {
      console.error('❌ Error al actualizar usuario:', err);
      throw err;
    }
  };

  // ============================================
  // CHECK EMAIL - Verificar si email está disponible
  // ============================================
  const checkEmail = async (email) => {
    try {
      const response = await authApi.checkEmail(email);
      return response;
    } catch (err) {
      console.error('❌ Error al verificar email:', err);
      throw err;
    }
  };

  // ============================================
  // CONTEXT VALUE
  // ============================================
  const value = {
    // Estado
    user,
    loading,
    error,
    
    // Funciones
    login,
    register,
    logout,
    refreshUser,
    checkEmail,
    
    // Helpers
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isOrganizer: user?.role === 'ORGANIZER',
    isCustomer: user?.role === 'CUSTOMER',
    isDoor: user?.role === 'DOOR',
    
    // Datos del usuario
    userId: user?.id,
    userEmail: user?.email,
    userName: user?.name,
    userRole: user?.role
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// HOOK useAuth
// ============================================
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  
  return context;
};

// Export por defecto
export default useAuth;
