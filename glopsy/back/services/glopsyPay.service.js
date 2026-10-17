// ==========================================
// Checkout Glopsy Pay (USDT / BEP20).
//
// La ecommerce crea la orden pendiente, genera un cobro en Glopsy Pay con la
// API key del comercio (checkout_integrations provider='glopsypay') y redirige
// al cliente a https://pay.glopsy.shop/p/<token>. La confirmación llega por
// webhook (HMAC-SHA256 en X-Glopsy-Signature) o por polling del cobro.
// ==========================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';
import { createPendingOrderForCart } from './product.service.js';
import { markOrderPaid } from './boldCheckout.service.js';

const apiBase = () => (process.env.GLOPSYPAY_API_URL || 'https://pay.glopsy.shop').replace(/\/+$/, '');
const webhookUrl = () => String(process.env.GLOPSYPAY_WEBHOOK_URL || '').trim();

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const findOrder = async (reference) => {
  if (!reference) return null;
  const { rows } = await pool.query(
    `SELECT id, tienda_id, order_number, order_hash, status, amount, currency,
            payload->>'glopsypay_token' AS glopsypay_token
       FROM orders
      WHERE order_number = $1
         OR order_hash = $1
         OR payload->>'glopsypay_token' = $1
      ORDER BY id DESC
      LIMIT 1`,
    [String(reference)]
  );
  return rows[0] || null;
};

// Credenciales Glopsy Pay de una tienda (con respaldo en cualquier tienda).
export const loadGlopsyPayCredentials = async (tiendaId = null) => {
  const params = [];
  let where = `provider = 'glopsypay'`;
  if (tiendaId) {
    params.push(tiendaId);
    where += ` AND tienda_id = $1`;
  }
  const { rows } = await pool.query(
    `SELECT tienda_id, access_token, webhook_secret, mode
       FROM checkout_integrations
      WHERE ${where}
      ORDER BY (mode = 'produccion') DESC, updated_at DESC NULLS LAST
      LIMIT 1`,
    params
  );
  let row = rows[0];
  if (!row && tiendaId) {
    const { rows: any } = await pool.query(
      `SELECT tienda_id, access_token, webhook_secret, mode
         FROM checkout_integrations
        WHERE provider = 'glopsypay'
        ORDER BY (mode = 'produccion') DESC, updated_at DESC NULLS LAST
        LIMIT 1`
    );
    row = any[0];
  }
  if (!row?.access_token) return null;
  return {
    tiendaId: row.tienda_id,
    apiKey: decryptSecret(row.access_token) || '',
    webhookSecret: row.webhook_secret ? decryptSecret(row.webhook_secret) || '' : '',
    test: row.mode !== 'produccion',
  };
};

