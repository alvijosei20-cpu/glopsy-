import { Router } from 'express';
import {
  getIntegraciones,
  saveIntegracion,
  queryProduct,
  getTiktokPixel,
  sendTiktokTestEvent,
} from '../controllers/integracion.controller.js';
import { requireAuth, requireSeller } from '../middlewares/auth.js';
import { tiendaLimiter } from '../middlewares/limiters.js';

const router = Router();

router.use(requireAuth, requireSeller, tiendaLimiter);

router.get('/', getIntegraciones);
router.post('/', saveIntegracion);
router.get('/query', queryProduct);

// Integración TikTok Pixel de la tienda del vendedor (estado enmascarado).
router.get('/tiktok-pixel', getTiktokPixel);
router.post('/tiktok-pixel/test-event', sendTiktokTestEvent);

export default router;
