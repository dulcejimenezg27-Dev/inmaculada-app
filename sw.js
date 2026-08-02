/* Service Worker — Colegio La Inmaculada PWA */
const CACHE_NAME = "inmaculada-v33";
const ASSETS = [
  "./index.html",
  "./css/styles.css",
  "./css/ayuda-nav.css",
  "./js/app.js",
  "./js/shared-content.js",
  "./js/ayuda-nav.js",
  "./js/pwa-install.js",
  "./js/firebase-config.js",
  "./manifest.json",
  "./data/contenido.json",
  "./image/logoInmaculada.jpg",
  "./image/fondoApp.jpeg",
  "./image/icon-192.png",
  "./image/icon-512.png",
  "./image/ayudas.jpeg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(ASSETS.map((url) => cache.add(url).catch(() => undefined)))
      )
      .then(() => self.skipWaiting())
  );
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Dejar que las PWA anidadas (docentes/admin/bienestar/personero) se controlen solas
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/docentes/") ||
      url.pathname.startsWith("/admin/") ||
      url.pathname.startsWith("/bienestar/") ||
      url.pathname.startsWith("/personero/"))
  ) {
    return;
  }

  if (url.hostname.includes("psepagos.co") || url.hostname.includes("pse.com.co")) {
    return;
  }

  // No cachear Firebase / Google
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebaseapp.com")
  ) {
    return;
  }

  // HTML y JS/CSS: red primero (para ver comunicados nuevos y código actualizado)
  const path = url.pathname;
  const networkFirst =
    request.mode === "navigate" ||
    path.endsWith(".js") ||
    path.endsWith(".css") ||
    path.endsWith(".html") ||
    path.includes("/js/") ||
    path.includes("/css/");

  if (networkFirst) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
