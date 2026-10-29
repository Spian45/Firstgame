// Offline support for the installed app: every file the game loads is cached the first time it is
// fetched. Later visits are served from the cache straight away (so the game works without internet)
// while a fresh copy is fetched in the background, so updates arrive on the next launch.
// Bump CACHE when the caching rules change; old caches are cleared on activate.
const CACHE = 'united-realm-v1';

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html', 'manifest.webmanifest'])));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    e.respondWith(caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req, { ignoreSearch: true });
        const fresh = fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
        }).catch(() => cached);
        return cached || fresh;
    }));
});
