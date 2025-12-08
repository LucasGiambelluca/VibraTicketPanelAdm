import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && token !== 'cookie-based-auth') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      
      // Solo limpiar sesión y redirigir si es un endpoint de LOGIN
      // NO incluir /users/me porque se usa para validación en segundo plano
      // y no debería causar logout si falla
      const isLoginEndpoint = url.includes('/auth/login');
      
      if (isLoginEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // No redirigir aquí, dejar que el componente de login maneje el error
      }
      // Para otros endpoints (incluyendo /users/me), el componente que hizo la llamada manejará el error
    }
    return Promise.reject(error);
  }
);
