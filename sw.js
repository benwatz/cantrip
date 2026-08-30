const CACHE_NAME = 'cantrip-v124';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './characters/calix.jpg', './characters/deneor.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Répond à index.html quand il demande la version du service worker actif (voir
// getControllerSwVersion() / checkServiceWorkerVersion() dans index.html) — sert à détecter un
// service worker resté sur une version plus ancienne que celle réellement déployée.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'SW_VERSION', version: CACHE_NAME });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
