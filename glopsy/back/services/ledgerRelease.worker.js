// ==========================================
// Programador diario del ledger.
//
// - Libera automáticamente los saldos vencidos (LEDGER_HOLD_BUSINESS_DAYS días
//   hábiles tras la entrega) -> bucket 'provider_available'.
// - Crea los LOTES de pago (payouts) por proveedor/moneda, listos para que el
//   admin apruebe/disperse MANUALMENTE (approvePayout).
// ==========================================

import { pool } from '../db.js';
import { releaseEligibleOrders, createPayout } from './ledger.service.js';

const CHECK_INTERVAL_MS = Number(process.env.LEDGER_WORKER_CHECK_MS || 60 * 60 * 1000); // revisa cada 1h
const LOCK_KEY = 'worker:ledger:lock';
const LOCK_TTL_SECONDS = 1800;

let timer = null;
let running = false;
let redisClient = null;

const getRedis = async () => {
  if (redisClient !== null) return redisClient;
  try {
    ({ redisClient } = await import('./redis.service.js'));
  } catch {
    redisClient = false;
  }
  return redisClient;
};

const dayKey = () => `worker:ledger:day:${new Date().toISOString().slice(0, 10)}`;

const acquireLock = async () => {
  const redis = await getRedis();
  if (!redis) return true;
  try {
    const ok = await redis.set(LOCK_KEY, String(Date.now()), { NX: true, EX: LOCK_TTL_SECONDS });
    return Boolean(ok);
  } catch {
    return true;
  }
};

const releaseLock = async () => {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.del(LOCK_KEY);
  } catch {}
};

const alreadyRanToday = async () => {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    return Boolean(await redis.get(dayKey()));
  } catch {
    return false;
  }
};

const markRanToday = async () => {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(dayKey(), String(Date.now()), { EX: 172800 });
  } catch {}
};

export const runLedgerDailyJob = async () => {
  const dias = Number(process.env.LEDGER_HOLD_BUSINESS_DAYS || 2);
  const liberacion = await releaseEligibleOrders({ dias });
  console.log(`[ledger-worker] Órdenes evaluadas: ${liberacion.evaluated}. Liberadas: ${liberacion.released.length}.`);

  // Crea los lotes de payout por proveedor/moneda con saldo disponible.
  const { rows: proveedores } = await pool.query(
    `SELECT provider_ref, moneda
     FROM ledger_account_balances
     WHERE bucket = 'provider_available'
     GROUP BY provider_ref, moneda
     HAVING COALESCE(SUM(balance), 0) > 0`
  );
  const pagos = [];
  for (const p of proveedores) {
    const res = await createPayout({ providerRef: p.provider_ref, moneda: p.moneda });
    if (res.created) pagos.push({ provider: p.provider_ref, moneda: p.moneda, total: res.total, payoutId: res.payoutId });
  }
  console.log(`[ledger-worker] Payouts creados (pendientes de aprobación manual): ${pagos.length}.`);
  return { released: liberacion.released.length, payouts: pagos.length };
};

const runCycle = async () => {
  if (running) return;
  if (await alreadyRanToday()) return;
  const locked = await acquireLock();
  if (!locked) return;
  running = true;
  try {
    await runLedgerDailyJob();
    await markRanToday();
  } catch (err) {
    console.error('[ledger-worker] error de ciclo:', err.message);
  } finally {
    running = false;
    await releaseLock();
  }
};

export const scheduleLedgerWorker = () => {
  if (timer) return timer;
  const run = async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error('[ledger-worker] error de ciclo:', err.message);
    }
  };
  setTimeout(run, 2 * 60 * 1000);
  timer = setInterval(run, CHECK_INTERVAL_MS);
  timer.unref?.();
  console.log('[ledger-worker] Programado (libera saldos y crea lotes de payout 1 vez al día; dispersión manual).');
  return timer;
};

export const stopLedgerWorker = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
