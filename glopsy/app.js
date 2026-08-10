import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { apiLimiter } from './middlewares/limiters.js';
import productRoutes from './routes/product.routes.js';
import authRoutes from './routes/auth.routes.js';
import tiendaRoutes from './routes/tienda.routes.js';
import integracionRoutes from './routes/integracion.routes.js';
import geoRoutes from './routes/geo.routes.js';

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
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Registro de Módulos de Rutas
app.use('/api/product', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tienda', tiendaRoutes);
app.use('/api/tienda/integraciones', integracionRoutes);
app.use('/api/geo', geoRoutes);

export default app;
