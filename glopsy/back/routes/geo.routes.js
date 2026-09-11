import { Router } from 'express';
import { 
  getFullments, 
  getMyFullments, 
  getCiudades, 
  getDepartamentos,
  getPaises,
  getZoomCiudades,
  createFullment, 
  deleteFullment, 
  getFullmentProducts, 
  updateFullmentProducts,
  updateFullmentPerfil,
  reverseGeocode
} from '../controllers/geo.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/fullments', getFullments);
router.get('/fullments/mine', requireAuth, getMyFullments);
router.get('/ciudades', getCiudades);
router.get('/departamentos', getDepartamentos);
router.get('/paises', getPaises);
router.get('/zoom-ciudades', getZoomCiudades);
router.get('/reverse', reverseGeocode);
router.post('/fullments', requireAuth, createFullment);
router.delete('/fullments/:id', requireAuth, deleteFullment);
router.put('/fullments/:id/perfil', requireAuth, updateFullmentPerfil);
router.get('/fullments/:id/products', requireAuth, getFullmentProducts);
router.put('/fullments/:id/products', requireAuth, updateFullmentProducts);

export default router;
