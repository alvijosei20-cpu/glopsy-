import { Router } from 'express';
import { storefrontInfo, storefrontProducts } from '../controllers/storefront.controller.js';

const router = Router();

// Rutas públicas para las vitrinas de cada tienda (subdominio x.glopsy.shop)
router.get('/:slug', storefrontInfo);
router.get('/:slug/products', storefrontProducts);

export default router;
