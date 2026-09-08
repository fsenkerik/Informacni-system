import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";
import type { Database } from "./types";

/**
 * Klient pro serverové komponenty a server actions.
 * V Next.js 16 je `cookies()` asynchronní, proto je celá funkce async.
 */
export async function getSupabaseServerClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Volání ze serverové komponenty – obnovu session zařídí proxy.ts.
        }
      },
    },
  });
}
