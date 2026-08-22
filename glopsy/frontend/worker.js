export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      url.hostname = 'glopsy-back.onrender.com';
      url.protocol = 'https:';
      return fetch(url, request);
    }
    return new Response(null, { status: 404 });
  },
};
