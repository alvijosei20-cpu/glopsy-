// ==========================================
// Moneda de cobro del checkout.
//
// Tiendas habilitadas en USD: un visitante del mismo país paga en su moneda
// local (p. ej. COP con Bold); el resto paga en USD.
// ==========================================

import { pool } from '../db.js';
import { getUsdRateTo } from './rates.service.js';

export const visitorCountryFromReq = (req) => {
  const raw = req?.headers?.['x-visitor-country'] || req?.headers?.['cf-ipcountry'] || req?.headers?.['x-vercel-ip-country'] || '';
  const c = String(raw).trim().toUpperCase();
  return c && c !== 'XX' && c !== 'T1' ? c : null;
};

export const resolveCheckoutCurrency = async (tiendaId, visitor = null) => {
  const { rows } = await pool.query(
    `SELECT COALESCE(t.moneda, pa.moneda, 'COP') AS moneda,
            t.pais_id, pa.codigo_iso, pa.moneda AS pais_moneda
     FROM tiendas t
     LEFT JOIN paises pa ON pa.id = t.pais_id
     WHERE t.usrid = $1 LIMIT 1`,
    [tiendaId]
  );
  const t = rows[0] || {};
  const storeCurrency = String(t.moneda || 'COP').toUpperCase();
  const base = { storeCurrency, currency: storeCurrency, rate: 1, converted: false };
  if (storeCurrency !== 'USD') return base;

  const local = String(t.pais_moneda || '').toUpperCase();
  if (!visitor || !t.codigo_iso || local === 'USD' || String(visitor).toUpperCase() !== String(t.codigo_iso).toUpperCase()) {
    return base;
  }
  const rate = await getUsdRateTo(local);
  if (!rate || rate <= 0) return base;
  return { storeCurrency, currency: local, rate, converted: true };
};

export const convertAmount = (amount, rate) =>
  Math.round((Number(amount) + Number.EPSILON) * (Number(rate) || 1) * 100) / 100;
