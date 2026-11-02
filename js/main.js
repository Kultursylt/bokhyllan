// Start och navigering. Varje vy är en egen modul med render(root, params);
// lägger man till en vy behöver bara ROUTES ändras här.

import { h, mount, $, showError } from "./lib/dom.js";
import { sb, configured } from "./lib/supabase.js";
import * as store from "./store.js";
import { setupPwa } from "./pwa.js";

const ROUTES = {
  hylla:   () => import("./views/library.js"),
  bok:     () => import("./views/book.js"),
  skanna:  () => import("./views/scan.js"),
  ordna:   () => import("./views/organize.js"),
  varde:   () => import("./views/value.js"),
  mer:     () => import("./views/settings.js"),
  platser: () => import("./views/places.js"),
};

const root = $("#view");
let cleanup = null;

function parseHash() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [name = "hylla", id] = path.split("/");
  return { name: ROUTES[name] ? name : "hylla", params: { id, ...Object.fromEntries(new URLSearchParams(query)) } };
}

async function route() {
  const { name, params } = parseHash();
  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  document.querySelectorAll("nav.tabs a").forEach((a) =>
    a.classList.toggle("active", a.dataset.route === name || (name === "bok" && a.dataset.route === "hylla") || (name === "platser" && a.dataset.route === "mer")));
  try {
    const mod = await ROUTES[name]();
    cleanup = mod.render(root, params) ?? null;
    window.scrollTo(0, 0);
  } catch (e) {
    showError(e);
    mount(root, h("p.error", e.message));
  }
}

async function showLogin() {
  document.body.classList.add("logged-out");
  const mod = await import("./views/login.js");
  mod.render(root, { onLogin: () => location.reload() });
}

async function boot() {
  setupPwa();

  if (!configured) {
    mount(root, h("section.card.stack",
      h("h1", "Nästan klart"),
      h("p", "Fyll i adressen och den publika nyckeln till ditt Supabase-projekt i ", h("code", "js/config.js"), "."),
      h("p.muted", "Se README, steg 5.")));
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();

  sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.reload(); });

  mount(root, h("p.muted.center", "Hämtar biblioteket…"));
  try {
    await store.loadAll();
  } catch (e) {
    mount(root, h("section.card.stack", h("h1", "Kunde inte läsa biblioteket"), h("p.error", e.message),
      h("button", { onclick: () => location.reload() }, "Försök igen")));
    return;
  }
  document.body.classList.remove("logged-out");
  window.addEventListener("hashchange", route);
  route();
}

boot().catch((e) => { showError(e); mount(root, h("p.error", e.message)); });
