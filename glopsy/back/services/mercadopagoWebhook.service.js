import crypto from 'node:crypto';
import { pool } from '../db.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { decryptSecret } from '../utils/crypto.js';

// ------------------------------------------------------------------ Credenciales por tienda
// Con más de una tienda cada una cobra con SU cuenta de Mercado Pago. El webhook no
// trae la tienda en el payload, así que se identifica por el pedido (mercadopago_payment_id
// o preference_id) y se usan el access_token y el webhook_secret de ESA tienda.

const getMpIntegrationForStore = async (tiendaId, { includeSecret = true } = {}) => {
  if (!tiendaId) return null;
  const { rows } = await pool.query(
    `SELECT access_token, public_key, mode${includeSecret ? ', webhook_secret' : ''}
     FROM checkout_integrations
     WHERE tienda_id = $1 AND provider = 'mercadopago'
     ORDER BY (mode = 'produccion') DESC LIMIT 1`,
    [Number(tiendaId)]
  );
  const mp = rows[0];
  if (!mp?.access_token) return null;
  mp.access_token = decryptSecret(mp.access_token);
  if (mp.webhook_secret) mp.webhook_secret = decryptSecret(mp.webhook_secret);
  return { tienda_id: Number(tiendaId), ...mp };
};

// Fallback: integración global única (comportamiento original con una sola tienda).
const getGlobalMpIntegration = async ({ includeSecret = true } = {}) => {
  const { rows } = await pool.query(
    `SELECT access_token, public_key, mode${includeSecret ? ', webhook_secret' : ''}
     FROM checkout_integrations
     WHERE provider = 'mercadopago'
     ORDER BY (mode = 'produccion') DESC LIMIT 1`
  );
  const mp = rows[0];
  if (!mp?.access_token) return null;
  mp.access_token = decryptSecret(mp.access_token);
  if (mp.webhook_secret) mp.webhook_secret = decryptSecret(mp.webhook_secret);
  return mp;
};

const getMpIntegration = async (tiendaId, opts) => {
  if (tiendaId) {
    const byStore = await getMpIntegrationForStore(tiendaId, opts);
    if (byStore) return byStore;
  }
  return getGlobalMpIntegration(opts);
};

// Tienda dueña de un pago/orden según los ids conocidos.
const findPaymentStore = async (paymentId, preferenceId) => {
  const { rows } = await pool.query(
    `SELECT tienda_id FROM orders
     WHERE ($1::text IS NOT NULL AND mercadopago_payment_id = $1)
        OR ($2::text IS NOT NULL AND preference_id = $2)
     ORDER BY (mercadopago_payment_id = $1) DESC NULLS LAST, id DESC
     LIMIT 1`,
    [paymentId ? String(paymentId) : null, preferenceId ? String(preferenceId) : null]
  );
  return rows[0]?.tienda_id ? Number(rows[0].tienda_id) : null;
};

const verifyWebhookSignature = (secret, rawBody, headers) => {
  const signatureHeader = headers['x-signature'];
  const requestId = headers['x-request-id'];
  if (!signatureHeader || !requestId) return true;

  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(',')
      .map((p) => {
        const [key, value] = p.split('=');
        return [key.trim(), (value || '').trim()];
      })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return true;

  const manifest = `id:${requestId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
};

const fetchPaymentById = async (paymentId, tiendaId) => {
  const mpInt = await getMpIntegration(tiendaId, { includeSecret: false });
  if (!mpInt?.access_token) return null;
  const { default: axios } = await import('axios');
  const { data } = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpInt.access_token}` },
  });
  return data;
};

const updateOrderFromPayment = async (paymentId, tiendaId) => {
  const mpInt = await getMpIntegration(tiendaId, { includeSecret: false });
  if (!mpInt?.access_token) return { ok: false, reason: 'sin_integracion' };

  let paymentData;
  try {
    const client = new MercadoPagoConfig({ accessToken: mpInt.access_token });
    const payment = new Payment(client);
    const res = await payment.get({ id: String(paymentId) });
    paymentData = res?.id ? res : await fetchPaymentById(paymentId, tiendaId);
  } catch {
    paymentData = await fetchPaymentById(paymentId, tiendaId);
  }
  if (!paymentData?.id) return { ok: false, reason: 'payment_not_found' };

  const mpStatus = paymentData.status;
  const status = mpStatus === 'approved' ? 'Completado' : (mpStatus || 'pending');

  const { rows } = await pool.query(
    `UPDATE orders SET status = $1, payload = $2::jsonb, updated_at = NOW()
     WHERE mercadopago_payment_id = $3
     RETURNING id, order_hash`,
    [status, JSON.stringify(paymentData), String(paymentId)]
  );

  return { ok: true, orderId: rows[0]?.id || null, orderHash: rows[0]?.order_hash || null, status };
};

export const processMercadopagoWebhook = async (payload, rawBody, headers = {}) => {
  const type = payload.type || payload.topic || payload.action || 'unknown';
  const paymentId = payload.data?.id || payload.payment_id || payload.id;

  if (type === 'test' || type === 'ping' || (!paymentId && type === 'unknown')) {
    return { ok: true, ignored: true, type };
  }
  if (type !== 'payment' && type !== 'merchant_order' && !paymentId) {
    return { ok: true, ignored: true, type };
  }
  if (!paymentId) {
    return { ok: true, ignored: true, reason: 'no_payment_id' };
  }

  // Identificar la tienda dueña del pago (si la orden ya existe).
  const merchantPaymentId =
    type === 'merchant_order' ? payload.data?.payments?.[0]?.id || null : null;
  const tiendaId = await findPaymentStore(paymentId, merchantPaymentId || null);

  // Verificar firma con el secreto de la tienda (o el global de una sola tienda).
  const mpInt = await getMpIntegration(tiendaId);
  const secret = mpInt?.webhook_secret || null;
  if (secret && rawBody && !verifyWebhookSignature(secret, rawBody, headers)) {
    return { ok: false, error: 'invalid_signature', status: 401 };
  }

  if (type === 'merchant_order') {
    const { rows } = await pool.query(
      `SELECT mercadopago_payment_id FROM orders WHERE preference_id = $1 LIMIT 1`,
      [payload.data?.id ? String(payload.data.id) : null]
    );
    const mpPaymentId = payload.data?.payments?.[0]?.id || rows[0]?.mercadopago_payment_id;
    if (mpPaymentId) {
      return updateOrderFromPayment(mpPaymentId, tiendaId);
    }
    return { ok: true, ignored: true, reason: 'no_related_payment' };
  }

  return updateOrderFromPayment(paymentId, tiendaId);
};
