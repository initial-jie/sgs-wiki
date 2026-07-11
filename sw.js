/* 三国杀线下 Wiki · Service Worker
 *
 * 缓存策略(为“push 即更新、牌桌离线可查”设计):
 *  - HTML / 导航请求 → network-first:联网时永远拿最新(git push 立刻生效),
 *    断网时回退到缓存,再回退到首页。所以日常改动无需动本文件。
 *  - 其余同源 GET(立绘 / generals.json / tools 页) → stale-while-revalidate:
 *    秒开旧缓存,同时后台拉新,下次访问即最新。
 *  - Google Fonts(跨域) → 同上,顺带缓存,离线回退系统宋体。
 *  - 房间(workers.dev)是另一个 origin,本 SW 作用域内根本拦不到 → 不受影响。
 *
 * 维护:通常什么都不用改。若想强制清空所有旧缓存,把 CACHE_VERSION 改个号即可。
 */
const CACHE_VERSION = 'v1';
const CACHE = 'sgs-wiki-' + CACHE_VERSION;

// 应用外壳:装 app 时预缓存,保证首屏离线可用
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);

  // 只处理同源与字体;其它跨域(如房间 worker)一律放行,不拦
  if (!sameOrigin && !isFont) return;

  // HTML / 导航 → network-first
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 其余(图片 / json / 字体 / tools 资源) → stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
