// Värde: vad samlingen är värd begagnad och vilka böcker som är värda att sälja.

import { h, mount, select, kr, cover, toast } from "../lib/dom.js";
import { callFn } from "../lib/supabase.js";
import * as store from "../store.js";
import { authorsText } from "../labels.js";

const opts = { show: "all", batch: "10" };
let running = false;

export function render(root) {
  const progress = h("p.progress");

  const draw = () => {
    const owned = store.works().filter((w) => store.copiesOf(w.id).some((c) => c.status !== "sold" && c.status !== "gone"));
    const valued = owned.filter((w) => store.state.valuations.has(w.id));
    const notValued = owned.filter((w) => !store.state.valuations.has(w.id));
    const sum = (k) => valued.reduce((a, w) => a + (store.state.valuations.get(w.id)[k] ?? 0), 0);

    let rows = valued.map((w) => ({ w, v: store.state.valuations.get(w.id) }));
    if (opts.show === "sell") rows = rows.filter(({ v }) => v.high >= 100 && v.best_channel !== "Ej värd att sälja");
    rows.sort((a, b) => b.v.high - a.v.high);

    mount(root,
      h("header.view-head", h("h1", "Värde")),
      h("section.stats",
        h("div.stat", h("strong", valued.length ? `${kr(sum("low"))}–${kr(sum("high"))}` : "–"), h("span", `uppskattat för ${valued.length} böcker`)),
        h("div.stat", h("strong", String(notValued.length)), h("span", "ej värderade"))),
      h("section.card.stack",
        h("h2", "Värdera fler"),
        h("p.muted.small",
          "Varje bok söks upp på Bokbörsen, Antikvariat.net, Studentapan, Tradera m.fl. Kostar ungefär 0,50–1 kr per bok i API-avgift. ",
          "Tips: börja med kurslitteratur, äldre böcker och dubbletter."),
        h("div.row",
          select([["5", "5 böcker"], ["10", "10 böcker"], ["25", "25 böcker"]], opts.batch, (v) => { opts.batch = v; }),
          h("button", { disabled: running || !notValued.length, onclick: () => runBatch(notValued, draw, progress) },
            running ? "Värderar…" : "Starta")),
        progress),
      h("div.row",
        select([["all", "Alla värderade"], ["sell", "Värda att sälja (100 kr+)"]], opts.show, (v) => { opts.show = v; draw(); })),
      h("div.list", rows.map(({ w, v }) => h("a.book-row", { href: `#/bok/${w.id}` },
        cover(w.isbn, w.title, "S"),
        h("div.book-main",
          h("strong", w.title),
          h("span.muted", authorsText(w)),
          h("span.small", `${v.best_channel} · säkerhet ${v.confidence}`)),
        h("div.price", v.high > 0 ? `${v.low}–${v.high} kr` : "–")))));
  };

  draw();
  return store.onChange(() => { if (!running) draw(); });
}

async function runBatch(candidates, draw, progress) {
  // Prioritera böcker där ett värde är troligast: dubbletter, äldre, kurslitteratur.
  const prio = (w) => (store.copiesOf(w.id).length > 1 ? 2 : 0) + (w.category === "Kurslitteratur" ? 2 : 0) +
    (w.year && w.year < 1970 ? 1 : 0) + (w.verified ? 1 : 0);
  const list = [...candidates].sort((a, b) => prio(b) - prio(a)).slice(0, Number(opts.batch));
  running = true;
  draw();
  let ok = 0;
  for (const [i, w] of list.entries()) {
    progress.textContent = `${i + 1}/${list.length}: ${w.title}…`;
    try {
      store.rememberValuation(await callFn("valuate", { work_id: w.id }));
      ok++;
    } catch (e) {
      toast(`${w.title}: ${e.message}`, "error", 6000);
      if (/ANTHROPIC|svarar inte|401|credit/i.test(e.message)) break;
    }
  }
  running = false;
  progress.textContent = `Klart: ${ok} av ${list.length} värderade.`;
  draw();
}
