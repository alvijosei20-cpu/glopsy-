// ==========================================
// Cliente de la API de Pagos en Línea de Bold (BETA).
//
// A diferencia del Checkout Onpage (checkout.js), esta API permite elegir el
// método de pago desde la integración. Aquí la usamos para cobrar por QR Bre-B:
//   1. Se crea una "intención de pago"  -> POST /v1/payment-intent
//   2. Se hace un "intento de pago" con payment_method QR -> POST /v1/payment
//      que responde next_actions.qr_payload (base64 o texto) y expires_at.
//   3. Se consulta el estado -> GET /v1/payment/{reference_id}
//   4. Se anula o reembolsa -> POST /v1/payment/void | POST /v1/payment/refund
//      (solo tarjeta y pago APPROVED; ver boldReversal.service.js)
//
// Doc: https://developers.bold.co/pagos-en-linea/api-de-pagos-en-linea
//
// Config:
//   BOLD_API_BASE          -> URL base (default https://api.online.payments.bold.co)
//   BOLD_API_IDENTITY_KEY  -> llave de identidad (x-api-key). Si no está, se usa
//                             la llave pública de checkout_integrations (runtime).
// ==========================================

import axios from 'axios';
import crypto from 'node:crypto';

const apiBase = () => (process.env.BOLD_API_BASE || 'https://api.online.payments.bold.co').replace(/\/+$/, '');

// Llave de identidad de la integración "API pagos en línea". loadBoldCredentials()
// la setea en runtime con la llave pública guardada en el panel.
let runtimeIdentityKey = null;
export const setBoldApiIdentityKey = (key = null) => { runtimeIdentityKey = key || null; };
const identityKey = () => runtimeIdentityKey || process.env.BOLD_API_IDENTITY_KEY || process.env.BOLD_PUBLIC_KEY || '';

// Llave secreta para verificar la firma x-bold-signature del webhook.
let runtimeSecretKey = null;
export const setBoldApiSecretKey = (key = null) => { runtimeSecretKey = key || null; };
const secretKey = () => runtimeSecretKey || process.env.BOLD_WEBHOOK_SECRET || process.env.BOLD_PRIVATE_KEY || '';

export const isBoldApiConfigured = () => Boolean(identityKey());
export const isBoldWebhookSecretConfigured = () => Boolean(secretKey());

