import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Bezplatný projekt Supabase se po týdnu nečinnosti uspí – což se trefí přesně
 * do prázdnin. Tenhle endpoint si jednou denně sáhne do databáze a tím ji
 * udrží vzhůru. Spouští ho Vercel Cron podle vercel.json.
 */
export async function GET(request: Request) {
  const secret = process.env.KEEP_ALIVE_SECRET ?? process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase není nastavená" }, { status: 503 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.from("projects").select("id").limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() });
}
