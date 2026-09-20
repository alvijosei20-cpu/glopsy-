import axios from 'axios';

// País guardado de la ubicación del usuario (evita import circular con location.js).
const storedCountry = () => {
  try {
    const raw = localStorage.getItem('location_data') || sessionStorage.getItem('location_data') || '{}';
    const iso = String(JSON.parse(raw)?.pais || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(iso) ? iso : null;
  } catch {
    return null;
  }
};

// 1. Crear instancia base
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// 2. Interceptor de Peticiones: envía el país de la ubicación del usuario
// (si la otorgó) para que el backend priorice eso sobre la IP.
api.interceptors.request.use((config) => {
  const country = storedCountry();
  if (country) {
    config.headers = config.headers || {};
    config.headers['x-visitor-country'] = country;
  }
  return config;
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
