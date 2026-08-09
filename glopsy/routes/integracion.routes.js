import { Router } from 'express';
import { getIntegraciones, saveIntegracion, queryProduct } from '../controllers/integracion.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { tiendaLimiter } from '../middlewares/limiters.js';

const router = Router();

router.use(requireAuth, tiendaLimiter);

router.get('/', getIntegraciones);
router.post('/', saveIntegracion);
router.get('/query', queryProduct);

export default router;
