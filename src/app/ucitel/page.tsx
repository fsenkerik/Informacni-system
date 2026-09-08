"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TeacherAuth } from "./TeacherAuth";
import { TeacherDashboard } from "./TeacherDashboard";
import { SetupNotice } from "@/components/SetupNotice";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type State = "loading" | "anonymous" | "teacher";

export default function TeacherPage() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    async function detect() {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      // Anonymní účet patří žákovi, ne učiteli.
      setState(data.user && !data.user.is_anonymous ? "teacher" : "anonymous");
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <SetupNotice />
      </main>
    );
  }

  if (state === "teacher") {
    return <TeacherDashboard onSignedOut={() => setState("anonymous")} />;
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden />
        Zpět
      </Link>
      {state === "loading" ? (
        <p className="text-sm text-muted">Načítám…</p>
      ) : (
        <TeacherAuth onSignedIn={() => setState("teacher")} />
      )}
    </main>
  );
}
