// Minimal service worker: it makes the site installable and shows the last-seen app shell if the network drops.
// Network-first on purpose: a cache-first worker would keep serving an old app.js after every deploy.
// Same-origin GETs are network-first; the two pinned CDN libraries below are cache-first; Firestore itself is never intercepted.
const CACHE = "family-cart-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The Firebase SDK and the QR library are loaded from CDNs at fixed version numbers, so their files never change.
// Keeping a copy is what lets the app start with no reception (they are not part of the shell otherwise).
const PINNED = /^https:\/\/(www\.gstatic\.com\/firebasejs\/10\.14\.1\/|cdn\.jsdelivr\.net\/npm\/qrcode-generator@1\.4\.4\/)/;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method === "GET" && PINNED.test(req.url)) {
    event.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: "no-cache" }) // revalidate every time, so a cached page can't outlive a deploy
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req)
        .then((hit) => hit || caches.match("index.html"))
        .then((hit) => hit || Response.error())),
  );
});
