// Skanna: fotografera ett hyllplan -> Claude läser ryggarna -> Libris
// verifierar -> du granskar -> appen jämför mot vad som redan står där.

import { h, mount, toast, showError, promptBox, busyButton, select } from "../lib/dom.js";
import { callFn } from "../lib/supabase.js";
import { resizeToJpeg } from "../lib/image.js";
import * as store from "../store.js";
import { CATEGORIES } from "../labels.js";
import { candidateCard, locationSelect, searchSheet } from "./widgets.js";

let currentLoc = null;

export function render(root) {
  const work = h("div.stack");
  const fileInput = h("input", {
    type: "file", accept: "image/*", capture: "environment", multiple: true, hidden: true,
    onchange: async (e) => {
      const files = [...e.target.files];
      e.target.value = "";
      for (const f of files) await processPhoto(f, work);
    },
  });

  const locRow = h("div.row");
  const drawLoc = () => mount(locRow,
    locationSelect(currentLoc, (v) => { currentLoc = v; }),
    h("button.ghost", { onclick: newBookcase }, "+ Ny bokhylla"));

  async function newBookcase() {
    const name = await promptBox("Namn på bokhyllan (t.ex. ”Vardagsrummet vänster”)");
    if (!name) return;
    const n = Number(await promptBox("Hur många hyllplan har den?", "5"));
    const bc = await store.addBookcase(name, Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 5);
    currentLoc = store.childrenOf(bc.id)[0]?.id ?? bc.id;
    drawLoc();
    toast(`${name} skapad med plan numrerade uppifrån.`, "ok");
  }

  mount(root,
    h("header.view-head", h("h1", "Skanna hylla")),
    h("section.card.stack",
      h("label", "Var står böckerna?", locRow),
      h("p.muted.small",
        "Bäst resultat: ett hyllplan per foto, rakt framifrån och i bra ljus. ",
        "Väljer du en hel bokhylla kan du fotografera flera plan på en gång — avläsningen anger planet för varje bok."),
      h("button.big", { onclick: () => fileInput.click() }, "📷 Ta foto eller välj bild"),
      fileInput),
    work,
    h("div#resume"));

  drawLoc();
  showResumable(root.querySelector("#resume"), work).catch(console.warn);
}

/** Skanningar som lästs av men aldrig sparats (t.ex. om appen stängdes). */
async function showResumable(box, work) {
  const pending = (await store.recentScans(15)).filter((s) => s.state === "review" && s.result);
  if (!pending.length) return;
  mount(box, h("section.card.stack",
    h("h2", "Ej färdiggranskade skanningar"),
    pending.map((s) => h("div.row.between",
      h("span", `${new Date(s.created_at).toLocaleString("sv-SE")} · ${store.locationPath(s.location_id)} · ${s.result.items.length} böcker`),
      h("button.small", {
        onclick: async () => {
          const url = await store.photoUrl(s.photo_path);
          box.replaceChildren();
          review(work, s, s.result, url);
        },
      }, "Fortsätt")))));
}

async function processPhoto(file, work) {
  const card = h("section.card.stack", h("p.progress", "Förbereder bilden…"));
  work.prepend(card);
  const step = (t) => card.querySelector(".progress").textContent = t;
  try {
    const blob = await resizeToJpeg(file);
    step("Laddar upp…");
    const scan = await store.uploadScan(blob, currentLoc);
    step("Läser av bokryggarna och slår upp dem i Libris… (brukar ta 20–60 sekunder)");
    const result = await callFn("analyze", { scan_id: scan.id });
    card.remove();
    review(work, scan, result, URL.createObjectURL(blob));
  } catch (e) {
    mount(card, h("p.error", "Avläsningen misslyckades: " + e.message),
      h("button.ghost", { onclick: () => card.remove() }, "Stäng"));
    showError(e, "Skanningen misslyckades");
  }
}

// ---------------------------------------------------------------------------
// Granskning
// ---------------------------------------------------------------------------

