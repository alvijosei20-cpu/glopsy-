// Despacho de pedidos en MasterShop (Colombia/multipaís) para tiendas que lo usan
// como proveedor de fulfillment/dispatch internacional.
// API: POST {MASTERSHOP_API_URL}/orders  (header `ms-api-key`).
import axios from 'axios';
import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';

const BASE = (process.env.MASTERSHOP_API_URL || 'https://prod.api.mastershop.com/api').replace(/\/+$/, '');

// API key de MasterShop configurada por el vendedor (tienda_integraciones).
export const getMastershopIntegrationForStore = async (tiendaId) => {
  if (!tiendaId) return null;
  const { rows } = await pool.query(
    `SELECT id, api_key FROM tienda_integraciones
     WHERE user_id = $1 AND provider = 'mastershop' LIMIT 1`,
    [Number(tiendaId)]
  );
  const row = rows[0];
  if (!row?.api_key) return null;
  return { id: row.id, apiKey: decryptSecret(row.api_key) };
};

const splitName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  const first = parts.shift() || '';
  return { first, last: parts.join(' ') };
};

// MasterShop rechaza caracteres no alfanuméricos en las direcciones (#, (), -, .).
const cleanAddressLine = (v) => {
  if (v == null) return null;
  const s = String(v)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s || null;
};

// MasterShop exige un SKU no vacío (solo alfanuméricos, guiones y guiones bajos).
const cleanSku = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '');

// Normaliza una dirección al esquema que MasterShop acepta en POST/PUT
// (address1/address2 obligatorios y sin caracteres especiales; documentNumber string).
export const toMastershopShippingAddress = (a = {}, customer = {}) => {
  const docNumber = a.documentNumber ?? customer.document ?? customer.documentNumber ?? customer.document_number ?? null;
  return {
    country: a.country || a.country_code || 'CO',
    state: a.state || a.province || null,
    city: a.city || null,
    address1: cleanAddressLine(a.address1 || a.address || a.street || a.direccion),
    address2: cleanAddressLine(a.address2 || a.addressDetail || 'Principal') || 'Principal',
    company: a.company ?? null,
    zip: a.zip || a.zipCode || a.postal_code || null,
    full_name: a.full_name || a.fullName || customer.full_name || null,
    first_name: a.first_name || customer.first_name || null,
    last_name: a.last_name || customer.last_name || null,
    phone: String(a.phone || customer.phone || '').replace(/[^\d+]/g, '') || null,
    email: a.email || customer.email || null,
    documentType: a.documentType || customer.documentType || customer.document_type || null,
    documentNumber: docNumber == null ? null : String(docNumber),
  };
};

const buildAddress = (a = {}) => {
  const { first, last } = splitName(a.full_name || a.fullName || a.name);
  return {
    country: a.country || a.country_code || 'CO',
    state: a.state || a.province || null,
    city: a.city || null,
    address1: cleanAddressLine(a.address1 || a.street || a.address || a.direccion),
    address2: cleanAddressLine(a.address2 || a.addressDetail),
    company: a.company || null,
    zip: a.zip || a.zipCode || a.postal_code || null,
    full_name: a.full_name || a.fullName || a.name || null,
    first_name: a.first_name || first || null,
    last_name: a.last_name || last || null,
    phone: String(a.phone || '').replace(/[^\d+]/g, '') || null,
  };
};

// Arma los order_items de MasterShop mapeando el id local de Glopsy con
// produc.external_product_id (id del producto en MasterShop).
export const buildMastershopOrderItems = async (items = []) => {
  const ids = items.map((i) => Number(i.id)).filter(Boolean);
  let map = new Map();
  if (ids.length > 0) {
    const { rows } = await pool.query(
      `SELECT id, external_product_id, name, suggested_price, base_price, peso
       FROM produc WHERE id = ANY($1::int[])`,
      [ids]
    );
    map = new Map(rows.map((r) => [Number(r.id), r]));
  }
  const missing = [];
  const orderItems = items.map((it) => {
    const p = map.get(Number(it.id));
    const idProduct = p?.external_product_id ? Number(p.external_product_id) : null;
    if (!idProduct) missing.push(it.name || it.id);
    return {
      id_variant: it.variant_id || it.id_variant || null,
      id_product: idProduct,
      quantity: Number(it.quantity) || 1,
      sku: cleanSku(it.sku) || String(idProduct || ''),
      name: it.name || p?.name || 'Producto',
      weight: Number(p?.peso) || 1,
      price: Number(it.price ?? p?.suggested_price ?? p?.base_price ?? 0),
    };
  });
  if (missing.length > 0) {
    throw new Error(`No se pudo mapear a MasterShop: ${missing.join(', ')}.`);
  }
  return orderItems;
};

