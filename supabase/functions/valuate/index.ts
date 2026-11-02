// Uppskattar begagnatvärdet på en bok med webbsökning — i första hand på
// Bokbörsen och andra antikvariat — och sparar resultatet med källor.
//
// Ingen fast sajtlista skickas till sökverktyget: om en enda sajt i en sådan
// lista inte får läsas av Anthropics sökning avvisas hela anropet. Prioriteringen
// sköts i stället av instruktionen nedan.
//
// POST { work_id: uuid }
// Svar: valuations-raden.
//
// Kostnad: några webbsökningar per bok (Anthropic tar ca 0,10 kr per sökning)
// plus tokens — räkna med under en krona per bok.

import { asCaller, HttpError, json, serve } from "../_shared/http.ts";
import { claude, toolInput } from "../_shared/claude.ts";

const REPORT = {
  name: "report_value",
  description: "Rapportera den uppskattade begagnatvärderingen.",
  input_schema: {
    type: "object",
    properties: {
      low: { type: "integer", description: "Låg uppskattning i kronor för ett normalt begagnat ex. 0 om osäljbar." },
      high: { type: "integer", description: "Hög uppskattning i kronor." },
      best_channel: {
        type: "string",
        enum: ["Bokbörsen", "Antikvariat", "Studentapan", "Tradera", "Bokcirkel/loppis", "Ej värd att sälja"],
      },
      confidence: { type: "string", enum: ["låg", "medel", "hög"] },
      summary: { type: "string", description: "1–3 meningar: vad priset bygger på, upplagans betydelse, efterfrågan." },
    },
    required: ["low", "high", "best_channel", "confidence", "summary"],
  },
};

serve(async (req, body) => {
  const workId = String(body.work_id ?? "");
  if (!workId) throw new HttpError(400, "work_id saknas.");
  const { sb } = await asCaller(req);

  const { data: w, error } = await sb.from("works")
    .select("id, library_id, title, authors, year, publisher, isbn")
    .eq("id", workId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!w) throw new HttpError(404, "Boken finns inte i ditt bibliotek.");

  const desc = [
    `Titel: ${w.title}`,
    w.authors?.length ? `Författare: ${w.authors.join(", ")}` : "",
    w.year ? `Utgivningsår: ${w.year}` : "",
    w.publisher ? `Förlag: ${w.publisher}` : "",
    w.isbn ? `ISBN: ${w.isbn}` : "",
  ].filter(Boolean).join("\n");

  const system = `Du värderar begagnade böcker för en privatperson i Sverige.

Sök i den här ordningen:
1. Bokbörsen (bokborsen.se) — Sveriges största marknad för antikvariska och begagnade
   böcker. Sök på ISBN om det finns, annars titel + författare. Detta är huvudkällan.
2. Andra antikvariat: antikvariat.net, och vid behov AbeBooks för utländska böcker.
3. Bara för kurslitteratur i aktuell upplaga: Studentapan.

Ange vad en säljare realistiskt får för ett ex i normalt skick: utgå från de LÄGRE
utbudspriserna för samma upplaga (många exemplar ligger ute länge utan att säljas),
inte nypris och inte det högsta utropspriset. Finns boken i mängder för 30–50 kr är
den inte värd att sälja styckvis — säg det ärligt ("Ej värd att sälja" eller
"Bokcirkel/loppis"). Hittar du inga jämförbara priser: gör en försiktig bedömning
och sätt confidence "låg". Avsluta alltid med verktyget report_value.`;

  const tools = [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 4,
      user_location: { type: "approximate", country: "SE", timezone: "Europe/Stockholm" },
    },
    REPORT,
  ];

  // deno-lint-ignore no-explicit-any
  const messages: any[] = [{ role: "user", content: `Värdera den här boken:\n${desc}` }];
  // deno-lint-ignore no-explicit-any
  let response: any = null;
  // deno-lint-ignore no-explicit-any
  const sources = new Map<string, any>();

  for (let turn = 0; turn < 4; turn++) {
    try {
      response = await claude({ system, messages, tools, max_tokens: 8000 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/web search/i.test(msg) && /not enabled|disabled/i.test(msg)) {
        throw new Error("Webbsökning är avstängd i ditt Anthropic-konto — slå på den under Settings → Capabilities (eller Privacy) i console.anthropic.com.");
      }
      throw e;
    }
    for (const b of response.content ?? []) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) {
          if (r?.url && !sources.has(r.url)) sources.set(r.url, { url: r.url, title: r.title ?? r.url });
        }
      }
    }
    if (toolInput(response, REPORT.name)) break;
    // Långa sökningar kan pausas av API:et; skicka tillbaka svaret oförändrat och fortsätt.
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "pause_turn") {
      messages.push({ role: "user", content: "Rapportera din bedömning nu med report_value." });
    }
  }

  const v = toolInput(response, REPORT.name);
  if (!v) throw new Error("Värderingen gav inget svar — försök igen.");

  const row = {
    library_id: w.library_id,
    work_id: w.id,
    low: Math.max(0, Math.round(Number(v.low) || 0)),
    high: Math.max(0, Math.round(Number(v.high) || 0)),
    best_channel: String(v.best_channel ?? ""),
    confidence: ["låg", "medel", "hög"].includes(v.confidence) ? v.confidence : "låg",
    summary: String(v.summary ?? ""),
    sources: [...sources.values()].slice(0, 8),
  };
  if (row.high < row.low) [row.low, row.high] = [row.high, row.low];

  const { data: saved, error: insErr } = await sb.from("valuations").insert(row).select().single();
  if (insErr) throw new HttpError(500, insErr.message);
  return json(saved);
});
