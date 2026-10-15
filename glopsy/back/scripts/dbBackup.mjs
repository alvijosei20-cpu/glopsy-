// Respaldos de la base de datos con pg_dump (formato custom, restaurable con
// pg_restore). Guarda en BACKUP_DIR (default ./backups) y rota conservando
// los últimos BACKUP_KEEP_DAYS (default 7).
//
// Uso manual:  node scripts/dbBackup.mjs

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const runDbBackup = () => {
  const dir = process.env.BACKUP_DIR || path.resolve(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(dir, `glopsy_${stamp}.dump`);

  const env = { ...process.env };
  const args = ['--format=custom', '--no-owner', '--no-privileges', '-f', file];
  if (process.env.DATABASE_URL) {
    args.push(process.env.DATABASE_URL);
  } else {
    if (process.env.DB_PASSWORD) env.PGPASSWORD = process.env.DB_PASSWORD;
    args.push(
      '-h', process.env.DB_HOST || 'localhost',
      '-p', String(process.env.DB_PORT || 5432),
      '-U', process.env.DB_USER || 'postgres',
      process.env.DB_NAME || 'glopsy'
    );
  }

  const res = spawnSync('pg_dump', args, { env, encoding: 'utf-8' });
  if (res.error || res.status !== 0) {
    try { fs.unlinkSync(file); } catch {}
    throw new Error(res.error?.message || res.stderr || `pg_dump salió con código ${res.status}`);
  }

  const size = fs.statSync(file).size;
  console.log(`[backup] OK ${file} (${(size / 1048576).toFixed(2)} MB)`);

  // Rotación: conserva los últimos N respaldos.
  const keep = Number(process.env.BACKUP_KEEP_DAYS || 7);
  const files = fs.readdirSync(dir).filter((f) => /^glopsy_.*\.dump$/.test(f)).sort();
  const toDelete = files.slice(0, Math.max(0, files.length - keep));
  for (const f of toDelete) {
    try { fs.unlinkSync(path.join(dir, f)); console.log(`[backup] eliminado antiguo ${f}`); } catch {}
  }

  return { file, size };
};

// Ejecución directa
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runDbBackup();
    process.exit(0);
  } catch (err) {
    console.error('[backup] Error:', err.message);
    process.exit(1);
  }
}

export default { runDbBackup };
