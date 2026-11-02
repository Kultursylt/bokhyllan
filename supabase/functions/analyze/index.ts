// Läser av bokryggarna på ett hyllfoto och verifierar varje bok mot Libris.
//
// POST { scan_id: uuid, categories?: string[] }
// Svar: { note, items: [{ reading, candidates, confident }] }
//
// Claude läser bara av vad som står på ryggarna. Vilken bok det faktiskt är
// avgörs av katalogen (Libris, annars Open Library) — inte av modellens minne.

import { asCaller, HttpError, json, serve } from "../_shared/http.ts";
import { claude, imageBlock, toolInput } from "../_shared/claude.ts";
import { Candidate, findCandidates, isConfident } from "../_shared/catalog.ts";

const DEFAULT_CATEGORIES = [
  "Skönlitteratur", "Deckare & spänning", "Poesi & dramatik", "Barn & unga", "Serier",
  "Biografier & memoarer", "Historia", "Samhälle & politik", "Filosofi & religion",
  "Psykologi", "Naturvetenskap", "Teknik & data", "Konst, design & foto", "Musik & film",
  "Mat & dryck", "Resor & geografi", "Språk & ordböcker", "Ekonomi & företag",
  "Hälsa & träning", "Hus, hem & trädgård", "Kurslitteratur", "Uppslagsverk", "Övrigt",
];

const PROMPT = (cats: string[]) => `Du tittar på ett foto av ett hyllplan, en bokhög eller en hel bokhylla.

Uppgift: skriv av exakt vad som står på varje bokrygg. Du ska INTE avgöra vilken
upplaga det är eller hitta på något — det görs efteråt mot Libris.

Orientering: mobilkameror sparar ofta bilden vriden 90 grader. Låt ryggtexten
avgöra vad som är upp. Böcker som ser ut att ligga i en stapel står då i själva
verket sida vid sida.

Ordning: lista böckerna i deras fysiska ordning — stående böcker från vänster till
höger, en liggande stapel uppifrån och ned. Om fotot visar flera hyllplan, ange
för varje bok vilket plan den står på (row: 1 = översta synliga planet).

För varje bok:
- spine_text: allt läsbart på ryggen, ordagrant (titel, författare, förlag).
- title: titeln. Utelämna undertitel om ryggen är trång.
- author: författarens namn som det står, annars tom sträng.
- category: EN kategori ur listan: ${cats.join(", ")}.
- row: hyllplanets nummer (1 om bara ett plan syns).
- uncertain: true om ryggen är svårläst, delvis skymd, eller titeln delvis gissad.
- is_book: false för föremål som inte är böcker (kortlekar, pärmar, spel, prydnader).

Räkna varje bok en gång — skuggor och tunna mellanrum är inte böcker.
Gissa aldrig en titel du inte kan läsa: skriv det du ser och sätt uncertain: true.

I note: kort om bilden (orientering, skymda eller avskurna partier, tips för ett
bättre foto om något var oläsligt).`;

const TOOL = {
  name: "report_books",
  description: "Rapportera böckerna som syns på fotot.",
  input_schema: {
    type: "object",
    properties: {
      note: { type: "string" },
      books: {
        type: "array",
        items: {
          type: "object",
          properties: {
            spine_text: { type: "string" },
            title: { type: "string" },
            author: { type: "string" },
            category: { type: "string" },
            row: { type: "integer" },
            uncertain: { type: "boolean" },
            is_book: { type: "boolean" },
          },
          required: ["spine_text", "title", "author", "category", "row", "uncertain", "is_book"],
        },
      },
    },
    required: ["note", "books"],
  },
};

/** Kör asynkrona jobb med begränsad samtidighet så Libris inte överbelastas. */
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

serve(async (req, body) => {
  const scanId = String(body.scan_id ?? "");
  if (!scanId) throw new HttpError(400, "scan_id saknas.");
  const cats = Array.isArray(body.categories) && body.categories.length
    ? (body.categories as unknown[]).map(String).slice(0, 60)
    : DEFAULT_CATEGORIES;

  const { sb } = await asCaller(req);

  // RLS: raden syns bara om den inloggade är medlem i skanningens bibliotek.
  const { data: scan, error } = await sb.from("scans").select("id, photo_path").eq("id", scanId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!scan) throw new HttpError(404, "Hittar ingen sådan skanning i ditt bibliotek.");

  await sb.from("scans").update({ state: "analyzing", error: null }).eq("id", scanId);

  try {
    const { data: file, error: dlErr } = await sb.storage.from("photos").download(scan.photo_path);
    if (dlErr || !file) throw new Error("Kunde inte hämta fotot: " + (dlErr?.message ?? "okänt fel"));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";

    const response = await claude({
      max_tokens: 8000,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{
        role: "user",
        content: [imageBlock(bytes, mediaType), { type: "text", text: PROMPT(cats) }],
      }],
    });
    const out = toolInput(response, TOOL.name);
    if (!out) throw new Error("Avläsningen gav inget resultat.");

    // deno-lint-ignore no-explicit-any
    const books: any[] = Array.isArray(out.books) ? out.books : [];
    const items = await pool(books, 5, async (b) => {
      const reading = {
        spine_text: String(b.spine_text ?? ""),
        title: String(b.title ?? "").trim(),
        author: String(b.author ?? "").trim(),
        category: cats.includes(b.category) ? b.category : "Övrigt",
        row: Number.isInteger(b.row) && b.row > 0 ? b.row : 1,
        uncertain: !!b.uncertain,
        is_book: b.is_book !== false,
      };
      let candidates: Candidate[] = [];
      if (reading.is_book && reading.title) {
        try {
          candidates = await findCandidates(reading);
        } catch (e) {
          console.warn("katalogsökning", reading.title, e);
        }
      }
      return { reading, candidates, confident: !reading.uncertain && isConfident(candidates) };
    });

    const result = { note: String(out.note ?? ""), items, model: response.model };
    await sb.from("scans").update({ state: "review", result }).eq("id", scanId);
    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("scans").update({ state: "error", error: msg }).eq("id", scanId);
    throw e;
  }
});
