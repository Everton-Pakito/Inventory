const CACHE_NAME = "inventario-pwa-v6";
const CORE_ASSETS = [
  "/Inventory/",
  "/Inventory/index.html",
  "/Inventory/styles.css",
  "/Inventory/app.js",
  "/Inventory/api.js",
  "/Inventory/db.js",
  "/Inventory/manifest.webmanifest",
  "/Inventory/icons/icon-192.png",
  "/Inventory/icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

// Strategy:
// - Navigations: cache-first for index.html (offline support)
// - Static assets (css/js/img): network-first, fallback to cache (never return index.html)
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (!url.pathname.startsWith("/Inventory/")) return;

  // Navigations
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("/Inventory/index.html").then(cached => cached || fetch(req))
    );
    return;
  }

  // Static assets
  e.respondWith(
    fetch(req).then(res => {
      // Only cache successful responses
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
