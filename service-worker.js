
self.addEventListener('install', e => {
self.skipWaiting();
});

self.addEventListener('fetch', function(event) {
event.respondWith(fetch(event.request));
});
