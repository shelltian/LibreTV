/*
 * LibreTV Service Worker
 * 缓存策略：
 * - 静态资源（icons、图片）：cache-first
 * - Next.js 静态资源（/_next/static）：cache-first（带哈希，可长期缓存）
 * - 页面与 API：network-first，离线时回退缓存
 */
const CACHE_NAME = 'libretv-v1';
const OFFLINE_URLS = ['/', '/manifest.webmanifest', '/favicon.ico', '/player-poster.png'];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存并接管客户端
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只处理同源 GET 请求；跨域视频源 API 不缓存
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Next.js 带哈希的静态资源：cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // 页面与其它同源资源：network-first，离线回退缓存
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === 'navigate' || url.pathname === '/manifest.webmanifest')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});