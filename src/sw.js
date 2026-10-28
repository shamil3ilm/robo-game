/* Robo Run: the service worker. It keeps the whole game on the device so it opens fast and works with no signal, and it updates itself when a new build is published.
   tools/build.cjs fills in VERSION (a hash of every file) and FILES (everything to keep) when it makes the dist folder; in the source folder both are empty and this only caches what the page asks for.
   An update is picked up on the next visit: the new worker takes over at once, and the page reloads onto the new files the next time it is opened. */
const VERSION = '__BUILD_ID__';
const FILES = [/*__FILES__*/];
const CACHE = 'robo-run-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 'reload' skips the browser's own HTTP cache, so a new build is never filled with old files
    await Promise.all(FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => { /* one missing file must not stop the install; it is fetched when needed */ })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('robo-run-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // only our own files
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });   // the page is opened as index.html?v=...; the query does not change the file
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') { const home = await cache.match('./index.html'); if (home) return home; }
      throw e;
    }
  })());
});
