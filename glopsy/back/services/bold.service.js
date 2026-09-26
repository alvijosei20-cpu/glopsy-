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

let runtimeCreds = null;
export const setBoldCredentials = (creds = null) => { runtimeCreds = creds || null; };

const apiKey = () => runtimeCreds?.apiKey || process.env.BOLD_API_KEY || '';
const disputesUrl = () => runtimeCreds?.disputesUrl || process.env.BOLD_DISPUTES_URL || '';
const payoutUrl = () => runtimeCreds?.payoutUrl || process.env.BOLD_PAYOUT_URL || '';
const balanceUrl = () => runtimeCreds?.balanceUrl || process.env.BOLD_BALANCE_URL || '';

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