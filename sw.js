/* 以撒全成就完成清单 - Service Worker
 * 功能：离线缓存 + PWA 安装支持
 * 策略：网络优先，断网时回退到本地缓存
 */

const CACHE_NAME = 'isaac-checklist-v3';

// 核心资源：与 sw.js 同目录下的页面（GitHub Pages 会自动把 ./ 指向 index.html）
const CORE_ASSETS = [
  './',
  './index.html',
];

// 安装阶段：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活阶段：删除旧版本缓存，接管现有页面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 请求阶段：网络优先，成功后缓存副本；失败时回退到缓存，最后兜底到首页
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只处理同源 GET 请求
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 只缓存正常的成功响应
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached || caches.match('./index.html'))
      )
  );
});
