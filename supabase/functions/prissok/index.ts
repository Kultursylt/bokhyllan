// Permanent prissökning via Tavily. Såld-sajter: se ALL_SITES/PAUSED_SITES
// nedan. Ersätter testfunktionen test-tavily-pricesearch.
//
// Metod och lärdomar landade i claude/rapport-tavily-chrome-pristest-2026-10-29.md
// och claude/sparningsark-tavily-pristest-2026-10-29.md. Fält bekräftade med
// Thomas och Design 29/10 (migrering 20261029163152_prissok_falt_och_historik.sql).
//
// Anropas med POST { book_ids: number[], confirm_overwrite?: boolean } och den
// inloggade användarens JWT i Authorization-headern, precis som hyllplan och
// analysera - RLS avgör vad som får läsas/skrivas, ingen service-roll används.
// Högst 25 book_ids per anrop (appen kör flera anrop i omgångar, osynligt för
// användaren).
//
// Statusar som sparas (price_status/sell_price_sources.status) - visningsnamn
// i appen (satt av Design) inom parentes:
//   automatiskt     (Okontrollerat) - pris läst i sidtiteln ELLER på sidan
//   ingen_begagnad  (Inget begagnat) - sidan hittad, men bara nypris finns
//   vantar          (Väntar på kontroll) - trolig sida men osäker titel eller
//                   pris inte läsbart
//   osakert         (Varierande pris) - en ny sökning gav ett annat pris för
//                   samma sajt än den förra sökningen gav - se LÄRDOM 3 nedan
//   ingen_traff     (Inget hittat) - ingen trolig träff alls
//   bekraftat       (Kontrollerat) - sätts ALDRIG av den här funktionen, bara
//                   av en människa
//
// "automatiskt" skrivs ALDRIG över "bekraftat" utan att confirm_overwrite är
// satt - se bekräftelsedialogen i appen. Det som skrivs över flyttas först
// till sell_price_history, aldrig raderat.
//
// Fix 30/10 (Småbugg-uppdraget): Access-Control-Allow-Headers saknade
// "apikey" och "x-client-info", som supabase-js' sb.functions.invoke()
// alltid skickar med. Preflighten (OPTIONS) kom tillbaka 200, men webbläsaren
// vägrade sedan skicka själva POST-anropet eftersom svaret inte tillät alla
// headrar den riktiga anropet ville sända - syntes i edge-loggen som en
// ensam OPTIONS|200 utan någon efterföljande POST alls. Resultat: VARJE
// körning av Värdera har misslyckats tyst sedan lansering (sell_items har
// aldrig haft en enda searched_at-rad) och klientens try/catch har bokat
// hela chunken som "fel".
//
// Ändring 30/10 (Thomas, efter utredningen i
// claude/rapport-smabugg-prissok-bara-campusbokhandeln-2026-10-30.md):
// Bokbörsen gav noll användbara träffar i produktion (0 av 7 i den
// utredningen, samma mönster som i de manuella testrundorna) - PAUSAD, inte
// borttagen (ta bort raden i PAUSED_SITES för att återaktivera). Campusbok-
// handeln var den enda källa som faktiskt gett bekräftade priser hittills
// (den manuella 27/10-rundan) - TILLAGD i den automatiska sökningen. Den
// behandlades som Bokbörsen/Tradera (andrahandsmarknad per definition, inget
// separat "begagnad"-krav som för Studentapan).
//
// RÄTTELSE 31/10: det antagandet var FEL, och det hade satt nypriser som
// värden i tio av elva rader. Campusbokhandeln säljer både nytt och
// begagnat, precis som Studentapan, och skriver ut vilket som är vilket:
// "Begagnat · Ej i lager · Helt ny 392 kr". Kontroll av alla elva sparade
// rader visade att tio var NYPRISER där begagnat inte fanns i lager; de
// rättades i databasen 31/10 (gamla värden sparade i sell_price_history).
// Sedan dess läser funktionen priset på SIDAN för båda sajterna i stället
// för att gissa utifrån sökträffens text - se lasBegagnatpris() nedan.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

