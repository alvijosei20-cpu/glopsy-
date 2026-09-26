// ==========================================
// ePayco Payouts — alta de proveedores
//
// Al crear una tienda nueva en /vender, la plataforma registra al vendedor
// como "proveedor" en el producto ePayco Payouts (apiflow.epayco.io) para que
// la liquidación de saldos (ledger) pueda dispersarse a su cuenta bancaria.
//
// La funcionalidad está apagada por defecto (EPAYCO_PAYOUTS_ENABLED=false).
// Cuando se activa, el alta es obligatoria: si falla, la creación de la tienda
// se rechaza (el owner de la plataforma debe revisar credenciales y respuesta).
//
// Docs: https://docs.epayco.com/docs/flujo-de-pago-de-proveedores
// ==========================================

import axios from 'axios';
import { isEpaycoConfigured, getEpaycoPublicKey, getEpaycoPrivateKey } from './epayco.service.js';
import { loadEpaycoCredentials } from './paymentConfig.service.js';

const isEnabled = () => String(process.env.EPAYCO_PAYOUTS_ENABLED || '').toLowerCase() === 'true';
export const isEpaycoPayoutsEnabled = isEnabled;

const apifyUrl = () => (process.env.EPAYCO_APIFY_URL || 'https://api.epayco.co').replace(/\/$/, '');
const baseUrl = () => (process.env.EPAYCO_PAYOUTS_BASE_URL || 'https://apiflow.epayco.io').replace(/\/$/, '');
const idEpayco = () => process.env.EPAYCO_ID_EPAYCO || '';
const idPlan = () => process.env.EPAYCO_ID_PLAN || '';

// Token de apiflow. El ideal es el token_apify obtenido por login, pero permite
// un override manual por env (útil para depurar o cuando el producto exige otro token).
const hardcodedToken = () => process.env.EPAYCO_PAYOUTS_TOKEN || '';

let cachedToken = null;
let cachedTokenExp = 0;
const getApifyToken = async () => {
  if (hardcodedToken()) return hardcodedToken();
  if (cachedToken && Date.now() < cachedTokenExp) return cachedToken;

  if (!isEpaycoConfigured()) {
    await loadEpaycoCredentials().catch(() => {});
  }
  const pk = getEpaycoPublicKey();
  const pKey = getEpaycoPrivateKey();
  if (!pk || !pKey) {
    const err = new Error('ePayco Payouts: no hay PUBLIC_KEY/PRIVATE_KEY configuradas (tarjeta ePayco en Payments y checkout).');
    err.code = 'EPAYCO_PAYOUTS_CONFIG';
    throw err;
  }

  const basic = Buffer.from(`${pk}:${pKey}`).toString('base64');
  const res = await axios.post(
    `${apifyUrl()}/login`,
    '',
    {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.EPAYCO_PAYOUTS_TIMEOUT || 15000),
    }
  );
  const token = res.data?.token || res.data?.access_token;
  if (!token) {
    const e = new Error('ePayco Payouts: el login no devolvió token.');
    e.code = 'EPAYCO_PAYOUTS_REJECTED';
    e.status = 200;
    e.data = res.data;
    throw e;
  }
  const exp = Number(res.data?.expires_in) || Number(res.data?.exp || 0);
  cachedToken = token;
  cachedTokenExp = exp > 0 ? Date.now() + exp * 1000 : Date.now() + 55 * 60 * 1000;
  return token;
};

// Tipos de documento que acepta el payload de proveedores de ePayco Payouts.
const DOC_LABEL = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  NIT: 'Nit',
  PA: 'Pasaporte',
  TI: 'Tarjeta de identidad',
  PPT: 'Permiso por Protección Temporal',
};

// commerce_type: 'P' por persona natural, 'C' por persona jurídica.
const comercioType = (tipoProveedor) => (tipoProveedor === 'juridica' ? 'C' : 'P');

const typeAccount = (tipoCuenta) => (String(tipoCuenta).toLowerCase() === 'corriente' ? 'Corriente' : 'Ahorros');

