import { Router } from 'express';
import { getProductById, saveProduct, getMyProducts, searchProducts, getCategoriesController, autoCategorizeController, getFavorites, getFavoritesProductsController, toggleFavorite, reserveStockController, releaseStockController, migrateCartController, calculateShippingController, createPreferenceController, processMpPaymentController, processSavedCardPaymentController, getTiposEmpaqueController, getUserComprasController, recordPurchaseController, cancelOrderController, updateOrderAddressController } from '../controllers/product.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.js';
import { tiendaLimiter, heavyLimiter } from '../middlewares/limiters.js';

const router = Router();

// Endpoint: Categorías
router.get('/categories', getCategoriesController);
router.post('/auto-categorize', autoCategorizeController);

// Endpoint: Favoritos
router.get('/favorites', requireAuth, getFavorites);
router.get('/favorite-products', requireAuth, getFavoritesProductsController);
router.post('/favorite', requireAuth, toggleFavorite);

// Specific GET routes (must be before /:id)
router.get('/search', searchProducts);
router.get('/mine', requireAuth, getMyProducts);
router.get('/compras', optionalAuth, getUserComprasController);
router.patch('/compras/:hash/cancel', optionalAuth, cancelOrderController);
router.patch('/compras/:hash/address', optionalAuth, updateOrderAddressController);
router.get('/tipos-empaque', getTiposEmpaqueController);

// Endpoint: GET /api/product (and /search)
router.get('/', searchProducts);

// Endpoint: POST /api/product
router.post('/', requireAuth, tiendaLimiter, saveProduct);
router.post('/reserve-stock', reserveStockController);
router.post('/release-stock', releaseStockController);
router.post('/migrate-cart', requireAuth, migrateCartController);
router.post('/calculate-shipping', heavyLimiter, calculateShippingController);
router.post('/create-preference', heavyLimiter, createPreferenceController);
router.post('/process-mp-payment', heavyLimiter, optionalAuth, processMpPaymentController);
router.post('/process-saved-card-payment', requireAuth, heavyLimiter, processSavedCardPaymentController);
router.post('/record-purchase', requireAuth, recordPurchaseController);

// Endpoint: GET /api/product/:id (dynamic route at the end)
router.get('/:id', getProductById);

export default router;
