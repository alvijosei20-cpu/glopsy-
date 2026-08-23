self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Glopsy', body: 'Nueva notificación' };
  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: data,
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '';
  const scheme = data.scheme || '';
  const fallbackUrl = data.fallbackUrl || '/';
  const isWeb = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      if (isWeb) {
        for (const client of clientsList) {
          if (client.url === url) {
            await client.focus();
            return;
          }
        }
        return self.clients.openWindow(url);
      }

      if (scheme) {
        try {
          await self.clients.openWindow(scheme);
          return;
        } catch (e) {}
        return self.clients.openWindow(fallbackUrl);
      }

      if (clientsList.length) {
        await clientsList[0].focus();
        return;
      }
      return self.clients.openWindow('/');
    })()
  );
});
