import * as c from "../supabase/functions/_shared/catalog.ts";
let fail = 0; const eq = (name: string, a: unknown, b: unknown) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(ok ? "✓" : "✗", name, ok ? "" : `fick ${JSON.stringify(a)} väntade ${JSON.stringify(b)}`); };

eq("ISBN-10 -> 13", c.cleanIsbn("91-0-012345-X (inb.)"), null);
eq("ISBN-10 giltigt", c.cleanIsbn("0-306-40615-2"), "9780306406157");
eq("ISBN-13 med streck", c.cleanIsbn(["978-0-306-40615-7 (inb.)"]), "9780306406157");
eq("ogiltigt", c.cleanIsbn("1234567890123"), null);
eq("personnamn", c.personName("Strindberg, August, 1849-1912"), "August Strindberg");
eq("personnamn enkelt", c.personName("Lagerlöf, Selma"), "Selma Lagerlöf");
eq("titelstädning", c.cleanTitle("Röda rummet : skildringar ur artist- och författarlivet / August Strindberg"), "Röda rummet : skildringar ur artist- och författarlivet");

// Simulerat Libris-svar i Xsearch-format (fält både som strängar och listor)
const fake = { xsearch: { records: 3, list: [
  { identifier: "http://libris.kb.se/bib/8234133", title: "Röda rummet : skildringar ur artist- och författarlivet / August Strindberg", creator: "Strindberg, August, 1849-1912", date: "1981", publisher: "Bonnier", isbn: "9100562184", language: "swe", type: "book" },
  { identifier: "http://libris.kb.se/bib/123", title: "Röda rummet", creator: ["Strindberg, August"], date: "[2012]", isbn: ["9789174290000 (inb.)"], type: "book" },
  { identifier: "http://libris.kb.se/bib/999", title: "Det röda rummet i litteraturen", creator: "Svensson, Anna", date: "2004", type: "book" },
  { identifier: "http://libris.kb.se/bib/555", title: "Röda rummet", type: "sound recording" },
]}};
const parsed = c.parseLibris(fake);
eq("filtrerar bort ljudbok", parsed.length, 3);
eq("libris-id", parsed[0].libris_id, "8234133");
eq("år ur [2012]", parsed[1].year, 2012);
eq("författare", parsed[0].authors, ["August Strindberg"]);

const reading = { title: "Röda rummet", author: "Strindberg" };
const ranked = parsed.map(p => ({ ...p, score: c.score(reading, p) })).sort((a, b) => b.score - a.score);
console.log("  poäng:", ranked.map(r => `${r.title.slice(0,30)}=${r.score.toFixed(2)}`).join(" | "));
eq("rätt bok överst", ranked[0].title.startsWith("Röda rummet"), true);
eq("säker (två upplagor av samma bok)", c.isConfident(ranked), true);

// Avläsningsfel på ryggen
const ocr = { title: "Roda rumet", author: "Strindbrg" };
eq("tål stavfel", c.score(ocr, parsed[0]) > 0.7, true);
// Fel bok ska inte bli säker
const wrong = [{ ...parsed[2], score: c.score({ title: "Röda rummet", author: "Strindberg" }, parsed[2]) }];
eq("fel bok ej säker", c.isConfident(wrong), false);
console.log(fail ? `${fail} FEL` : "Alla katalogtester gröna");
process.exit(fail ? 1 : 0);
