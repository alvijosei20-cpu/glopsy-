import { obtenerProductoPorId } from '../services/mastershopService.js';
import { saveProductForUser, getProductsForUser, searchQueryProducts, getCategories, autoCategorizeUncategorizedProducts, getUserFavorites, toggleProductFavorite, getProductByPublicId, reserveStockForSession, releaseStockForSession, migrateCartSession, calculateShippingCost, createMercadoPagoPreferenceForCart, processMpPaymentForCart, processSavedCardPaymentForCart, getTiposEmpaque, getFavoriteProductsDetails, recordPurchaseForUser, getUserPurchasesDetails, searchOrdersByNumberOrDoc, getOrderByHash, cancelOrderForUser, updateOrderAddressForUser, getProductReviews, getUserReviewStatus, getOrderReviewsStatus, addProductReview, updateProductReview, deleteProductReview } from '../services/product.service.js';
import { validatePaymentBiometricNonce } from '../services/auth.service.js';
import { pool } from '../db.js';
import {
  cleanString,
  cleanText,
  cleanPhone,
  toInt,
  toNumber,
  cleanBoolean,
  sanitizeArray,
  sanitizeObject,
} from '../utils/validation.js';

const sanitizeCartItems = (items) => sanitizeArray(items, (item) => {
  if (!item || typeof item !== 'object') return null;
  const id = toInt(item.id, { min: 1 });
  if (!id) return null;
  return {
    ...item,
    id,
    name: cleanString(item.name, { maxLength: 200 }),
    price: toNumber(item.price, { min: 0, fallback: 0 }),
    quantity: toInt(item.quantity, { min: 1, max: 999, fallback: 1 }),
    tienda_id: toInt(item.tienda_id, { min: 1 }),
    fullm_id: toInt(item.fullm_id, { min: 1 }),
  };
});

const requirePaymentBiometric = async (userId, biometricNonce) => {
  if (!userId) return;
  const { rows } = await pool.query('SELECT webauthn_credential FROM users WHERE id = $1', [userId]);
  const hasBio = rows[0] && rows[0].webauthn_credential;
  if (!hasBio) return;
  const valid = await validatePaymentBiometricNonce(userId, biometricNonce);
  if (!valid) {
    throw new Error('Validación biométrica requerida para completar el pago. Vuelve a intentarlo.');
  }
};

export const getProductById = async (req, res) => {
  const productId = cleanString(req.params.id, { maxLength: 100 });
  const ciudad = cleanString(req.query.ciudad, { maxLength: 100 }) || null;

  try {
    const producto = await getProductByPublicId(productId, ciudad);
    res.json({
      ok: true,
      product: producto,
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        ok: false,
        message: `Producto con ID ${productId} no fue encontrado en Mastershop.`,
      });
    }

    console.error('Error en la ruta del producto:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Error al intentar obtener el producto.',
    });
  }
};

export const saveProduct = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const savedProduct = await saveProductForUser(userId, req.body);
    res.status(201).json({
      ok: true,
      message: 'Producto guardado y publicado con éxito en la base de datos.',
      product: savedProduct,
    });
  } catch (error) {
    console.error('Error al guardar el producto:', error.message);
    res.status(400).json({
      ok: false,
      message: error.message || 'Error al intentar guardar el producto.',
    });
  }
};

export const getMyProducts = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const products = await getProductsForUser(userId);
    res.json({ ok: true, products });
  } catch (error) {
    console.error('Error al obtener productos de la tienda:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener los productos de la tienda.' });
  }
};

export const searchProducts = async (req, res) => {
  try {
    const q = cleanString(req.query.q, { maxLength: 200 }) || undefined;
    const limit = toInt(req.query.limit, { min: 1, max: 100, fallback: 12 });
    const offset = toInt(req.query.offset, { min: 0, fallback: 0 });
    const ciudad = cleanString(req.query.ciudad, { maxLength: 100 }) || undefined;
    const categoria_id = toInt(req.query.categoria_id, { min: 1 });
    const sort = cleanString(req.query.sort, { maxLength: 20 });
    const price_min = toNumber(req.query.price_min, { min: 0 });
    const price_max = toNumber(req.query.price_max, { min: 0 });
    const envio_gratis = cleanBoolean(req.query.envio_gratis, undefined);
    const min_rating = toNumber(req.query.min_rating, { min: 1, max: 5 });
    await autoCategorizeUncategorizedProducts().catch(() => {});
    const data = await searchQueryProducts({ q, limit, offset, ciudadName: ciudad, categoriaId: categoria_id, sortBy: sort, priceMin: price_min, priceMax: price_max, envioGratis: envio_gratis, minRating: min_rating });
    res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    console.error('Error al buscar productos:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Error al buscar productos.',
    });
  }
};

