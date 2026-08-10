import rateLimit from 'express-rate-limit';

// 1. Límite global (100 req / 15 min)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Por favor intenta dentro de 15 min.',
  },
});

// 2. Límite estricto para autenticación/login (3 intentos fallidos / 15 min)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    ok: false,
    message: 'Demasiados intentos fallidos intenta más tarde.',
  },
});

// 3. Límite para endpoints pesados (30 req / 15 min)
export const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Exceso de solicitudes.',
  },
});

// Alias / compatibilidad
export const tiendaLimiter = heavyLimiter;
