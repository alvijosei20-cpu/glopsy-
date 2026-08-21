export async function onRequest({ request }) {
  const url = new URL(request.url);
  url.hostname = 'glopsy-back.onrender.com';
  return fetch(url, request);
}
