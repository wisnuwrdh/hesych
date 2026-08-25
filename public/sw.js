// Hesych Service Worker — PWA offline support
//
// Strategy:
//   - Hashed static assets & icons  → cache-first (immutable content)
//   - Documents / navigations       → network-first, cache fallback
//   - /api/* and build-info.json    → always network (never cached)
//
// NOTE for maintainers: clearing site data wipes this cache AND the vault's
// biometric registration — the update banner in-app is the safe upgrade path.

const VERSION = "hesych-v1";
const RUNTIME_CACHE = `${VERSION}-runtime`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== RUNTIME_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/favicons/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/build-info.json") return; // update-check: selalu network

  // ── Static assets: cache-first ──
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      })(),
    );
    return;
  }

  // ── Dokumen/navigasi: network-first dengan fallback cache ──
  const accept = req.headers.get("accept") || "";
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === "basic") {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cached = await caches.match(req, { cacheName: RUNTIME_CACHE });
          return (
            cached ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        }
      })(),
    );
  }
});
