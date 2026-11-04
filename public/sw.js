// Minimal service worker: it makes the site installable and shows the last-seen app shell if the network drops.
// Network-first on purpose: a cache-first worker would keep serving an old app.js after every deploy.
// Only same-origin GETs are touched; Firestore and the other CDNs are never intercepted.
const CACHE = "family-cart-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req)
        .then((hit) => hit || caches.match("index.html"))
        .then((hit) => hit || Response.error())),
  );
});
