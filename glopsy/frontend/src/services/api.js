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

// Rutas de autenticación cuya respuesta 401 es esperada (credenciales
// inválidas, código OAuth vencido, etc.) y NO significan sesión expirada.
const AUTH_ACTION_RE = /\/auth\/(login|register|oauth\/consume|biometric\/login)/;

// 2. Interceptor de Respuestas: sólo la pérdida real de sesión (401) cuando el
// usuario tenía una sesión activa. Un 403 es un permiso denegado, no una
// expiración, y no debe cerrar la sesión ni redirigir.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const hadSession = Boolean(localStorage.getItem('user'));

    if (status === 401 && hadSession && !AUTH_ACTION_RE.test(url)) {
      // El JWT vive en cookie HttpOnly: se limpia la caché local del usuario y
      // se avisa a la app para vaciar el estado en memoria (evita bucles).
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('glopsy:session-expired'));

      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
