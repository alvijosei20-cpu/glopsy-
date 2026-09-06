import { Router } from 'express';
import { generateStoreBanner, serveBanner } from '../controllers/banners.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { heavyLimiter } from '../middlewares/limiters.js';

const router = Router();

// Genera un banner con la foto real de un producto de la tienda logueada.
router.post('/generate', requireAuth, heavyLimiter, generateStoreBanner);

// Sirve el PNG generado (público). Formato: /api/banners/<sha1>.png
router.get('/:key.png', serveBanner);

export default router;
