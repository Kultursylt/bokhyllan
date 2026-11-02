// Gemensamt för alla funktioner: CORS, JSON-svar och inloggningskontroll.
//
// Viktig skillnad mot originalappen: funktionerna arbetar med ANVÄNDARENS
// session, inte med service role-nyckeln. Databasens radnivåsäkerhet gäller
// därför även här — en inloggad användare kan bara läsa och skriva sitt eget
// biblioteks rader, oavsett vilket id hen skickar in.

import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2.45.4";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Skapar en Supabase-klient som agerar som den inloggade användaren. */
export async function asCaller(req: Request): Promise<{ sb: SupabaseClient; user: User }> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new HttpError(401, "Logga in först.");

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(auth.slice(7));
  if (error || !data?.user) throw new HttpError(401, "Sessionen har gått ut — logga in igen.");
  return { sb, user: data.user };
}

/** Standardram: OPTIONS, POST-krav, JSON-indata och felhantering. */
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json({ error: "Använd POST." }, 405);
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Ogiltig JSON." }, 400);
    }
    try {
      return await handler(req, body);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      console.error(e);
      return json({ error: e instanceof Error ? e.message : String(e) }, status);
    }
  });
}
