import axios from 'axios';

// 1. Crear instancia base
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://localhost:3000/api',
});

// 2. Interceptor de Peticiones: Adjunta el JWT almacenado
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 3. Interceptor de Respuestas: Atrapa la expiración en Redis (401/403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Borrar token local
      localStorage.removeItem('token');

      // Redirigir si no está ya en la pantalla de login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
