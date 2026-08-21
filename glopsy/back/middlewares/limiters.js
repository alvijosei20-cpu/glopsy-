import rateLimit from 'express-rate-limit';

// 1. Límite global (1000 req / 15 min) - protección general contra abuso
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Por favor intenta dentro de 15 min.',
  },
});

// 2. Límite estricto para autenticación/login (10 intentos fallidos / 15 min)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    ok: false,
    message: 'Demasiados intentos fallidos intenta más tarde.',
  },
});

// 3. Límite para endpoints pesados (300 req / 15 min) - pagos, envío, publicación
export const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Exceso de solicitudes.',
  },
});

// 4. Límite para tienda e integraciones (600 req / 15 min) - operaciones frecuentes
export const tiendaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Exceso de solicitudes.',
  },
});
