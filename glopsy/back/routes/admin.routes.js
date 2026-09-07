import { Router } from 'express';
import { requireAdminKey } from '../middlewares/admin.js';
import { listUsersForAdmin, setUserCanSell } from '../controllers/admin.controller.js';

const router = Router();

// Rutas privadas del monitor/panel del administrador (Bearer con NOTIFICATIONS_ADMIN_KEY).
router.use(requireAdminKey);
router.get('/sellers', listUsersForAdmin);
router.post('/sellers/set', setUserCanSell);

export default router;
