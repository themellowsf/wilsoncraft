// Offline cache for the Wilson games (WilsonCraft and Super Wilson World). Used when the game is opened from the website
// (e.g. added to an iPad Home Screen): after the first visit everything loads without internet.
const VERSION = '20261001030558'; // tools/publish.sh stamps this on every publish so installed copies pick up the update
const CACHE = 'wilsongames-' + VERSION;
const LEGACY = ['wilsoncraft-', 'willsoncraft-', 'franklincraft-'];   // caches from the old cache-first versions
const FILES = ['./', 'index.html', 'craft.html', 'platformer.html', 'app.json', 'manifest.webmanifest', 'lib/three.min.js', 'lib/fflate.min.js', 'data/lidar.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const OPTIONAL = [];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so a new version never mixes in old files
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))
      .then(() => Promise.all(OPTIONAL.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => {
      const legacy = keys.filter((k) => LEGACY.some((p) => k.startsWith(p)));
      const old = keys.filter((k) => k !== CACHE && (k.startsWith('wilsongames-') || legacy.includes(k)));
      return Promise.all(old.map((k) => caches.delete(k))).then(() => legacy.length);
    })
    .then((updated) => self.clients.claim().then(() => {
      // replacing an old cache-first version: reload any open page, which that version served from its stale copy
      if (updated) return self.clients.matchAll({ type: 'window' }).then((cs) => Promise.all(cs.map((c) => c.navigate ? c.navigate(c.url).catch(() => {}) : null)));
    })));
});

// Network first, so a phone that is online always gets the latest version; the saved copy is only used offline
// (or when the network takes too long).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()).catch(() => {}); return res; });
    const late = new Promise((resolve) => setTimeout(resolve, 6000, null));
    try {
      const res = await Promise.race([net, late]);
      if (res) return res;
    } catch (err) { /* offline */ }
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || net;
  })());
});
