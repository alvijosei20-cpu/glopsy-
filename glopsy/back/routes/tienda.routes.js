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

export default router;
