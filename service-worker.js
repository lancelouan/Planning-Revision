const CACHE_NAME = 'planning-revision-v3';

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
const url = event.request.url;

// Ne jamais mettre en cache les requêtes Supabase.
if (
url.includes('supabase.co') ||
url.includes('/rest/v1/') ||
url.includes('/auth/v1/')
) {
event.respondWith(fetch(event.request));
return;
}

// Toujours récupérer index.html depuis le réseau.
if (
event.request.mode === 'navigate' ||
url.endsWith('/Planning-Revision/') ||
url.endsWith('/Planning-Revision/index.html')
) {
event.respondWith(
fetch(event.request)
.then(response => {
const clone = response.clone();

      caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, clone);
      });

      return response;
    })
    .catch(() => caches.match(event.request))
);

return;

}

// Pour les autres fichiers : réseau d'abord,
// cache uniquement comme solution de secours.
event.respondWith(
fetch(event.request)
.then(response => {
if (response.ok) {
const clone = response.clone();

      caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, clone);
      });
    }

    return response;
  })
  .catch(() => caches.match(event.request))

);
});
