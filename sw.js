const CACHE = 'mescomptes-v4';
const FICHIERS = ['./', './index.html', './style.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-512-maskable.png', './apple-touch-icon.png', './favicon-48.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FICHIERS.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((resp) => {
    if (resp.ok && new URL(e.request.url).origin === location.origin) { const copie = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); }
    return resp;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
});
