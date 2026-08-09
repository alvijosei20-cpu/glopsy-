import rateLimit from 'express-rate-limit';

// Limitador general para toda la API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo en 15 minutos.',
  },
});

// Limitador estricto para flujos de autenticación / OAuth
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Demasiados intentos de autenticación. Intenta más tarde.',
  },
});

// Cambios de estado: evita automatización o abuso sin penalizar la lectura normal.
export const tiendaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas solicitudes a tienda. Intenta más tarde.' },
});
