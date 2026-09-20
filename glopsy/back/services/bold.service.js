// ==========================================
// Bold — API Link de pagos (pagos en línea)
//
// Cuenta central de la plataforma: una sola llave de comercio
// (BOLD_API_KEY) recibe todos los pagos y el ledger liquida a los
// proveedores.
//
// Docs: https://developers.bold.co/pagos-en-linea/api-link-de-pagos
// ==========================================

import crypto from 'node:crypto';
import axios from 'axios';

// Link de pagos (redirección a checkout.bold.co).
const API_BASE = process.env.BOLD_API_BASE || 'https://integrations.api.bold.co';
// API Pagos en línea (checkout transparente: la tarjeta se captura en tu web).
const ONLINE_API_BASE = process.env.BOLD_ONLINE_API_BASE || 'https://api.online.payments.bold.co';

// Credenciales globales de la plataforma. Se pueden cargar desde la config
// del panel (tienda principal) en tiempo de ejecución; si no, se usa el env.
let runtimeCreds = null;
export const setBoldCredentials = (creds) => { runtimeCreds = creds || null; };

const apiKey = () => runtimeCreds?.apiKey || process.env.BOLD_API_KEY || '';
const secretKey = () => runtimeCreds?.secretKey || process.env.BOLD_SECRET_KEY || '';

const authHeaders = () => ({
  Authorization: `x-api-key ${apiKey()}`,
  'Content-Type': 'application/json',
});

export const isBoldConfigured = () => Boolean(apiKey());

// La firma del webhook es HMAC-SHA256(base64(cuerpo crudo)) en hex,
// comparada con el header x-bold-signature. En modo pruebas la llave va vacía.
export const verifyBoldSignature = (rawBody, signature, secret = secretKey()) => {
  if (!signature) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
  const encoded = Buffer.from(body, 'utf8').toString('base64');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch {
    return false;
  }
};

// Construye el cuerpo de creación de link (monto cerrado).
export const buildPaymentLinkPayload = ({
  amount,
  currency = 'COP',
  reference,
  description,
  payerEmail,
  callbackUrl,
  paymentMethods,
  taxes,
  tipAmount = 0,
  expirationDate,
}) => ({
  amount_type: 'CLOSE',
  amount: {
    currency,
    total_amount: Number(amount),
    tip_amount: Number(tipAmount) || 0,
    ...(Array.isArray(taxes) && taxes.length > 0 ? { taxes } : {}),
  },
  ...(reference ? { reference } : {}),
  ...(description ? { description } : {}),
  ...(payerEmail ? { payer_email: payerEmail } : {}),
  ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  ...(Array.isArray(paymentMethods) && paymentMethods.length > 0 ? { payment_methods: paymentMethods } : {}),
  ...(expirationDate ? { expiration_date: expirationDate } : {}),
});

// Crea un link de pago. Devuelve { payment_link: 'LNK_...', url: 'https://checkout.bold.co/LNK_...' }.
export const createPaymentLink = async (params) => {
  if (!isBoldConfigured()) throw new Error('Bold no está configurado (BOLD_API_KEY).');
  const { data } = await axios.post(
    `${API_BASE}/online/link/v1`,
    buildPaymentLinkPayload(params),
    { headers: authHeaders() }
  );
  if (data?.errors?.length) throw new Error(`Bold: ${JSON.stringify(data.errors)}`);
  return data?.payload || null;
};

// Consulta estado y datos de un link: ACTIVE | PROCESSING | PAID | REJECTED | CANCELLED | EXPIRED.
export const getPaymentLink = async (paymentLink) => {
  const { data } = await axios.get(
    `${API_BASE}/online/link/v1/${encodeURIComponent(paymentLink)}`,
    { headers: authHeaders() }
  );
  return data;
};

// Métodos de pago habilitados y sus límites.
export const listPaymentMethods = async () => {
  const { data } = await axios.get(`${API_BASE}/online/link/v1/payment_methods`, { headers: authHeaders() });
  return data?.payload?.payment_methods || {};
};

// Respaldo: consulta la notificación por payment_id o por referencia externa.
export const getNotificationByReference = async (reference, { isExternalReference = true } = {}) => {
  const { data } = await axios.get(
    `${API_BASE}/payments/webhook/notifications/${encodeURIComponent(reference)}`,
    { headers: authHeaders(), params: isExternalReference ? { is_external_reference: true } : {} }
  );
  return data?.notifications || [];
};

