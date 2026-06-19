/* Brújula — service worker
   - App-shell cacheado para arranque instantáneo y tolerancia a señal intermitente.
   - El HTML va "red primero" para que las actualizaciones aparezcan al toque si hay internet.
   - Los precios (twelvedata) y eventos (stlouisfed) NUNCA se cachean: siempre datos frescos. */
const CACHE = 'brujula-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'icon-180.png',
  'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // allSettled: si un archivo falla, los demás igual se cachean (no rompe la instalación)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Datos en vivo: siempre red, nunca caché (no servir precios viejos).
  if (/(^|\.)api\.twelvedata\.com$/.test(url.hostname) || /(^|\.)stlouisfed\.org$/.test(url.hostname)) return;

  // HTML: red primero (para ver actualizaciones), con respaldo a caché sin señal.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
    );
    return;
  }

  // Resto del shell (íconos, librería del gráfico): caché primero, rápido y ahorra datos.
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200 && (url.origin === self.location.origin || url.hostname === 'unpkg.com')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
