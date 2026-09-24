const HOSTNAME_WHITELIST = [
  self.location.hostname,
  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'cdn.jsdelivr.net'
];

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const getFixedUrl = (req) => {
  const now = Date.now();
  const url = new URL(req.url);
  url.protocol = self.location.protocol;
  if (url.hostname === self.location.hostname) {
    url.search += (url.search ? '&' : '?') + 'cache-bust=' + now;
  }
  return url.href;
};

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (HOSTNAME_WHITELIST.indexOf(url.hostname) === -1) return;

  const isAppFile = /\.(?:html|js|css|json|webmanifest)$/.test(url.pathname)
                    || url.pathname.endsWith("/");

  if (isAppFile) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(resp => {
          const copy = resp.clone();
          caches.open("pwa-cache").then(c => c.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  const cached = caches.match(event.request);
  const fixedUrl = getFixedUrl(event.request);
  const fetched = fetch(fixedUrl, { cache: 'no-store' });
  const fetchedCopy = fetched.then(resp => resp.clone());

  event.respondWith(
    Promise.race([fetched.catch(_ => cached), cached])
      .then(resp => resp || fetched)
      .catch(_ => {})
  );

  event.waitUntil(
    Promise.all([fetchedCopy, caches.open("pwa-cache")])
      .then(([response, cache]) => response.ok && cache.put(event.request, response))
      .catch(_ => {})
  );
});