// ==================================================================
// API Pagos en línea (checkout transparente)
// Docs: https://developers.bold.co/pagos-en-linea/api-de-pagos-en-linea/integracion
// ==================================================================

const unwrap = (data) => {
  if (data?.errors?.length) throw new Error(`Bold: ${JSON.stringify(data.errors)}`);
  return data?.payload ?? data;
};

// Intención de pago (paso 1): monto, cliente y callback.
export const buildPaymentIntentPayload = ({
  referenceId,
  amount,
  currency = 'COP',
  taxes,
  tipAmount = 0,
  description,
  callbackUrl,
  metadata,
  customer,
  expirationDate,
  deviceFingerprint,
}) => ({
  reference_id: String(referenceId),
  amount: {
    currency,
    total_amount: Number(amount),
    tip_amount: Number(tipAmount) || 0,
    ...(Array.isArray(taxes) && taxes.length > 0 ? { taxes } : {}),
  },
  ...(description ? { description } : {}),
  ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  ...(metadata ? { metadata } : {}),
  ...(customer ? { customer } : {}),
  ...(expirationDate ? { expiration_date: expirationDate } : {}),
  ...(deviceFingerprint ? { device_fingerprint: deviceFingerprint } : {}),
});

// Intento de pago (paso 2): pagador + método de pago.
export const buildPaymentAttemptPayload = ({
  referenceId,
  payer,
  paymentMethod,
  deviceFingerprint,
  metadata,
}) => ({
  reference_id: String(referenceId),
  ...(metadata ? { metadata } : {}),
  payer,
  payment_method: paymentMethod,
  ...(deviceFingerprint ? { device_fingerprint: deviceFingerprint } : {}),
});

export const createPaymentIntent = async (params) => {
  if (!isBoldConfigured()) throw new Error('Bold no está configurado (BOLD_API_KEY).');
  const { data } = await axios.post(`${ONLINE_API_BASE}/v1/payment-intent`, buildPaymentIntentPayload(params), { headers: authHeaders() });
  return unwrap(data);
};

export const getPaymentIntent = async (referenceId) => {
  const { data } = await axios.get(`${ONLINE_API_BASE}/v1/payment-intent/${encodeURIComponent(referenceId)}`, { headers: authHeaders() });
  return unwrap(data);
};

export const updatePaymentIntent = async (params) => {
  const { data } = await axios.put(`${ONLINE_API_BASE}/v1/payment-intent`, buildPaymentIntentPayload(params), { headers: authHeaders() });
  return unwrap(data);
};

// Devuelve { transaction_id, next_actions?, status: APPROVED|REJECTED|RUNNING }.
export const createPaymentAttempt = async (params) => {
  const { data } = await axios.post(`${ONLINE_API_BASE}/v1/payment`, buildPaymentAttemptPayload(params), { headers: authHeaders() });
  return unwrap(data);
};

export const getPaymentStatus = async (referenceId) => {
  const { data } = await axios.get(`${ONLINE_API_BASE}/v1/payment/${encodeURIComponent(referenceId)}`, { headers: authHeaders() });
  return unwrap(data);
};

export const listPseBanks = async () => {
  const { data } = await axios.get(`${ONLINE_API_BASE}/v1/payment/pse/banks`, { headers: authHeaders() });
  return unwrap(data)?.banks || [];
};

export const voidPayment = async (transactionId) => {
  await axios.post(`${ONLINE_API_BASE}/v1/payment/void`, { transaction_id: transactionId }, { headers: authHeaders() });
  return true;
};

export const refundPayment = async ({ referenceId, transactionId, reason }) => {
  await axios.post(`${ONLINE_API_BASE}/v1/payment/refund`, {
    reference_id: String(referenceId),
    transaction_id: transactionId,
    reason,
  }, { headers: authHeaders() });
  return true;
};

export const getRefundStatus = async (transactionId) => {
  const { data } = await axios.get(`${ONLINE_API_BASE}/v1/payment/refund/${encodeURIComponent(transactionId)}`, { headers: authHeaders() });
  return unwrap(data);
};
