// ==========================================
// Worker de saldo ENVIA.
//
// Revisa cada 5 min los pedidos con envíos en espera por falta de saldo
// (order_shipments.fulfillment_status = 'pending_balance') y, cuando la cuenta
// ENVIA ya tiene saldo, genera sus guías (dispatchDomesticOrder).
// ==========================================

import { pool } from '../db.js';
import { dispatchDomesticOrder } from './domesticShipping.service.js';

const RUN_INTERVAL_MS = Number(process.env.ENVIA_BALANCE_WORKER_INTERVAL_MS || 5 * 60 * 1000);
const LOCK_KEY = 'worker:enviabalance:lock';
const LOCK_TTL_SECONDS = 240;
const BATCH_LIMIT = 20;

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

const processPending = async () => {
  const { rows } = await pool.query(
    `SELECT DISTINCT o.id
     FROM orders o
     JOIN order_shipments s ON s.order_id = o.id
     WHERE s.fulfillment_status = 'pending_balance'
       AND o.status IN ('Completado', 'approved', 'paid', 'authorized')
     ORDER BY o.id
     LIMIT $1`,
    [BATCH_LIMIT]
  );
  let done = 0;
  for (const r of rows) {
    const res = await dispatchDomesticOrder(r.id).catch((e) => ({ ok: false, error: e.message }));
    if (res?.ok) done++;
  }
  return { evaluated: rows.length, dispatched: done };
};

const runCycle = async () => {
  if (running) return;
  const locked = await acquireLock();
  if (!locked) return;
  running = true;
  try {
    const { evaluated, dispatched } = await processPending();
    if (dispatched > 0) {
      console.log(`[envia-balance-worker] ${dispatched}/${evaluated} pedido(s) despachados tras detectar saldo.`);
    }
  } catch (err) {
    console.error('[envia-balance-worker] error de ciclo:', err.message);
  } finally {
    running = false;
    await releaseLock();
  }
};

export const scheduleEnviaBalanceWorker = () => {
  if (timer) return timer;
  const run = async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error('[envia-balance-worker] error de ciclo:', err.message);
    }
  };
  setTimeout(run, 60 * 1000);
  timer = setInterval(run, RUN_INTERVAL_MS);
  timer.unref?.();
  console.log(`[envia-balance-worker] Programado cada ${Math.round(RUN_INTERVAL_MS / 1000)}s (procesa envíos en espera de saldo ENVIA).`);
  return timer;
};

export const stopEnviaBalanceWorker = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

export { runCycle as runEnviaBalanceNow };
