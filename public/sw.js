const CACHE_NAME = 'diamante-os-shell-v3';
const PREVIOUS_APP_CACHES = ['diamante-os-shell-v0', 'diamante-os-shell-v1', 'diamante-os-shell-v2'];
const APP_SHELL = ['/index.html', '/manifest.webmanifest', '/icons/diamante-mark.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all(PREVIOUS_APP_CACHES.map((name) => caches.delete(name)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.headers.has('authorization')) return;

  // Private, dynamic and realtime endpoints are network-only.
  if (
    url.pathname === '/api' || url.pathname.startsWith('/api/') ||
    url.pathname === '/auth' || url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/') ||
    url.pathname === '/health' || url.pathname.startsWith('/socket.io/') ||
    url.pathname.startsWith('/.well-known/')
  ) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const type = response.headers.get('content-type') || '';
        if (response.ok && type.includes('text/html')) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)));
        }
        return response;
      }).catch(async () => (await caches.match('/index.html')) || Response.error())
    );
    return;
  }

  // Fingerprinted Vite assets only; never cache arbitrary same-origin responses.
  if (/^\/assets\/[A-Za-z0-9._-]+\.(?:js|css|woff2?|ttf|otf|svg|png|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const policy = response.headers.get('Cache-Control') || '';
        if (response.ok && response.type === 'basic' && !/private|no-store/i.test(policy)) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      }))
    );
  }
});
