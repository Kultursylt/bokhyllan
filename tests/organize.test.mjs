import { planLayout, authorKey } from "../js/organize.js";
let fail = 0; const ok = (n, c) => { if (!c) fail++; console.log(c ? "✓" : "✗", n); };
const W = (title, author, category) => ({ title, authors: author ? [author] : [], category });
const items = [
  ["Röda rummet", "August Strindberg", "Skönlitteratur", "A"],
  ["Gösta Berlings saga", "Selma Lagerlöf", "Skönlitteratur", "B"],
  ["Mördaren i Stockholm", "Henning Mankell", "Deckare & spänning", "A"],
  ["Hundra år av ensamhet", "Gabriel García Márquez", "Skönlitteratur", "B"],
  ["Sapiens", "Yuval Noah Harari", "Historia", "A"],
  ["Dagens Ö", "Örjan Åberg", "Skönlitteratur", "A"],
].map(([t, a, c, loc], i) => ({ copy: { id: "c" + i, location_id: loc }, work: W(t, a, c) }));

ok("efternamn först", authorKey(["August Strindberg"]) === "Strindberg August");
const { plan, overflow, moves } = planLayout(items, [{ id: "A", capacity: 3 }, { id: "B", capacity: 4 }], "kategori-forfattare");
const names = plan.map(p => p.items.map(i => i.work.title));
console.log("  ", JSON.stringify(names));
ok("deckare först (D före H, S)", names[0][0] === "Mördaren i Stockholm");
ok("Åberg sist bland skönlitteratur (svensk sortering)", names.flat().at(-1) === "Dagens Ö");
ok("inget överskott", overflow.length === 0);
ok("flyttlista bara för de som byter plan", moves.every(m => m.from !== m.to));
const tight = planLayout(items, [{ id: "A", capacity: 2 }, { id: "B", capacity: 2 }], "forfattare");
ok("överskott när det inte ryms", tight.overflow.length === 2);
process.exit(fail ? 1 : 0);
