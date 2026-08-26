import { Router } from 'express';
import { query, pool } from '../db.js';
import { redisClient } from '../services/redis.service.js';

const router = Router();

router.get('/', async (_req, res) => {
  const ts = new Date().toISOString();

  let db = 'down';
  let redis = 'down';

  try {
    await query('SELECT 1');
    db = 'up';
  } catch (err) {
    db = err.code || 'down';
  }

  try {
    await redisClient.ping();
    redis = 'up';
  } catch (err) {
    redis = err.code || 'down';
  }

  res.json({
    ok: db === 'up' && redis === 'up',
    db,
    redis,
    uptime: Math.round(process.uptime()),
    ts,
  });
});

// Pool de conexiones PostgreSQL en tiempo real
router.get('/pool', async (_req, res) => {
  const ts = new Date().toISOString();
  const poolStats = {
    total: pool.totalCount ?? 0,
    idle: pool.idleCount ?? 0,
    waiting: pool.waitingCount ?? 0,
    active: Math.max(0, (pool.totalCount ?? 0) - (pool.idleCount ?? 0)),
    max: pool.options?.max ?? 10,
  };
  poolStats.usagePct = poolStats.max > 0 ? Math.round((poolStats.total / poolStats.max) * 100) : 0;

  let pg = null;
  try {
    const r = await query(`
      SELECT
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
        count(*) FILTER (WHERE state = 'active') AS active,
        count(*) FILTER (WHERE state = 'idle') AS idle,
        count(*) AS total
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    const row = r.rows[0] || { max_conn: 100, active: 0, idle: 0, total: 0 };
    const maxConn = Number(row.max_conn) || 100;
    pg = {
      max: maxConn,
      active: Number(row.active) || 0,
      idle: Number(row.idle) || 0,
      total: Number(row.total) || 0,
      usagePct: maxConn > 0 ? Math.round((Number(row.total) / maxConn) * 100) : 0,
    };
  } catch (err) {
    pg = { error: err.code || 'down', max: 0, active: 0, idle: 0, total: 0, usagePct: 0 };
  }

  res.json({ ok: true, ts, pool: poolStats, pg });
});

export default router;
