import axios from 'axios';

// 1. Crear instancia base
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// 2. Interceptor de Respuestas: Atrapa la expiración en Redis (401/403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // El JWT vive en cookie HttpOnly: solo limpiar caché local del usuario
      localStorage.removeItem('user');

      // Redirigir si no está ya en la pantalla de login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
