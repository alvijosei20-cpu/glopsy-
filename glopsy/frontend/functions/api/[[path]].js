export async function onRequest({ request }) {
  const url = new URL(request.url);
  url.hostname = 'glopsy-back-production.up.railway.app';
  return fetch(url, request);
}
