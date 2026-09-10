import { pool } from '../db.js';
import { redisClient } from './redis.service.js';

const RESERVE_PREFIX = 'cart:reserve:';
const RESTORE_LEAD_SECONDS = 60;
const RUN_INTERVAL_MS = 60 * 1000;
const LOCK_KEY = 'cleaner:stockreserve:lock';
const LOCK_TTL_SECONDS = 180;

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
    console.warn('[stock-reserve-cleaner] Redis no disponible, ejecuto sin lock:', err.message);
    return true;
  }
};

const releaseLock = async () => {
  try {
    await redisClient.del(LOCK_KEY);
  } catch {}
};

const restoreItemsStock = async (items) => {
  for (const item of items) {
    const productId = Number(item?.id);
    const qty = Number(item?.quantity) || 0;
    if (!productId || qty <= 0) continue;
    await pool.query(`UPDATE produc SET stock_total = stock_total + $1 WHERE id = $2`, [qty, productId]);
  }
};

const cleanupExpiredReservations = async () => {
  let released = 0;
  let cursor = '0';
  do {
    const { cursor: next, keys } = await redisClient.scan(cursor, { MATCH: `${RESERVE_PREFIX}*`, COUNT: 200 });
    cursor = String(next || '0');
    for (const key of keys || []) {
      try {
        const ttl = await redisClient.ttl(key);
        if (ttl === -2) continue;
        if (ttl > RESTORE_LEAD_SECONDS) continue;
        const raw = await redisClient.get(key);
        await redisClient.del(key);
        if (raw) {
          try {
            const items = JSON.parse(raw);
            if (Array.isArray(items) && items.length > 0) {
              await restoreItemsStock(items);
            }
          } catch {}
        }
        released++;
      } catch (err) {
        console.error(`[stock-reserve-cleaner] error en key ${key}:`, err.message);
      }
    }
  } while (cursor !== '0');
  if (released > 0) {
    console.log(`[stock-reserve-cleaner] restauradas ${released} reserva(s) de stock vencidas.`);
  }
};

const runCycle = async () => {
  if (running) return;
  const locked = await acquireLock();
  if (!locked) return;
  running = true;
  try {
    await cleanupExpiredReservations();
  } catch (err) {
    console.error('[stock-reserve-cleaner] error de ciclo:', err.message);
  } finally {
    running = false;
    await releaseLock();
  }
};

export const scheduleStockReserveCleaner = () => {
  if (timer) return timer;
  const run = async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error('[stock-reserve-cleaner] error de ciclo:', err.message);
    }
  };
  setTimeout(run, 30 * 1000);
  timer = setInterval(run, RUN_INTERVAL_MS);
  timer.unref?.();
  console.log('[stock-reserve-cleaner] Programado cada 60s (restaura stock de reservas vencidas).');
  return timer;
};

export const stopStockReserveCleaner = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

export { runCycle as runStockReserveCleanupNow };