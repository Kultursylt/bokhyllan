// Verifiering mot riktiga bokkataloger: Libris först (KB:s nationella
// katalog, bäst för svenska böcker), Open Library som reserv för utländska.
//
// Filen använder inga Deno-specifika API:er så att den kan testas med Node.

export interface Candidate {
  source: "libris" | "openlibrary";
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  language: string | null;
  isbn: string | null;
  libris_id: string | null;
  url: string | null;
  score?: number;
}

export interface Reading {
  title: string;
  author: string;
}

// ---------------------------------------------------------------------------
// ISBN
// ---------------------------------------------------------------------------

/** Plockar ut första giltiga ISBN ur fri text och returnerar det som ISBN-13. */
export function cleanIsbn(raw: unknown): string | null {
  const values = Array.isArray(raw) ? raw : [raw];
  for (const v of values) {
    if (typeof v !== "string") continue;
    for (const m of v.toUpperCase().matchAll(/[0-9X][0-9X\- ]{8,16}[0-9X]/g)) {
      const s = m[0].replace(/[- ]/g, "");
      if (s.length === 13 && isValid13(s)) return s;
      if (s.length === 10 && isValid10(s)) return to13(s);
    }
  }
  return null;
}

function isValid13(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  const sum = [...s].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}

function isValid10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  const sum = [...s].reduce((a, c, i) => a + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
  return sum % 11 === 0;
}

function to13(isbn10: string): string {
  const base = "978" + isbn10.slice(0, 9);
  const sum = [...base].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return base + ((10 - (sum % 10)) % 10);
}

// ---------------------------------------------------------------------------
// Libris Xsearch
// ---------------------------------------------------------------------------

const LIBRIS = "https://libris.kb.se/xsearch";

const first = (v: unknown): string | null =>
  Array.isArray(v) ? (v.find((x) => typeof x === "string") ?? null) : typeof v === "string" ? v : null;

const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v]).filter((x): x is string => typeof x === "string");

/** "Strindberg, August, 1849-1912" -> "August Strindberg" */
export function personName(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim()).filter((s) => s && !/\d/.test(s));
  if (parts.length >= 2) return `${parts[1]} ${parts[0]}`.replace(/\s+/g, " ").trim();
  return (parts[0] ?? raw).replace(/\s*\d{4}-?(\d{4})?\s*$/, "").trim();
}

/** "Röda rummet : skildringar ur artist- och författarlivet / August Strindberg" -> huvudtitel + undertitel */
export function cleanTitle(raw: string): string {
  return raw.split(" / ")[0].replace(/\s*[:;/]\s*$/, "").replace(/\s+/g, " ").trim();
}

// deno-lint-ignore no-explicit-any
export function fromLibris(item: any): Candidate | null {
  const title = first(item?.title);
  if (!title) return null;
  const id = first(item?.identifier);
  const libris_id = id ? id.replace(/\/$/, "").split("/").pop() ?? null : null;
  const yearMatch = (first(item?.date) ?? "").match(/\d{4}/);
  return {
    source: "libris",
    title: cleanTitle(title),
    authors: asList(item?.creator).map(personName).filter(Boolean),
    year: yearMatch ? Number(yearMatch[0]) : null,
    publisher: first(item?.publisher),
    language: first(item?.language),
    isbn: cleanIsbn(item?.isbn),
    libris_id,
    url: libris_id ? `https://libris.kb.se/bib/${libris_id}` : id,
  };
}

// deno-lint-ignore no-explicit-any
export function parseLibris(data: any): Candidate[] {
  const list = data?.xsearch?.list;
  if (!Array.isArray(list)) return [];
  return list
    .filter((it) => !it?.type || /book|bok|text/i.test(String(first(it.type) ?? "")))
    .map(fromLibris)
    .filter((c): c is Candidate => c !== null);
}

