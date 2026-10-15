// ==========================================
// Worker de respaldos de BD.
//
// Corre un pg_dump una vez al día (day-guard en Redis) y rota los archivos.
// Si pg_dump no está disponible (p. ej. en contenedores sin cliente Postgres),
// se omite con aviso. Config: BACKUP_DIR, BACKUP_KEEP_DAYS, BACKUP_CHECK_MS.
// ==========================================

import { runDbBackup } from '../scripts/dbBackup.mjs';

const CHECK_INTERVAL_MS = Number(process.env.BACKUP_CHECK_MS || 60 * 60 * 1000);
const LOCK_KEY = 'worker:backup:lock';
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

const dayKey = () => `worker:backup:day:${new Date().toISOString().slice(0, 10)}`;

const acquireLock = async () => {
  const redis = await getRedis();
  if (!redis) return true;
  try {
    return Boolean(await redis.set(LOCK_KEY, String(Date.now()), { NX: true, EX: LOCK_TTL_SECONDS }));
  } catch {
    return true;
  }
};

const releaseLock = async () => {
  const redis = await getRedis();
  if (!redis) return;
  try { await redis.del(LOCK_KEY); } catch {}
};

const runCycle = async () => {
  if (running) return;
  const redis = await getRedis();
  try {
    if (redis && (await redis.get(dayKey()))) return;
  } catch {}
  if (!(await acquireLock())) return;
  running = true;
  try {
    runDbBackup();
    if (redis) {
      try { await redis.set(dayKey(), String(Date.now()), { EX: 172800 }); } catch {}
    }
  } catch (err) {
    // pg_dump ausente u otro fallo: se registra y se reintenta en el próximo ciclo.
    console.error('[backup-worker]', err.message);
  } finally {
    running = false;
    await releaseLock();
  }
};

export const scheduleBackupWorker = () => {
  if (timer) return timer;
  const run = () => runCycle().catch((e) => console.error('[backup-worker]', e.message));
  setTimeout(run, 3 * 60 * 1000);
  timer = setInterval(run, CHECK_INTERVAL_MS);
  timer.unref?.();
  console.log('[backup-worker] Programado (pg_dump 1 vez al día).');
  return timer;
};

export const stopBackupWorker = () => {
  if (timer) { clearInterval(timer); timer = null; }
};
