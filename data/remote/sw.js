// BlueLink Remote PWA Service Worker
// Cache shell assets for offline home-screen launch.

const CACHE_NAME = 'bluelink-remote-v3';

const PRECACHE_URLS = [
  './bluelinkremote.html',
  './manifest.json',
  './icon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './mqtt.min.js'
];

// Install: pre-cache shell assets, skip waiting immediately.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function (err) {
        console.error('[BlueLink SW] Pre-cache failed:', err);
        throw err;
      })
  );
});

// Activate: claim clients and delete old caches.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (name) { return name !== CACHE_NAME; })
            .map(function (name) { return caches.delete(name); })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

// Fetch: cache-first for shell assets, network-only for everything else.
self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  var shellPath = url.pathname;
  var swDir = self.location.pathname.replace(/[^/]+$/, '');
  if (shellPath.indexOf(swDir) === 0) {
    shellPath = shellPath.substring(swDir.length);
  }
  var isShell = PRECACHE_URLS.some(function (u) {
    return u.replace('./', '') === shellPath;
  });

  if (!isShell) {
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true })
      .then(function (cached) {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then(function (response) {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, clone);
            });
            return response;
          });
      })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
