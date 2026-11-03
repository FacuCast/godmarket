// Service Worker para GOD MARKET PWA (v18 - Legal & Compliance Suite, Boton de Arrepentimiento Ley 24.240 y Ley 25.326)
const CACHE_NAME = 'godmarket-v18';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Para documentos HTML o navegación, SIEMPRE ir a la red primero para no congelar HTML viejo
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
              cache.put('./index.html', responseToCache.clone());
              cache.put('/', responseToCache.clone());
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match('./index.html').then((r) => r || caches.match('/'))))
    );
    return;
  }

  // Network First para CSS, JS e imágenes
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
