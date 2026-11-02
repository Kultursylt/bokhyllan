// Supabase-klienten och anrop till serverfunktionerna.
// supabase-js laddas lokalt från vendor/ (se index.html) så appen inte
// beror på ett externt CDN och fungerar även när nätet är segt.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

export const configured =
  !SUPABASE_URL.includes("DITT-PROJEKT") && !SUPABASE_ANON_KEY.includes("DIN-PUBLIKA");

export const sb = configured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

/** Anropar en edge function och ger ett läsbart fel om något går snett. */
export async function callFn(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await error.context?.json?.();
      if (j?.error) msg = j.error;
    } catch { /* svaret var inte JSON */ }
    if (/Failed to send|NetworkError|Load failed/i.test(msg)) {
      msg = `Funktionen "${name}" svarar inte — är den deployad? (se README steg 4)`;
    }
    throw new Error(msg);
  }
  return data;
}

/** Kastar databasens fel som vanliga undantag. */
export function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
