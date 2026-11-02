// Ordna: överblick över samlingens skick och förslag på ny ordning med
// en konkret flyttlista, hylla för hylla.

import { h, mount, select, busyButton, confirmBox, toast } from "../lib/dom.js";
import * as store from "../store.js";
import { PRINCIPLES, planLayout, estimateCapacity } from "../organize.js";
import { authorsText } from "../labels.js";

const opts = { scope: "", principle: "kategori-forfattare" };

export function render(root) {
  const out = h("div.stack");

  const draw = () => {
    const all = store.copies().filter((c) => c.status === "shelf" || c.status === "away");
    const W = store.state.works;
    const unverified = store.works().filter((w) => !w.verified).length;
    const noPlace = store.copies().filter((c) => !c.location_id && c.status === "shelf").length;
    const away = store.copies().filter((c) => c.status === "away").length;
    const lent = store.copies().filter((c) => c.status === "lent");
    const dupes = store.works().filter((w) => store.copiesOf(w.id).filter((c) => c.status !== "sold" && c.status !== "gone").length > 1);
    const yearAgo = Date.now() - 365 * 864e5;
    const stale = all.filter((c) => Date.parse(c.seen_at) < yearAgo).length;

    const stat = (n, label, href) => h(href ? "a.stat" : "div.stat", href ? { href } : {}, h("strong", String(n)), h("span", label));

    const roots = store.locationTree().filter((l) => l.kind === "room" || l.kind === "bookcase");
    mount(root,
      h("header.view-head", h("h1", "Ordna")),
      h("section.stats",
        stat(store.state.copies.size, "exemplar"),
        stat(unverified, "ej verifierade", "#/hylla?filter=unverified"),
        stat(noPlace, "utan plats", "#/hylla?loc=none"),
        stat(away, "okänd plats"),
        stat(lent.length, "utlånade"),
        stat(stale, "ej sedda på ett år")),
      lent.length ? h("section.card.stack",
        h("h2", "Utlånat"),
        lent.map((c) => {
          const w = W.get(c.work_id);
          return h("a.row.between", { href: `#/bok/${c.work_id}` }, h("span", w?.title), h("span.muted", c.lent_to ?? "?"));
        })) : null,
      dupes.length ? h("section.card.stack",
        h("h2", `Dubbletter (${dupes.length})`),
        h("p.muted.small", "Böcker du har flera exemplar av — kandidater att sälja eller ge bort."),
        dupes.slice(0, 30).map((w) => h("a.row.between", { href: `#/bok/${w.id}` },
          h("span", w.title), h("span.muted", `${store.copiesOf(w.id).length} ex`)))) : null,
      h("section.card.stack",
        h("h2", "Föreslå ny ordning"),
        h("p.muted.small", "Appen sorterar böckerna efter vald princip och fyller hyllplanen i tur och ordning, uppifrån och från vänster. Du får en flyttlista att gå efter."),
        h("label", "Vilka hyllor",
          select([["", "Alla bokhyllor"], ...roots.map((l) => [l.id, `${"  ".repeat(l.depth)}${l.name}`])], opts.scope, (v) => { opts.scope = v; })),
        h("label", "Ordning",
          select(Object.entries(PRINCIPLES).map(([k, p]) => [k, p.label]), opts.principle, (v) => { opts.principle = v; })),
        h("button", { onclick: () => propose(out) }, "Visa förslag")),
      out);
  };

  draw();
}

function propose(out) {
  const shelves = store.leafLocations(opts.scope || null).filter((l) => l.kind === "shelf" || l.kind === "spot");
  if (!shelves.length) {
    mount(out, h("p.notice", "Inga hyllplan att ordna. Lägg till bokhyllor under Mer › Platser, eller via Skanna."));
    return;
  }
  const ids = new Set(shelves.map((s) => s.id));
  const items = store.copies()
    .filter((c) => c.status === "shelf" && ids.has(c.location_id))
    .map((copy) => ({ copy, work: store.state.works.get(copy.work_id) }))
    .filter((x) => x.work);
  const caps = shelves.map((s) => ({ id: s.id, capacity: estimateCapacity(s, store.copiesAt(s.id).length) }));
  const { plan, overflow, moves } = planLayout(items, caps, opts.principle);

  // Flyttlistan grupperad per hylla man plockar FRÅN.
  const byFrom = new Map();
  for (const m of moves) {
    if (!byFrom.has(m.from)) byFrom.set(m.from, []);
    byFrom.get(m.from).push(m);
  }

  mount(out,
    h("section.card.stack",
      h("h2", `${moves.length} av ${items.length} böcker behöver flyttas`),
      overflow.length ? h("p.notice", `${overflow.length} böcker får inte plats. Ange hur många som ryms per plan under Mer › Platser, eller lägg till fler plan.`) : null,
      h("p.muted.small", "Kapaciteten per plan är uppskattad till dagens antal + 15 % om du inte angett den själv."),
      h("details", { open: true },
        h("summary", "Så här blir hyllorna"),
        plan.filter((p) => p.items.length).map((p) => h("div.plan",
          h("h3", store.locationPath(p.shelfId)),
          h("p.muted.small", `${p.items.length}/${p.capacity} · ${p.groups.join(", ")}`),
          h("ol.small", p.items.map(({ copy, work }) => h("li", { class: copy.location_id === p.shelfId ? "" : "moving" },
            `${work.title} — ${authorsText(work) || "?"}`)))))),
      moves.length ? h("details",
        h("summary", "Flyttlista (plocka hylla för hylla)"),
        [...byFrom].map(([from, ms]) => h("div.plan",
          h("h3", `Från ${store.locationPath(from)}`),
          h("ul.small", ms.map((m) => h("li", `${m.work.title} → ${store.locationPath(m.to)}`)))))) : null,
      moves.length ? busyButton("Jag har flyttat böckerna — uppdatera platserna", async () => {
        if (!(await confirmBox(`Uppdatera platsen för ${moves.length} böcker enligt förslaget?`, "Uppdatera"))) return;
        const patches = [];
        for (const p of plan) p.items.forEach(({ copy }, i) =>
          patches.push({ id: copy.id, location_id: p.shelfId, position: i + 1, seen_at: new Date().toISOString() }));
        await store.updateCopies(patches);
        toast("Platserna uppdaterade.", "ok");
        mount(out);
      }) : h("p.ok-text", "Allt står redan i den ordningen.")));
}
