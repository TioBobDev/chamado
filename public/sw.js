const CACHE_NAME = 'lumen-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Não intercepta chamadas de API ou de autenticação
  if (url.pathname.includes('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('Sem conexão com a internet', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    })
  );
});

// ==========================================
// Web Push Notifications & Background Sync
// ==========================================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Lumen Chamados',
        message: event.data.text(),
      };
    }
  }

  const title = data.title || 'Lumen Chamados';
  const basePath = '/chamado';
  let targetUrl = data.url || '/dashboard';
  if (!targetUrl.startsWith('http') && !targetUrl.startsWith(basePath)) {
    targetUrl = basePath + (targetUrl.startsWith('/') ? targetUrl : '/' + targetUrl);
  }

  const options = {
    body: data.message || 'Você recebeu uma nova atualização no chamado.',
    icon: basePath + '/icons/icon-192x192.png',
    badge: basePath + '/icons/icon-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || ('lumen-' + Date.now()),
    renotify: true,
    data: {
      url: targetUrl,
    },
    actions: [
      { action: 'open', title: 'Abrir Chamado' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/chamado/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/chamado') && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

