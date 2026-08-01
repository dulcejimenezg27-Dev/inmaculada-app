/* Service Worker — Inmaculada Admin PWA */

const CACHE_NAME = "inmaculada-admin-v10";

const ASSETS = [

  "./",

  "./index.html",

  "./css/admin.css",

  "./js/admin.js",

  "./js/config.js",

  "./js/shared-content.js",

  "./manifest.json",

  "./image/logoInmaculada.jpg",

  "./image/icon-192.png",

  "./image/icon-512.png",

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



  if (request.mode === "navigate") {

    event.respondWith(

      fetch(request)

        .then((response) => {

          const clone = response.clone();

          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));

          return response;

        })

        .catch(() => caches.match("./index.html"))

    );

    return;

  }



  event.respondWith(

    caches.match(request).then((cached) => {

      const network = fetch(request)

        .then((response) => {

          if (response && response.status === 200 && response.type === "basic") {

            const clone = response.clone();

            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));

          }

          return response;

        })

        .catch(() => cached);

      return cached || network;

    })

  );

});

