# Arbetsregler för Bokhyllan

Läs README.md (avsnittet "Kodens uppbyggnad") först.

- **Databasen nås bara via `js/store.js`.** Vyer anropar store-funktioner, aldrig `sb.from(...)` direkt.
- **En vy per fil** i `js/views/`. Ny vy = ny fil + en rad i `ROUTES` i `js/main.js` + en rad i `SHELL` i `sw.js`.
- **Ingen byggkedja.** Vanliga ES-moduler, inga npm-beroenden i webbappen.
- **Bokdata hittas aldrig på.** AI läser av ryggar; titel, upplaga och ISBN kommer från Libris/Open Library.
- **Schemaändringar:** lägg en ny fil i `supabase/migrations/` (skapa mappen vid första ändringen) (datum_beskrivning.sql) och uppdatera `supabase/schema.sql` så den alltid bygger hela databasen från noll.
- **Serverfunktioner** använder anroparens session (`asCaller`), aldrig service role.
- **Före commit:** `node tests/organize.test.mjs` och `node --experimental-strip-types tests/catalog.test.mts`; `node --check` på ändrade js-filer. Höj `CACHE` i `sw.js` när appens filer ändras.
