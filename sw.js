// Textus — cache-first service worker. Precaches everything on install; app must work fully offline.
// The cache name is derived from APP_VERSION, so bumping the version in version.js
// invalidates the whole offline cache and the app reloads fresh files.
importScripts('version.js');

const CACHE_NAME = 'textus-v' + APP_VERSION;
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './srs.js',
  './data.js',
  './backup.js',
  './version.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
