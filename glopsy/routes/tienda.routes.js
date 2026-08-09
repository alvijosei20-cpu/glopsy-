import { Router } from 'express';
import { 
  changeStatus, 
  getMine, 
  getDian, 
  saveDian,
  getCheckoutIntegrations,
  saveCheckoutIntegration,
  deleteCheckoutIntegration
} from '../controllers/tienda.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { tiendaLimiter } from '../middlewares/limiters.js';
import { getPerfilesForUser, createPerfilForUser, deletePerfilForUser } from '../controllers/perfiles.controller.js';

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

export default router;
