// Smoke test end-to-end (sin navegador): verifica que el backend responde y
// que la BD está accesible. Útil en CI / post-deploy.
//
// Uso:  BASE_URL=https://tu-host node scripts/smoke.mjs

import 'dotenv/config';
import { pool } from '../db.js';

const BASE = (process.env.SMOKE_BASE_URL || process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/$/, '');

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log(`  FAIL  ${name} — ${e.message}`);
  }
};

const get = async (path) => {
  const res = await fetch(BASE + path, { headers: { Accept: 'application/json' } });
  return { status: res.status };
};

const main = async () => {
  console.log(`Smoke test contra ${BASE}`);
  await check('GET /api/health', async () => {
    const { status } = await get('/api/health');
    if (status !== 200) throw new Error(`HTTP ${status}`);
    return '200';
  });
  await check('GET /api/banners', async () => {
    const { status } = await get('/api/banners');
    if (status >= 500) throw new Error(`HTTP ${status}`);
    return String(status);
  });
  await check('GET /api/notifications', async () => {
    const { status } = await get('/api/notifications');
    if (status >= 500) throw new Error(`HTTP ${status}`);
    return String(status);
  });
  await check('404 en ruta API inexistente', async () => {
    const { status } = await get('/api/__nope__');
    if (status !== 404) throw new Error(`HTTP ${status} (se esperaba 404)`);
    return '404';
  });
  await check('BD: SELECT 1', async () => {
    const { rows } = await pool.query('SELECT 1 AS ok');
    if (!rows?.[0]) throw new Error('sin fila');
    return 'ok';
  });

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} OK`);
  await pool.end().catch(() => {});
  process.exit(failed > 0 ? 1 : 0);
};

main().catch((e) => {
  console.error('Smoke error:', e.message);
  process.exit(1);
});
