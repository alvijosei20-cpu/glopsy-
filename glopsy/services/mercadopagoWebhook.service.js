import crypto from 'node:crypto';
import { pool } from '../db.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { decryptSecret } from '../utils/crypto.js';

const getMpAccessToken = async () => {
  const { rows } = await pool.query(
    `SELECT access_token, public_key, mode FROM checkout_integrations
     WHERE provider = 'mercadopago'
     ORDER BY (mode = 'produccion') DESC LIMIT 1`
  );
  const mpInt = rows[0];
  if (!mpInt?.access_token) {
    throw new Error('No hay integración de Mercado Pago configurada.');
  }
  mpInt.access_token = decryptSecret(mpInt.access_token);
  return mpInt;
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

const updateOrderFromPayment = async (paymentId) => {
  const mpInt = await getMpAccessToken();
  const client = new MercadoPagoConfig({ accessToken: mpInt.access_token });
  const payment = new Payment(client);

  let paymentData;
  try {
    const res = await payment.get({ id: String(paymentId) });
    paymentData = res?.id ? res : await fetchPaymentById(paymentId);
  } catch {
    paymentData = await fetchPaymentById(paymentId);
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

const fetchPaymentById = async (paymentId) => {
  const mpInt = await getMpAccessToken();
  const { default: axios } = await import('axios');
  const { data } = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpInt.access_token}` },
  });
  return data;
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

  const { rows: webhookRows } = await pool.query(
    `SELECT ci.webhook_secret
     FROM checkout_integrations ci
     WHERE ci.provider = 'mercadopago'
     ORDER BY (ci.mode = 'produccion') DESC
     LIMIT 1`
  );
  const secret = webhookRows[0]?.webhook_secret ? decryptSecret(webhookRows[0].webhook_secret) : null;

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
      return updateOrderFromPayment(mpPaymentId);
    }
    return { ok: true, ignored: true, reason: 'no_related_payment' };
  }

  return updateOrderFromPayment(paymentId);
};
