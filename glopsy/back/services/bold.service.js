// ==========================================
// Conector de pasarela Bold (configurable).
//
// Bold es la pasarela donde la plataforma recibe los pagos y desde donde se
// dispersan fondos a los proveedores. El contrato real de la API puede variar
// según el producto contratado; este conector centraliza:
//   1. Verificación de disputas/contracargos antes de liberar fondos.
//   2. Envío de la liquidación al proveedor.
//
// Si no está configurado (sin credenciales) el flujo NO libera fondos: deja la
// liquidación "enviando"/retenida hasta que la verificación sea posible. Así se
// cumple la regla: no se suelta dinero si no se confirma que no hay reclamo.
//
// Config vía env (o runtime setBoldCredentials):
//   BOLD_DISPUTES_URL   -> endpoint que recibe las refs y responde disputas
//   BOLD_PAYOUT_URL     -> endpoint de dispersión
//   BOLD_BALANCE_URL    -> endpoint de saldos (disponible, diferido, congelado)
//   BOLD_API_KEY        -> llave/secret de autenticación
// ==========================================

import axios from 'axios';
import crypto from 'node:crypto';

let runtimeCreds = null;
export const setBoldCredentials = (creds = null) => { runtimeCreds = creds || null; };

const apiKey = () => runtimeCreds?.apiKey || process.env.BOLD_API_KEY || '';
const disputesUrl = () => runtimeCreds?.disputesUrl || process.env.BOLD_DISPUTES_URL || '';
const payoutUrl = () => runtimeCreds?.payoutUrl || process.env.BOLD_PAYOUT_URL || '';
const balanceUrl = () => runtimeCreds?.balanceUrl || process.env.BOLD_BALANCE_URL || '';

// Credenciales del checkout Onpage (cuenta Bold de la plataforma).
const publicKey = () => runtimeCreds?.publicKey || process.env.BOLD_PUBLIC_KEY || '';
const privateKey = () => runtimeCreds?.privateKey || process.env.BOLD_PRIVATE_KEY || '';
const customerId = () => runtimeCreds?.customerId || process.env.BOLD_CUSTOMER_ID || '';
const sdkUrl = () => runtimeCreds?.sdkUrl || process.env.BOLD_SDK_URL || 'https://checkout.bold.co/checkout.js';

export const isBoldCheckoutConfigured = () => Boolean(publicKey() && privateKey());
export const getBoldPublicKey = () => publicKey();
export const getBoldPrivateKey = () => privateKey();
export const getBoldCustomerId = () => customerId();
export const getBoldSdkUrl = () => sdkUrl();
export const isBoldTest = () => runtimeCreds?.test !== false;

export const isBoldConfigured = () => Boolean(apiKey() && disputesUrl());

