import { Router } from 'express';
import { getProductById, saveProduct, getMyProducts, searchProducts, getCategoriesController, autoCategorizeController, getFavorites, getFavoritesProductsController, toggleFavorite, reserveStockController, releaseStockController, migrateCartController, calculateShippingController, createPreferenceController, processMpPaymentController, getTiposEmpaqueController } from '../controllers/product.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { tiendaLimiter, heavyLimiter } from '../middlewares/limiters.js';

const router = Router();

// Endpoint: Categorías
router.get('/categories', getCategoriesController);
router.post('/auto-categorize', autoCategorizeController);

// Endpoint: Favoritos
router.get('/favorites', requireAuth, getFavorites);
router.get('/favorite-products', requireAuth, getFavoritesProductsController);
router.post('/favorite', requireAuth, toggleFavorite);

// Endpoint: GET /api/product (and /search)
router.get('/', searchProducts);
router.get('/search', searchProducts);
// Endpoint: GET /api/product/mine
router.get('/mine', requireAuth, getMyProducts);
// Endpoint: GET /api/product/:id
router.get('/:id', getProductById);
// Endpoint: POST /api/product
router.post('/', requireAuth, tiendaLimiter, saveProduct);
router.post('/reserve-stock', reserveStockController);
router.post('/release-stock', releaseStockController);
router.post('/migrate-cart', requireAuth, migrateCartController);
router.get('/tipos-empaque', getTiposEmpaqueController);
router.post('/calculate-shipping', heavyLimiter, calculateShippingController);
router.post('/create-preference', heavyLimiter, createPreferenceController);
router.post('/process-mp-payment', heavyLimiter, processMpPaymentController);

export default router;
