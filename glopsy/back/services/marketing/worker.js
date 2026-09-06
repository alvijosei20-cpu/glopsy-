import { pool } from '../../db.js';
import { redisClient } from '../redis.service.js';
import { runMarketingAnalysis } from './engine.js';

const LOCK_KEY = 'marketing:worker:lock';
const LOCK_TTL_SECONDS = Number(process.env.MARKETING_WORKER_LOCK_SECONDS) || 600;
const INTERVAL_HOURS = Number(process.env.MARKETING_INTERVAL_HOURS) || 6;

let timer = null;
let running = false;

const acquireLock = async () => {
  try {
    const ok = await redisClient.set(LOCK_KEY, String(Date.now()), {
      NX: true,
      EX: LOCK_TTL_SECONDS,
    });
    return Boolean(ok);
  } catch (err) {
    console.warn('[marketing-worker] Redis no disponible, ejecuto sin lock:', err.message);
    return true;
  }
};

const releaseLock = async () => {
  try {
    await redisClient.del(LOCK_KEY);
  } catch {}
};

const activeStores = async () => {
  const { rows } = await pool.query(
    `SELECT DISTINCT p.tienda_id
     FROM produc p
     JOIN tiendas t ON t.usrid = p.tienda_id
     WHERE p.status = 'active' AND t.activa = true`
  );
  return rows.map((r) => Number(r.tienda_id));
};

const runCycle = async ({ manual = false } = {}) => {
  if (running) {
    console.log('[marketing-worker] Ya hay un ciclo en ejecución, se omite.');
    return;
  }
  const locked = await acquireLock();
  if (!locked) {
    console.log('[marketing-worker] Otra instancia ejecuta el ciclo, se omite.');
    return;
  }
  running = true;
  try {
    const stores = await activeStores();
    const results = [];
    for (const tiendaId of stores) {
      try {
        const res = await runMarketingAnalysis(tiendaId, { manual });
        results.push({ tiendaId, ...res.stats });
        console.log(`[marketing-worker] Tienda ${tiendaId}: ${JSON.stringify(res.stats)}`);
      } catch (err) {
        console.error(`[marketing-worker] Error en tienda ${tiendaId}:`, err.message);
        results.push({ tiendaId, error: err.message });
      }
    }
    return results;
  } finally {
    running = false;
    await releaseLock();
  }
};

export const scheduleMarketingWorker = () => {
  if (timer) return timer;
  const intervalMs = INTERVAL_HOURS * 60 * 60 * 1000;
  const run = async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error('[marketing-worker] Error de ciclo:', err.message);
    }
  };
  setTimeout(run, 60 * 1000);
  timer = setInterval(run, intervalMs);
  timer.unref?.();
  console.log(`[marketing-worker] Programado cada ${INTERVAL_HOURS}h (primer ciclo en 1 min).`);
  return timer;
};

export const stopMarketingWorker = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

export { runCycle as runMarketingCycleNow };