function review(container, scan, result, photoSrc) {
  const box = h("section.card.stack.review");
  container.prepend(box);
  const baseLoc = scan.location_id;

  // Ett beslut per avläst bok.
  const items = result.items.map((it, i) => {
    const best = it.candidates[0] ?? null;
    const usable = it.reading.is_book && it.reading.title;
    return {
      ...it,
      i,
      include: usable && (!!best || !it.reading.uncertain),
      chosen: best && (it.confident || (best.score ?? 0) >= 0.6) ? best : null, // null = spara som avläst
      category: it.reading.category,
      mode: "move",
    };
  });

  // Hela bokhyllan på ett foto: rad n -> plan n.
  const targetFor = (it) => {
    const base = store.locationById(baseLoc);
    if (base && base.kind === "bookcase") {
      const planes = store.childrenOf(base.id);
      return planes[it.reading.row - 1]?.id ?? base.id;
    }
    return baseLoc;
  };

  const asCandidate = (it) => it.chosen ?? {
    source: "ai", title: it.reading.title, authors: it.reading.author ? [it.reading.author] : [],
  };

  /** Matcha avläsningarna mot exemplar som redan finns. */
  function resolveClaims() {
    const claimed = new Set();
    for (const it of items) {
      it.existing = null; it.claim = null; it.target = targetFor(it);
      if (!it.include) continue;
      const w = store.findWork(asCandidate(it));
      if (!w) continue;
      it.existing = w;
      const cs = store.copiesOf(w.id).filter((c) => !claimed.has(c.id));
      const here = cs.find((c) => c.location_id === it.target);
      const elsewhere = cs.find((c) => c.status === "away") ?? cs.find((c) => c.status === "shelf");
      it.claim = here ?? (it.mode === "move" ? elsewhere ?? null : null);
      if (it.claim) claimed.add(it.claim.id);
    }
    const targets = new Set(items.filter((i) => i.include).map((i) => i.target).filter(Boolean));
    if (baseLoc) targets.add(baseLoc);
    return [...targets].flatMap((t) => store.copiesAt(t))
      .filter((c) => c.status === "shelf" && !claimed.has(c.id));
  }

  const missingDecision = new Map(); // copy_id -> "keep" | "away"

  const draw = () => {
    const missing = resolveClaims();
    const n = items.filter((i) => i.include).length;
    const sure = items.filter((i) => i.include && i.chosen && i.confident).length;

    mount(box,
      h("div.review-head",
        photoSrc ? h("img.scan-photo", { src: photoSrc, alt: "Hyllfotot", onclick: () => window.open(photoSrc, "_blank") }) : null,
        h("div.stack",
          h("h2", `${result.items.length} saker på fotot`),
          h("p.muted", `${store.locationPath(baseLoc)} · ${sure} säkra Libris-träffar, ${n - sure} att kontrollera`),
          result.note ? h("p.small.muted", result.note) : null)),
      h("div.stack", items.map(itemCard)),
      missing.length ? h("div.stack.missing",
        h("h3", `${missing.length} böcker som borde stå här syns inte på fotot`),
        h("p.muted.small", "De kan vara skymda, utlånade eller flyttade."),
        missing.map((c) => {
          const w = store.state.works.get(c.work_id);
          return h("div.row.between",
            h("span", w?.title ?? "?"),
            select([["keep", "Låt stå kvar"], ["away", "Markera: okänd plats"]],
              missingDecision.get(c.id) ?? "keep", (v) => missingDecision.set(c.id, v)));
        })) : null,
      h("div.row.end.sticky-actions",
        h("button.ghost", { onclick: () => box.remove() }, "Spara inte"),
        busyButton(`Spara ${n} böcker`, save, { busyLabel: "Sparar…" })));
  };

  function itemCard(it) {
    const r = it.reading;
    const status = !r.is_book ? h("span.badge.muted", "Inte en bok")
      : it.chosen && it.confident ? h("span.badge.ok", "✓ Säker träff")
      : it.chosen ? h("span.badge.warn", "Kontrollera")
      : h("span.badge.warn", "Ej verifierad");

    const altOptions = [
      ...it.candidates.map((c, k) => [String(k), `${c.title.slice(0, 50)}${c.year ? ` (${c.year})` : ""} – ${c.source === "libris" ? "Libris" : "OL"}`]),
      ["reading", "Spara som avläst, utan verifiering"],
      ["search", "Sök i Libris…"],
    ];
    const curIdx = it.chosen ? it.candidates.indexOf(it.chosen) : -1;
    const cur = it.chosen ? (curIdx >= 0 ? String(curIdx) : "custom") : "reading";
    if (cur === "custom") altOptions.unshift(["custom", `${it.chosen.title} (vald via sökning)`]);

    let existingLine = null;
    if (it.include && it.existing) {
      existingLine = it.claim && it.claim.location_id === it.target
        ? h("p.small.ok-text", "Står redan här — markeras som sedd.")
        : it.claim
          ? h("p.small.notice", `Finns i samlingen på ${store.locationPath(it.claim.location_id)}. `,
              h("button.link", { onclick: () => { it.mode = "new"; draw(); } }, "Nytt exemplar i stället"))
          : h("p.small.notice", "Finns redan i samlingen — sparas som ytterligare ett exemplar.",
              it.mode === "new" ? h("button.link", { onclick: () => { it.mode = "move"; draw(); } }, " Flytta befintligt hit") : null);
    }

    return h("div.item", { class: it.include ? "" : "excluded" },
      h("div.row.between",
        h("label.check",
          h("input", { type: "checkbox", checked: it.include, onchange: (e) => { it.include = e.target.checked; draw(); } }),
          h("span.muted.small", `#${it.i + 1}${r.row > 1 ? ` · plan ${r.row}` : ""} · ”${r.spine_text || r.title}”`)),
        status),
      it.include ? [
        it.chosen ? candidateCard(it.chosen)
          : h("div.cand", h("div.cover.placeholder", "?"), h("div.book-main", h("strong", r.title || "(oläslig)"), h("span.muted", r.author))),
        h("div.row.wrap",
          select(altOptions, cur, async (v) => {
            if (v === "search") {
              const c = await searchSheet({ title: r.title, author: r.author });
              if (c?.manual) { it.chosen = null; r.title = c.manual.title; r.author = c.manual.author; }
              else if (c) { it.chosen = c; it.confident = true; }
            } else if (v === "reading") it.chosen = null;
            else if (v !== "custom") it.chosen = it.candidates[Number(v)];
            draw();
          }, { "aria-label": "Välj träff" }),
          it.existing ? null : select(CATEGORIES.map((c) => [c, c]), it.category, (v) => { it.category = v; }, { "aria-label": "Kategori" })),
        existingLine,
      ] : null);
  }

  async function save() {
    resolveClaims();
    const pos = new Map();
    let created = 0, moved = 0, seen = 0;
    const now = new Date().toISOString();

    for (const it of items.filter((x) => x.include)) {
      const p = (pos.get(it.target) ?? 0) + 1;
      pos.set(it.target, p);
      const work = it.existing ?? await store.createWork(asCandidate(it), it.category);
      if (it.claim) {
        if (it.claim.location_id === it.target) seen++; else moved++;
        await store.updateCopy(it.claim.id, { location_id: it.target, position: p, status: "shelf", lent_to: null, seen_at: now });
      } else {
        created++;
        await store.addCopy(work.id, it.target, { position: p, seen_at: now });
      }
    }
    const away = [...missingDecision].filter(([, v]) => v === "away").map(([id]) => ({ id, status: "away" }));
    if (away.length) await store.updateCopies(away);
    await store.markScanDone(scan.id);

    box.remove();
    toast([created && `${created} nya`, moved && `${moved} flyttade`, seen && `${seen} bekräftade`, away.length && `${away.length} saknas`]
      .filter(Boolean).join(", ") || "Sparat", "ok", 6000);
  }

  draw();
}

