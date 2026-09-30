const HOSTNAME_WHITELIST = [
  self.location.hostname,
  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'tessdata.projectnaptha.com'
];

self.addEventListener('install', event => {
  self.skipWaiting();
});

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

  // ---- Share Target: recibir la imagen compartida desde Uber ----
  if(event.request.method === 'POST' && url.pathname.endsWith('/share-target')){
    console.log('[SW] POST /share-target recibido');
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('imagen');
        if(file){
          console.log('[SW] Imagen recibida:', file.size, 'bytes');
          const cache = await caches.open('share-target');
          await cache.put('/shared-image', new Response(file));
          console.log('[SW] Imagen guardada en cache');
        } else {
          console.warn('[SW] No se ha encontrado el campo "imagen" en el formData');
        }
      } catch(e){
        console.warn('[SW] Error recibiendo imagen:', e);
      }
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  // ----------------------------------------------------------------

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