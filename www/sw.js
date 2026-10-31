// Offline support for the web version. Bump VERSION on every release.
// Network first: phones always get the newest files when online, and the cached copy only when offline.
const VERSION = 'bullrush-6.7';
const FILES = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/engine.js', 'js/bots.js', 'js/sound.js', 'js/net.js', 'js/charts.js', 'js/ui.js',
  'vendor/peerjs.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/frontpage-studios.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html')))
  );
});
