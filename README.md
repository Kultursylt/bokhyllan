# Bokhyllan

Fotografera dina bokhyllor. Appen läser av bokryggarna, verifierar varje bok mot
**Libris** (Kungliga bibliotekets katalog), håller reda på var varje exemplar står,
uppskattar vad böckerna är värda begagnade och föreslår hur du kan ordna om dem.

Fungerar i webbläsaren på dator och kan installeras som app på Android.

> Bygger på idéerna i [tringenr/bokhyllan](https://github.com/tringenr/bokhyllan),
> men är omskriven från grunden med egen databas, Libris-verifiering och uppdelad kod.

---

## Så fungerar den

1. **Skanna** – du fotograferar ett hyllplan. Claude läser av vad som står på ryggarna,
   inget mer. Varje avläsning slås sedan upp i Libris (Open Library som reserv för
   utländska böcker). Boken identifieras alltså av katalogen, inte av AI:ns minne.
2. **Granska** – säkra träffar är förbockade. Osäkra visas med alternativ och sökruta.
   Appen känner igen böcker som redan finns och visar vilka som borde stå på
   hyllplanet men inte syns på fotot.
3. **Hylla** – sök och filtrera på plats, kategori och status (på plats, utlånad till…).
4. **Ordna** – överblick (ej verifierade, utan plats, dubbletter, utlånat) och förslag
   på ny ordning med en flyttlista, hylla för hylla.
5. **Värde** – webbsökning i första hand på Bokbörsen och andra antikvariat (Studentapan för kurslitteratur)
   ger ett prisintervall, bästa säljkanal och källor per bok.
6. **Lägg till enstaka böcker** – skanna streckkoden (ISBN) med mobilkameran
   eller sök på titel.

---

## Kom igång (ca 30 minuter)

Du behöver: ett GitHub-konto, ett gratis Supabase-konto och en API-nyckel från Anthropic.

### Steg 1 – Skapa databasen i Supabase

1. Gå till [supabase.com](https://supabase.com), skapa konto och **New project**.
   Välj region **North EU (Stockholm)**. Spara databaslösenordet någonstans.
2. När projektet är klart: **SQL Editor → New query**. Klistra in hela innehållet i
   [`supabase/schema.sql`](supabase/schema.sql) och tryck **Run**.
   Det ska stå *Success. No rows returned*.

### Steg 2 – Inloggningsinställningar

Under **Authentication**:

- **Sign In / Providers → Email**: stäng av *Confirm email* om du vill slippa
  bekräftelsemejl (rekommenderas för ett hushåll – Supabases gratis mejlutskick är
  hårt begränsat).
- **URL Configuration**: sätt *Site URL* till adressen där appen kommer att ligga
  (se steg 5, t.ex. `https://DITTNAMN.github.io/bokhyllan/`) och lägg till samma
  adress följd av `**` under *Redirect URLs*.

### Steg 3 – API-nyckel till Claude

1. Gå till [console.anthropic.com](https://console.anthropic.com) och skapa konto.
2. **Billing**: fyll på en liten summa (t.ex. 10 USD räcker långt) och sätt gärna en
   månadsgräns under *Limits*.
3. **API Keys → Create Key**. Kopiera nyckeln (börjar med `sk-ant-`). Den visas bara en gång.

Nyckeln läggs **bara** i Supabase (steg 4), aldrig i appens kod.

### Steg 4 – Installera serverfunktionerna

Serverfunktionerna (`analyze`, `lookup`, `valuate`) kör avläsningen, Libris-sökningen
och värderingen. Kör i Terminal på din Mac, i mappen med repot:

```sh
brew install supabase/tap/supabase      # en gång
supabase login                          # öppnar webbläsaren
supabase link --project-ref DITT-PROJEKT-ID
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy --no-verify-jwt
```

Projekt-id:t är den slumpmässiga delen av adressen, `https://DITT-PROJEKT-ID.supabase.co`.
`--no-verify-jwt` behövs eftersom funktionerna själva kontrollerar inloggningen
(det fungerar med både gamla och nya nyckeltyper i Supabase).

*Valfritt:* för svårlästa ryggar kan du byta till en starkare modell:
`supabase secrets set BOKHYLLAN_MODEL=claude-opus-5-5` (dyrare per foto).

### Steg 5 – Koppla appen till din databas och publicera

1. I Supabase: **Project Settings → API**. Kopiera *Project URL* och den publika
   nyckeln (*anon* eller *publishable*) till [`js/config.js`](js/config.js).
   Använd aldrig *service_role*/*secret*-nyckeln där.
2. Skapa ett nytt repo på GitHub och ladda upp filerna (eller `git push`).
3. På GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**,
   välj `main` och `/ (root)`. Efter någon minut ligger appen på
   `https://DITTNAMN.github.io/REPONAMN/`.

**Testa först på Macen:** `python3 -m http.server 8000` i mappen och öppna
`http://localhost:8000`.

### Steg 6 – Installera på Android

Öppna adressen i **Chrome** på telefonen och logga in. Välj **⋮ → Installera app**
(eller *Lägg till på startskärmen*), eller tryck **Installera** under *Mer* i appen.
Bokhyllan öppnas då som en egen app med kameran direkt tillgänglig.

### Steg 7 – Bjud in hushållet

Under **Mer** finns bibliotekets inbjudningskod och knappen **Dela inbjudan**. Den
som skapar konto via länken hamnar i samma bibliotek och ser samma böcker.

---

## Tips för bra resultat

- **Ett hyllplan per foto**, rakt framifrån, i dagsljus utan blänk. Det ger bäst
  läsbarhet. Hela bokhyllan på ett foto går, men tunna ryggar blir svårare.
- Börja med att skapa bokhyllan med rätt antal plan (*Skanna → + Ny bokhylla*).
  Planen numreras **uppifrån**.
- Kontrollera de gula *Kontrollera*-raderna, de gröna är säkra Libris-träffar.
- Ange under *Mer → Platser* ungefär hur många böcker som ryms per plan, så blir
  förslagen under *Ordna* bättre.
- Värdera i omgångar och börja med kurslitteratur, äldre böcker och dubbletter.

## Kostnader

- **Supabase**: gratisnivån räcker gott för en hemmasamling.
- **Anthropic**: avläsning kostar i storleksordningen någon krona per hyllfoto och
  värdering under en krona per bok (webbsökning kostar 10 USD per 1 000 sökningar,
  max fyra per bok). Exakta priser och din förbrukning ser du i Anthropic-konsolen.
- **Libris och Open Library**: gratis.

## Felsökning

| Symptom | Orsak |
|---|---|
| ”Nästan klart – fyll i js/config.js” | Steg 5.1 är inte gjort. |
| ”Kontot saknar bibliotek” | Kontot skapades innan `schema.sql` kördes. Ta bort användaren under *Authentication → Users* och skapa kontot igen. |
| ”Funktionen … svarar inte” | Steg 4 är inte gjort, eller deployen misslyckades. Kör `supabase functions deploy --no-verify-jwt` igen. |
| ”ANTHROPIC_API_KEY saknas” | Kör `supabase secrets set …` i steg 4. |
| ”Claude svarade 400 … credit” | Fyll på saldo i Anthropic-konsolen. |
| Felet *row-level security* | Appen pratar med fel databas, kontrollera `js/config.js`. |
| Loggar i funktionerna | Supabase → *Edge Functions* → välj funktion → *Logs*. |

---

## Kodens uppbyggnad

Ingen byggkedja. Vanliga ES-moduler, en fil per ansvar, så att två ändringar sällan
krockar i samma fil.

```
index.html               skal + bottenmeny
css/app.css              all stil (ljust/mörkt läge)
js/main.js               start och navigering (ROUTES)
js/config.js             Supabase-adress och publik nyckel
js/store.js              ENDA stället som läser/skriver databasen
js/organize.js           ren logik för ordningsförslag (testbar)
js/labels.js             gemensamma texter och kategorier
js/pwa.js                installera-knapp, service worker
js/lib/                  dom-hjälpare, supabase-klient, bild, streckkod
js/views/                en fil per vy: library, book, scan, organize, value,
                         places, settings, login, addbook, widgets
sw.js, manifest.webmanifest, icons/   installerbar app
vendor/supabase.js       supabase-js lokalt (inget CDN-beroende)
supabase/schema.sql      hela databasen + säkerhetsregler, körs en gång
supabase/functions/      analyze, lookup, valuate + _shared/
tests/                   node tests/organize.test.mjs
                         node --experimental-strip-types tests/catalog.test.mts
```

**Datamodell:** `works` (boken/upplagan med ISBN och Libris-id) ·
`copies` (fysiska exemplar med plats och status) · `locations` (rum › bokhylla ›
hyllplan) · `scans` · `valuations`. Allt hör till ett `library` och skyddas av
radnivåsäkerhet: man ser och ändrar bara bibliotek man är medlem i.

**Säkerhet:** serverfunktionerna agerar som den inloggade användaren, inte med
administratörsnyckel, så databasens regler gäller även där.
