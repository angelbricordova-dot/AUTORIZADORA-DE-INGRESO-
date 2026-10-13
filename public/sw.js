// Tu Día en Tucacas · avisos al teléfono.
// Solo muestra las notificaciones y abre la app al tocarlas; no guarda nada en caché.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { body: event.data ? event.data.text() : '' };
  }
  const url = typeof aviso.url === 'string' && aviso.url.startsWith('/') ? aviso.url : '/trabajo';
  event.waitUntil(
    self.registration.showNotification(aviso.title || 'Tu Día en Tucacas', {
      body: aviso.body || '',
      tag: aviso.tag || undefined,
      renotify: !!aviso.tag,
      icon: '/icon-trabajo-192.png',
      badge: '/icon-trabajo-192.png',
      lang: 'es',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/trabajo', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(url) && 'focus' in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
