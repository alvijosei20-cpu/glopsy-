import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { hash } from 'blake3-wasm';

const ACCOUNT = process.env.CF_ACCOUNT || '3af6812351ebe74ebdd62bbbebdffe00';
const SCRIPT = 'glopsy';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DIST = process.env.DIST || path.resolve(process.cwd(), 'dist');
const ENTRY = process.env.ENTRY || path.resolve(process.cwd(), 'worker.js');
const CDN = 'https://api.cloudflare.com/client/v4';

if (!TOKEN) {
  console.error('Falta CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

const api = async (url, opts = {}, auth = `Bearer ${TOKEN}`) => {
  const res = await fetch(CDN + url, {
    ...opts,
    headers: { authorization: auth, ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    console.error('API error', res.status, url, body && body.errors ? JSON.stringify(body.errors) : text.slice(0, 1200));
    throw new Error(`API ${res.status} en ${url}`);
  }
  return body && body.result !== undefined ? body.result : body;
};

const hashFile = (filepath) => {
  const contents = fs.readFileSync(filepath);
  const base64Contents = contents.toString('base64');
  const extension = path.extname(filepath).substring(1);
  return hash(base64Contents + extension).toString('hex').slice(0, 32);
};

const contentTypeFor = (absPath) => {
  const ext = path.extname(absPath).toLowerCase().replace('.', '');
  const map = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', cjs: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8', json: 'application/json', map: 'application/json',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif', bmp: 'image/bmp',
    txt: 'text/plain; charset=utf-8', xml: 'application/xml', wasm: 'application/wasm',
    webmanifest: 'application/manifest+json', woff: 'font/woff', woff2: 'font/woff2',
    ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject', mp4: 'video/mp4',
    pdf: 'application/pdf', webm: 'video/webm', mp3: 'audio/mpeg',
  };
  return map[ext] || null;
};

const walk = (dir, base = dir) => {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full, base));
    else if (st.isFile() && !st.isSymbolicLink()) out.push(path.relative(base, full));
  }
  return out;
};

const SKIP = new Set(['_headers', '_redirects', '.assetsignore']);

const buildManifest = (dir) => {
  const manifest = {};
  for (const rel of walk(dir)) {
    if (SKIP.has(rel)) continue;
    const abs = path.join(dir, rel);
    const st = fs.statSync(abs);
    manifest['/' + rel.split(path.sep).join('/')] = { hash: hashFile(abs), size: st.size };
  }
  return manifest;
};

// 1) Manifest y sesión de upload
const manifest = buildManifest(DIST);
console.log(`Manifesto: ${Object.keys(manifest).length} archivos en ${DIST}`);
const initRes = await api(`/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/assets-upload-session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ manifest }),
});
const sessionJwt = initRes.jwt;
const buckets = Array.isArray(initRes.buckets) ? initRes.buckets : [];
const filesToUpload = buckets.flat();
console.log(`Sesión OK. JWT presente: ${Boolean(sessionJwt)}, archivos a subir: ${filesToUpload.length}`);

let completionJwt = sessionJwt;

if (filesToUpload.length > 0) {
  const lookup = new Map(Object.entries(manifest).map(([k, v]) => [v.hash, k]));
  let uploaded = 0;
  for (const [bi, bucket] of buckets.entries()) {
    const form = new FormData();
    for (const fileHash of bucket) {
      const relPath = lookup.get(fileHash);
      if (!relPath) throw new Error(`Archivo no encontrado para hash ${fileHash}`);
      const abs = path.join(DIST, relPath.replace(/^\//, ''));
      const ctype = contentTypeFor(abs);
      form.append(fileHash, new File([fs.readFileSync(abs).toString('base64')], fileHash, { type: ctype || 'application/null' }));
    }
    const res = await api(`/accounts/${ACCOUNT}/workers/assets/upload?base64=true`, {
      method: 'POST',
      body: form,
    }, `Bearer ${sessionJwt}`);
    uploaded += bucket.length;
    completionJwt = res.jwt || completionJwt;
    console.log(`Subido bucket ${bi + 1}/${buckets.length} (${uploaded}/${filesToUpload.length})`);
  }
}

if (!completionJwt) throw new Error('No completion jwt');

// 2) Crear versión
const entrySource = fs.readFileSync(ENTRY, 'utf8');
const headersRaw = fs.existsSync(path.join(DIST, '_headers')) ? fs.readFileSync(path.join(DIST, '_headers'), 'utf8') : undefined;

const assetConfig = {
  html_handling: undefined,
  not_found_handling: 'single-page-application',
  run_worker_first: true,
  _redirects: undefined,
  _headers: headersRaw,
};

const metadata = {
  main_module: 'worker.js',
  bindings: [
    { name: 'ASSETS', type: 'assets' },
    { name: 'CACHE_VERSIONS', type: 'kv_namespace', namespace_id: 'a7c4f45652c44bb3a5b6b8c3b016f2dc' },
  ],
  compatibility_date: '2026-08-22',
  compatibility_flags: [],
  assets: { jwt: completionJwt, config: assetConfig },
};

const form = new FormData();
form.set('metadata', JSON.stringify(metadata));
form.set('worker.js', new File([entrySource], 'worker.js', { type: 'application/javascript+module' }));

console.log('Creando versión…');
const versionRes = await api(`/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/versions?bindings_inherit=strict`, {
  method: 'POST',
  body: form,
});
const versionId = versionRes.id;
console.log('Versión creada:', versionId);

// 3) Desplegar al 100%
const depRes = await api(`/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/deployments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ strategy: 'percentage', versions: [{ version_id: versionId, percentage: 100 }] }),
});
const deployments = Array.isArray(depRes) ? depRes : depRes.deployments || [];
console.log('Deployment:', deployments.length ? deployments[0].id : 'ok');
console.log('Deploy completado ✅');