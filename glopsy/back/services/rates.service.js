// Tasa USD -> VES (bolívares) para operar Venezuela.
// Fuente: DolarApi.com (https://ve.dolarapi.com). Se cachea y, si falla,
// se usa VE_FALLBACK_RATE del entorno.
import { redisClient } from './redis.service.js';

const CACHE_KEY = 'rates:ve:usd';
const CACHE_TTL_SECONDS = 60 * 60; // 1 hora

const DOLARAPI_BASE = process.env.DOLARAPI_BASE || 'https://ve.dolarapi.com/v1/dolares';

const parseRate = (data) => {
  const list = Array.isArray(data) ? data : [data];
  const source = (process.env.VE_RATE_SOURCE || 'oficial').toLowerCase();
  const pick = list.find((d) => String(d?.fuente || '').toLowerCase() === source) || list[0];
  const rate = Number(pick?.promedio ?? pick?.venta ?? pick?.compra);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
};

// Devuelve cuántos bolívares equivalen a 1 USD.
export const getVeUsdRate = async () => {
  const cached = await redisClient.get(CACHE_KEY).catch(() => null);
  if (cached) {
    const n = Number(cached);
    if (Number.isFinite(n) && n > 0) return n;
  }

  try {
    const res = await fetch(DOLARAPI_BASE, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const rate = parseRate(await res.json());
      if (rate) {
        await redisClient.set(CACHE_KEY, String(rate), { EX: CACHE_TTL_SECONDS }).catch(() => {});
        return rate;
      }
    }
  } catch (error) {
    console.warn('[rates] no se pudo obtener la tasa VE de DolarApi:', error.message);
  }

  const fallback = Number(process.env.VE_FALLBACK_RATE);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
};

// Convierte un monto en bolívares a USD (redondeado a 2 decimales).
export const bsToUsd = (bs, rate) => {
  const n = Number(bs) || 0;
  if (!rate || rate <= 0) return null;
  return Math.round((n / rate) * 100) / 100;
};

// Tasa USD -> moneda local (para mostrar precio local a visitantes del país).
// VES usa DolarApi; otras (p. ej. COP) usan Frankfurter con respaldo en env USD_<CUR>_RATE.
export const getUsdRateTo = async (currency) => {
  const cur = String(currency || '').toUpperCase();
  if (!cur || cur === 'USD') return 1;
  if (cur === 'VES') {
    const r = await getVeUsdRate();
    return r && r > 0 ? r : null;
  }

  // Tasa forzada por entorno (tiene prioridad; no depende de APIs externas).
  const forced = Number(process.env[`USD_${cur}_RATE`]);
  if (Number.isFinite(forced) && forced > 0) return forced;

  const cacheKey = `rates:usd:${cur}`;
  const cached = await redisClient.get(cacheKey).catch(() => null);
  if (cached) {
    const n = Number(cached);
    if (Number.isFinite(n) && n > 0) return n;
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const rate = Number(data?.rates?.[cur]);
      if (Number.isFinite(rate) && rate > 0) {
        await redisClient.set(cacheKey, String(rate), { EX: CACHE_TTL_SECONDS }).catch(() => {});
        return rate;
      }
    }
  } catch (error) {
    console.warn(`[rates] no se pudo obtener USD->${cur}:`, error.message);
  }

  return null;
};