// Crea el pedido de despacho en MasterShop.
export const createMastershopDispatchOrder = async ({
  apiKey,
  orderId,
  shippingAddress,
  billingAddress,
  items,
  total,
  currency = 'COP',
  customer,
  additionalCharges = [],
  paymentMethod = null,
}) => {
  if (!apiKey) throw new Error('Falta la API key de MasterShop.');
  const address = buildAddress(shippingAddress);
  const body = {
    id_order: String(orderId),
    notes: [],
    tags: [],
    shipping_address: address,
    billing_address: billingAddress ? buildAddress(billingAddress) : address,
    order_transaction: {
      total: Number(total) || 0,
      currency,
      // MasterShop acepta "cod" (contra entrega) o "pia" (pago inmediato anticipado).
      payment_method: ['cod', 'pia'].includes(paymentMethod) ? paymentMethod : 'pia',
    },
    customer: {
      full_name: customer?.full_name || customer?.fullName || address.full_name || null,
      first_name: customer?.first_name || address.first_name || null,
      last_name: customer?.last_name || address.last_name || null,
      email: customer?.email || null,
      phone: String(customer?.phone || address.phone || '').replace(/[^\d+]/g, '') || null,
      tags: [],
      documentType: customer?.documentType || customer?.document_type || null,
      documentNumber: customer?.documentNumber || customer?.document_number || null,
    },
    order_items: await buildMastershopOrderItems(items),
    ...(Array.isArray(additionalCharges) && additionalCharges.length > 0
      ? { additional_charge: additionalCharges }
      : {}),
  };

  const res = await axios.post(`${BASE}/orders`, body, {
    headers: { 'ms-api-key': apiKey, 'Content-Type': 'application/json' },
    timeout: Number(process.env.MASTERSHOP_REQUEST_TIMEOUT || 15000),
  });
  return res.data;
};

const msHeaders = (apiKey) => ({ 'ms-api-key': apiKey, 'Content-Type': 'application/json' });
const msTimeout = () => Number(process.env.MASTERSHOP_REQUEST_TIMEOUT || 15000);

// Campos que MasterShop permite actualizar vía PUT /orders/{id}.
// (No acepta "status"; el estado se cambia con idStatus.)
const MS_UPDATABLE_FIELDS = ['idStatus', 'paymentMethod', 'shippingAddress', 'billingAddress', 'notes', 'tags'];

// Consulta una orden: GET /orders?idOrder={id}. (Ojo: por path /orders/{id} da 403.)
export const getMastershopOrder = async (apiKey, orderRef) => {
  if (!apiKey || !orderRef) return null;
  const { data } = await axios.get(`${BASE}/orders?idOrder=${encodeURIComponent(orderRef)}`, {
    headers: msHeaders(apiKey),
    timeout: msTimeout(),
  });
  return data?.data || data;
};

// Actualiza una orden: PUT /orders/{id}. Solo envía campos permitidos.
export const updateMastershopOrder = async (apiKey, orderRef, fields = {}) => {
  if (!apiKey || !orderRef) throw new Error('MasterShop: falta apiKey u orden.');
  const body = {};
  for (const key of MS_UPDATABLE_FIELDS) {
    if (fields[key] !== undefined) body[key] = fields[key];
  }
  if (Object.keys(body).length === 0) throw new Error('MasterShop: no hay campos para actualizar.');
  const { data } = await axios.put(`${BASE}/orders/${encodeURIComponent(orderRef)}`, body, {
    headers: msHeaders(apiKey),
    timeout: msTimeout(),
  });
  return data?.data || data;
};

// Cancela la orden (id_status 9 = Cancelada). MasterShop no soporta cancelar envíos parciales.
export const cancelMastershopOrder = async (apiKey, orderRef) =>
  updateMastershopOrder(apiKey, orderRef, { idStatus: 9 });

// Extrae el código de guía/tracking del objeto carrierTracking de la orden.
export const extractMastershopTracking = (orderData) => {
  const ct =
    orderData?.orderLogistics?.carrierTracking ||
    orderData?.order_logistics?.carrierTracking ||
    {};
  const v =
    ct.tracking_code ??
    ct.trackingCode ??
    ct.guide ??
    ct.guideNumber ??
    ct.guide_number ??
    ct.waybill ??
    ct.tracking ??
    ct.tracking_id ??
    ct.trackingId ??
    null;
  return v == null ? null : String(v);
};

// Id interno con el que MasterShop registró el pedido (si la API lo devuelve).
export const extractMastershopOrderId = (data) => {
  if (!data || typeof data !== 'object') return null;
  const candidate =
    data.id ??
    data.idOrder ??
    data.order_id ??
    data.orderId ??
    data.id_order ??
    data.order?.id ??
    data.order?.idOrder ??
    data.order?.order_id ??
    null;
  return candidate == null ? null : String(candidate);
};

// Referencia del pedido en MasterShop para consultas/cancelaciones posteriores.
// Prefiere el id interno guardado en orders.payload; si no existe, usa el
// id_order que enviamos al crear (order_number).
export const resolveMastershopOrderRef = (order = {}) => {
  const payload = order?.payload && typeof order.payload === 'object' ? order.payload : {};
  const stored = payload?.mastershop?.id ?? payload?.mastershop?.order_id ?? null;
  if (stored != null) return String(stored);
  const sent = payload?.id_order ?? order?.order_number ?? order?.id ?? null;
  return sent == null ? '' : String(sent);
};

// Cancela el pedido de despacho en MasterShop (cancelación total, idStatus 9).
export const cancelMastershopDispatchOrder = async ({ apiKey, orderId }) => {
  if (!apiKey || !orderId) return false;
  try {
    await cancelMastershopOrder(apiKey, orderId);
    return true;
  } catch {
    return false;
  }
};

export default {
  createMastershopDispatchOrder,
  getMastershopIntegrationForStore,
  buildMastershopOrderItems,
  extractMastershopOrderId,
  resolveMastershopOrderRef,
  cancelMastershopDispatchOrder,
  getMastershopOrder,
  updateMastershopOrder,
  cancelMastershopOrder,
  extractMastershopTracking,
};
