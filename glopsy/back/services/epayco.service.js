// ==========================================
// ePayco — Checkout Onpage (Colombia)
//
// Cuenta central de la plataforma: una sola PUBLIC_KEY (checkout.js) recibe
// todos los pagos y el ledger liquida a los proveedores.
//
// La confirmación llega por webhook (form-urlencoded) y se valida con la
// firma MD5 (x_signature) usando P_KEY. No requiere IP fija ni llamadas
// server-to-server a la API de ePayco.
//
// Docs: https://docs.epayco.co
// ==========================================

import crypto from 'node:crypto';

// Credenciales globales de la plataforma. Se cargan desde la config del panel
// (tienda principal) en tiempo de ejecución; si no, se usan las de env.
let runtimeCreds = null;
export const setEpaycoCredentials = (creds) => { runtimeCreds = creds || null; };

const publicKey = () => runtimeCreds?.publicKey || process.env.EPAYCO_PUBLIC_KEY || '';
const privateKey = () => runtimeCreds?.privateKey || process.env.EPAYCO_PRIVATE_KEY || '';
const customerId = () => runtimeCreds?.customerId || process.env.EPAYCO_CUSTOMER_ID || '';

export const isEpaycoConfigured = () => Boolean(publicKey() && privateKey());
export const getEpaycoPublicKey = () => publicKey();
export const getEpaycoCustomerId = () => customerId();
export const isEpaycoTest = () => runtimeCreds?.test !== false;

// Firma del webhook:
//   sha256( x_cust_id_cliente ^ p_key ^ x_ref_payco ^ x_transaction_id ^ x_amount ^ x_currency_code )
// Confirmado en https://github.com/epayco/resources (onePage/confirmation).
export const buildEpaycoSignature = ({
  custId,
  refPayco,
  transactionId,
  amount,
  currency,
  key = privateKey(),
}) => crypto
  .createHash('sha256')
  .update([custId, key, refPayco, transactionId, amount, currency].join('^'))
  .digest('hex');

export const verifyEpaycoSignature = (data = {}) => {
  const received = String(data.x_signature || '').toLowerCase();
  if (!received) return false;
  const expected = buildEpaycoSignature({
    custId: data.x_cust_id_cliente,
    refPayco: data.x_ref_payco,
    transactionId: data.x_transaction_id,
    amount: data.x_amount,
    currency: data.x_currency_code,
  });
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Datos para ePayco.checkout.configure({ key, test }).open(data) — Onpage.
export const buildOnpageData = ({
  key = publicKey(),
  test = isEpaycoTest(),
  invoice,
  amount,
  currency = 'COP',
  description,
  name = 'Compra en Glopsy',
  taxBase = 0,
  tax = 0,
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
  tax_base: Number(taxBase) || 0,
  tax: Number(tax) || 0,
  country: 'co',
  lang: 'es',
  external: 'false',
  ...(confirmationUrl ? { confirmation: confirmationUrl } : {}),
  ...(responseUrl ? { response: responseUrl } : {}),
  ...(billing.name ? { name_billing: billing.name } : {}),
  ...(billing.address ? { address_billing: billing.address } : {}),
  ...(billing.documentType ? { type_doc_billing: billing.documentType } : {}),
  ...(billing.documentNumber ? { number_doc_billing: billing.documentNumber } : {}),
  ...(billing.phone ? { mobilephone_billing: billing.phone } : {}),
  ...(billing.email ? { email_billing: billing.email } : {}),
  ...(Object.keys(extras).length > 0 ? { extras } : {}),
});

// Estados de ePayco normalizados.
export const normalizeEpaycoState = (state, response) => {
  const s = String(state || response || '').trim().toLowerCase();
  if (s === 'aceptada' || s === 'aprobada') return 'approved';
  if (s === 'rechazada' || s === 'fallida' || s === 'failed') return 'rejected';
  if (s === 'reversada' || s === 'reversion') return 'refunded';
  if (s === 'pendiente' || s === 'pending') return 'pending';
  return 'unknown';
};
