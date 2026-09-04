const CACHE_NAME = 'planning-revision-v5';

const FILES_TO_CACHE = [
  '/Planning-Revision/',
  '/Planning-Revision/index.html',
  '/Planning-Revision/manifest.json',
  '/Planning-Revision/planning-enhancements.js',
  '/Planning-Revision/icon-192.png',
  '/Planning-Revision/icon-512.png'
];

// Installation : on prépare immédiatement le noyau de l'application.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});

// Activation : on supprime les anciens caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // On ne gère que les requêtes GET.
  if (request.method !== 'GET') return;

  // Pour la page principale : réseau d'abord pour récupérer
  // les éventuelles mises à jour, puis cache si hors ligne.
  if (
    request.mode === 'navigate' ||
    url.pathname === '/Planning-Revision/' ||
    url.pathname === '/Planning-Revision/index.html'
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, clone);
            });
          }

          return response;
        })
        .catch(() => caches.match('/Planning-Revision/index.html'))
    );

    return;
  }

  // Pour les fichiers de l'application : cache d'abord,
  // puis réseau si le fichier n'est pas encore en cache.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clone);
          });
        }

        return response;
      });
    })
  );
});
