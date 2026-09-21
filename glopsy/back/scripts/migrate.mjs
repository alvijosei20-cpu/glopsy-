import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createPool } from '../utils/db-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

// 00_base_schema.sql es un snapshot (pg_dump). Solo las migraciones con fecha
// igual o anterior a esta ya están incluidas en él; las posteriores deben
// ejecutarse. Si se regenera el snapshot, actualizar esta fecha.
const BASE_SNAPSHOT_THROUGH = '20260821';

const pool = createPool();

const client = await pool.connect();

try {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const { rows: appliedRows } = await client.query('SELECT name FROM public.schema_migrations');
  let applied = new Set(appliedRows.map((r) => r.name));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs
      .readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('\\'))
      .join('\n');
    const isBase = file === '00_base_schema.sql';

    try {
      await client.query('BEGIN');
      await client.query(sql);
      if (isBase) {
        // El dump restablece el search_path; lo devolvemos a public para
        // que las migraciones posteriores (nombres sin calificar) funcionen.
        await client.query("SELECT pg_catalog.set_config('search_path', 'public', false)");
      }
      await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [file]);
      if (isBase) {
        // Marcar solo las migraciones ya incluidas en el snapshot base.
        // Las posteriores (fecha > BASE_SNAPSHOT_THROUGH) quedan pendientes
        // para ejecutarse en el bucle normal.
        for (const f of files) {
          if (f !== file && f <= BASE_SNAPSHOT_THROUGH) {
            await client.query(
              'INSERT INTO public.schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
              [f]
            );
          }
        }
      }
      await client.query('COMMIT');
      console.log(`✔ migración aplicada: ${file}`);
      count++;
      if (isBase) {
        const { rows } = await client.query('SELECT name FROM public.schema_migrations');
        applied = new Set(rows.map((r) => r.name));
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migración fallida (${file}): ${err.message}`);
    }
  }

  console.log(count > 0 ? `✅ ${count} migraciones aplicadas.` : '✅ Sin migraciones pendientes.');
} finally {
  client.release();
  await pool.end();
}
