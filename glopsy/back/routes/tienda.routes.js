import { Router } from 'express';
import { 
  changeStatus, 
  getMine, 
  getDian, 
  saveDian,
  getCheckoutIntegrations,
  saveCheckoutIntegration,
  deleteCheckoutIntegration,
  getAnalytics
} from '../controllers/tienda.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { tiendaLimiter } from '../middlewares/limiters.js';
import { getPerfilesForUser, createPerfilForUser, deletePerfilForUser } from '../controllers/perfiles.controller.js';
import { getOfertas, createOferta, updateOfertaProductos, deleteOferta } from '../controllers/ofertas.controller.js';
import {
  getMarketingOverview,
  getSuggestions,
  runMarketingManual,
  applySuggestion,
  dismissSuggestion,
  updateCampaignUrl,
  sendPushCampaign,
} from '../controllers/marketing.controller.js';

const router = Router();

router.use(requireAuth, tiendaLimiter);
router.get('/', getMine);
router.patch('/estado', changeStatus);
router.get('/dian', getDian);
router.put('/dian', saveDian);
router.get('/checkout-integrations', getCheckoutIntegrations);
router.post('/checkout-integrations', saveCheckoutIntegration);
router.delete('/checkout-integrations/:provider', deleteCheckoutIntegration);
// Perfiles de envío
router.get('/perfiles-envio', getPerfilesForUser);
router.post('/perfiles-envio', createPerfilForUser);
router.delete('/perfiles-envio/:id', deletePerfilForUser);
// Ofertas / promociones
router.get('/ofertas', getOfertas);
router.post('/ofertas', createOferta);
router.put('/ofertas/:id/productos', updateOfertaProductos);
router.delete('/ofertas/:id', deleteOferta);
// Estadísticas / analytics del vendedor
router.get('/analytics', getAnalytics);

// Marketing: motor de sugerencias (SEO, promos, social, email/push)
router.get('/marketing', getMarketingOverview);
router.get('/marketing/sugerencias', getSuggestions);
router.post('/marketing/run', runMarketingManual);
router.post('/marketing/sugerencias/:id/aplicar', applySuggestion);
router.post('/marketing/sugerencias/:id/descartar', dismissSuggestion);
router.post('/marketing/sugerencias/:id/url', updateCampaignUrl);
router.post('/marketing/sugerencias/:id/enviar', sendPushCampaign);

export default router;
