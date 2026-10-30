// Offline cache for the web version. Bump VERSION on every release so phones pick up the new files.
const VERSION = 'bullrush-5.5';
const FILES = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/engine.js', 'js/bots.js', 'js/sound.js', 'js/net.js', 'js/charts.js', 'js/ui.js',
  'vendor/peerjs.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
