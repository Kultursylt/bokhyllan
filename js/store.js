// Datalagret. ALLA läsningar och skrivningar mot databasen går härigenom,
// så vyerna aldrig behöver känna till tabellnamn eller kolumner.
// Hela biblioteket (några tusen rader som mest) hålls i minnet.

import { sb, check } from "./lib/supabase.js";

const S = {
  user: null,
  library: null,
  role: null,
  locations: [],
  works: new Map(),
  copies: new Map(),
  valuations: new Map(), // work_id -> senaste värderingen
};
export const state = S;

const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn());

// ---------------------------------------------------------------------------
// Laddning
// ---------------------------------------------------------------------------

export async function loadAll() {
  const { data: { user } } = await sb.auth.getUser();
  S.user = user;
  if (!user) return;

  const members = check(await sb.from("library_members").select("library_id, role, libraries(*)").eq("user_id", user.id));
  if (!members.length) throw new Error("Kontot saknar bibliotek — kördes schema.sql innan kontot skapades? Se README.");
  // Har man gått med i ett hushålls bibliotek används det framför det egna, tomma.
  const preferred = localStorage.getItem("bokhyllan.library");
  const m = members.find((x) => x.library_id === preferred) ??
            members.find((x) => x.role === "member") ?? members[0];
  S.library = m.libraries;
  S.role = m.role;
  const lib = S.library.id;

  const [locs, works, copies, vals] = await Promise.all([
    sb.from("locations").select("*").eq("library_id", lib).order("position"),
    fetchAll("works", lib),
    fetchAll("copies", lib),
    sb.from("valuations").select("*").eq("library_id", lib).order("created_at", { ascending: false }),
  ]);
  S.locations = check(locs);
  S.works = new Map(works.map((w) => [w.id, w]));
  S.copies = new Map(copies.map((c) => [c.id, c]));
  S.valuations = new Map();
  for (const v of check(vals)) if (!S.valuations.has(v.work_id)) S.valuations.set(v.work_id, v);
  emit();
}

/** PostgREST ger max 1000 rader per anrop — hämta i omgångar. */
async function fetchAll(table, lib) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await sb.from(table).select("*").eq("library_id", lib).range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export function memberships() {
  return sb.from("library_members").select("library_id, role, libraries(name)").eq("user_id", S.user.id).then(check);
}

export function switchLibrary(id) {
  localStorage.setItem("bokhyllan.library", id);
  return loadAll();
}

// ---------------------------------------------------------------------------
// Platser
// ---------------------------------------------------------------------------

export const locationById = (id) => S.locations.find((l) => l.id === id) ?? null;
export const childrenOf = (parentId) =>
  S.locations.filter((l) => (l.parent_id ?? null) === (parentId ?? null))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "sv"));

/** "Vardagsrum › Bokhylla 1 › Plan 3" */
export function locationPath(id, sep = " › ") {
  const parts = [];
  for (let l = locationById(id), guard = 0; l && guard < 10; l = locationById(l.parent_id), guard++) parts.unshift(l.name);
  return parts.join(sep) || "Ingen plats";
}

/** Alla platser i trädordning, med djup — för väljare och listor. */
export function locationTree() {
  const out = [];
  const walk = (pid, depth) => childrenOf(pid).forEach((l) => { out.push({ ...l, depth }); walk(l.id, depth + 1); });
  walk(null, 0);
  return out;
}

/** Hyllplan och lösa platser (där böcker faktiskt står), i läsordning under en rot. */
export function leafLocations(rootId = null) {
  return locationTree().filter((l) =>
    (l.kind === "shelf" || l.kind === "spot" || childrenOf(l.id).length === 0) &&
    l.kind !== "room" && (rootId == null || isWithin(l.id, rootId)));
}

export function isWithin(id, ancestorId) {
  for (let l = locationById(id), guard = 0; l && guard < 10; l = locationById(l.parent_id), guard++) {
    if (l.id === ancestorId) return true;
  }
  return false;
}

export async function addLocation({ name, kind, parent_id = null, capacity = null }) {
  const position = childrenOf(parent_id).length;
  const row = check(await sb.from("locations")
    .insert({ library_id: S.library.id, name, kind, parent_id, capacity, position }).select().single());
  S.locations.push(row);
  emit();
  return row;
}

/** Ny bokhylla med N plan, numrerade uppifrån. */
export async function addBookcase(name, planes, parent_id = null) {
  const bc = await addLocation({ name, kind: "bookcase", parent_id });
  const rows = Array.from({ length: planes }, (_, i) => ({
    library_id: S.library.id, parent_id: bc.id, name: `Plan ${i + 1}`, kind: "shelf", position: i,
  }));
  if (rows.length) S.locations.push(...check(await sb.from("locations").insert(rows).select()));
  emit();
  return bc;
}

export async function updateLocation(id, patch) {
  const row = check(await sb.from("locations").update(patch).eq("id", id).select().single());
  S.locations = S.locations.map((l) => (l.id === id ? row : l));
  emit();
}

export async function deleteLocation(id) {
  check(await sb.from("locations").delete().eq("id", id));
  const gone = new Set([id, ...S.locations.filter((l) => isWithin(l.id, id)).map((l) => l.id)]);
  S.locations = S.locations.filter((l) => !gone.has(l.id));
  for (const c of S.copies.values()) if (gone.has(c.location_id)) c.location_id = null;
  emit();
}

// ---------------------------------------------------------------------------
// Verk och exemplar
// ---------------------------------------------------------------------------

export const works = () => [...S.works.values()];
export const copies = () => [...S.copies.values()];
export const copiesOf = (workId) => copies().filter((c) => c.work_id === workId);
export const copiesAt = (locId) =>
  copies().filter((c) => c.location_id === locId).sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9));

