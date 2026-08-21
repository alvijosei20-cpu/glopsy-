import { Router } from 'express';
import { 
  getFullments, 
  getMyFullments, 
  getCiudades, 
  getDepartamentos,
  createFullment, 
  deleteFullment, 
  getFullmentProducts, 
  updateFullmentProducts,
  updateFullmentPerfil 
} from '../controllers/geo.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/fullments', getFullments);
router.get('/fullments/mine', requireAuth, getMyFullments);
router.get('/ciudades', getCiudades);
router.get('/departamentos', getDepartamentos);
router.post('/fullments', requireAuth, createFullment);
router.delete('/fullments/:id', requireAuth, deleteFullment);
router.put('/fullments/:id/perfil', requireAuth, updateFullmentPerfil);
router.get('/fullments/:id/products', requireAuth, getFullmentProducts);
router.put('/fullments/:id/products', requireAuth, updateFullmentProducts);

export default router;