const gpFetch = async (path, { apiKey, method = 'GET', body = null } = {}) => {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `Glopsy Pay HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
};

// Registra (best-effort) la URL de webhook del comercio en Glopsy Pay. No toca
// el secret: lo genera Glopsy Pay y el comercio lo pega en el panel admin.
const ensureWebhook = async (apiKey) => {
  const url = webhookUrl();
  if (!url) return;
  try {
    await gpFetch('/api/v1/webhook', { apiKey });
    await gpFetch('/api/v1/webhook', { apiKey, method: 'POST', body: { url, active: true } });
  } catch (error) {
    console.warn('[Glopsy Pay] No se pudo registrar el webhook:', error.message);
  }
};

export const startGlopsyPayCheckout = async (userId, {
  items,
  customerInfo = {},
  guestHash = null,
  shippingCost = 0,
  shippingPayload = null,
  redirectBase = null,
} = {}) => {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: 'carrito_vacio' };

  const order = await createPendingOrderForCart(userId, items, {
    customerInfo,
    guestHash,
    shippingCost,
    shippingPayload,
  });

  const creds = await loadGlopsyPayCredentials(order.tiendaId);
  if (!creds?.apiKey) {
    return { ok: false, reason: 'glopsypay_no_configurado', orderId: order.orderId, orderNumber: order.orderNumber };
  }

  await ensureWebhook(creds.apiKey);

  const amount = round2(Number(order.totalAmount));
  const redirectUrl = redirectBase ? `${redirectBase}?glopsy_ref=${encodeURIComponent(order.orderNumber)}` : undefined;

  const data = await gpFetch('/api/v1/charges', {
    apiKey: creds.apiKey,
    method: 'POST',
    body: {
      amount: String(amount),
      concept: `Pedido ${order.orderNumber}`,
      redirect_url: redirectUrl,
      redirect_delay_ms: 1200,
    },
  });

  const token = data?.charge?.token || null;
  await pool.query(
    `UPDATE orders SET currency = 'USD', es_exportacion = TRUE,
          payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb
     WHERE id = $1`,
    [order.orderId, JSON.stringify({ glopsypay_token: token, glopsypay_charge_id: data?.charge?.id || null })]
  );

  return {
    ok: true,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    orderHash: order.orderHash,
    amount,
    currency: 'USDT',
    token,
    url: data?.charge?.url || null,
  };
};

export const verifyGlopsyPaySignature = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
};

export const processGlopsyPayWebhook = async ({ rawBody, signature }) => {
  let payload;
  try {
    payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || ''));
  } catch {
    return { ok: false, status: 400, reason: 'body_invalido' };
  }

  const event = payload?.event;
  const data = payload?.data || {};
  if (event !== 'charge.paid') return { ok: true, ignored: true, reason: event || 'sin_evento' };

  const token = data.token;
  if (!token) return { ok: false, status: 400, reason: 'token_ausente' };

  const order = await findOrder(token);
  if (!order) {
    console.warn(`[Glopsy Pay Webhook] Sin orden para token=${token}`);
    return { ok: true, ignored: true, reason: 'orden_no_encontrada' };
  }

  const creds = await loadGlopsyPayCredentials(order.tienda_id);
  if (!creds?.webhookSecret) return { ok: false, status: 503, reason: 'webhook_no_configurado' };
  if (!verifyGlopsyPaySignature(rawBody, signature, creds.webhookSecret)) {
    return { ok: false, status: 401, reason: 'firma_invalida' };
  }

  if (order.status === 'Completado') return { ok: true, ignored: true, reason: 'ya_procesada', orderId: order.id };

  const amount = Number(data.amount);
  if (Number.isFinite(amount) && Math.abs(amount - Number(order.amount)) > 0.01) {
    console.warn(`[Glopsy Pay Webhook] Monto no coincide orden=${order.id} recibido=${amount} esperado=${order.amount}`);
    return { ok: false, status: 409, reason: 'monto_no_coincide', orderId: order.id };
  }

  await markOrderPaid(order.id, {
    provider: 'glopsypay',
    refBold: token,
    payloadExtra: { glopsypay_token: token, glopsypay_paid_at: data.paid_at || null, glopsypay_event: data },
  });
  return { ok: true, orderId: order.id, status: 'Completado' };
};

export const getGlopsyPayOrderStatus = async (reference) => {
  const order = await findOrder(reference);
  if (!order) return { ok: false, reason: 'orden_no_encontrada' };
  if (order.status === 'Completado') return { ok: true, orderId: order.id, status: 'APPROVED', orderStatus: 'Completado' };

  const token = order.glopsypay_token;
  const creds = await loadGlopsyPayCredentials(order.tienda_id);
  if (token && creds?.apiKey) {
    try {
      const data = await gpFetch(`/api/v1/charges/${encodeURIComponent(token)}`, { apiKey: creds.apiKey });
      const st = String(data?.charge?.status || '').toLowerCase();
      if (st === 'paid') {
        await markOrderPaid(order.id, {
          provider: 'glopsypay',
          refBold: token,
          payloadExtra: { glopsypay_token: token, glopsypay_status: 'paid' },
        });
        return { ok: true, orderId: order.id, status: 'APPROVED', orderStatus: 'Completado' };
      }
      if (st === 'expired' || st === 'canceled') {
        await pool.query(`UPDATE orders SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND status <> 'Completado'`, [order.id]);
        return { ok: true, orderId: order.id, status: 'REJECTED', orderStatus: 'rejected' };
      }
    } catch (error) {
      console.warn('[Glopsy Pay] Error consultando estado del cobro:', error.message);
    }
  }
  return { ok: true, orderId: order.id, status: 'PENDING', orderStatus: order.status };
};
