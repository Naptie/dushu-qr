const CACHE = `dushu-qr-v2`;
const SHELL = ['./', './favicon.svg', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never touch cross-origin traffic (api.215123.cn): network only.
  if (url.origin !== location.origin) return;
  if (event.request.method !== 'GET') return;

  // SPA navigation fallback: network first, cached shell offline.
  //
  // A pairing link carries the openId in the URL *fragment*, and a fragment
  // is stripped by the browser before the request is made — so `event.request`
  // never contains it. The response is never cached either, so the credential
  // cannot end up in the Cache Storage.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./', { ignoreSearch: true })));
    return;
  }

  // Cache-first for same-origin static assets.
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return resp;
        })
    )
  );
});
