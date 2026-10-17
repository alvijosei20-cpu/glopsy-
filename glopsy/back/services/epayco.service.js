// ==========================================
// ePayco Smart Checkout (COP).
//
// Crea la orden pendiente, genera la sesión de checkout en ePayco (Apify) y
// confirma el pago por webhook (firma SHA256). Al aprobarse, la venta se
// contabiliza y (fase 2) el COP se convierte a USDT vía Glopsy Pay.
// ==========================================

import crypto from 'node:crypto';
import axios from 'axios';
import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';
import { createPendingOrderForCart } from './product.service.js';
import { markOrderPaid } from './boldCheckout.service.js';

const APIFY_BASE = (process.env.EPAYCO_APIFY_URL || 'https://apify.epayco.co').replace(/\/+$/, '');
const VALIDATION_BASE = (process.env.EPAYCO_VALIDATION_URL || 'https://secure.epayco.co').replace(/\/+$/, '');
const publicBase = () => (process.env.PUBLIC_API_BASE || '').replace(/\/+$/, '');

// Credenciales de la cuenta ePayco de la plataforma (por tienda o por env).
export const loadEpaycoCredentials = async (tiendaId = null) => {
  let row = null;
  if (tiendaId) {
    const { rows } = await pool.query(
      `SELECT public_key, access_token, webhook_secret, cust_id FROM checkout_integrations
        WHERE provider = 'epayco' AND tienda_id = $1
        ORDER BY (mode = 'produccion') DESC, updated_at DESC NULLS LAST LIMIT 1`,
      [tiendaId]
    );
    row = rows[0] || null;
  }
  if (!row) {
    const { rows } = await pool.query(
      `SELECT public_key, access_token, webhook_secret, cust_id FROM checkout_integrations
        WHERE provider = 'epayco' ORDER BY (mode = 'produccion') DESC, updated_at DESC NULLS LAST LIMIT 1`
    );
    row = rows[0] || null;
  }
  return {
    publicKey: (row?.public_key ? decryptSecret(row.public_key) : null) || process.env.EPAYCO_PUBLIC_KEY || '',
    privateKey: (row?.access_token ? decryptSecret(row.access_token) : null) || process.env.EPAYCO_PRIVATE_KEY || '',
    custId: row?.cust_id || process.env.EPAYCO_CUST_ID || '',
    pKey: (row?.webhook_secret ? decryptSecret(row.webhook_secret) : null) || process.env.EPAYCO_P_KEY || '',
  };
};

