const CACHE_NAME = "inventario-pwa-v5";
const ASSETS = [
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
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Cacheia apenas o que está dentro do escopo /Inventory/
  if (url.pathname.startsWith("/Inventory/")) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match("/Inventory/index.html")))
    );
  }
});