export const getCategoriesController = async (req, res) => {
  try {
    const categories = await getCategories();
    res.json({ ok: true, categories });
  } catch (error) {
    console.error('Error al obtener categorías:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener categorías' });
  }
};

export const autoCategorizeController = async (req, res) => {
  try {
    await autoCategorizeUncategorizedProducts();
    res.json({ ok: true, message: 'Productos categorizados con éxito.' });
  } catch (error) {
    console.error('Error al categorizar productos:', error.message);
    res.status(500).json({ ok: false, message: 'Error al categorizar productos.' });
  }
};

export const getFavorites = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: 'No autorizado' });
    }
    const favorites = await getUserFavorites(userId);
    res.json({ ok: true, favorites });
  } catch (error) {
    console.error('Error al obtener favoritos:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener favoritos.' });
  }
};

export const getFavoritesProductsController = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: 'No autorizado' });
    }
    const ciudad = cleanString(req.query.ciudad, { maxLength: 100 }) || null;
    const products = await getFavoriteProductsDetails(userId, ciudad);
    res.json({ ok: true, products });
  } catch (error) {
    console.error('Error al obtener productos favoritos:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener productos favoritos.' });
  }
};

export const toggleFavorite = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: 'No autorizado' });
    }
    const productId = toInt(req.body.productId, { min: 1 });
    const result = await toggleProductFavorite(userId, productId);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al alternar favorito:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al alternar favorito.' });
  }
};

export const reserveStockController = async (req, res) => {
  try {
    const items = sanitizeCartItems(req.body.items);
    const guestHash = cleanString(req.body.guestHash, { maxLength: 64 });
    if (items.length === 0) {
      return res.status(400).json({ ok: false, message: 'No hay productos en el carrito para apartar stock.' });
    }
    const identifier = req.auth?.userId ? `user_${req.auth.userId}` : (guestHash || 'guest_anonymous');
    const result = await reserveStockForSession(items, identifier);
    res.json({ ok: true, message: 'Stock apartado con éxito.', ...result });
  } catch (error) {
    console.error('Error al apartar stock:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al apartar stock.' });
  }
};

export const releaseStockController = async (req, res) => {
  try {
    const guestHash = cleanString(req.body.guestHash, { maxLength: 64 });
    const identifier = req.auth?.userId ? `user_${req.auth.userId}` : (guestHash || 'guest_anonymous');
    const result = await releaseStockForSession(identifier);
    res.json({ ok: true, message: 'Stock liberado con éxito.', ...result });
  } catch (error) {
    console.error('Error al liberar stock:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al liberar stock.' });
  }
};

export const migrateCartController = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const guestHash = cleanString(req.body.guestHash, { maxLength: 64 });
    const result = await migrateCartSession(guestHash, userId);
    res.json({ ok: true, message: 'Sesión de carrito migrada con éxito.', ...result });
  } catch (error) {
    console.error('Error al migrar carrito:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al migrar carrito.' });
  }
};

export const calculateShippingController = async (req, res) => {
  try {
    const items = sanitizeCartItems(req.body.items);
    const destination_ciudad_id = toInt(req.body.destination_ciudad_id, { min: 1 });
    if (items.length === 0) {
      return res.status(400).json({ ok: false, message: 'No hay productos en el carrito.' });
    }
    const result = await calculateShippingCost(items, destination_ciudad_id);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al calcular envío:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al calcular el costo de envío.' });
  }
};

export const createPreferenceController = async (req, res) => {
  try {
    const items = sanitizeCartItems(req.body.items);
    const shipping_cost = toNumber(req.body.shipping_cost, { min: 0, fallback: 0 });
    const customer_info = sanitizeObject(req.body.customer_info || {}, { maxSize: 30 });
    const guestHash = cleanString(req.body.guestHash, { maxLength: 64 });
    if (items.length === 0) {
      return res.status(400).json({ ok: false, message: 'No hay productos en el carrito.' });
    }
    const userId = req.auth?.userId || 1;
    const result = await createMercadoPagoPreferenceForCart(userId, items, shipping_cost, customer_info, guestHash);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al crear preferencia de Mercado Pago:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al procesar el pago con Mercado Pago.' });
  }
};