let tokenCache = { token: null, exp: 0 };
const getApifyToken = async (creds) => {
  if (!creds.publicKey || !creds.privateKey) throw new Error('ePayco no configurado (PUBLIC_KEY/PRIVATE_KEY).');
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const basic = Buffer.from(`${creds.publicKey}:${creds.privateKey}`).toString('base64');
  const { data } = await axios.post(`${APIFY_BASE}/login`, {}, {
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basic}` },
    timeout: Number(process.env.EPAYCO_TIMEOUT || 15000),
  });
  const token = data?.token;
  if (!token) throw new Error('ePayco: no se obtuvo token de Apify.');
  tokenCache = { token, exp: Date.now() + 8 * 60 * 1000 };
  return token;
};

export const createEpaycoSession = async ({ creds, amount, currency = 'COP', name, description, invoice, responseUrl, confirmationUrl, billing }) => {
  const token = await getApifyToken(creds);
  const body = {
    checkout_version: '2',
    name: name || 'Glopsy',
    currency,
    amount: Number(amount),
    lang: 'ES',
    country: 'CO',
    method: 'POST',
    ...(description ? { description } : {}),
    ...(invoice ? { invoice: String(invoice) } : {}),
    ...(responseUrl ? { response: responseUrl } : {}),
    ...(confirmationUrl ? { confirmation: confirmationUrl } : {}),
    ...(billing ? { billing } : {}),
  };
  const { data } = await axios.post(`${APIFY_BASE}/payment/session/create`, body, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    timeout: Number(process.env.EPAYCO_TIMEOUT || 15000),
  });
  const sessionId = data?.data?.sessionId;
  if (!sessionId) throw new Error(data?.textResponse || 'ePayco: no se creó la sesión.');
  return { sessionId, raw: data };
};

const findOrder = async (reference) => {
  if (!reference) return null;
  const { rows } = await pool.query(
    `SELECT id, tienda_id, order_number, order_hash, status, amount, currency
       FROM orders
      WHERE order_number = $1 OR order_hash = $1
         OR payload->>'epayco_invoice' = $1
         OR payload->>'epayco_ref' = $1
      ORDER BY id DESC LIMIT 1`,
    [String(reference)]
  );
  return rows[0] || null;
};

export const startEpaycoCheckout = async (userId, {
  items,
  customerInfo = {},
  guestHash = null,
  shippingCost = 0,
  shippingPayload = null,
  billing = null,
  baseUrl = '',
} = {}) => {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: 'carrito_vacio' };

  const order = await createPendingOrderForCart(userId, items, { customerInfo, guestHash, shippingCost, shippingPayload });
  const creds = await loadEpaycoCredentials(order.tiendaId);
  if (!creds.publicKey || !creds.privateKey) {
    return { ok: false, reason: 'epayco_no_configurado', orderId: order.orderId, orderNumber: order.orderNumber };
  }

  const amount = Math.round(Number(order.totalAmount));
  const base = publicBase() || String(baseUrl || '').replace(/\/+$/, '');
  const responseUrl = `${base}/glopsy/checkout?epayco_ref=${encodeURIComponent(order.orderNumber)}`;
  const confirmationUrl = `${base}/glopsy/api/payments/epayco/confirmation`;

  const { sessionId } = await createEpaycoSession({
    creds, amount, currency: 'COP', name: 'Glopsy', description: `Pedido ${order.orderNumber}`,
    invoice: order.orderNumber, responseUrl, confirmationUrl, billing,
  });

  await pool.query(
    `UPDATE orders SET currency = 'COP',
          payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb
     WHERE id = $1`,
    [order.orderId, JSON.stringify({ epayco_session: sessionId, epayco_invoice: order.orderNumber })]
  );

  return { ok: true, orderId: order.orderId, orderNumber: order.orderNumber, orderHash: order.orderHash, amount, currency: 'COP', sessionId };
};

const validSignature = (creds, p) => {
  if (!creds.custId || !creds.pKey || !p.x_signature) return false;
  const expected = crypto.createHash('sha256')
    .update(`${creds.custId}^${creds.pKey}^${p.x_ref_payco}^${p.x_transaction_id}^${p.x_amount}^${p.x_currency_code}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(p.x_signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Fase 2 (COP→USDT vía Glopsy Pay): hook. Por ahora deja rastro en payload.
const convertCopToUsdt = async (orderId, amountCop) => {
  try {
    await pool.query(
      `UPDATE orders SET payload = COALESCE(payload,'{}'::jsonb) || $2::jsonb WHERE id = $1`,
      [orderId, JSON.stringify({ cop_to_usdt_pending: true, cop_amount: amountCop })]
    );
  } catch (e) {
    console.error('[ePayco] convertCopToUsdt:', e.message);
  }
};

export const processEpaycoConfirmation = async (payload = {}) => {
  const invoice = payload.x_id_invoice || payload.x_extra1 || payload.x_invoice;
  const order = await findOrder(invoice || payload.x_ref_payco);
  const creds = await loadEpaycoCredentials(order?.tienda_id || null);
  if (!creds.pKey || !creds.custId) return { ok: false, status: 503, reason: 'epayco_no_configurado' };
  if (!validSignature(creds, payload)) return { ok: false, status: 401, reason: 'firma_invalida' };
  if (!order) return { ok: true, ignored: true, reason: 'orden_no_encontrada' };

  const response = String(payload.x_response || '');
  // Comisión real de ePayco reportada en la confirmación (fee + IVA del fee).
  const epaycoFee = Math.round(((Number(payload.x_fee) || 0) + (Number(payload.x_fee_iva) || 0)) * 100) / 100;
  const payloadExtra = {
    epayco_ref: payload.x_ref_payco || payload.ref_payco || null,
    epayco_transaction_id: payload.x_transaction_id || null,
    epayco_response: response || null,
    epayco_test: String(payload.x_test_request || '').toLowerCase() === 'true',
    epayco_fee: epaycoFee > 0 ? epaycoFee : null,
    epayco_event: payload,
  };

  if (response === 'Aceptada') {
    if (order.status === 'Completado') return { ok: true, ignored: true, reason: 'ya_procesada', orderId: order.id };
    await markOrderPaid(order.id, { provider: 'epayco', refBold: payload.x_ref_payco || null, processorFee: epaycoFee > 0 ? epaycoFee : null, payloadExtra });
    await convertCopToUsdt(order.id, order.amount);
    return { ok: true, orderId: order.id, status: 'Completado' };
  }
  if (response === 'Rechazada' || response === 'Fallida') {
    await pool.query(`UPDATE orders SET status = 'rejected', payload = COALESCE(payload,'{}'::jsonb) || $2::jsonb, updated_at = now() WHERE id = $1 AND status <> 'Completado'`, [order.id, JSON.stringify(payloadExtra)]);
    return { ok: true, orderId: order.id, status: 'rejected' };
  }
  return { ok: true, ignored: true, orderId: order.id, response: response || null };
};

export const getEpaycoOrderStatus = async (reference) => {
  const order = await findOrder(reference);
  if (!order) return { ok: false, reason: 'orden_no_encontrada' };
  if (order.status === 'Completado') return { ok: true, orderId: order.id, status: 'APPROVED', orderStatus: 'Completado' };

  const { rows } = await pool.query(`SELECT payload->>'epayco_ref' AS ref FROM orders WHERE id = $1`, [order.id]);
  const ref = rows[0]?.ref;
  if (ref) {
    try {
      const { data } = await axios.get(`${VALIDATION_BASE}/validation/v1/reference/${encodeURIComponent(ref)}`, { timeout: 15000 });
      const st = data?.data?.x_response || data?.x_response || '';
      if (st === 'Aceptada') {
        await markOrderPaid(order.id, { provider: 'epayco', refBold: ref, payloadExtra: { epayco_ref: ref, epayco_validated: true } });
        await convertCopToUsdt(order.id, order.amount);
        return { ok: true, orderId: order.id, status: 'APPROVED', orderStatus: 'Completado' };
      }
      if (st === 'Rechazada' || st === 'Fallida') {
        await pool.query(`UPDATE orders SET status = 'rejected', updated_at = now() WHERE id = $1 AND status <> 'Completado'`, [order.id]);
        return { ok: true, orderId: order.id, status: 'REJECTED', orderStatus: 'rejected' };
      }
    } catch (e) {
      console.warn('[ePayco] validación estado:', e.message);
    }
  }
  return { ok: true, orderId: order.id, status: 'PENDING', orderStatus: order.status };
};
