// Service worker : permet l'installation sur téléphone et l'ouverture rapide de l'application.
// Les données (Supabase) passent toujours par le réseau ; seuls les fichiers de l'application sont mis en cache.
const CACHE = 'crm-v2';
const ASSETS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/store.js', 'js/app.js', 'icons/icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (pour toujours avoir la dernière version), cache en secours hors connexion.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
