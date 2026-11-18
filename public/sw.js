/* 以撒成就清单 - Service Worker
 * 页面 network-first（尽快拿到新版本），图集/数据 cache-first（体积大，URL 带 ?v= 版本号）。
 */
const CACHE_NAME = 'isaac-checklist-v7';
const CORE = ['/', '/index.html', '/pwa/manifest.json'];
// 页面数据（成就/拼音）随页面版本一起更新：cache: 'reload' 绕过本地缓存取最新副本
const PAGE_DATA = ['/data/ach-py.json'];
const DATA = ['/data/codex.json', '/data/eid-icons.json'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 预缓存 URL 与页面请求保持一致（/assets/<file>?v=<version>），版本升级后自动拉取新文件
    let assets = [];
    try {
      const res = await fetch('/assets/manifest.json', { cache: 'no-store' });
      const m = res.ok ? await res.json() : null;
      if (m && m.version) {
        assets = Object.values(m)
          .filter((s) => s && typeof s === 'object' && s.file)
          .map((s) => '/assets/' + s.file + '?v=' + m.version);
      }
    } catch (e) { /* 离线安装：仅缓存核心页面 */ }
    await cache.addAll(CORE.concat(assets, DATA));
    await Promise.all(PAGE_DATA.map(async (u) => {
      try {
        const res = await fetch(u, { cache: 'reload' });
        if (res && res.status === 200) await cache.put(u, res);
      } catch (e) { /* 离线安装：跳过页面数据 */ }
    }));
    await self.skipWaiting();
  })());
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
