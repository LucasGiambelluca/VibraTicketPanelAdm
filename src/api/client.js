import axios from 'axios';
import { isTauri } from '../lib/tauri';
import tauriAdapter from '../lib/tauriAdapter';

// Use environment variable for API URL, fallback to relative /api for development
const API_URL = import.meta.env.VITE_API_URL || '';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// En la app desktop, las requests salen por el core Rust (sin CORS, con cookie
// jar nativo). En el navegador se usa el adapter normal de axios.
if (isTauri()) {
  apiClient.defaults.adapter = tauriAdapter;
}

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

      // /auth/login: credenciales malas — limpiar y dejar que el form muestre
      // el error. /users/me: chequeo de sesión en segundo plano — lo maneja
      // quien lo llamó, sin desloguear.
      const isLoginEndpoint = url.includes('/auth/login');
      const isBackgroundCheck = url.includes('/users/me');

      if (isLoginEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else if (!isBackgroundCheck) {
        // Cualquier otro 401 = sesión vencida. Antes esto fallaba en silencio
        // (cada pantalla mostraba errores sueltos sin desloguear). Se limpia
        // la sesión y se va al login, salvo que ya estemos ahí (evita loops).
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login?expired=1');
        }
      }
    }
    return Promise.reject(error);
  }
);
