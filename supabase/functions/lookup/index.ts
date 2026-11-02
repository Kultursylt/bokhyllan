// Slår upp en bok i Libris (och Open Library som reserv).
//
// POST { isbn }               -> exakt träff på ISBN (från streckkodsskannern)
// POST { title, author? }     -> rangordnade kandidater
// Svar: { candidates: Candidate[] }
//
// Kräver inloggning så att funktionen inte blir en öppen proxy.

import { asCaller, HttpError, json, serve } from "../_shared/http.ts";
import { findByIsbn, findCandidates } from "../_shared/catalog.ts";

serve(async (req, body) => {
  await asCaller(req);

  const isbn = typeof body.isbn === "string" ? body.isbn : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const author = typeof body.author === "string" ? body.author.trim() : "";

  if (isbn) return json({ candidates: await findByIsbn(isbn) });
  if (title) return json({ candidates: await findCandidates({ title, author }, 8) });
  throw new HttpError(400, "Ange isbn eller title.");
});
