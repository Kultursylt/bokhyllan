// Ren logik för "Ordna": ingen DOM, ingen databas — så den kan testas för sig.

const collator = new Intl.Collator("sv", { sensitivity: "base", numeric: true });

/** Efternamn först för sortering: "August Strindberg" -> "Strindberg August" */
export function authorKey(authors = []) {
  const a = (authors[0] ?? "").trim();
  if (!a) return "￿"; // böcker utan författare sist
  const parts = a.split(/\s+/);
  return parts.length > 1 ? `${parts.at(-1)} ${parts.slice(0, -1).join(" ")}` : a;
}

const titleKey = (t = "") => t.replace(/^(the|a|an|en|ett|den|det|der|die|das|le|la|les) /i, "");

export const PRINCIPLES = {
  "kategori-forfattare": {
    label: "Kategori, sedan författare",
    key: (w) => [w.category || "Övrigt", authorKey(w.authors), titleKey(w.title)],
    group: (w) => w.category || "Övrigt",
  },
  "forfattare": {
    label: "Författare A–Ö",
    key: (w) => [authorKey(w.authors), titleKey(w.title)],
    group: (w) => (authorKey(w.authors)[0] ?? "#").toUpperCase(),
  },
  "sprak-kategori": {
    label: "Språk, sedan kategori och författare",
    key: (w) => [languageLabel(w.language), w.category || "Övrigt", authorKey(w.authors), titleKey(w.title)],
    group: (w) => `${languageLabel(w.language)} · ${w.category || "Övrigt"}`,
  },
  "titel": {
    label: "Titel A–Ö",
    key: (w) => [titleKey(w.title)],
    group: (w) => (titleKey(w.title)[0] ?? "#").toUpperCase(),
  },
};

export function languageLabel(code) {
  const map = { swe: "Svenska", eng: "Engelska", nor: "Norska", nob: "Norska", dan: "Danska",
    fin: "Finska", ger: "Tyska", deu: "Tyska", fre: "Franska", fra: "Franska", spa: "Spanska" };
  return map[(code ?? "").toLowerCase()] ?? (code ? code : "Okänt språk");
}

function compareKeys(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const c = collator.compare(String(a[i] ?? ""), String(b[i] ?? ""));
    if (c) return c;
  }
  return 0;
}

/**
 * Föreslår en ny ordning.
 * items:  [{ copy, work }]   — exemplaren som ska ordnas
 * shelves: [{ id, capacity }] — hyllplanen i läsordning (bokhylla för bokhylla, uppifrån)
 * Fyller planen i tur och ordning efter vald princip. En grupp (t.ex. en
 * kategori) får hellre börja på ett nytt plan än delas, om den då ryms där.
 *
 * Returnerar { plan: [{ shelfId, items, groups }], overflow: [...], moves: [...] }
 */
export function planLayout(items, shelves, principleId = "kategori-forfattare") {
  const P = PRINCIPLES[principleId] ?? PRINCIPLES["kategori-forfattare"];
  const sorted = [...items].sort((x, y) => compareKeys(P.key(x.work), P.key(y.work)));

  // Dela upp i grupper i sorteringsordning.
  const groups = [];
  for (const it of sorted) {
    const g = P.group(it.work);
    if (!groups.length || groups.at(-1).name !== g) groups.push({ name: g, items: [] });
    groups.at(-1).items.push(it);
  }

  const plan = shelves.map((s) => ({ shelfId: s.id, capacity: Math.max(1, s.capacity || 1), items: [], groups: [] }));
  const overflow = [];
  let si = 0;

  for (const g of groups) {
    let rest = g.items;
    while (rest.length) {
      if (si >= plan.length) { overflow.push(...rest); rest = []; break; }
      const shelf = plan[si];
      const free = shelf.capacity - shelf.items.length;
      // Påbörjat plan och gruppen ryms helt på nästa: hoppa hellre till nästa plan
      // (men bara om vi inte lämnar mer än halva planet tomt).
      const next = plan[si + 1];
      if (shelf.items.length > 0 && rest.length > free && next && rest.length <= next.capacity &&
          free < shelf.capacity / 2) {
        si++;
        continue;
      }
      if (free <= 0) { si++; continue; }
      const take = rest.slice(0, free);
      rest = rest.slice(free);
      shelf.items.push(...take);
      if (!shelf.groups.includes(g.name)) shelf.groups.push(g.name);
      if (shelf.items.length >= shelf.capacity) si++;
    }
  }

  const moves = [];
  for (const p of plan) {
    for (const it of p.items) {
      if (it.copy.location_id !== p.shelfId) moves.push({ copy: it.copy, work: it.work, from: it.copy.location_id, to: p.shelfId });
    }
  }
  return { plan, overflow, moves };
}

/** Ungefärlig kapacitet för ett plan: angiven, annars dagens antal + 15 % luft (minst 10). */
export function estimateCapacity(shelf, currentCount) {
  if (shelf.capacity) return shelf.capacity;
  return Math.max(10, Math.ceil(currentCount * 1.15));
}
