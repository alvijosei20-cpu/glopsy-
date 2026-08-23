const BACKEND = 'glopsy-back.onrender.com';

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

    if (!url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 404 });
    }

    if (url.pathname === '/api/_cache/invalidate' && request.method === 'POST') {
      return handleInvalidate(request, env, ctx);
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
