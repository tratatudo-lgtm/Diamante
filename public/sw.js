const CACHE_NAME = 'diamante-os-shell-v2';
const PREVIOUS_APP_CACHES = ['diamante-os-shell-v0', 'diamante-os-shell-v1'];
const APP_SHELL = ['/index.html', '/manifest.webmanifest', '/icons/diamante-mark.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all(PREVIOUS_APP_CACHES.map((name) => caches.delete(name)))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache API/authentication, health checks, or realtime connections.
  if (
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/health' ||
    url.pathname.startsWith('/socket.io/')
  ) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Cache only versioned build assets. Do not cache arbitrary same-origin files.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const cacheControl = response.headers.get('Cache-Control') || '';
          const isPublicStaticAsset =
            response.ok &&
            response.type === 'basic' &&
            !/private|no-store/i.test(cacheControl);

          if (isPublicStaticAsset) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
          }
          return response;
        });
      }),
    );
  }
});