const headers = () => ({ Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' });

// Consulta si alguna orden tiene disputa, reclamo o contracargo abierto en Bold.
// Devuelve { configured, disputes, error }.
export const checkPayoutDisputes = async ({ orders = [] }) => {
  const refs = orders.map((o) => o?.refPayco || o?.externalRef || String(o?.orderId || '')).filter(Boolean);
  if (!isBoldConfigured()) return { configured: false, disputes: null, error: null };

  try {
    const { data } = await axios.post(disputesUrl(), { references: refs }, { headers: headers(), timeout: 15000 });
    const list = Array.isArray(data?.disputes) ? data.disputes : [];
    return {
      configured: true,
      disputes: list.map((d) => ({
        orderId: d?.orderId ?? d?.order_id ?? null,
        reference: d?.reference ?? d?.ref ?? null,
        status: d?.status ?? null,
      })),
      error: null,
    };
  } catch (err) {
    // No confirmamos saldo limpio: ante error, el flujo retiene los fondos.
    return { configured: true, disputes: null, error: String(err?.message || 'error_bold') };
  }
};

// Dispersa el monto de la liquidación al proveedor en Bold.
// Devuelve { configured, ok, error, externalRef }.
export const sendPayout = async ({ providerRef, amount, currency, reference = null } = {}) => {
  if (!isBoldConfigured()) return { configured: false, ok: false, error: 'no_configurado' };

  try {
    const { data } = await axios.post(payoutUrl(), {
      recipient: providerRef,
      amount: Number(amount),
      currency: currency || 'COP',
      reference,
    }, { headers: headers(), timeout: 20000 });
    return {
      configured: true,
      ok: data?.ok === true || (data && data.status !== 'rejected'),
      error: data?.message || null,
      externalRef: data?.id || data?.transferId || data?.external_id || null,
    };
  } catch (err) {
    return { configured: true, ok: false, error: String(err?.message || 'error_bold') };
  }
};

// Saldos de la cuenta Bold: disponible, diferido y congelado (disputas/garantías).
// Devuelve { configured, available, deferred, frozen, dispute, currency, error }.
export const getAccountBalances = async () => {
  if (!apiKey() || !balanceUrl()) return { configured: false, available: 0, deferred: 0, frozen: 0, dispute: 0, currency: 'COP', error: null };

  try {
    const { data } = await axios.get(balanceUrl(), { headers: headers(), timeout: 15000 });
    const b = data?.balances || data || {};
    const num = (v) => (Number(v) || 0);
    return {
      configured: true,
      available: num(b.available ?? b.availableAmount),
      deferred: num(b.deferred ?? b.deferredAmount),
      frozen: num(b.frozen ?? b.frozenAmount),
      dispute: num(b.dispute ?? b.disputeAmount ?? b.chargebacks ?? b.chargebackAmount),
      currency: String(b.currency || 'COP').toUpperCase(),
      error: null,
    };
  } catch (err) {
    return { configured: true, available: 0, deferred: 0, frozen: 0, dispute: 0, currency: 'COP', error: String(err?.message || 'error_bold') };
  }
};

// ------------------------------------------------------------------
// Checkout Onpage (cuenta Bold de la plataforma).
// Firma HMAC-SHA256 del webhook: sha256( customer_id ^ key ^ ref ^ txn ^ amount ^ currency )
// ------------------------------------------------------------------

export const buildBoldSignature = ({
  custId,
  ref,
  transactionId,
  amount,
  currency,
  key = privateKey(),
}) => crypto
  .createHmac('sha256', String(key))
  .update([custId, key, ref, transactionId, amount, currency].join('^'))
  .digest('hex');

export const verifyBoldSignature = (data = {}) => {
  const received = String(data.x_signature || data.signature || '').toLowerCase();
  if (!received) return false;
  const expected = buildBoldSignature({
    custId: data.x_cust_id_cliente || data.customer_id,
    ref: data.x_ref_payco || data.reference,
    transactionId: data.x_transaction_id || data.transaction_id,
    amount: data.x_amount || data.amount,
    currency: data.x_currency_code || data.currency,
  });
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Datos para el checkout Onpage de Bold (window.Bold.checkout.configure().open()).
export const buildBoldOnpageData = ({
  key = publicKey(),
  test = isBoldTest(),
  invoice,
  amount,
  currency = 'COP',
  description,
  name = 'Compra en Glopsy',
  confirmationUrl,
  responseUrl,
  billing = {},
  extras = {},
}) => ({
  key,
  test: Boolean(test),
  name,
  description: description || name,
  invoice: String(invoice),
  currency: String(currency).toLowerCase(),
  amount: Number(amount),
  country: 'co',
  lang: 'es',
  external: 'false',
  ...(confirmationUrl ? { confirmation: confirmationUrl } : {}),
  ...(responseUrl ? { response: responseUrl } : {}),
  ...(billing.name ? { name_billing: billing.name } : {}),
  ...(billing.email ? { email_billing: billing.email } : {}),
  ...(billing.documentType ? { type_doc_billing: billing.documentType } : {}),
  ...(billing.documentNumber ? { number_doc_billing: billing.documentNumber } : {}),
  ...(billing.phone ? { mobilephone_billing: billing.phone } : {}),
  ...(Object.keys(extras).length > 0 ? { extras } : {}),
});

// Estados de Bold normalizados.
export const normalizeBoldState = (state, response) => {
  const s = String(state || response || '').trim().toLowerCase();
  if (s === 'aceptada' || s === 'aprobada' || s === 'approved') return 'approved';
  if (s === 'rechazada' || s === 'fallida' || s === 'failed' || s === 'rejected') return 'rejected';
  if (s === 'reversada' || s === 'reversion' || s === 'refunded') return 'refunded';
  if (s === 'pendiente' || s === 'pending') return 'pending';
  return 'unknown';
};