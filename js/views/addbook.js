// "Lägg till": en enstaka bok via ISBN-skanning eller Libris-sökning.

import { h, sheet, toast, showError } from "../lib/dom.js";
import { callFn } from "../lib/supabase.js";
import { scanIsbn, hasDetector } from "../lib/barcode.js";
import * as store from "../store.js";
import { CATEGORIES } from "../labels.js";
import { searchSheet, pickCandidate, locationSelect, candidateCard } from "./widgets.js";

let lastLocation = null;

export async function addBookFlow() {
  try {
    const how = await sheet((close) => h("div.stack",
      h("button.big", { onclick: () => close("isbn") }, hasDetector ? "📷 Skanna streckkoden (ISBN)" : "Skriv in ISBN"),
      h("button.big.ghost", { onclick: () => close("search") }, "🔎 Sök på titel och författare"),
      h("p.muted.small", "För många böcker på en gång: använd Skanna och fotografera hela hyllplanet.")),
      { title: "Lägg till bok" });
    if (!how) return;

    let cand;
    if (how === "isbn") {
      const isbn = await scanIsbn();
      if (!isbn) return;
      toast("Slår upp " + isbn + "…");
      const { candidates } = await callFn("lookup", { isbn });
      if (!candidates.length) {
        toast("ISBN hittades varken i Libris eller Open Library — sök på titel i stället.", "warn", 6000);
        cand = await searchSheet();
      } else {
        cand = await pickCandidate(candidates);
      }
    } else {
      cand = await searchSheet();
    }
    if (!cand) return;
    if (cand.manual) cand = { source: "manual", title: cand.manual.title, authors: cand.manual.author ? [cand.manual.author] : [] };

    await confirmAndSave(cand);
  } catch (e) {
    showError(e);
  }
}

async function confirmAndSave(cand) {
  const existing = store.findWork(cand);
  let loc = lastLocation;
  let cat = existing?.category ?? "Skönlitteratur";

  const ok = await sheet((close) => h("div.stack",
    candidateCard(cand),
    existing ? h("p.notice", `Finns redan i samlingen (${store.copiesOf(existing.id).length} ex). Ett nytt exemplar läggs till.`) : null,
    h("label", "Plats", locationSelect(loc, (v) => { loc = v; })),
    existing ? null : h("label", "Kategori", h("select", { onchange: (e) => { cat = e.target.value; } },
      CATEGORIES.map((c) => h("option", { selected: c === cat }, c)))),
    h("div.row.end", h("button", { onclick: () => close(true) }, "Spara"))), { title: "Spara bok" });
  if (!ok) return;

  const work = existing ?? await store.createWork(cand, cat);
  await store.addCopy(work.id, loc);
  lastLocation = loc;
  toast(`”${work.title}” sparad.`, "ok");
}
