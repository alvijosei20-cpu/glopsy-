// Worker dedicado a servir las imágenes de producto desde el bucket R2
// (glopsy-products) en el subdominio img.glopsy.shop.
//
// Se despliega con su propia ruta "img.glopsy.shop/*", que es más específica
// que el wildcard del Worker principal "*.glopsy.shop/*" y por eso tiene
// prioridad sin afectar los subdominios de las tiendas.
export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!key || key.includes('..')) {
      return new Response('Not found', { status: 404 });
    }

    const object = await env.PRODUCT_IMAGES.get(key);
    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  },
};
