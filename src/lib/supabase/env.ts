/**
 * Čtení konfigurace Supabase.
 *
 * Když env proměnné chybí, aplikace se nesmí rozsypat nesrozumitelnou chybou –
 * učitel, který si projekt klonuje z GitHubu, musí hned vidět, co má doplnit.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Chybí nastavení Supabase. Zkopíruj .env.local.example do .env.local " +
        "a doplň NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(najdeš je v Supabase → Project Settings → API).",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}
