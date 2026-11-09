// Macht Guitarhero offline nutzbar. Wird von tools/build-sw.mjs erzeugt.
const VERSION = '__VERSION__';
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(request);
    } catch (err) {
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw err;
    }
  })());
});