export const processMpPaymentController = async (req, res) => {
  try {
    const { formData } = req.body;
    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
      return res.status(400).json({ ok: false, message: 'Datos de pago inválidos.' });
    }
    const preferenceId = cleanString(req.body.preferenceId, { maxLength: 100 });
    const customer_info = sanitizeObject(req.body.customer_info || {}, { maxSize: 30 });
    const guestHash = cleanString(req.body.guestHash, { maxLength: 64 });
    const shipping_cost = toNumber(req.body.shipping_cost, { min: 0, fallback: 0 });
    const shipping_payload = sanitizeObject(req.body.shipping_payload || {}, { maxSize: 200 });
    const items = sanitizeCartItems(req.body.items);
    const userId = req.auth?.userId || 1;
    await requirePaymentBiometric(req.auth?.userId, req.body.biometric_nonce);
    const paymentRes = await processMpPaymentForCart(userId, formData, preferenceId, customer_info, guestHash, shipping_cost, shipping_payload, items);
    res.json({ ok: true, payment: paymentRes });
  } catch (error) {
    console.error('Error al procesar pago con Mercado Pago Bricks:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al procesar el pago.' });
  }
};

export const processSavedCardPaymentController = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    await requirePaymentBiometric(userId, req.body.biometric_nonce);
    const card_id = toInt(req.body.card_id, { min: 1 });
    const items = sanitizeCartItems(req.body.items);
    const shipping_cost = toNumber(req.body.shipping_cost, { min: 0, fallback: 0 });
    const shipping_payload = sanitizeObject(req.body.shipping_payload || {}, { maxSize: 200 });
    const customer_info = sanitizeObject(req.body.customer_info || {}, { maxSize: 30 });
    const guestHash = cleanString(req.body.guestHash, { maxLength: 64 });
    if (!card_id) {
      return res.status(400).json({ ok: false, message: 'Tarjeta inválida.' });
    }
    const paymentRes = await processSavedCardPaymentForCart(userId, {
      card_id,
      items,
      shipping_cost,
      shipping_payload,
      customer_info,
      guestHash,
    });
    res.json({ ok: true, payment: paymentRes });
  } catch (error) {
    console.error('Error al procesar pago con tarjeta guardada (1-Click):', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al procesar el pago con tarjeta guardada.' });
  }
};

export const getTiposEmpaqueController = async (req, res) => {
  try {
    const tipos = await getTiposEmpaque();
    res.json({ ok: true, tipos_empaque: tipos });
  } catch (error) {
    console.error('Error al obtener tipos de empaque:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener tipos de empaque.' });
  }
};

export const getUserComprasController = async (req, res) => {
  try {
    const userId = req.auth?.userId || null;
    const guestHash = cleanString(req.query.guestHash || req.headers['x-guest-hash'], { maxLength: 64 }) || null;
    const products = await getUserPurchasesDetails(userId, guestHash);
    res.json({ ok: true, products });
  } catch (error) {
    console.error('Error al obtener compras del usuario:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener las compras.' });
  }
};

export const searchOrdersController = async (req, res) => {
  try {
    const searchTerm = cleanString(req.query.q || req.query.query, { maxLength: 50 });
    if (!searchTerm) {
      return res.status(400).json({ ok: false, message: 'Ingresa un número de pedido o documento de identidad.' });
    }
    const userId = req.auth?.userId || null;
    const guestHash = cleanString(req.query.guestHash || req.headers['x-guest-hash'], { maxLength: 64 }) || null;
    const products = await searchOrdersByNumberOrDoc(searchTerm, userId, guestHash);
    res.json({ ok: true, products });
  } catch (error) {
    console.error('Error al buscar pedidos:', error.message);
    res.status(500).json({ ok: false, message: 'Error al buscar pedidos.' });
  }
};

export const getOrderByHashController = async (req, res) => {
  try {
    const hash = cleanString(req.params.hash, { maxLength: 100 });
    if (!hash) {
      return res.status(400).json({ ok: false, message: 'Hash de orden requerido.' });
    }
    const userId = req.auth?.userId || null;
    const guestHash = cleanString(req.query.guestHash || req.headers['x-guest-hash'], { maxLength: 64 }) || null;
    if (!userId && !guestHash) {
      return res.status(401).json({ ok: false, message: 'Autenticación requerida para ver el detalle del pedido.' });
    }
    const order = await getOrderByHash(hash, userId, guestHash);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
    }
    res.json({ ok: true, product: order });
  } catch (error) {
    console.error('Error al obtener detalle de orden por hash:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener el detalle del pedido.' });
  }
};

