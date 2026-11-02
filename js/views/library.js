// Hylla: sök och bläddra i hela samlingen.

import { h, mount, select, cover } from "../lib/dom.js";
import * as store from "../store.js";
import { CATEGORIES, STATUS, authorsText } from "../labels.js";
import { addBookFlow } from "./addbook.js";

const collator = new Intl.Collator("sv", { sensitivity: "base", numeric: true });
const prefs = { q: "", loc: "", cat: "", status: "", sort: "author" };

export function render(root, params = {}) {
  if (params.filter === "unverified") Object.assign(prefs, { status: "unverified" });
  if (params.loc) prefs.loc = params.loc;

  const list = h("div.list");
  const count = h("p.muted.count");

  const draw = () => {
    const q = prefs.q.toLowerCase().trim();
    let rows = store.copies().map((c) => ({ c, w: store.state.works.get(c.work_id) })).filter((r) => r.w);
    if (q) rows = rows.filter(({ w }) =>
      `${w.title} ${authorsText(w)} ${w.isbn ?? ""} ${w.year ?? ""}`.toLowerCase().includes(q));
    if (prefs.loc) rows = rows.filter(({ c }) => prefs.loc === "none" ? !c.location_id :
      c.location_id === prefs.loc || store.isWithin(c.location_id, prefs.loc));
    if (prefs.cat) rows = rows.filter(({ w }) => (w.category || "Övrigt") === prefs.cat);
    if (prefs.status === "unverified") rows = rows.filter(({ w }) => !w.verified);
    else if (prefs.status) rows = rows.filter(({ c }) => c.status === prefs.status);

    const key = {
      author: ({ w }) => `${(w.authors[0] ?? "").split(" ").pop()} ${w.title}`,
      title: ({ w }) => w.title,
      place: ({ c, w }) => `${store.locationPath(c.location_id)} ${String(c.position ?? 999).padStart(4, "0")} ${w.title}`,
      added: ({ c }) => `${9e15 - Date.parse(c.created_at)}`,
    }[prefs.sort];
    rows.sort((a, b) => collator.compare(key(a), key(b)));

    count.textContent = `${rows.length} av ${store.state.copies.size} exemplar`;
    mount(list, rows.length ? rows.slice(0, 400).map(row) :
      h("div.empty",
        store.state.copies.size ? "Inga böcker matchar." : [
          h("p", "Här är det tomt än så länge."),
          h("a.button", { href: "#/skanna" }, "Fotografera din första hylla"),
        ]),
      rows.length > 400 ? h("p.muted", "Visar de 400 första — förfina sökningen.") : null);
  };

  const row = ({ c, w }) => h("a.book-row", { href: `#/bok/${w.id}` },
    cover(w.isbn, w.title, "S"),
    h("div.book-main",
      h("strong", w.title),
      h("span.muted", [authorsText(w), w.year].filter(Boolean).join(" · ")),
      h("span.place", store.locationPath(c.location_id))),
    h("div.badges",
      c.status !== "shelf" ? h("span.badge.warn", c.status === "lent" && c.lent_to ? `Lånad: ${c.lent_to}` : STATUS[c.status]) : null,
      !w.verified ? h("span.badge.muted", "Ej verifierad") : null));

  const search = h("input.search", {
    type: "search", placeholder: "Sök titel, författare, ISBN…", value: prefs.q,
    oninput: (e) => { prefs.q = e.target.value; draw(); },
  });

  const locOptions = [["", "Alla platser"], ["none", "Utan plats"],
    ...store.locationTree().map((l) => [l.id, `${"  ".repeat(l.depth)}${l.name}`])];

  mount(root,
    h("header.view-head",
      h("h1", store.state.library?.name ?? "Bokhyllan"),
      h("button", { onclick: () => addBookFlow() }, "+ Lägg till")),
    search,
    h("div.filters",
      select(locOptions, prefs.loc, (v) => { prefs.loc = v; draw(); }, { "aria-label": "Plats" }),
      select([["", "Alla kategorier"], ...CATEGORIES.map((c) => [c, c])], prefs.cat, (v) => { prefs.cat = v; draw(); }, { "aria-label": "Kategori" }),
      select([["", "Alla"], ...Object.entries(STATUS), ["unverified", "Ej verifierade"]], prefs.status, (v) => { prefs.status = v; draw(); }, { "aria-label": "Status" }),
      select([["author", "Sortera: författare"], ["title", "Titel"], ["place", "Plats"], ["added", "Senast tillagd"]], prefs.sort, (v) => { prefs.sort = v; draw(); }, { "aria-label": "Sortering" })),
    count,
    list);

  draw();
  return store.onChange(draw);
}
