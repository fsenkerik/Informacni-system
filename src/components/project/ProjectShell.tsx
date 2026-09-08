"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, Database, Eye, FileCode2, Table2, Trophy } from "lucide-react";
import { Badge, JoinCode } from "@/components/ui";
import { SetupNotice } from "@/components/SetupNotice";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useSchemaStore } from "@/lib/er/store";
import { DEMO_PROJECT_ID } from "@/lib/er/demo";
import { getScenario } from "@/lib/sim/scenarios";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "navrh", label: "Návrh", icon: Table2 },
  { href: "provoz", label: "Provoz", icon: Activity },
  { href: "data", label: "Data", icon: Database },
  { href: "uspechy", label: "Úspěchy", icon: Trophy },
  { href: "sql", label: "SQL", icon: FileCode2 },
];

export function ProjectShell({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const load = useSchemaStore((s) => s.load);
  const connect = useSchemaStore((s) => s.connect);
  const project = useSchemaStore((s) => s.project);
  const loading = useSchemaStore((s) => s.loading);
  const error = useSchemaStore((s) => s.error);
  const collaborators = useSchemaStore((s) => s.collaborators);
  const setViewer = useSchemaStore((s) => s.setViewer);
  const canEdit = useSchemaStore((s) => s.canEdit);
  const [nickname, setNickname] = useState<string | null>(null);

  const isDemo = projectId === DEMO_PROJECT_ID;

  useEffect(() => {
    if (!isSupabaseConfigured && projectId !== DEMO_PROJECT_ID) return;

    // Připojení běží přes několik awaitů. Kdyby žák mezitím přeskočil na jinou
    // kartu, musí se kanál zavřít i tak – jinak by se spojení hromadila a
    // třída by narazila na limit Realtimu.
    let cancelled = false;
    let disconnect: (() => void) | undefined;

    async function boot() {
      await load(projectId);
      if (cancelled) return;

      if (projectId === DEMO_PROJECT_ID) {
        setNickname("ukázka");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      if (!user) return;

      const { data: member } = await supabase
        .from("project_members")
        .select("nickname")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      // Učitel není členem skupiny – chodí se jen podívat, ale ať je poznat.
      const name = member?.nickname ?? (user.is_anonymous ? "Host" : "Učitel");
      setNickname(name);
      setViewer(member ? "member" : user.is_anonymous ? "guest" : "teacher");

      disconnect = connect(projectId, { userId: user.id, nickname: name });
      if (cancelled) {
        disconnect();
        disconnect = undefined;
      }
    }

    void boot();
    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [projectId, load, connect, setViewer]);

  if (!isSupabaseConfigured && !isDemo) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <SetupNotice />
      </main>
    );
  }

  const scenario = project ? getScenario(project.scenario_key) : null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/" className="text-sm font-semibold text-ink">
            DataFirma
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg" aria-hidden>
              {scenario?.emoji}
            </span>
            <span className="truncate font-medium text-ink">
              {project?.company_name || project?.name || "Načítám…"}
            </span>
            {scenario ? (
              <Badge tone="neutral">{scenario.name}</Badge>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-4">
            {collaborators.length > 0 ? (
              <div className="flex items-center gap-1.5">
                {collaborators.map((c) => (
                  <span
                    key={c.userId}
                    title={c.nickname}
                    className="flex h-7 items-center rounded-full px-2.5 text-xs font-medium text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.nickname}
                  </span>
                ))}
              </div>
            ) : null}

            {project ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5">
                <span className="text-xs text-muted">Kód</span>
                <JoinCode code={project.join_code} className="text-sm" />
              </div>
            ) : null}
          </div>
        </div>

        <nav className="mx-auto flex w-full max-w-[1600px] gap-1 px-4">
          {TABS.map((tab) => {
            const href = `/projekt/${projectId}/${tab.href}`;
            const active = pathname === href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                <Icon size={16} aria-hidden />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {!canEdit ? (
        <div className="flex items-center gap-2 border-b border-warn/30 bg-warn-soft px-6 py-2 text-sm text-warn">
          <Eye size={15} aria-hidden />
          <span>
            Prohlížíš projekt skupiny jen pro čtení. Upravovat ho můžou žáci,
            kteří se do něj přihlásili kódem.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="border-b border-bad/30 bg-bad-soft px-6 py-2 text-sm text-bad">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            Načítám firmu…
          </div>
        ) : (
          children
        )}
      </div>

      <span className="sr-only">Přihlášen jako {nickname ?? "host"}</span>
    </div>
  );
}
