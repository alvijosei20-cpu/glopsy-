import { Router } from 'express';
import { requireAdminKey } from '../middlewares/admin.js';
import {
  listUsersForAdmin,
  setUserCanSell,
  setUsdActivation,
  listCommissions,
  saveCommission,
  deleteCommission,
  listSellerRequests,
  reviewSellerRequest,
  listStoresForAdmin,
  getStoreCheckoutIntegrations,
  saveStoreCheckoutIntegration,
  deleteStoreCheckoutIntegration,
  getPanicStatus,
  setPanicStatus,
  getAuthConfig,
  saveAuthConfig,
  trackEnvia,
} from '../controllers/admin.controller.js';

const router = Router();

// Rutas privadas del monitor/panel del administrador (Bearer con NOTIFICATIONS_ADMIN_KEY).
router.use(requireAdminKey);
router.get('/sellers', listUsersForAdmin);
router.post('/sellers/set', setUserCanSell);
router.post('/sellers/usd-activation', setUsdActivation);

// Solicitudes para ser vendedor (alta con aprobación).
router.get('/seller-requests', listSellerRequests);
router.post('/seller-requests/review', reviewSellerRequest);

// Integraciones de pago/checkout (Bold, Mercado Pago, ENVIA) por tienda.
router.get('/stores', listStoresForAdmin);
router.get('/stores/:tiendaId/checkout-integrations', getStoreCheckoutIntegrations);
router.post('/stores/:tiendaId/checkout-integrations', saveStoreCheckoutIntegration);
router.delete('/stores/:tiendaId/checkout-integrations/:provider', deleteStoreCheckoutIntegration);

// Kill switch (pánico)
router.get('/panic', getPanicStatus);
router.post('/panic', setPanicStatus);

// Auth OAuth (Google / Discord / TikTok)
router.get('/auth/:provider', getAuthConfig);
router.post('/auth/:provider', saveAuthConfig);

// Rastreo de guías (ENVIA)
router.post('/tracking', trackEnvia);

// Comisiones de la plataforma (global y por categoría).
router.get('/commissions', listCommissions);
router.post('/commissions', saveCommission);
router.delete('/commissions/:id', deleteCommission);

export default router;
