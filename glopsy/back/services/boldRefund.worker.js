// ==========================================
// Worker de conciliación de reversiones de Bold.
//
// Los reembolsos de la API de Pagos en Línea de Bold son asíncronos (quedan en
// PROCESSING y no emiten webhook). Este worker los consulta periódicamente y,
// cuando Bold los aprueba (APPROVED) o rechaza (REJECTED), asienta el resultado
// en el ledger y actualiza la orden (ver settleBoldReversal).
//
// Las anulaciones (void) sí notifican por webhook (VOID_APPROVED); el worker las
// cubre como respaldo por si el webhook no llega.
// ==========================================

import { pool } from '../db.js';
import { getRefundStatus, getPaymentStatus } from './boldApi.service.js';
import { settleBoldReversal } from './boldReversal.service.js';

const RUN_INTERVAL_MS = Number(process.env.BOLD_REFUND_WORKER_INTERVAL_MS || 5 * 60 * 1000);
const LOCK_KEY = 'worker:boldrefund:lock';
const LOCK_TTL_SECONDS = 240;
const BATCH_LIMIT = 50;

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

const conciliateRefunds = async () => {
  const { rows } = await pool.query(
    `SELECT id, order_number, payload->'bold_reversal' AS reversal
     FROM orders
     WHERE payload->'bold_reversal'->>'action' = 'refund'
       AND payload->'bold_reversal'->>'ok' = 'true'
       AND COALESCE(payload->'bold_reversal'->>'settled', 'false') <> 'true'
     ORDER BY updated_at ASC
     LIMIT $1`,
    [BATCH_LIMIT]
  );

  let settled = 0;
  for (const row of rows) {
    const txId = row.reversal?.transaction_id;
    if (!txId) continue;
    const res = await getRefundStatus(txId);
    const st = String(res.data?.status || '').toUpperCase();
    if (!res.ok || (st !== 'APPROVED' && st !== 'REJECTED')) continue;
    const out = await settleBoldReversal(row.id, { status: st, transactionId: txId, source: 'refund' });
    if (out.ok) settled++;
  }
  return settled;
};

const conciliateVoids = async () => {
  const { rows } = await pool.query(
    `SELECT id, order_number, payload->'bold_reversal' AS reversal
     FROM orders
     WHERE payload->'bold_reversal'->>'action' = 'void'
       AND payload->'bold_reversal'->>'ok' = 'true'
       AND COALESCE(payload->'bold_reversal'->>'settled', 'false') <> 'true'
     ORDER BY updated_at ASC
     LIMIT $1`,
    [BATCH_LIMIT]
  );

  let settled = 0;
  for (const row of rows) {
    const referenceId = row.reversal?.reference_id || row.order_number || null;
    if (!referenceId) continue;
    const res = await getPaymentStatus(referenceId);
    const st = String(res.data?.status || '').toUpperCase();
    if (!res.ok || !st) continue;
    if (!/VOID|CANCEL/.test(st)) continue; // aún no anulado en Bold
    const out = await settleBoldReversal(row.id, { status: 'APPROVED', transactionId: res.data?.transaction_id || row.reversal?.transaction_id || null, source: 'void' });
    if (out.ok) settled++;
  }
  return settled;
};

const runCycle = async () => {
  if (running) return;
  const locked = await acquireLock();
  if (!locked) return;
  running = true;
  try {
    const refunds = await conciliateRefunds();
    const voids = await conciliateVoids();
    if (refunds + voids > 0) {
      console.log(`[bold-refund-worker] conciliadas ${refunds} reversión(es) por reembolso y ${voids} por anulación.`);
    }
  } catch (err) {
    console.error('[bold-refund-worker] error de ciclo:', err.message);
  } finally {
    running = false;
    await releaseLock();
  }
};

export const scheduleBoldRefundWorker = () => {
  if (timer) return timer;
  const run = async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error('[bold-refund-worker] error de ciclo:', err.message);
    }
  };
  setTimeout(run, 45 * 1000);
  timer = setInterval(run, RUN_INTERVAL_MS);
  timer.unref?.();
  console.log(`[bold-refund-worker] Programado cada ${Math.round(RUN_INTERVAL_MS / 1000)}s (concilia reversiones de Bold).`);
  return timer;
};

export const stopBoldRefundWorker = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

export { runCycle as runBoldRefundConciliationNow };
