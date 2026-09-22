import { Router } from 'express';
import { requireAdminKey } from '../middlewares/admin.js';
import {
  listUsersForAdmin,
  setUserCanSell,
  setUsdActivation,
  listCommissions,
  saveCommission,
  deleteCommission,
} from '../controllers/admin.controller.js';

const router = Router();

// Rutas privadas del monitor/panel del administrador (Bearer con NOTIFICATIONS_ADMIN_KEY).
router.use(requireAdminKey);
router.get('/sellers', listUsersForAdmin);
router.post('/sellers/set', setUserCanSell);
router.post('/sellers/usd-activation', setUsdActivation);

// Comisiones de la plataforma (global y por categoría).
router.get('/commissions', listCommissions);
router.post('/commissions', saveCommission);
router.delete('/commissions/:id', deleteCommission);

export default router;