const keyNorm = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Finns boken redan? Libris-id och ISBN först, sedan titel + författare. */
export function findWork({ libris_id, isbn, title, authors = [] }) {
  const all = works();
  if (libris_id) { const w = all.find((x) => x.libris_id === libris_id); if (w) return w; }
  if (isbn) { const w = all.find((x) => x.isbn === isbn); if (w) return w; }
  if (title) {
    const t = keyNorm(title.split(/ [:;] /)[0]);
    const a = keyNorm(authors[0] ?? "").split(" ").pop();
    return all.find((x) => keyNorm(x.title.split(/ [:;] /)[0]) === t &&
      (!a || keyNorm(x.authors[0] ?? "").split(" ").pop() === a)) ?? null;
  }
  return null;
}

/** Skapar verket från en katalogkandidat (eller en ren avläsning). */
export async function createWork(c, category = null) {
  const row = {
    library_id: S.library.id,
    title: c.title,
    authors: c.authors ?? [],
    year: c.year ?? null,
    publisher: c.publisher ?? null,
    language: c.language ?? null,
    isbn: c.isbn ?? null,
    libris_id: c.libris_id ?? null,
    libris_url: c.source === "libris" ? c.url : null,
    category,
    source: c.source ?? "manual",
    verified: c.source === "libris" || c.source === "openlibrary",
  };
  const res = await sb.from("works").insert(row).select().single();
  if (res.error?.code === "23505") {
    // Unik regel slog till (någon annan i hushållet hann före) — hämta den.
    await loadAll();
    const w = findWork(row);
    if (w) return w;
  }
  const w = check(res);
  S.works.set(w.id, w);
  emit();
  return w;
}

export async function updateWork(id, patch) {
  const w = check(await sb.from("works").update(patch).eq("id", id).select().single());
  S.works.set(id, w);
  emit();
  return w;
}

export async function deleteWork(id) {
  check(await sb.from("works").delete().eq("id", id));
  S.works.delete(id);
  for (const c of copiesOf(id)) S.copies.delete(c.id);
  S.valuations.delete(id);
  emit();
}

export async function addCopy(workId, location_id = null, extra = {}) {
  const c = check(await sb.from("copies").insert({
    library_id: S.library.id, work_id: workId, location_id, status: "shelf", ...extra,
  }).select().single());
  S.copies.set(c.id, c);
  emit();
  return c;
}

export async function updateCopy(id, patch) {
  const c = check(await sb.from("copies").update(patch).eq("id", id).select().single());
  S.copies.set(id, c);
  emit();
  return c;
}

/** Flera exemplar på en gång (t.ex. efter "Ordna"). */
export async function updateCopies(patches) {
  // Små parallella skurar — PostgREST saknar massuppdatering med olika värden per rad.
  for (let i = 0; i < patches.length; i += 20) {
    const part = patches.slice(i, i + 20);
    const rows = await Promise.all(part.map(({ id, ...p }) =>
      sb.from("copies").update(p).eq("id", id).select().single().then(check)));
    rows.forEach((c) => S.copies.set(c.id, c));
  }
  emit();
}

export async function deleteCopy(id) {
  check(await sb.from("copies").delete().eq("id", id));
  S.copies.delete(id);
  emit();
}

// ---------------------------------------------------------------------------
// Skanningar
// ---------------------------------------------------------------------------

export async function uploadScan(blob, location_id) {
  const path = `${S.library.id}/scans/${crypto.randomUUID()}.jpg`;
  check(await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" }));
  return check(await sb.from("scans").insert({ library_id: S.library.id, location_id, photo_path: path }).select().single());
}

export const markScanDone = (id) => sb.from("scans").update({ state: "done" }).eq("id", id).then(check);

export function recentScans(limit = 20) {
  return sb.from("scans").select("id, location_id, photo_path, state, error, created_at, result")
    .eq("library_id", S.library.id).order("created_at", { ascending: false }).limit(limit).then(check);
}

export async function photoUrl(path) {
  const { data } = await sb.storage.from("photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------
// Värderingar och bibliotek
// ---------------------------------------------------------------------------

export function rememberValuation(v) {
  S.valuations.set(v.work_id, v);
  emit();
}

export async function renameLibrary(name) {
  S.library = check(await sb.from("libraries").update({ name }).eq("id", S.library.id).select().single());
  emit();
}

export async function rotateJoinCode() {
  const code = check(await sb.rpc("rotate_join_code", { lib: S.library.id }));
  S.library = { ...S.library, join_code: code };
  emit();
  return code;
}

export async function joinLibrary(code) {
  const id = check(await sb.rpc("join_library", { code }));
  return switchLibrary(id);
}

/** Säkerhetskopia av allt (utom foton) som en JSON-fil. */
export function exportJson() {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    library: { name: S.library.name },
    locations: S.locations,
    works: works(),
    copies: copies(),
    valuations: [...S.valuations.values()],
  }, null, 2);
}

export function exportCsv() {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const head = ["Titel", "Författare", "År", "Förlag", "ISBN", "Libris", "Kategori", "Plats", "Status", "Utlånad till", "Värde låg", "Värde hög"];
  const lines = copies().map((c) => {
    const w = S.works.get(c.work_id) ?? {};
    const v = S.valuations.get(c.work_id);
    return [w.title, (w.authors ?? []).join("; "), w.year, w.publisher, w.isbn, w.libris_url, w.category,
      locationPath(c.location_id), c.status, c.lent_to, v?.low, v?.high].map(esc).join(",");
  });
  return "﻿" + [head.map(esc).join(","), ...lines].join("\n");
}
