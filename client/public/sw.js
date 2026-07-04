/**
 * Minimal service worker for realist.ca (scoped per docs/DISTRIBUTION_ARCHITECTURE.md
 * decision #3: "manifest + minimal service worker ... don't build offline-first
 * infrastructure").
 *
 * Strategy:
 * - Navigations + /api requests: network-first (never serve a stale shell or
 *   stale data; fall back to cache only when offline).
 * - Hashed build assets (/assets/*) and static images/fonts: cache-first
 *   (immutable by construction, so this is safe).
 * - Everything else (cross-origin, non-GET): untouched.
 */
const CACHE_NAME = "realist-static-v1";

self.addEventListener("install", () => {
  // No precache list on purpose — hashed chunk names change every build and
  // are cached lazily on first fetch instead.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

const STATIC_DEST = ["style", "script", "image", "font"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the service worker itself.
  if (url.pathname === "/sw.js") return;

  // API + page navigations: network-first, cache as offline fallback only.
  if (url.pathname.startsWith("/api/") || request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && request.mode === "navigate") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Static assets: cache-first with background fill.
  const isHashedAsset = url.pathname.startsWith("/assets/");
  if (isHashedAsset || STATIC_DEST.includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
