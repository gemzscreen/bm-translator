/* BM Translator service worker - makes the app work without data */
const VERSION = "bm-1.0.0";
const SHELL_CACHE = "bm-shell-" + VERSION;
const OCR_CACHE = "bm-ocr-v5";   // scanner files kept across app updates
const SHELL = ["./", "index.html", "app.js", "engine.js", "data.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((k) => k.startsWith("bm-shell-") && k !== SHELL_CACHE)
    .map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // online services go straight to the network
  const isOCR = url.pathname.includes("/ocr/");
  if (req.mode === "navigate") {
    // app page: network first (to pick up updates), cache when offline
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put("index.html", copy)); return res;
    }).catch(() => caches.match("index.html", { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    if (hit) return hit;
    return fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(isOCR ? OCR_CACHE : SHELL_CACHE).then((c) => c.put(req, copy)); }
      return res;
    });
  }));
});
