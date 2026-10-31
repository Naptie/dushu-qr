/**
 * dushu-qr service worker.
 */

const SHELL_CACHE = 'dushu-qr-shell';
const RUNTIME_CACHE = 'dushu-qr-runtime';

/** Upper bound on runtime cache entries; the oldest insertions go first. */
const RUNTIME_MAX_ENTRIES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(['./']))
      // A failed precache must not abort the install — the shell simply
      // arrives through the runtime path on the next load.
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never touch cross-origin traffic (api.215123.cn): network only.
  if (url.origin !== location.origin) return;
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(serveNavigation(event.request));
    return;
  }

  event.respondWith(serveAsset(event.request, url));
});

/**
 * Navigations are served from the cache first, so opening the installed app
 * never waits on the network. The network copy is fetched in the background
 * and replaces the cached one, which is how a new deploy reaches the app.
 */
async function serveNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await matchShell(cache, request);

  const refreshed = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);

  if (hit) return hit;
  return (await refreshed) ?? new Response('Offline', { status: 503 });
}

/**
 * The shell cache holds whichever documents have been visited. GitHub Pages
 * resolves `/guide` to `guide.html` but answers `/guide/` with a 404, so
 * try the `.html` sibling next, and fall back to the root shell (the SPA
 * entry point) for anything else.
 */
async function matchShell(cache, request) {
  const url = new URL(request.url);
  const candidates = [
    request,
    new Request(new URL(`${url.pathname}.html`, url).href),
    new Request(new URL('./', url).href)
  ];

  for (const candidate of candidates) {
    const hit = await cache.match(candidate, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
  }
  return null;
}

/**
 * Static assets are served from the cache first as well. SvelteKit emits
 * content-hashed filenames under /_app/immutable/, so those never go stale
 * and are only fetched once; everything else (manifest, icons, guide
 * images) is revalidated in the background.
 */
async function serveAsset(request, url) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request, { ignoreVary: true });

  if (hit) {
    if (!isImmutable(url)) revalidate(cache, request);
    trim(cache);
    return hit;
  }

  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone()).catch(() => {});
    trim(cache);
  }
  return res;
}

/**
 * SvelteKit content-hashes everything under /_app/immutable/, so a changed
 * file always has a new URL and the old one can never go stale.
 */
function isImmutable(url) {
  return url.pathname.includes('/_app/immutable/');
}

/**
 * Refresh a cached asset in the background. Failures are ignored — the
 * cached copy stays usable and the next open tries again.
 */
function revalidate(cache, request) {
  fetch(request)
    .then((res) => (res.ok ? cache.put(request, res.clone()) : null))
    .catch(() => {});
}

/**
 * Every deploy adds a fresh set of hashed bundles, so the superseded ones
 * would pile up forever. Keep the runtime cache bounded by dropping the
 * oldest insertions first.
 */
async function trim(cache) {
  const keys = await cache.keys();
  const excess = keys.length - RUNTIME_MAX_ENTRIES;
  if (excess <= 0) return;
  for (const key of keys.slice(0, excess)) {
    await cache.delete(key);
  }
}
