import axios from 'axios';
import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';

const BASE = (process.env.DROPANAS_API_URL || 'https://app.dropanas.com/api/v1').replace(/\/+$/, '');

export const getDropanasIntegrationForStore = async (tiendaId) => {
  if (!tiendaId) return null;
  const { rows } = await pool.query(
    `SELECT id, api_key FROM tienda_integraciones
     WHERE user_id = $1 AND provider = 'dropanas' LIMIT 1`,
    [Number(tiendaId)]
  );
  const row = rows[0];
  if (!row?.api_key) return null;
  return { id: row.id, apiKey: decryptSecret(row.api_key) };
};

export const buildDropanasOrderItems = async (items = []) => {
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
    const productoId = p?.external_product_id ? Number(p.external_product_id) : Number(it.id);
    if (!productoId) missing.push(it.name || it.id);
    return {
      producto_id: productoId,
      cantidad: Number(it.quantity) || 1,
      precio_venta_usd: Number(it.price ?? p?.suggested_price ?? p?.base_price ?? 0),
      ...(it.variant_id || it.id_variant ? { variante_id: Number(it.variant_id || it.id_variant) } : {}),
    };
  });
  if (missing.length > 0) {
    throw new Error(`No se pudo mapear a DropPanas: ${missing.join(', ')}.`);
  }
  return orderItems;
};

export const createDropanasDispatchOrder = async ({
  apiKey,
  orderId,
  shippingAddress,
  items,
  total,
  currency = 'USD',
  customer,
  bodegaOrigenId = 1,
  tipoEntrega = 'domicilio',
  tipoPago = 'con_recaudo',
  referenciaExterna = null,
}) => {
  if (!apiKey) throw new Error('Falta la API key de DropPanas.');
  const mode = apiKey.startsWith('test_sk_') ? 'sandbox' : 'live';

  const body = {
    cliente: {
      nombre: customer?.first_name || customer?.nombre || shippingAddress?.first_name || 'Cliente',
      apellido: customer?.last_name || customer?.apellido || shippingAddress?.last_name || 'General',
      telefono: String(customer?.phone || shippingAddress?.phone || '').replace(/[^\d+]/g, ''),
      email: customer?.email || null,
    },
    direccion: {
      state_id: Number(shippingAddress?.state_id || shippingAddress?.stateId || 1),
      city_id: Number(shippingAddress?.city_id || shippingAddress?.cityId || 1),
      direccion: shippingAddress?.address1 || shippingAddress?.street || shippingAddress?.address || 'Dirección no especificada',
    },
    productos: await buildDropanasOrderItems(items),
    bodega_origen_id: Number(bodegaOrigenId) || 1,
    tipo_entrega: tipoEntrega,
    tipo_pago: tipoPago,
    ...(referenciaExterna ? { referencia_externa: String(referenciaExterna) } : { referencia_externa: String(orderId) }),
  };

  const res = await axios.post(`${BASE}/ordenes`, body, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DroPanas-Mode': mode,
    },
    timeout: Number(process.env.DROPANAS_REQUEST_TIMEOUT || 15000),
  });
  return res.data;
};

export default { createDropanasDispatchOrder, getDropanasIntegrationForStore, buildDropanasOrderItems };
