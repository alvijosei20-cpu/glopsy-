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
import { isEpaycoConfigured, getEpaycoPublicKey, getEpaycoPrivateKey, getEpaycoCustomerId } from './epayco.service.js';
import { loadEpaycoCredentials } from './paymentConfig.service.js';

const isEnabled = () => String(process.env.EPAYCO_PAYOUTS_ENABLED || '').toLowerCase() === 'true';
export const isEpaycoPayoutsEnabled = isEnabled;

const baseUrl = () => (process.env.EPAYCO_PAYOUTS_BASE_URL || 'https://apiflow.epayco.io').replace(/\/$/, '');
// El id del comercio en ePayco (id_epayco) coincide con P_CUST_ID_CLIENTE; si no se
// define en env se deriva de la cuenta configurada en la tarjeta ePayco.
const idEpayco = () => process.env.EPAYCO_ID_EPAYCO || getEpaycoCustomerId() || '';
const idPlan = () => process.env.EPAYCO_ID_PLAN || '';

// Token de apiflow: login OAuth 2.0 client_credentials contra apiflow
// (POST /authentication/api/v2/login). Permite un override manual por env.
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

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: pk,
    client_secret: pKey,
  });
  const res = await axios.post(
    `${baseUrl()}/authentication/api/v2/login`,
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: Number(process.env.EPAYCO_PAYOUTS_TIMEOUT || 15000),
    }
  );
  const token = res.data?.data?.token || res.data?.token || res.data?.access_token;
  if (!token) {
    const e = new Error('ePayco Payouts: el login OAuth no devolvió token.');
    e.code = 'EPAYCO_PAYOUTS_REJECTED';
    e.status = res.status;
    e.data = res.data;
    throw e;
  }
  const exp = Number(res.data?.data?.expires_in) || Number(res.data?.expires_in) || 0;
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
  if (!idEpayco()) {
    const err = new Error('ePayco Payouts: no se pudo determinar el id_epayco (define EPAYCO_ID_EPAYCO o configura la tarjeta ePayco).');
    err.code = 'EPAYCO_PAYOUTS_CONFIG';
    throw err;
  }
  if (!idPlan()) {
    const err = new Error('ePayco Payouts: falta EPAYCO_ID_PLAN (id del plan para proveedores en el panel ePayco Payouts).');
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

  // Asegura que las llaves estén cargadas (para derivar id_epayco del P_CUST_ID_CLIENTE).
  if (!isEpaycoConfigured()) {
    await loadEpaycoCredentials().catch(() => {});
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