const digito = (value) => String(value || '').replace(/\D/g, '');

// Valida que el backend tenga todo lo necesario para operar el alta.
export const assertEpaycoPayoutsConfig = () => {
  if (!idEpayco() || !idPlan()) {
    const err = new Error('ePayco Payouts: faltan EPAYCO_ID_EPAYCO y/o EPAYCO_ID_PLAN (panel ePayco Payouts).');
    err.code = 'EPAYCO_PAYOUTS_CONFIG';
    throw err;
  }
};

// Registra al vendedor como proveedor en ePayco Payouts.
// tienda: fila de tiendas + país (paisCodigo). account: cuenta de pagos guardada.
// Devuelve { ok: true, data } o { skipped: true, reason }.
// Lanza Error si ePayco rechaza/falla.
export const registerEpaycoProvider = async ({ tienda, account } = {}) => {
  if (!isEnabled()) return { skipped: true, reason: 'epayco_payouts_inactivo' };
  if (!tienda || !account) {
    const err = new Error('ePayco Payouts: faltan los datos de la tienda o de la cuenta de pagos.');
    err.code = 'EPAYCO_PAYOUTS_CONFIG';
    throw err;
  }
  // ePayco solo dispersa a bancos colombianos y proveedores de Colombia.
  if (String(tienda.paisCodigo || '').toUpperCase() !== 'CO') {
    return { skipped: true, reason: 'pais_no_soportado' };
  }
  // Binance Pay no es un banco dispersable por ePayco.
  if (String(account.banco_codigo || '').toUpperCase() === 'BINANCE_PAY') {
    return { skipped: true, reason: 'banco_no_soportado' };
  }

  assertEpaycoPayoutsConfig();

  const docLabel = DOC_LABEL[String(account.tipo_documento || '').trim().toUpperCase()] || String(account.tipo_documento || '').toUpperCase();
  const phoneDigits = digito(tienda.contacto_telefono);

  const payload = {
    id_epayco: Number(idEpayco()),
    id_plan: Number(idPlan()),
    client_name: String(tienda.nombres || tienda.name || '').trim().slice(0, 80),
    name: String(account.titular_cuenta || '').trim().slice(0, 80),
    state: true,
    company_name: account.tipo_proveedor === 'juridica' ? String(account.titular_cuenta || '').trim().slice(0, 120) : null,
    document_type: docLabel,
    document_number: String(account.titular_documento || '').trim(),
    email: String(tienda.contacto_email || '').trim().slice(0, 120),
    phone: phoneDigits ? Number(phoneDigits.slice(0, 15)) : 0,
    url_imagen: '',
    bank: String(account.banco_nombre || '').trim().slice(0, 80),
    type_account: typeAccount(account.tipo_cuenta),
    account_number: String(account.numero_cuenta || '').trim(),
    id_category: process.env.EPAYCO_PAYOUTS_CATEGORY_ID || '0112',
    category: process.env.EPAYCO_PAYOUTS_CATEGORY || 'Comercio electrónico y venta por catálogo',
    commerce_type: comercioType(account.tipo_proveedor),
    id_epayco_provider: 0,
  };

  const url = `${baseUrl()}/payouts/api/v2/providers`;
  const apifyToken = await getApifyToken();
  let res;
  try {
    res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${apifyToken}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.EPAYCO_PAYOUTS_TIMEOUT || 15000),
    });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('[ePayco Payouts] fallo registrando proveedor:', JSON.stringify(detail).slice(0, 1200));
    if (err.response?.status) {
      const e = new Error('ePayco Payouts rechazó el registro del proveedor.');
      e.code = 'EPAYCO_PAYOUTS_REJECTED';
      e.status = err.response.status;
      e.data = err.response.data;
      throw e;
    }
    throw new Error(`ePayco Payouts no respondió: ${err.message}`);
  }

  return { ok: true, data: res.data, payload: { ...payload, document_number: '***', account_number: '***', phone: '***', email: '***' } };
};