// Service worker: gör appen installerbar och startbar även med dåligt nät.
// Strategi: nätet först för appens egna filer (så uppdateringar slår igenom
// direkt), cachen som reserv. Supabase och Libris cachas aldrig.

const CACHE = "bokhyllan-v1";
const SHELL = [
  "./", "./index.html", "./css/app.css", "./manifest.webmanifest",
  "./vendor/supabase.js", "./icons/icon-192.png", "./icons/icon-512.png",
  "./js/main.js", "./js/config.js", "./js/store.js", "./js/labels.js", "./js/organize.js", "./js/pwa.js",
  "./js/lib/dom.js", "./js/lib/supabase.js", "./js/lib/image.js", "./js/lib/barcode.js",
  "./js/views/library.js", "./js/views/book.js", "./js/views/scan.js", "./js/views/organize.js",
  "./js/views/value.js", "./js/views/settings.js", "./js/views/places.js", "./js/views/login.js",
  "./js/views/widgets.js", "./js/views/addbook.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r ?? caches.match("./index.html"))),
  );
});
