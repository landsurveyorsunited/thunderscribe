const CACHE_NAME = 'thunderscribe-shell-v4';
const SHELL = [
  './',
  './index.html',
  './404.html',
  './styles/main.css',
  './js/main.js',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './manifest.webmanifest'
];

// Never cache application data. This includes the meeting-memory endpoint,
// whose response is scoped to the current signed-in identity.
const PRIVATE_PREFIXES = ['/transcripts', '/api/'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Network-first keeps imported modules and styles current after a deploy,
  // while still making the app useful offline once a resource was fetched.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
