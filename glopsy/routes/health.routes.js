import { Router } from 'express';
import { query } from '../db.js';
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

export default router;
