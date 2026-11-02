// Installerbar app (Android/Chrome/Edge) och service worker.

let deferred = null;

export function setupPwa() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("service worker", e));
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    window.dispatchEvent(new Event("pwa-installable"));
  });
  window.addEventListener("appinstalled", () => { deferred = null; });
}

export const canInstall = () => !!deferred;

export async function install() {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
}
