import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { redisClient } from './services/redis.service.js';

import { apiLimiter } from './middlewares/limiters.js';
import productRoutes from './routes/product.routes.js';
import authRoutes from './routes/auth.routes.js';
import tiendaRoutes from './routes/tienda.routes.js';
import storefrontRoutes from './routes/storefront.routes.js';
import adminRoutes from './routes/admin.routes.js';
import integracionRoutes from './routes/integracion.routes.js';
import geoRoutes from './routes/geo.routes.js';
import healthRoutes from './routes/health.routes.js';
import mastershopWebhookRoutes from './routes/mastershopWebhook.routes.js';
import enviaWebhookRoutes from './routes/enviaWebhook.routes.js';
import mercadopagoWebhookRoutes from './routes/mercadopagoWebhook.routes.js';
import boldRoutes from './routes/bold.routes.js';
import returnsRoutes from './routes/returns.routes.js';
import statsRoutes from './routes/stats.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import pushRoutes from './routes/push.routes.js';
import homeRoutes from './routes/home.routes.js';
import bannersRoutes from './routes/banners.routes.js';

const app = express();

// Configuración trust proxy
app.set('trust proxy', 1);

// Middlewares Globales
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(apiLimiter);
const allowedOrigin = process.env.FRONTEND_URL;
const allowedOriginBase = (() => { try { return new URL(allowedOrigin).origin; } catch { return null; } })();
const extraOrigins = (process.env.EXTRA_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
const dashboardOrigins = (process.env.DASHBOARD_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === 'null' || origin === allowedOrigin || origin === allowedOriginBase || extraOrigins.includes(origin) || dashboardOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:') || origin.startsWith('http://127.0.0.1:') || origin.startsWith('https://127.0.0.1:')) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por política CORS'));
    }
  },
  credentials: true,
}));
// Se conserva el cuerpo crudo para verificar firmas de webhooks.
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(cookieParser());

// Kill switch (pánico): si está activo, la API pública responde 503.
// Se excluyen /api/health y /api/admin para poder monitorear y desactivarlo.
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  if (req.path.startsWith('/api/health') || req.path.startsWith('/api/admin')) return next();
  try {
    const on = await redisClient.get('system:panic');
    if (on === '1') return res.status(503).json({ ok: false, message: 'Servicio en mantenimiento.' });
  } catch {
    // Si Redis falla, no bloqueamos.
  }
  next();
});

// Registro de Módulos de Rutas
app.use('/api/product', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tienda', tiendaRoutes);
app.use('/api/storefront', storefrontRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tienda/integraciones', integracionRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/webhooks', mastershopWebhookRoutes);
app.use('/api/webhooks', enviaWebhookRoutes);
app.use('/api/payments', mercadopagoWebhookRoutes);
app.use('/api/payments', boldRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/banners', bannersRoutes);

// 404 JSON para rutas de API no encontradas.
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada.' });
});

// Manejador global de errores: evita que un throw no capturado tumbe la respuesta.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Express] Error no controlado:', err.message);
  if (res.headersSent) return;
  const status = err.status || 500;
  res.status(status).json({ ok: false, message: status === 500 ? 'Error interno.' : err.message });
});

export default app;
