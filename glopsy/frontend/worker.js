const BACKEND = 'glopsy-back.onrender.com';

const TTL_BY_PATH = {
  '/api/geo/departamentos': 86400,
  '/api/geo/ciudades': 86400,
  '/api/geo/fullments': 300,
  '/api/product/categories': 3600,
  '/api/product/tipos-empaque': 86400,
  '/api/product/': 120,
  '/api/product/search': 120,
};

const DETAIL_TTL = 300;
const REVIEWS_TTL = 120;

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

function cacheablePath(pathname) {
  if (pathname in TTL_BY_PATH) return true;
  if (!pathname.startsWith('/api/product/')) return false;

  const rest = pathname.slice('/api/product/'.length);
  if (rest.endsWith('/reviews')) {
    const id = rest.slice(0, -'/reviews'.length);
    return id.length > 0 && id.length < 40 && !id.includes('/') && !RESERVED.has(id);
  }

  if (!rest.includes('/') && rest.length > 0 && rest.length < 40 && !RESERVED.has(rest)) {
    return true;
  }

  return false;
}

function ttlFor(pathname) {
  if (pathname in TTL_BY_PATH) return TTL_BY_PATH[pathname];
  if (pathname.endsWith('/reviews')) return REVIEWS_TTL;
  return DETAIL_TTL;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const isGet = request.method === 'GET' || request.method === 'HEAD';
      const cacheable = isGet && cacheablePath(url.pathname);

      if (cacheable) {
        const key = new Request(url, { method: 'GET' });
        const cached = await caches.default.match(key);
        if (cached) return cached;
      }

      url.hostname = BACKEND;
      url.protocol = 'https:';

      const backendRequest = new Request(url, request);
      backendRequest.headers.set('X-Forwarded-Host', BACKEND);

      const response = await fetch(backendRequest);

      if (cacheable && response.status === 200 && !response.headers.get('set-cookie')) {
        const ttl = ttlFor(url.pathname);
        const cachedResponse = new Response(response.body, response);
        cachedResponse.headers.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
        const key = new Request(url, { method: 'GET' });
        ctx.waitUntil(caches.default.put(key, cachedResponse.clone()));
        return cachedResponse;
      }

      return response;
    }

    return new Response(null, { status: 404 });
  },
};
