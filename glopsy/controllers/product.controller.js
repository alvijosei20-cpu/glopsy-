import { obtenerProductoPorId } from '../services/mastershopService.js';
import { saveProductForUser, getProductsForUser, searchQueryProducts, getCategories, autoCategorizeUncategorizedProducts, getUserFavorites, toggleProductFavorite, getProductByPublicId, reserveStockForSession, releaseStockForSession, migrateCartSession, calculateShippingCost, createMercadoPagoPreferenceForCart, processMpPaymentForCart, processSavedCardPaymentForCart, getTiposEmpaque, getFavoriteProductsDetails, recordPurchaseForUser, getUserPurchasesDetails, searchOrdersByNumberOrDoc, getOrderByHash, cancelOrderForUser, updateOrderAddressForUser } from '../services/product.service.js';
import { validatePaymentBiometricNonce } from '../services/auth.service.js';
import { pool } from '../db.js';

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
  const productId = req.params.id;

  try {
    const producto = await getProductByPublicId(productId);
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
    const { q, limit, offset, ciudad, categoria_id } = req.query;
    await autoCategorizeUncategorizedProducts().catch(() => {});
    const data = await searchQueryProducts({ q, limit, offset, ciudadName: ciudad, categoriaId: categoria_id });
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
    const products = await getFavoriteProductsDetails(userId);
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
    const { productId } = req.body;
    const result = await toggleProductFavorite(userId, productId);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al alternar favorito:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al alternar favorito.' });
  }
};

export const reserveStockController = async (req, res) => {
  try {
    const { items, guestHash } = req.body;
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
    const { guestHash } = req.body;
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
    const { guestHash } = req.body;
    const result = await migrateCartSession(guestHash, userId);
    res.json({ ok: true, message: 'Sesión de carrito migrada con éxito.', ...result });
  } catch (error) {
    console.error('Error al migrar carrito:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al migrar carrito.' });
  }
};

export const calculateShippingController = async (req, res) => {
  try {
    const { items, destination_ciudad_id } = req.body;
    const result = await calculateShippingCost(items, destination_ciudad_id);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al calcular envío:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al calcular el costo de envío.' });
  }
};

export const createPreferenceController = async (req, res) => {
  try {
    const { items, shipping_cost, customer_info, guestHash } = req.body;
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
    const { formData, preferenceId, customer_info, guestHash, shipping_cost, shipping_payload, items } = req.body;
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
    const paymentRes = await processSavedCardPaymentForCart(userId, req.body);
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
    const guestHash = req.query.guestHash || req.headers['x-guest-hash'] || null;
    const products = await getUserPurchasesDetails(userId, guestHash);
    res.json({ ok: true, products });
  } catch (error) {
    console.error('Error al obtener compras del usuario:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener las compras.' });
  }
};

export const searchOrdersController = async (req, res) => {
  try {
    const { q, query } = req.query;
    const searchTerm = q || query;
    if (!searchTerm) {
      return res.status(400).json({ ok: false, message: 'Ingresa un número de pedido o documento de identidad.' });
    }
    const products = await searchOrdersByNumberOrDoc(searchTerm);
    res.json({ ok: true, products });
  } catch (error) {
    console.error('Error al buscar pedidos:', error.message);
    res.status(500).json({ ok: false, message: 'Error al buscar pedidos.' });
  }
};

export const getOrderByHashController = async (req, res) => {
  try {
    const { hash } = req.params;
    if (!hash) {
      return res.status(400).json({ ok: false, message: 'Hash de orden requerido.' });
    }
    const order = await getOrderByHash(hash);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
    }
    res.json({ ok: true, product: order });
  } catch (error) {
    console.error('Error al obtener detalle de orden por hash:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener el detalle del pedido.' });
  }
};

export const recordPurchaseController = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { items } = req.body;
    if (!userId || !Array.isArray(items) || items.length === 0) {
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
    const orderHash = req.params.hash;
    const userId = req.auth?.userId || null;
    const guestHash = req.query.guestHash || req.headers['x-guest-hash'] || null;
    const updated = await cancelOrderForUser(orderHash, userId, guestHash);
    res.json({ ok: true, order: updated });
  } catch (error) {
    console.error('Error al cancelar la orden:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al cancelar la orden.' });
  }
};

export const updateOrderAddressController = async (req, res) => {
  try {
    const orderHash = req.params.hash;
    const { direccion, telefono } = req.body;
    const userId = req.auth?.userId || null;
    const guestHash = req.query.guestHash || req.headers['x-guest-hash'] || null;
    const updated = await updateOrderAddressForUser(orderHash, userId, guestHash, direccion, telefono);
    res.json({ ok: true, order: updated });
  } catch (error) {
    console.error('Error al actualizar dirección:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al actualizar la dirección.' });
  }
};
