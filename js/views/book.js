// En bok: uppgifter, exemplar (plats, status, lån) och värdering.

import { h, mount, select, cover, busyButton, confirmBox, toast, fmtDate, kr } from "../lib/dom.js";
import { callFn } from "../lib/supabase.js";
import * as store from "../store.js";
import { CATEGORIES, STATUS, SOURCE, authorsText } from "../labels.js";
import { locationSelect, searchSheet } from "./widgets.js";
import { languageLabel } from "../organize.js";

export function render(root, { id }) {
  const draw = () => {
    const w = store.state.works.get(id);
    if (!w) return mount(root, h("p.empty", "Boken finns inte längre."), h("a.button", { href: "#/hylla" }, "Till hyllan"));
    const v = store.state.valuations.get(id);

    mount(root,
      h("a.back", { href: "#/hylla" }, "‹ Hyllan"),
      h("section.book-head",
        cover(w.isbn, w.title, "L"),
        h("div.stack",
          h("h1", w.title),
          h("p.lead", authorsText(w) || "Okänd författare"),
          h("p.muted", [w.year, w.publisher, w.language && languageLabel(w.language)].filter(Boolean).join(" · ")),
          w.isbn ? h("p.muted.small", `ISBN ${w.isbn}`) : null,
          h("div.row.wrap",
            h("span.badge", { class: w.verified ? "ok" : "warn" }, w.verified ? `✓ ${SOURCE[w.source]}` : SOURCE[w.source] ?? "Ej verifierad"),
            w.libris_url ? h("a.small", { href: w.libris_url, target: "_blank", rel: "noopener" }, "Öppna i Libris") : null))),

      !w.verified ? h("section.card.stack",
        h("p", "Den här boken är inte verifierad mot en katalog. Sök fram rätt post så får den ISBN, upplaga och omslag."),
        busyButton("Verifiera mot Libris", async () => {
          const c = await searchSheet({ title: w.title, author: w.authors[0] ?? "" });
          if (!c || c.manual) return;
          const dupe = store.findWork({ libris_id: c.libris_id, isbn: c.isbn });
          if (dupe && dupe.id !== w.id) {
            // Samma bok fanns redan: flytta exemplaren dit och ta bort dubbletten.
            await store.updateCopies(store.copiesOf(w.id).map((cp) => ({ id: cp.id, work_id: dupe.id })));
            await store.deleteWork(w.id);
            toast("Slogs ihop med befintlig post.", "ok");
            location.hash = `#/bok/${dupe.id}`;
            return;
          }
          await store.updateWork(w.id, {
            title: c.title, authors: c.authors, year: c.year, publisher: c.publisher, language: c.language,
            isbn: c.isbn, libris_id: c.libris_id, libris_url: c.source === "libris" ? c.url : null,
            source: c.source, verified: true,
          });
          toast("Verifierad.", "ok");
        })) : null,

      h("section.card.stack",
        h("h2", "Kategori"),
        select(CATEGORIES.map((c) => [c, c]), w.category ?? "Övrigt", (val) => store.updateWork(w.id, { category: val }))),

      h("section.card.stack",
        h("div.row.between",
          h("h2", `Exemplar (${store.copiesOf(w.id).length})`),
          busyButton("+ Exemplar", () => store.addCopy(w.id, null), { class: "small ghost" })),
        store.copiesOf(w.id).map(copyEditor)),

      h("section.card.stack",
        h("h2", "Värde"),
        v ? valuationBlock(v) : h("p.muted", "Inte värderad än."),
        busyButton(v ? "Värdera igen" : "Värdera (söker på Bokbörsen och antikvariat)", async () => {
          const res = await callFn("valuate", { work_id: w.id });
          store.rememberValuation(res);
        }, { busyLabel: "Söker priser… (ca 30 s)" }),
        h("a.small", {
          href: `https://www.bokborsen.se/?q=${encodeURIComponent(w.isbn ?? `${w.title} ${w.authors[0] ?? ""}`.trim())}`,
          target: "_blank", rel: "noopener",
        }, "Se själv på Bokbörsen ↗")),

      h("section.stack",
        h("button.danger.ghost", {
          onclick: async () => {
            if (!(await confirmBox(`Ta bort ”${w.title}” och alla exemplar?`, "Ta bort", true))) return;
            await store.deleteWork(w.id);
            location.hash = "#/hylla";
          },
        }, "Ta bort boken")));
  };

  const copyEditor = (c) => {
    const lent = h("input", {
      value: c.lent_to ?? "", placeholder: "Till vem?", "aria-label": "Utlånad till",
      onchange: (e) => store.updateCopy(c.id, { lent_to: e.target.value || null }),
    });
    return h("div.copy.stack",
      h("label", "Plats", locationSelect(c.location_id, (v) => store.updateCopy(c.id, { location_id: v, seen_at: new Date().toISOString() }))),
      h("div.row.wrap",
        select(Object.entries(STATUS), c.status, (v) => store.updateCopy(c.id, { status: v, lent_to: v === "lent" ? c.lent_to : null }), { "aria-label": "Status" }),
        c.status === "lent" ? lent : null),
      h("input", {
        value: c.note ?? "", placeholder: "Anteckning (skick, signerad, gåva…)", "aria-label": "Anteckning",
        onchange: (e) => store.updateCopy(c.id, { note: e.target.value || null }),
      }),
      h("div.row.between",
        h("span.muted.small", `Senast sedd ${fmtDate(c.seen_at)}`),
        h("button.link.danger-text", {
          onclick: async () => (await confirmBox("Ta bort exemplaret?", "Ta bort", true)) && store.deleteCopy(c.id),
        }, "Ta bort exemplar")));
  };

  draw();
  return store.onChange(draw);
}

export function valuationBlock(v) {
  return h("div.stack",
    h("p.value", v.high > 0 ? `${kr(v.low)} – ${kr(v.high)}` : "Inget nämnvärt andrahandsvärde"),
    h("p", h("strong", v.best_channel), ` · säkerhet: ${v.confidence} · ${fmtDate(v.created_at)}`),
    v.summary ? h("p.muted", v.summary) : null,
    v.sources?.length ? h("details",
      h("summary", `Källor (${v.sources.length})`),
      h("ul", v.sources.map((s) => h("li", h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.title || s.url))))) : null);
}