const headers = () => ({
  Authorization: `x-api-key ${identityKey()}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

// Bold envuelve algunas respuestas en { payload, errors }.
const unwrap = (data) => (data && typeof data === 'object' && 'payload' in data ? data.payload : data);

export const createPaymentIntent = async ({
  referenceId,
  amount,
  currency = 'COP',
  description,
  customer = {},
  metadata = null,
} = {}) => {
  if (!isBoldApiConfigured()) return { ok: false, reason: 'bold_api_no_configurado' };
  const body = {
    reference_id: String(referenceId),
    amount: { currency: String(currency || 'COP').toUpperCase(), total_amount: Number(amount) },
    ...(description ? { description } : {}),
    ...(metadata ? { metadata } : {}),
    ...(Object.keys(customer).length ? { customer } : {}),
  };
  try {
    const { data } = await axios.post(`${apiBase()}/v1/payment-intent`, body, { headers: headers(), timeout: 20000 });
    return { ok: true, data: unwrap(data) };
  } catch (err) {
    return { ok: false, reason: 'bold_api_error', error: err.response?.data || err.message };
  }
};

// Crea el intento de pago con QR Bre-B. qrFormat: TEXT | PLAIN_BASE64 | BOLD_BASE64.
export const createQrPayment = async ({
  referenceId,
  payer = {},
  deviceFingerprint = null,
  qrFormat = 'BOLD_BASE64',
  metadata = null,
} = {}) => {
  if (!isBoldApiConfigured()) return { ok: false, reason: 'bold_api_no_configurado' };
  const body = {
    reference_id: String(referenceId),
    payer,
    payment_method: { name: 'QR', qr_format: qrFormat },
    ...(metadata ? { metadata } : {}),
    ...(deviceFingerprint ? { device_fingerprint: deviceFingerprint } : {}),
  };
  try {
    const { data } = await axios.post(`${apiBase()}/v1/payment`, body, { headers: headers(), timeout: 20000 });
    return { ok: true, data: unwrap(data) };
  } catch (err) {
    return { ok: false, reason: 'bold_api_error', error: err.response?.data || err.message };
  }
};

export const getPaymentStatus = async (referenceId) => {
  if (!isBoldApiConfigured()) return { ok: false, reason: 'bold_api_no_configurado' };
  try {
    const { data } = await axios.get(
      `${apiBase()}/v1/payment/${encodeURIComponent(referenceId)}`,
      { headers: headers(), timeout: 15000 }
    );
    return { ok: true, data: unwrap(data) };
  } catch (err) {
    return { ok: false, reason: 'bold_api_error', error: err.response?.data || err.message };
  }
};

// Anula (void) un pago del mismo día. Solo tarjeta de crédito/débito. Irreversible.
// POST /v1/payment/void  { transaction_id }  -> 201 sin cuerpo.
export const voidPayment = async ({ transactionId }) => {
  if (!isBoldApiConfigured()) return { ok: false, reason: 'bold_api_no_configurado' };
  if (!transactionId) return { ok: false, reason: 'sin_transaction_id' };
  try {
    const res = await axios.post(
      `${apiBase()}/v1/payment/void`,
      { transaction_id: String(transactionId) },
      { headers: headers(), timeout: 20000 }
    );
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, reason: 'bold_api_error', status: err.response?.status || null, error: err.response?.data || err.message };
  }
};

// Solicita el reembolso de un pago (queda en revisión de Bold). Solo tarjeta.
// POST /v1/payment/refund  { reference_id, transaction_id, reason }  -> 201 sin cuerpo.
export const requestRefund = async ({ referenceId = null, transactionId = null, reason = 'Cancelación de pedido' } = {}) => {
  if (!isBoldApiConfigured()) return { ok: false, reason: 'bold_api_no_configurado' };
  if (!referenceId && !transactionId) return { ok: false, reason: 'sin_referencia' };
  const body = {
    ...(referenceId ? { reference_id: String(referenceId) } : {}),
    ...(transactionId ? { transaction_id: String(transactionId) } : {}),
    reason,
  };
  try {
    const res = await axios.post(`${apiBase()}/v1/payment/refund`, body, { headers: headers(), timeout: 20000 });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, reason: 'bold_api_error', status: err.response?.status || null, error: err.response?.data || err.message };
  }
};

// Estado de un reembolso: PROCESSING | APPROVED | REJECTED.
// GET /v1/payment/refund/{transaction_id}
export const getRefundStatus = async (transactionId) => {
  if (!isBoldApiConfigured()) return { ok: false, reason: 'bold_api_no_configurado' };
  if (!transactionId) return { ok: false, reason: 'sin_transaction_id' };
  try {
    const { data } = await axios.get(
      `${apiBase()}/v1/payment/refund/${encodeURIComponent(transactionId)}`,
      { headers: headers(), timeout: 15000 }
    );
    return { ok: true, data: unwrap(data) };
  } catch (err) {
    return { ok: false, reason: 'bold_api_error', error: err.response?.data || err.message };
  }
};

// Verifica el header x-bold-signature: HMAC-SHA256(secret, base64(rawBody)) hex.
// En modo pruebas la llave secreta va vacía ("") según la doc de Bold.
export const verifyBoldWebhookSignature = (rawBody, signature) => {
  const received = String(signature || '').toLowerCase();
  if (!received || rawBody == null) return false;
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : String(rawBody);
  const encoded = Buffer.from(raw, 'utf-8').toString('base64');
  const expected = crypto.createHmac('sha256', secretKey()).update(encoded).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
