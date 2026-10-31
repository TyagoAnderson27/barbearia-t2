const CACHE = 't2-barbershop-v2';
const ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './dados.js',
  './script.js',
  './firebase-config.js',
  './manifest.json',
  './image/logo.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      // adiciona um por um: se um arquivo falhar, os outros continuam
      Promise.all(ARQUIVOS.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Só mexe em GET do próprio site. Firebase, fontes e o painel admin passam direto.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('admin.html') || url.pathname.endsWith('admin.js')) {
    return;
  }

  // Internet primeiro; sem conexão, usa o que está guardado
  e.respondWith(
    fetch(req)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copia));
        return resp;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});