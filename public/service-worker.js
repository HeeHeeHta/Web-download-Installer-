const CACHE_NAME = "tvy-app-center-v2";
const PRECACHE_URLS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/com.tvytech.ceirchecker.komun-icon.png",
  "icons/com.tvytech.ceirtaxchecker.ceir-icon.png",
  "icons/com.tvytech.medicalnote.komun-icon.png",
  "icons/com.aistudio.koenawin.chntr-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Exclude external API calls (Firebase, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Stale-While-Revalidate for Images & Static Assets (icons, screenshots, manifests)
  if (
    url.pathname.includes("/icons/") ||
    url.pathname.includes("/shots/") ||
    req.destination === "image" ||
    url.pathname.endsWith(".webmanifest")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Network-First with Fast Cache Fallback for Navigation/HTML
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === "navigate") {
        return (await caches.match("index.html")) || (await caches.match("./"));
      }
      return new Response("Offline", { status: 503, statusText: "Offline" });
    })
  );
});
