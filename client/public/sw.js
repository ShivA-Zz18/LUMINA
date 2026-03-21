/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║         SERVICE WORKER — LINGO-BRIDGE PWA              ║
 * ║         Offline Support & Caching Strategy               ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const CACHE_VERSION = "lingo-bridge-v2.0.1";
const ASSETS_CACHE = "lingo-bridge-assets-v2.0.1";
const API_CACHE = "lingo-bridge-api-v2.0.1";
const IMAGE_CACHE = "lingo-bridge-images-v2.0.1";

// ─────────────────────────────────────────────────────────
// STATIC ASSETS TO PRECACHE
// ─────────────────────────────────────────────────────────

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
];

// ─────────────────────────────────────────────────────────
// INSTALL EVENT: Precache static assets
// ─────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker: Installing...");

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log("📦 Precaching static assets");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("⚠️ Some assets failed to precache:", err);
        // Don't fail install on precache error
      });
    })
  );

  // Skip waiting to activate immediately
  self.skipWaiting();
});

// ─────────────────────────────────────────────────────────
// ACTIVATE EVENT: Clean up old caches
// ─────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker: Activating...");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_VERSION &&
            cacheName !== ASSETS_CACHE &&
            cacheName !== API_CACHE &&
            cacheName !== IMAGE_CACHE
          ) {
            console.log(`🗑️  Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Claim all clients
  self.clients.claim();
});

// ─────────────────────────────────────────────────────────
// FETCH EVENT: Smart caching strategy
// ─────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // ─────────────────────────────────────────────────────
  // API CALLS: Network-first with fallback to cache
  // ─────────────────────────────────────────────────────
  if (url.pathname.startsWith("/api")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached response if network fails
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log(`📦 Serving from cache (API): ${url.pathname}`);
              return cached;
            }
            // Return offline response
            return new Response(
              JSON.stringify({
                error: "Offline: No cached data available",
                offline: true,
              }),
              {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "application/json" },
              }
            );
          });
        })
    );
  }
  // ─────────────────────────────────────────────────────
  // IMAGES: Cache-first with network fallback
  // ─────────────────────────────────────────────────────
  else if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i) ||
    url.pathname.startsWith("/uploads")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
  }
  // ─────────────────────────────────────────────────────
  // HTML/CSS/JS: Network-first with cache fallback
  // ─────────────────────────────────────────────────────
  else if (
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname === "/"
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(ASSETS_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            // Return offline page for HTML requests
            if (url.pathname.endsWith(".html") || url.pathname === "/") {
              return caches.match("/index.html");
            }
          });
        })
    );
  }
  // ─────────────────────────────────────────────────────
  // OTHER ASSETS: Cache-first
  // ─────────────────────────────────────────────────────
  else {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(ASSETS_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});

// ─────────────────────────────────────────────────────────
// MESSAGE HANDLING: For cache updates from client
// ─────────────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName);
      });
    });
  }
});

console.log("✅ Service Worker loaded and ready");

