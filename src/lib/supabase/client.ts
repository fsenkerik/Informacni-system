"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";
import type { Database } from "./types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Jeden sdílený klient na celou kartu prohlížeče (kvůli Realtime spojení). */
export function getSupabaseBrowserClient() {
  if (!cached) {
    const { url, anonKey } = requireSupabaseEnv();
    cached = createBrowserClient<Database>(url, anonKey);
  }
  return cached;
}
