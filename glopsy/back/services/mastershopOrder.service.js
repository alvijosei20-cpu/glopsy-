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

const buildAddress = (a = {}) => {
  const { first, last } = splitName(a.full_name || a.fullName || a.name);
  return {
    country: a.country || a.country_code || 'CO',
    state: a.state || a.province || null,
    city: a.city || null,
    address1: a.address1 || a.street || a.address || null,
    address2: a.address2 || a.addressDetail || null,
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
      sku: it.sku || '',
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
      payment_method: 'prepaid',
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

export default { createMastershopDispatchOrder, getMastershopIntegrationForStore, buildMastershopOrderItems };
