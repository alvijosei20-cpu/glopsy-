import { Router } from 'express';
import {
  getIntegraciones,
  saveIntegracion,
  queryProduct,
  getTiktokAuth,
  saveTiktokAuth,
} from '../controllers/integracion.controller.js';
import { requireAuth, requireSeller } from '../middlewares/auth.js';
import { tiendaLimiter } from '../middlewares/limiters.js';

const router = Router();

router.use(requireAuth, requireSeller, tiendaLimiter);

router.get('/', getIntegraciones);
router.post('/', saveIntegracion);
router.get('/query', queryProduct);

// OAuth global de TikTok (Login Kit). Solo la tienda principal.
router.get('/tiktok', getTiktokAuth);
router.post('/tiktok', saveTiktokAuth);

export default router;
