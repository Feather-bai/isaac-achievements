/* 以撒成就清单 - Service Worker
 * 页面 network-first（尽快拿到新版本），图集/数据 cache-first（体积大且按内容命名）。
 */
const CACHE_NAME = 'isaac-checklist-v4';
const CORE = ['/', '/index.html', '/pwa/manifest.json'];
const PRECACHE = [
  '/assets/atlas-ach.png',
  '/assets/item-collect.webp',
  '/assets/item-trinket.webp',
  '/assets/item-cards.webp',
  '/assets/item-runes.webp',
  '/assets/item-pills.webp',
  '/data/codex.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE.concat(PRECACHE)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  const url = new URL(request.url);
  const cacheFirst = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/data/');

  if (cacheFirst) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res && res.status === 200) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html')))
  );
});