export const getOrderReviewsStatusController = async (req, res) => {
  try {
    const hash = cleanString(req.params.hash, { maxLength: 100 });
    if (!hash) {
      return res.status(400).json({ ok: false, message: 'Hash de orden requerido.' });
    }
    const userId = req.auth?.userId || null;
    const guestHash = cleanString(req.query.guestHash || req.headers['x-guest-hash'], { maxLength: 64 }) || null;
    if (!userId && !guestHash) {
      return res.status(401).json({ ok: false, message: 'Autenticación requerida para ver el pedido.' });
    }
    const order = await getOrderByHash(hash, userId, guestHash);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
    }
    const reviewStatus = userId ? await getOrderReviewsStatus(order.id, userId) : {};
    res.json({ ok: true, review_status: reviewStatus });
  } catch (error) {
    console.error('Error al obtener estado de reseñas de la orden:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener el estado de reseñas del pedido.' });
  }
};

export const recordPurchaseController = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const items = sanitizeCartItems(req.body.items);
    if (!userId || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'Datos inválidos para registrar compra' });
    }
    await recordPurchaseForUser(userId, items);
    res.json({ ok: true, message: 'Compra registrada con éxito' });
  } catch (error) {
    console.error('Error al registrar compra:', error.message);
    res.status(500).json({ ok: false, message: 'Error al registrar la compra.' });
  }
};

export const cancelOrderController = async (req, res) => {
  try {
    const orderHash = cleanString(req.params.hash, { maxLength: 100 });
    const userId = req.auth?.userId || null;
    const guestHash = cleanString(req.query.guestHash || req.headers['x-guest-hash'], { maxLength: 64 }) || null;
    const updated = await cancelOrderForUser(orderHash, userId, guestHash);
    res.json({ ok: true, order: updated });
  } catch (error) {
    console.error('Error al cancelar la orden:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al cancelar la orden.' });
  }
};

export const updateOrderAddressController = async (req, res) => {
  try {
    const orderHash = cleanString(req.params.hash, { maxLength: 100 });
    const direccion = cleanText(req.body.direccion, { maxLength: 300 });
    const telefono = cleanPhone(req.body.telefono, { maxLength: 15 });
    const userId = req.auth?.userId || null;
    const guestHash = cleanString(req.query.guestHash || req.headers['x-guest-hash'], { maxLength: 64 }) || null;
    const updated = await updateOrderAddressForUser(orderHash, userId, guestHash, direccion, telefono);
    res.json({ ok: true, order: updated });
  } catch (error) {
    console.error('Error al actualizar dirección:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al actualizar la dirección.' });
  }
};

export const getProductReviewsController = async (req, res) => {
  try {
    const id = toInt(req.params.id, { min: 1 });
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID de producto inválido.' });
    }
    const result = await getProductReviews(id);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al obtener reseñas:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener reseñas.' });
  }
};

export const getUserReviewController = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ ok: false, message: 'No autorizado' });
    const id = toInt(req.params.id, { min: 1 });
    if (!id) return res.status(400).json({ ok: false, message: 'ID de producto inválido.' });
    const status = await getUserReviewStatus(userId, id);
    res.json({ ok: true, ...status });
  } catch (error) {
    console.error('Error al obtener reseña del usuario:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener tu reseña.' });
  }
};

export const addReviewController = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ ok: false, message: 'No autorizado' });
    const id = toInt(req.params.id, { min: 1 });
    if (!id) return res.status(400).json({ ok: false, message: 'ID de producto inválido.' });
    const rating = toInt(req.body.rating, { min: 1, max: 5 });
    const comment = cleanText(req.body.comment, { maxLength: 2000 });
    if (!rating) return res.status(400).json({ ok: false, message: 'La calificación debe estar entre 1 y 5 estrellas.' });
    const review = await addProductReview(userId, id, { rating, comment });
    res.status(201).json({ ok: true, review });
  } catch (error) {
    console.error('Error al crear reseña:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al crear la reseña.' });
  }
};

export const updateReviewController = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ ok: false, message: 'No autorizado' });
    const id = toInt(req.params.id, { min: 1 });
    if (!id) return res.status(400).json({ ok: false, message: 'ID de producto inválido.' });
    const rating = toInt(req.body.rating, { min: 1, max: 5 });
    const comment = cleanText(req.body.comment, { maxLength: 2000 });
    if (!rating) return res.status(400).json({ ok: false, message: 'La calificación debe estar entre 1 y 5 estrellas.' });
    const review = await updateProductReview(userId, id, { rating, comment });
    res.json({ ok: true, review });
  } catch (error) {
    console.error('Error al actualizar reseña:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al actualizar la reseña.' });
  }
};

export const deleteReviewController = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ ok: false, message: 'No autorizado' });
    const id = toInt(req.params.id, { min: 1 });
    if (!id) return res.status(400).json({ ok: false, message: 'ID de producto inválido.' });
    const result = await deleteProductReview(userId, id);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al eliminar reseña:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al eliminar la reseña.' });
  }
};