// Hela listan sajter funktionen känner till - PAUSED_SITES dras ifrån innan
// den skickas till Tavily. Pausa/återaktivera genom att lägga till/ta bort
// en rad i PAUSED_SITES, inte genom att röra ALL_SITES eller siteOf().
const ALL_SITES = ["studentapan.se", "bokborsen.se", "tradera.com", "campusbokhandeln.se"];
const PAUSED_SITES = ["bokborsen.se"]; // Pausad 30/10 - se kommentaren ovan.
const TARGET_SITES = ALL_SITES.filter((s) => !PAUSED_SITES.includes(s));
const MAX_BOOKS_PER_CALL = 25;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---- Textjämförelse -----------------------------------------------------
// LÄRDOM 1 (rapporten): lita aldrig på Tavilys textutdrag, bara sökträffens
// EGEN sidtitel - utdraget kan komma från en helt annan boks sida.
// LÄRDOM 2: även titelfiltret ger falska positiva vid delvis ordöverlapp
// ("Andlig läsning" matchade en annan bok till 70%). "Stark" matchning
// kräver därför att hela boktiteln (minus en eventuell upplage-parentes)
// återfinns i sidtiteln - inte ett procenttal.

function normalize(s: string): string {
  return s.toLowerCase().replace(/[""""'']/g, "").replace(/[():,.\-–—?!|]/g, " ").replace(/\s+/g, " ").trim();
}
// Stryker en avslutande upplage-/årsparentes, t.ex. "(uppl 2)", "(3:e uppl.)",
// "(2017)" - annars matchar nästan ingen katalogtitel någonsin, eftersom
// sidtitlar på säljsajter nästan aldrig skriver ut "(uppl 2)".
function coreTitle(title: string): string {
  return title.replace(/\s*\(\s*(uppl\.?\s*\d+|\d+\s*:?a?\s*uppl\.?|\d{4})\s*\)\s*$/i, "").trim();
}
function strongTitleMatch(hitTitle: string, bookTitle: string): boolean {
  const hit = normalize(hitTitle);
  const book = normalize(coreTitle(bookTitle));
  if (!book) return false;
  return hit.includes(book);
}
// "Trolig men inte säker" - minst halva de meningsbärande orden igen, så en
// uppenbart orelaterad sida på rätt domän inte visas som "väntar på kontroll".
function plausibleTitleMatch(hitTitle: string, bookTitle: string): boolean {
  const hit = normalize(hitTitle);
  const words = normalize(coreTitle(bookTitle)).split(" ").filter((w) => w.length > 2);
  if (!words.length) return false;
  return words.filter((w) => hit.includes(w)).length / words.length >= 0.5;
}
function extractPriceFromTitle(title: string): number | null {
  const m = title.match(/(\d[\d\s]{1,6})\s*(SEK|kr)\b/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\s/g, ""), 10);
  return Number.isFinite(n) && n > 0 && n < 5000 ? n : null;
}
// Beslutat 29/10: bara begagnatpris räknas. Bokbörsen och Tradera är
// andrahandsmarknader per definition. Studentapan OCH Campusbokhandeln säljer
// både nytt och begagnat - för dem läses priset på sidan (lasBegagnatpris),
// inte ur sökträffens titel. Den här heuristiken ligger kvar för titelvägen:
// säger varken titel eller utdrag "begagnad" får ett titelpris från
// Studentapan inte användas, eftersom det då kan vara ett nypris.
function studentapanAnvandaSomBegagnat(hitTitle: string, snippet: string): boolean {
  return /begagnad|begagnat/i.test(hitTitle + " " + snippet);
}
function siteOf(url: string): string {
  if (url.includes("studentapan.se")) return "studentapan";
  if (url.includes("bokborsen.se")) return "bokborsen";
  if (url.includes("tradera.com")) return "tradera";
  if (url.includes("campusbokhandeln.se")) return "campusbokhandeln";
  return "";
}


/* ---- Prisavläsning på sidan (31/10) -------------------------------------
   Före detta lästes priset BARA ur sökträffens titel. Campusbokhandeln
   skriver priset i titeln, Studentapan gör inte det - resultatet var att
   8 av 8 Studentapan-rader hade en länk men inget pris, vilket var hela
   "Kolla själv"-kategorin i appen, och att Campusbokhandelns titelpris var
   NYPRISET.

   Mätning 31/10 mot 26 riktiga sidor: båda sajterna är serverrenderade och
   skriver ut vilket pris som är vilket, med etikett:
     Studentapan:      "Köp boken Begagnad 219 kr Ny 371 kr"
     Campusbokhandeln: "Begagnat Säljs av privatperson 335 kr ... Helt ny 468 kr"
     Campusbokhandeln: "Begagnat ... Ej i lager Helt ny 392 kr"  (inget begagnat)
   Rak fetch räcker alltså; ingen webbläsare och inga Tavily-krediter.
   (Tavilys /extract provades och tappade prisblocket på alla sex testade
   Studentapan-sidor - sämre OCH dyrare, så den vägen är förkastad.) */

const SID_TIMEOUT_MS = 6000;      // per sida
const MAX_SIDOR_PER_BOK = 2;      // tak så en körning inte drar iväg i tid
const SID_BUDGET_MS = 60000;      // samlad budget per anrop, se nedan

function htmlTillText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/* Sajtens standardtext i sidtiteln, som inte säger något om vilken bok det
   är: ISBN-nummer, sajtnamnet, upplagemarkeringar. */
function skalaBortStandardtext(sidtitel: string): string {
  return sidtitel
    .replace(/ISBN\s*\d[\dxX-]*/gi, " ")
    .replace(/\b97[89][\d-]{9,}\b/g, " ")
    .replace(/\|?\s*(Studentapan|Campusbokhandeln)\b/gi, " ")
    .replace(/\bUpplaga\s*\d+/gi, " ")
    .replace(/\bk(öp|op) (boken|billigt)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* GRANSKNINGSFYND 31/10, det viktigaste i hela spåret: "stark" titelmatchning
   räcker INTE för att läsa av ett pris. Den kräver bara att katalogtiteln
   finns INUTI sidtiteln, och katalogens titlar är ofta avkortade - de kommer
   ur AI-analysen av hyllfoton, alltså av vad som gick att läsa på bokryggen.
   Därför matchade katalogtiteln "Coaching" sidan för "Coaching : vad, varför,
   hur" som en stark träff, och "Executive Coaching" matchade "Executive
   Coaching with Backbone and Heart".

   Ett längdkrav löser det inte: "Handledande samtal" är två ord och RÄTT bok
   med ett riktigt pris, medan "Executive Coaching" är två ord och tveksam.

   Det som skiljer dem är vad som blir KVAR av sidtiteln när katalogtiteln och
   sajtens standardtext räknats bort. Blir det meningsbärande ord kvar som
   katalogen inte känner, är sidan troligen en annan eller mer specifik bok -
   och då läses inget pris. Boken behåller i stället dagens beteende: länk att
   kolla själv, plus det manuella prisfältet. Ett pris man tror på men som är
   fel är sämre än ett tomt fält man kan fylla. */
function sidanAvserSammaBok(sidtitel: string, bookTitle: string): boolean {
  if (!sidtitel) return false;
  const rest = normalize(skalaBortStandardtext(sidtitel))
    .replace(normalize(coreTitle(bookTitle)), " ")
    .split(" ")
    .filter((w) => w.length > 2);
  return rest.length === 0;
}

type Avlast = { pris: number | null; baraNypris: boolean; skal: string };

/* Läser en boksida och svarar på två frågor: finns ett begagnatpris, och om
   inte - stod det uttryckligen att bara nytt finns? Skillnaden avgör om
   boken blir "Kolla själv" eller "Inget begagnat". */
async function lasBegagnatpris(url: string, site: string, bookTitle: string): Promise<Avlast> {
  const svar: Avlast = { pris: null, baraNypris: false, skal: "" };
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept-Language": "sv-SE,sv;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(SID_TIMEOUT_MS),
    });
    if (!r.ok) { svar.skal = `sidan svarade ${r.status}`; return svar; }
    const html = await r.text();

    /* Länken kan vara gammal. Har sidan tagits bort och sajten svarar med en
       sökträfflista i stället, skulle avläsningen annars ge NÅGON ANNAN BOKS
       pris med full säkerhet. Kontrollen görs mot sidans EGEN titel som den
       ser ut nu, inte mot Tavilys sparade. */
    const sidtitel = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
      .replace(/\s+/g, " ").trim();
    if (!sidanAvserSammaBok(sidtitel, bookTitle)) {
      svar.skal = "sidtiteln avser inte samma bok: " + sidtitel.slice(0, 80);
      return svar;
    }

    /* Allt från "Liknande kurslitteratur"/"Liknande böcker" och ner tillhör
       ANDRA böcker - 10-15 tal per sida. Klipps bort före avläsningen så en
       granne aldrig kan bidra med sitt pris. */
    const helText = htmlTillText(html);
    const kap = helText.search(/Liknande (kurslitteratur|b[öo]cker)/i);
    const text = kap > 0 ? helText.slice(0, kap) : helText;

    const tal = (m: RegExpMatchArray | null) => {
      if (!m) return null;
      const n = parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
      // Samma rimlighetsgräns som extractPriceFromTitle: ett ISBN, ett
      // sidantal eller ett årtal följt av "kr" är inget pris.
      return Number.isFinite(n) && n > 0 && n < 5000 ? n : null;
    };

    if (site === "studentapan") {
      svar.pris = tal(text.match(/Begagnad\D{0,25}(\d[\d\s\u00a0]{0,6})\s*kr/i));
      if (svar.pris == null && /\bNy\D{0,25}\d[\d\s]{0,6}\s*kr/i.test(text)) {
        svar.baraNypris = true; svar.skal = "bara nypris på sidan";
      }
    } else if (site === "campusbokhandeln") {
      // "Begagnat ... Ej i lager" betyder att talet efter "Helt ny" är ett
      // NYPRIS. Det var felet som satte tio nypriser som värden.
      const ejILager = /Begagnat[^|]{0,80}Ej i lager/i.test(text);
      if (!ejILager) svar.pris = tal(text.match(/Begagnat\D{0,60}(\d[\d\s\u00a0]{0,6})\s*kr/i));
      if (svar.pris == null && (ejILager || /Helt ny\D{0,25}\d[\d\s]{0,6}\s*kr/i.test(text))) {
        svar.baraNypris = true; svar.skal = "begagnat ej i lager";
      }
    } else {
      svar.skal = "ingen avläsningsregel för " + site;
    }
    if (svar.pris != null) svar.skal = "läst på sidan";
  } catch (e) {
    // En timeout eller ett nätfel får ALDRIG fälla boken: utan den här
    // fångsten hade det yttre try/catch bokat hela boken som fel, och
    // appen räknar en trasig chunk som 25 misslyckade böcker.
    svar.skal = "kunde inte läsa sidan: " + String(e).slice(0, 80);
  }
  return svar;
}

type TavilyHit = { title?: string; url?: string; content?: string };
async function tavilySearch(title: string, author: string | null): Promise<TavilyHit[]> {
  const query = `${title}${author ? ` ${author}` : ""} begagnad bok köp`;
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify({ query, search_depth: "basic", include_domains: TARGET_SITES, max_results: 5 }),
  });
  if (!resp.ok) throw new Error(`Tavily-fel ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  return (data.results ?? []) as TavilyHit[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!TAVILY_API_KEY) return json({ error: "TAVILY_API_KEY saknas som secret i projektet" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Logga in för att söka priser." }, 401);
  const sb = createClient(SB_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Ogiltig eller utgången session." }, 401);

  let body: { book_ids?: number[]; confirm_overwrite?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Ogiltig JSON-body" }, 400); }
  const bookIds = Array.isArray(body.book_ids) ? body.book_ids.filter((n) => Number.isInteger(n)) : [];
  const confirmOverwrite = body.confirm_overwrite === true;
  if (!bookIds.length) return json({ error: "book_ids-listan är tom" }, 400);
  if (bookIds.length > MAX_BOOKS_PER_CALL) {
    return json({ error: `Högst ${MAX_BOOKS_PER_CALL} böcker per anrop.` }, 400);
  }

  // RLS filtrerar automatiskt bort böcker i andra bibliotek - de kommer inte
  // tillbaka här alls, utan att funktionen behöver kolla det själv.
  const { data: books, error: booksErr } = await sb
    .from("manual_books").select("id,title,author,library_id").in("id", bookIds);
  if (booksErr) return json({ error: "Kunde inte läsa böckerna: " + booksErr.message }, 500);

  const resultat: Record<string, unknown>[] = [];
  /* Samlad tidsbudget. Appen skickar 25 böcker per anrop, och varje bok
     kostade förut ett nätanrop (Tavily). Med sidavläsning tillkommer upp
     till två per bok. Går tiden mot slutet slutar funktionen läsa sidor
     och låter resten av böckerna få dagens beteende - i stället för att
     dö mitt i, vilket hade fått appen att boka hela chunken som 25 fel
     (klientens catch gör antal.fel += chunk.length). */
  const start = Date.now();

  for (const book of books ?? []) {
    try {
      // Hämta eller skapa sell_items-raden - fyller bara i det som saknas,
      // rör aldrig andra fält (checked, heat, why, estimated_value, ...).
      let { data: item } = await sb.from("sell_items").select("*")
        .eq("library_id", book.library_id).eq("book_id", book.id).maybeSingle();
      if (!item) {
        const { data: created, error: insErr } = await sb.from("sell_items")
          .insert({ library_id: book.library_id, book_id: book.id, title: book.title })
          .select("*").single();
        if (insErr) { resultat.push({ book_id: book.id, error: insErr.message }); continue; }
        item = created;
      }

      /* Flödesrapporten 31/10, punkt 9: "manuellt" (ett pris Thomas själv
         skrivit in för hand, via smpSave) skyddades inte här - bara
         bekraftat/automatiskt. En ny körning kunde alltså tyst skriva
         över ett pris en människa skrivit in, utan confirm_overwrite,
         och sell_price_history fick den gamla raden men UI:t visade bara
         den nya (eller "-" om inget nytt hittades). Ett manuellt pris är
         minst lika säkert som ett sökträff-pris ingen kontrollerat, så
         det hör till samma skydd. */
      const redanSokt = item.price_status === "bekraftat" || item.price_status === "automatiskt" ||
        item.price_status === "manuellt";
      if (redanSokt && !confirmOverwrite) {
        resultat.push({ book_id: book.id, status: "skippad_skyddad", price_status: item.price_status });
        continue;
      }

      const hits = await tavilySearch(book.title, book.author || null);
      const kandidater = hits
        .map((h) => ({ title: h.title ?? "", url: h.url ?? "", snippet: (h.content ?? "").slice(0, 200), site: siteOf(h.url ?? "") }))
        .filter((h) => h.site)
        .map((h) => ({ ...h, strong: strongTitleMatch(h.title, book.title), plausible: plausibleTitleMatch(h.title, book.title) }));

      const starka = kandidater.filter((h) => h.strong);

      /* VÄG 1: priset står i sökträffens titel. Bokbörsen och Tradera är
         andrahandsmarknader; för Studentapan krävs att texten säger
         "begagnad", annars kan titelpriset vara ett nypris. Campusbokhandeln
         är INTE längre med här - dess titelpris visade sig vara nypriset
         (rättelsen 31/10 högst upp), så den går via sidavläsningen. */
      const meddPris = starka
        .filter((h) => h.site === "bokborsen" || h.site === "tradera" || studentapanAnvandaSomBegagnat(h.title, h.snippet))
        .map((h) => ({ ...h, price: extractPriceFromTitle(h.title) }))
        .filter((h) => h.price !== null) as (typeof starka[number] & { price: number })[];

      /* VÄG 2: läs priset på sidan. Bara för STARKA träffar - felmatchningen
         som gav ett felaktigt pris i testet 29/10 var en "trolig" match - och
         bara för de två sajter som har en avläsningsregel. */
      const lasta: { site: string; url: string; page_title: string; price: number }[] = [];
      let baraNypris = false, avlastSkal = "";
      const redanPrissatt = new Set(meddPris.map((h) => h.site));
      const attLasa = starka
        .filter((h) => (h.site === "studentapan" || h.site === "campusbokhandeln") && !redanPrissatt.has(h.site))
        .slice(0, MAX_SIDOR_PER_BOK);
      for (const h of attLasa) {
        if (Date.now() - start > SID_BUDGET_MS) { avlastSkal = "tidsbudgeten slut, sidan lästes inte"; break; }
        const a = await lasBegagnatpris(h.url, h.site, book.title);
        if (a.pris != null) lasta.push({ site: h.site, url: h.url, page_title: h.title, price: a.pris });
        else if (a.baraNypris) baraNypris = true;
        if (a.skal) avlastSkal = a.skal;
      }

      let nyStatus: string;
      let nyLow: number | null = null, nyHigh: number | null = null;
      /* Bugg 2, samma körning: två starka träffar från SAMMA sajt (två
         upplagor av boken) gav två kallRader, och upserten mot
         (sell_item_id, site) lät den andra skriva över den första. Spannet
         i sell_items blev rätt (95-109 kr) men källraden visade bara 109.
         Dedupas nedan: en rad per sajt, det LÄGSTA priset - det är vad boken
         faktiskt går att få tag på för. */
      const kallRader: { site: string; price: number | null; url: string; page_title: string; status: string; title_match: string }[] = [];

      if (meddPris.length > 0 || lasta.length > 0) {
        nyStatus = "automatiskt";
        const priser = [...meddPris.map((h) => h.price), ...lasta.map((h) => h.price)];
        nyLow = Math.min(...priser); nyHigh = Math.max(...priser);
        for (const h of meddPris) kallRader.push({ site: h.site, price: h.price, url: h.url, page_title: h.title, status: "automatiskt", title_match: "stark" });
        for (const h of lasta) kallRader.push({ site: h.site, price: h.price, url: h.url, page_title: h.page_title, status: "automatiskt", title_match: "stark" });
      } else if (baraNypris) {
        /* Sidan säger uttryckligen att bara nytt finns. Det är INTE samma sak
           som "väntar på kontroll": att öppna länken ger ingenting. Statusen
           får bara sättas när ingen sajt gav ett begagnatpris - annars kunde
           en bok med pris hos en sajt märkas "Inget begagnat" för att en
           annan saknade exemplar. Villkoret ligger därför efter grenen ovan. */
        nyStatus = "ingen_begagnad";
        const trolig = starka[0];
        if (trolig) kallRader.push({ site: trolig.site, price: null, url: trolig.url, page_title: trolig.title, status: "ingen_begagnad", title_match: "stark" });
      } else if (starka.length > 0 || kandidater.some((h) => h.plausible)) {
        nyStatus = "vantar";
        const trolig = starka[0] || kandidater.find((h) => h.plausible);
        if (trolig) kallRader.push({ site: trolig.site, price: null, url: trolig.url, page_title: trolig.title, status: "vantar", title_match: trolig.strong ? "stark" : "svag" });
      } else {
        nyStatus = "ingen_traff";
      }

      // LÄRDOM 3: skilj inte på "osäkert" genom att söka två gånger (kostar
      // dubbla krediter) - utan genom att jämföra med förra körningens
      // automatiska pris för samma sajt. Skiljer de sig har sökresultatet
      // visat sig variera över tid, precis det testet upptäckte.
      if (nyStatus === "automatiskt" && item.price_status === "automatiskt") {
        const { data: gamlaKallor } = await sb.from("sell_price_sources").select("site,price")
          .eq("sell_item_id", item.id).eq("status", "automatiskt");
        const gammaltSpann = (gamlaKallor || []).map((k: { price: number | null }) => k.price).filter((p: number | null): p is number => p != null);
        if (gammaltSpann.length && (Math.min(...gammaltSpann) !== nyLow || Math.max(...gammaltSpann) !== nyHigh)) {
          nyStatus = "osakert";
          nyLow = Math.min(nyLow!, ...gammaltSpann); nyHigh = Math.max(nyHigh!, ...gammaltSpann);
        }
      }

      // Skriv över: det gamla (om något) till historik - ALDRIG raderat -
      // sedan den nya raden. Rör bara om vi faktiskt har en ny sökning att
      // skriva (annars lämnas en skyddad rad helt orörd trots confirm_overwrite
      // när books_ids råkar sakna träff den här gången).
      if (redanSokt || item.price_status) {
        const { data: gamlaKallor } = await sb.from("sell_price_sources").select("*").eq("sell_item_id", item.id);
        for (const g of gamlaKallor || []) {
          await sb.from("sell_price_history").insert({
            sell_item_id: item.id, site: g.site, price: g.price, url: g.url,
            page_title: g.page_title, status: g.status || item.price_status || "automatiskt",
          });
        }
      }

      /* BUGG hittad 31/10 i Thomas körning, och den har funnits sedan
         funktionen byggdes: gamla källrader flyttades till historiken men
         RADERADES ALDRIG. Gav en ny sökning inget alls (ingen_traff) låg den
         förra länken kvar, och eftersom appen avgör kategorin på OM DET FINNS
         EN LÄNK visades boken som "Kolla själv" trots statusen "Inget
         hittat". Det förklarar också motsägelsen från 29/10: två böcker
         märkta ingen_traff som ändå hade sparade sidor.

         Städningen sker bara när vi faktiskt gjort en sökning - kastar
         Tavily ett fel hoppar vi ur långt före den här raden, och en skyddad
         rad (skippad_skyddad) returnerar ännu tidigare. */
      const behall = kallRader.map((k) => k.site);
      const { data: finnsNu } = await sb.from("sell_price_sources").select("site").eq("sell_item_id", item.id);
      const taBort = (finnsNu || []).map((r: { site: string }) => r.site).filter((site: string) => !behall.includes(site));
      if (taBort.length) {
        await sb.from("sell_price_sources").delete().eq("sell_item_id", item.id).in("site", taBort);
      }

      const envarPerSajt = new Map<string, typeof kallRader[number]>();
      for (const k of kallRader) {
        const f = envarPerSajt.get(k.site);
        if (!f || (k.price != null && (f.price == null || k.price < f.price))) envarPerSajt.set(k.site, k);
      }
      for (const k of envarPerSajt.values()) {
        await sb.from("sell_price_sources").upsert(
          /* title_match har funnits i tabellen sedan bygget men aldrig
             fyllts. Nu vilar prisavläsningen på skillnaden stark/svag, så
             fältet säger i efterhand HUR säker matchningen var när priset
             sparades - första frågan man ställer om ett pris visar sig fel. */
          { sell_item_id: item.id, site: k.site, price: k.price, url: k.url, page_title: k.page_title, status: k.status, title_match: k.title_match },
          { onConflict: "sell_item_id,site" },
        );
      }
      /* Codex-fynd i PR 126 (2/11): estimated_value sätts bara av smpSave,
         alltid tillsammans med price_status "manuellt" (det manuella
         prisfältet i appen). Skriver en ny sökning över det - vilket nu
         kan hända, eftersom "manuellt" sedan samma PR är skyddat men inte
         OSKRIVBART med confirm_overwrite - måste den gamla manuella
         siffran nollas här. Annars vinner den kvardröjande estimated_value
         över det nya priset i vardPris() (estimated_value→low→price_high
         →price_low), och raden visar det GAMLA manuella priset trots att
         källorna och sökresultatet redan säger ett nytt. */
      await sb.from("sell_items").update({
        price_status: nyStatus, price_low: nyLow, price_high: nyHigh, searched_at: new Date().toISOString(),
        estimated_value: null,
      }).eq("id", item.id);

      resultat.push({ book_id: book.id, status: nyStatus, low: nyLow, high: nyHigh, avlast: avlastSkal || undefined });
    } catch (e) {
      resultat.push({ book_id: book.id, error: String(e) });
    }
  }

  return json({ resultat });
});
