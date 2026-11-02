// Återanvändbara byggstenar: platsväljare, kandidatkort och Libris-sökning.

import { h, select, sheet, cover, busyButton } from "../lib/dom.js";
import { callFn } from "../lib/supabase.js";
import * as store from "../store.js";
import { SOURCE } from "../labels.js";

/** Rullgardin med alla platser i trädordning. */
export function locationSelect(value, onchange, { allowNone = true, leavesOnly = false } = {}) {
  const tree = store.locationTree();
  const opts = tree
    .filter((l) => !leavesOnly || store.leafLocations().some((x) => x.id === l.id) || l.kind === "room" || l.kind === "bookcase")
    // Hela sökvägen ("Vardagsrummet › Plan 1") så det vara valda alltid är entydigt.
    .map((l) => [l.id, l.depth ? store.locationPath(l.id) : l.name]);
  return select(allowNone ? [["", "— Ingen plats —"], ...opts] : opts, value ?? "", (v) => onchange(v || null),
    { "aria-label": "Plats" });
}

/** Ett katalogförslag: omslag, titel, upplaga och källa. */
export function candidateCard(c, { onPick, picked = false } = {}) {
  return h("div.cand", { class: picked ? "picked" : "" },
    cover(c.isbn, c.title, "S"),
    h("div.book-main",
      h("strong", c.title),
      h("span.muted", [c.authors?.join(", "), c.year, c.publisher].filter(Boolean).join(" · ")),
      h("span.muted.small", [c.isbn ? `ISBN ${c.isbn}` : null, c.language].filter(Boolean).join(" · "))),
    h("div.cand-side",
      h("span.badge", { class: c.source === "libris" ? "ok" : "muted" }, SOURCE[c.source] ?? c.source),
      c.url ? h("a.small", { href: c.url, target: "_blank", rel: "noopener" }, "Visa") : null,
      onPick ? h("button.small", { onclick: () => onPick(c) }, picked ? "Vald" : "Välj") : null));
}

/**
 * Sökruta mot Libris. Löses med vald kandidat, { manual: {title, author} }
 * om man vill spara som den är, eller undefined.
 */
export function searchSheet({ title = "", author = "" } = {}) {
  return sheet((close) => {
    const t = h("input", { value: title, placeholder: "Titel", "aria-label": "Titel" });
    const a = h("input", { value: author, placeholder: "Författare (valfritt)", "aria-label": "Författare" });
    const results = h("div.stack");
    const run = async () => {
      if (!t.value.trim()) return;
      results.replaceChildren(h("p.muted", "Söker i Libris…"));
      const { candidates } = await callFn("lookup", { title: t.value, author: a.value });
      results.replaceChildren(...(candidates.length
        ? candidates.map((c) => candidateCard(c, { onPick: close }))
        : [h("p.muted", "Inga träffar. Prova kortare titel eller bara efternamnet.")]));
    };
    const form = h("form.stack", { onsubmit: (e) => { e.preventDefault(); run().catch((err) => results.replaceChildren(h("p.error", err.message))); } },
      t, a, h("div.row",
        h("button", { type: "submit" }, "Sök i Libris"),
        h("button.ghost", { type: "button", onclick: () => t.value.trim() && close({ manual: { title: t.value.trim(), author: a.value.trim() } }) },
          "Spara utan verifiering")));
    if (title) setTimeout(run, 0);
    return h("div.stack", form, results);
  }, { title: "Sök bok" });
}

/** Knapp + lista för att välja bland flera kandidater (används vid ISBN med flera poster). */
export function pickCandidate(candidates, heading = "Välj rätt upplaga") {
  if (candidates.length === 1) return Promise.resolve(candidates[0]);
  return sheet((close) => h("div.stack", candidates.map((c) => candidateCard(c, { onPick: close }))), { title: heading });
}

export { busyButton };
