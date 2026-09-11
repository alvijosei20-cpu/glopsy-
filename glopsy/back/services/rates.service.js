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
