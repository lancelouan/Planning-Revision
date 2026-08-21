```javascript
const CACHE_NAME = 'planning-revision-v2';

const FILES_TO_CACHE = [
  '/Planning-Revision/',
  '/Planning-Revision/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});

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

  // Ne jamais mettre en cache les requêtes Supabase.
  if (
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('/rest/v1/') ||
    event.request.url.includes('/auth/v1/')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Toujours récupérer index.html depuis le serveur.
  if (
    event.request.mode === 'navigate' ||
    event.request.url.endsWith('/Planning-Revision/') ||
    event.request.url.endsWith('/Planning-Revision/index.html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });

          return response;
        })
        .catch(() =>
          caches.match(event.request)
        )
    );

    return;
  }

  // Pour les autres fichiers :
  // réseau d'abord, cache en secours.
  event.respondWith(
    fetch(event.request)
      .then(response => {

        if (response.ok) {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }

        return response;
      })
      .catch(() =>
        caches.match(event.request)
      )
  );
});
```