export async function searchLibris(query: string, n = 8): Promise<Candidate[]> {
  const url = `${LIBRIS}?query=${encodeURIComponent(query)}&format=json&n=${n}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  try {
    return parseLibris(await res.json());
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Open Library (reserv)
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
export function fromOpenLibrary(doc: any): Candidate | null {
  if (!doc?.title) return null;
  return {
    source: "openlibrary",
    title: String(doc.title),
    authors: asList(doc.author_name),
    year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
    publisher: first(doc.publisher),
    language: first(doc.language),
    isbn: cleanIsbn(doc.isbn),
    libris_id: null,
    url: doc.key ? `https://openlibrary.org${doc.key}` : null,
  };
}

export async function searchOpenLibrary(params: Record<string, string>, n = 5): Promise<Candidate[]> {
  const qs = new URLSearchParams({
    ...params,
    limit: String(n),
    fields: "key,title,author_name,first_publish_year,publisher,language,isbn",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${qs}`);
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return (data?.docs ?? []).map(fromOpenLibrary).filter((c: Candidate | null) => c !== null);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Matchning: hur väl stämmer en katalogpost med det som lästes av på ryggen?
// ---------------------------------------------------------------------------

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Dice-koefficient på teckenpar, 0..1. Tål stavfel och avläsningsfel. */
export function similarity(a: string, b: string): number {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x), B = bigrams(y);
  let overlap = 0, total = 0;
  for (const [g, n] of A) { overlap += Math.min(n, B.get(g) ?? 0); total += n; }
  for (const n of B.values()) total += n;
  return (2 * overlap) / total;
}

export function score(reading: Reading, c: Candidate): number {
  const full = similarity(reading.title, c.title);
  // Ryggen har ofta bara huvudtiteln; katalogen har undertitel efter kolon.
  const main = similarity(reading.title, c.title.split(/ [:;] /)[0]);
  const t = Math.max(full, main);
  if (!reading.author.trim()) return t;
  const a = c.authors.length
    ? Math.max(...c.authors.map((au) => Math.max(
        similarity(reading.author, au),
        // efternamnet ensamt räcker ofta på en rygg
        similarity(reading.author.split(" ").pop() ?? "", au.split(" ").pop() ?? ""),
      )))
    : 0;
  return 0.7 * t + 0.3 * a;
}

/** Säker nog att godta utan att fråga? */
export function isConfident(ranked: Candidate[]): boolean {
  const [best, next] = ranked;
  if (!best || (best.score ?? 0) < 0.82) return false;
  // Samma bok i flera upplagor är ok — tvekan gäller bara olika böcker.
  const mainTitle = (c: Candidate) => norm(c.title.split(/ [:;] /)[0]);
  if (next && mainTitle(next) !== mainTitle(best) && (best.score ?? 0) - (next.score ?? 0) < 0.08) return false;
  return true;
}

function dedupe(list: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = c.isbn ?? c.libris_id ?? `${norm(c.title)}|${norm(c.authors[0] ?? "")}|${c.year}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Hittar och rangordnar kandidater för en avläst bokrygg. */
export async function findCandidates(reading: Reading, max = 5): Promise<Candidate[]> {
  const words = (s: string) => norm(s).split(" ").filter((w) => w.length > 1).slice(0, 8).join(" ");
  const t = words(reading.title);
  const a = words(reading.author).split(" ").pop() ?? "";
  if (!t) return [];

  let found = await searchLibris(a ? `${t} ${a}` : t);
  if (found.length === 0 && a) found = await searchLibris(t);
  if (found.length === 0) {
    found = await searchOpenLibrary(a ? { title: reading.title, author: reading.author } : { title: reading.title });
  }
  return dedupe(found.map((c) => ({ ...c, score: Math.round(score(reading, c) * 100) / 100 })))
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
    .slice(0, max);
}

export async function findByIsbn(isbn: string): Promise<Candidate[]> {
  const clean = cleanIsbn(isbn);
  if (!clean) return [];
  const libris = await searchLibris(`isbn:${clean}`, 3);
  if (libris.length) return libris.map((c) => ({ ...c, isbn: c.isbn ?? clean, score: 1 }));
  const ol = await searchOpenLibrary({ isbn: clean }, 1);
  return ol.map((c) => ({ ...c, isbn: clean, score: 1 }));
}
