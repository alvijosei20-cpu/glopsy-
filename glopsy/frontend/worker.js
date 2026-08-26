const BACKEND = 'glopsy-back.onrender.com';

const PANIC_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>glopsy · En mantenimiento</title>
<style>
  :root{--bg:#1a1a1a;--surface:#000000;--text:#ffffff;--muted:#64748b;--accent:#db2777;--danger:#9d174d}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .box{background:var(--surface);border:1px solid #27272a;border-radius:12px;padding:32px;max-width:420px;width:100%;text-align:center;box-shadow:0 6px 14px rgba(190,24,93,.16)}
  .shield{width:56px;height:56px;margin:0 auto 16px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#db2777,#7e22ce);font-size:28px;color:#fff}
  h1{font-size:20px;font-weight:700;margin-bottom:8px}
  p{color:var(--muted);font-size:14px;line-height:1.5}
  .bar{height:4px;width:64px;margin:16px auto;border-radius:999px;background:var(--danger)}
</style>
</head>
<body>
  <div class="box">
    <div class="shield">🛡️</div>
    <h1>Servicio congelado por seguridad</h1>
    <p>La web está temporalmente bloqueada por un protocolo de protección. Volverá a estar disponible en cuanto se desactive.</p>
    <div class="bar"></div>
    <p style="font-size:12px">glopsy · protección anti-ataques</p>
  </div>
</body>
</html>`;

// ---------- Kill switch / botón de pánico (edge) ----------
async function getPanic(env) {
  try {
    const raw = await env.CACHE_VERSIONS.get('panic');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function checkPanicSecret(request, env) {
  const secret = request.headers.get('x-panic-secret');
  return Boolean(secret && env.PANIC_SECRET && secret === env.PANIC_SECRET);
}

const ACAO = { 'Access-Control-Allow-Origin': '*' };

async function handlePanicOn(request, env) {
  if (!checkPanicSecret(request, env)) {
    return Response.json({ ok: false, message: 'No autorizado' }, { status: 401, headers: ACAO });
  }
  const body = await request.json().catch(() => ({}));
  const reason = String(body?.reason || '').trim().slice(0, 500);
  await env.CACHE_VERSIONS.put('panic', JSON.stringify({
    active: true,
    ts: new Date().toISOString(),
    reason,
  }));
  return Response.json({ ok: true, message: 'Web congelada' }, { headers: ACAO });
}

async function handlePanicOff(request, env) {
  if (!checkPanicSecret(request, env)) {
    return Response.json({ ok: false, message: 'No autorizado' }, { status: 401, headers: ACAO });
  }
  await env.CACHE_VERSIONS.delete('panic');
  return Response.json({ ok: true, message: 'Web reactivada' }, { headers: ACAO });
}

async function handlePanicStatus(env) {
  const panic = await getPanic(env);
  return Response.json({ ok: true, panic }, { headers: ACAO });
}

// Devuelve una respuesta de bloqueo si el kill switch está activo (null si no)
async function panicGuard(url, env) {
  const panic = await getPanic(env);
  if (!panic || !panic.active) return null;
  // Siempre permitir desarmar / consultar el estado del pánico
  if (url.pathname.startsWith('/api/_panic')) return null;
  const isApi = url.pathname.startsWith('/api/');
  if (isApi) {
    return new Response(
      JSON.stringify({ ok: false, code: 'SITE_FROZEN', message: 'Servicio congelado por seguridad', panic }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...ACAO },
      }
    );
  }
  return new Response(PANIC_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}


const TTL_BY_PATH = {
  '/api/geo/departamentos': 86400,
  '/api/geo/ciudades': 86400,
  '/api/geo/fullments': 300,
  '/api/product/tipos-empaque': 86400,
};

const DETAIL_TTL = 300;
const REVIEWS_TTL = 120;
const CATALOG_TTL = 120;
const CATEGORIES_TTL = 3600;

const VERSIONED = new Set([
  '/api/product/',
  '/api/product/search',
  '/api/product/categories',
]);

const RESERVED = new Set([
  'mine',
  'manage',
  'favorites',
  'favorite-products',
  'compras',
  'categories',
  'search',
  'tipos-empaque',
]);

function pathKind(pathname) {
  if (pathname in TTL_BY_PATH) return { cache: true, versioned: false, ttl: TTL_BY_PATH[pathname] };
  if (pathname === '/api/product/') return { cache: true, versioned: true, ttl: CATALOG_TTL };
  if (pathname === '/api/product/search') return { cache: true, versioned: true, ttl: CATALOG_TTL };
  if (pathname === '/api/product/categories') return { cache: true, versioned: true, ttl: CATEGORIES_TTL };

  if (!pathname.startsWith('/api/product/')) return { cache: false };

  const rest = pathname.slice('/api/product/'.length);
  if (rest.endsWith('/reviews')) {
    const id = rest.slice(0, -'/reviews'.length);
    if (id.length > 0 && id.length < 40 && !id.includes('/') && !RESERVED.has(id)) {
      return { cache: true, versioned: true, ttl: REVIEWS_TTL };
    }
    return { cache: false };
  }

  if (!rest.includes('/') && rest.length > 0 && rest.length < 40 && !RESERVED.has(rest)) {
    return { cache: true, versioned: true, ttl: DETAIL_TTL };
  }

  return { cache: false };
}

async function handleInvalidate(request, env, ctx) {
  const secret = request.headers.get('x-invalidate-secret');
  if (!env.INVALIDATE_SECRET || secret !== env.INVALIDATE_SECRET) {
    return Response.json({ ok: false, message: 'No autorizado' }, { status: 401 });
  }
  const current = Number((await env.CACHE_VERSIONS.get('v').catch(() => null)) || '0');
  const next = current + 1;
  ctx.waitUntil(env.CACHE_VERSIONS.put('v', String(next)));
  return Response.json({ ok: true, version: next });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Preflight CORS para los endpoints del worker (pánico / invalidar caché)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-panic-secret, x-invalidate-secret, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Kill switch: si el pánico está activo, se bloquea todo (excepto /api/_panic)
    const blocked = await panicGuard(url, env);
    if (blocked) return blocked;

    if (url.pathname === '/api/_panic/on' && request.method === 'POST') {
      return handlePanicOn(request, env);
    }
    if (url.pathname === '/api/_panic/off' && request.method === 'POST') {
      return handlePanicOff(request, env);
    }
    if (url.pathname === '/api/_panic/status') {
      return handlePanicStatus(env);
    }

    if (url.pathname === '/api/_cache/invalidate' && request.method === 'POST') {
      return handleInvalidate(request, env, ctx);
    }

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const isGet = request.method === 'GET' || request.method === 'HEAD';
    const kind = pathKind(url.pathname);
    const cacheable = isGet && kind.cache;

    if (cacheable) {
      const keyUrl = new URL(url);
      if (kind.versioned) {
        keyUrl.searchParams.set('__cv', (await env.CACHE_VERSIONS.get('v').catch(() => null)) || '0');
      }
      const key = new Request(keyUrl, { method: 'GET' });
      const cached = await caches.default.match(key);
      if (cached) return cached;
    }

    url.hostname = BACKEND;
    url.protocol = 'https:';

    const backendRequest = new Request(url, request);
    backendRequest.headers.set('X-Forwarded-Host', BACKEND);

    const response = await fetch(backendRequest);

    if (cacheable && response.status === 200 && !response.headers.get('set-cookie')) {
      const keyUrl = new URL(url);
      if (kind.versioned) {
        keyUrl.searchParams.set('__cv', (await env.CACHE_VERSIONS.get('v').catch(() => null)) || '0');
      }
      const cachedResponse = new Response(response.body, response);
      cachedResponse.headers.set('Cache-Control', `public, max-age=${kind.ttl}, stale-while-revalidate=${kind.ttl * 2}`);
      const key = new Request(keyUrl, { method: 'GET' });
      ctx.waitUntil(caches.default.put(key, cachedResponse.clone()));
      return cachedResponse;
    }

    return response;
  },
};

// nota: re-disparo para probar el deploy tras crear los secretos
