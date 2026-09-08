"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  JoinCode,
  Label,
  Select,
} from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClassRow, ProjectRow } from "@/lib/supabase/types";
import { SCENARIOS, getScenario } from "@/lib/sim/scenarios";
import { SIZE_PRESET_INFO, type SizePreset } from "@/lib/types";

interface ProjectOverview extends ProjectRow {
  memberNames: string[];
  entityCount: number;
  relationshipCount: number;
  xp: number;
  achievementCount: number;
}

/** Čtení dat je schválně mimo komponentu – bez setState se dá snadno testovat. */
async function fetchClasses(): Promise<ClassRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function fetchProjects(classId: string): Promise<ProjectOverview[]> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "*, project_members(nickname), entities(id), relationships(id), project_progress(xp), project_achievements(achievement_key)",
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  type Joined = ProjectRow & {
    project_members: { nickname: string }[] | null;
    entities: { id: string }[] | null;
    relationships: { id: string }[] | null;
    project_progress: { xp: number } | { xp: number }[] | null;
    project_achievements: { achievement_key: string }[] | null;
  };

  return ((data ?? []) as unknown as Joined[]).map((row) => {
    const progress = Array.isArray(row.project_progress)
      ? row.project_progress[0]
      : row.project_progress;
    return {
      ...row,
      memberNames: (row.project_members ?? []).map((m) => m.nickname),
      entityCount: (row.entities ?? []).length,
      relationshipCount: (row.relationships ?? []).length,
      xp: progress?.xp ?? 0,
      achievementCount: (row.project_achievements ?? []).length,
    };
  });
}

export function TeacherDashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOverview[]>([]);
  const [loading, setLoading] = useState(true);
  /** Zvýšením se vynutí načtení znovu – po založení třídy, projektu i ručně. */
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const rows = await fetchClasses();
      if (cancelled) return;
      setClasses(rows);
      setActiveClassId((current) => current ?? rows[0]?.id ?? null);
      setLoading(false);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    if (!activeClassId) return;
    let cancelled = false;
    async function run() {
      const rows = await fetchProjects(activeClassId!);
      if (!cancelled) setProjects(rows);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeClassId, reloadToken]);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    onSignedOut();
  }

  const activeClass = classes.find((c) => c.id === activeClassId) ?? null;
  const ranked = [...projects].sort((a, b) => b.xp - a.xp);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Přehled tříd</h1>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reload}
          >
            <RefreshCw size={15} aria-hidden />
            Načíst znovu
          </Button>
          <Button variant="secondary" size="sm" onClick={signOut}>
            <LogOut size={15} aria-hidden />
            Odhlásit
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <ClassList
            classes={classes}
            activeId={activeClassId}
            onSelect={setActiveClassId}
            loading={loading}
          />
          <NewClassForm onCreated={reload} />
        </div>

        <div className="space-y-4">
          {activeClass ? (
            <>
              <NewProjectForm classId={activeClass.id} onCreated={reload} />

              {ranked.length === 0 ? (
                <EmptyState
                  title="Ve třídě zatím není žádná skupina"
                  description="Založ projekt pro každou dvojici a rozdej jim kódy. Do jednoho projektu se může přihlásit víc žáků a uvidí změny toho druhého."
                />
              ) : (
                <ul className="space-y-3">
                  {ranked.map((project, index) => (
                    <ProjectRowCard
                      key={project.id}
                      project={project}
                      rank={index + 1}
                      onDeleted={reload}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : (
            <EmptyState
              title="Založ první třídu"
              description="Například „2. A – informační systémy“. Do třídy pak přidáš projekty pro jednotlivé skupiny."
            />
          )}
        </div>
      </div>
    </main>
  );
}

function ClassList({
  classes,
  activeId,
  onSelect,
  loading,
}: {
  classes: ClassRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-muted">Načítám…</p>;
  }
  if (classes.length === 0) return null;

  return (
    <nav className="space-y-1">
      {classes.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={
            item.id === activeId
              ? "w-full rounded-lg border border-accent bg-accent-soft px-3 py-2 text-left text-sm font-medium text-accent"
              : "w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm text-ink-2 hover:border-border-strong"
          }
        >
          {item.name}
          {item.school_year ? (
            <span className="ml-2 text-xs text-muted">{item.school_year}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function NewClassForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [pending, setPending] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setPending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      await supabase.from("classes").insert({
        teacher_id: user.user.id,
        name: name.trim(),
        school_year: year.trim() || null,
      });
      setName("");
      setYear("");
      onCreated();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="space-y-3">
      <Label>Nová třída</Label>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="2. A – informační systémy"
      />
      <Input
        value={year}
        onChange={(e) => setYear(e.target.value)}
        placeholder="2025/2026"
      />
      <Button size="sm" className="w-full" onClick={create} disabled={pending}>
        <Plus size={15} aria-hidden />
        Založit třídu
      </Button>
    </Card>
  );
}

function NewProjectForm({
  classId,
  onCreated,
}: {
  classId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0].key);
  const [sizePreset, setSizePreset] = useState<SizePreset>("small");
  const [count, setCount] = useState(1);
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const base = name.trim() || "Skupina";
      const rows = Array.from({ length: Math.max(1, Math.min(20, count)) }, (_, i) => ({
        class_id: classId,
        name: count > 1 ? `${base} ${i + 1}` : base,
        scenario_key: scenarioKey,
        size_preset: sizePreset,
      }));
      await supabase.from("projects").insert(rows);
      setName("");
      setCount(1);
      onCreated();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <Label hint="každá skupina dostane vlastní kód">Nové projekty pro skupiny</Label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Skupina"
        />
        <Select value={scenarioKey} onChange={(e) => setScenarioKey(e.target.value)}>
          {SCENARIOS.map((scenario) => (
            <option key={scenario.key} value={scenario.key}>
              {scenario.emoji} {scenario.name}
            </option>
          ))}
        </Select>
        <Select
          value={sizePreset}
          onChange={(e) => setSizePreset(e.target.value as SizePreset)}
        >
          {(Object.keys(SIZE_PRESET_INFO) as SizePreset[]).map((key) => (
            <option key={key} value={key}>
              {SIZE_PRESET_INFO[key].label} – {SIZE_PRESET_INFO[key].customersPerDay}/den
            </option>
          ))}
        </Select>
        <Input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          aria-label="Počet skupin"
        />
      </div>
      <Button size="sm" className="mt-3" onClick={create} disabled={pending}>
        <Plus size={15} aria-hidden />
        Vytvořit {count > 1 ? `${count} projektů` : "projekt"}
      </Button>
    </Card>
  );
}

function ProjectRowCard({
  project,
  rank,
  onDeleted,
}: {
  project: ProjectOverview;
  rank: number;
  onDeleted: () => void;
}) {
  const scenario = getScenario(project.scenario_key);

  async function remove() {
    const supabase = getSupabaseBrowserClient();
    await supabase.from("projects").delete().eq("id", project.id);
    onDeleted();
  }

  return (
    <li>
      <Card className="flex flex-wrap items-center gap-4">
        <span className="w-6 text-center text-sm font-semibold text-muted">{rank}.</span>

        <div className="min-w-[180px] flex-1">
          <p className="font-medium text-ink">{project.company_name || project.name}</p>
          <p className="text-xs text-ink-2">
            {scenario.emoji} {scenario.name}
            {project.memberNames.length > 0
              ? ` · ${project.memberNames.join(", ")}`
              : " · zatím se nikdo nepřipojil"}
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm text-ink-2">
          <span title="Tabulky">{project.entityCount} tab.</span>
          <span title="Vazby">{project.relationshipCount} vaz.</span>
          <Badge tone={project.xp > 0 ? "accent" : "neutral"}>{project.xp} XP</Badge>
          <Badge tone="neutral">{project.achievementCount} 🏅</Badge>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5">
          <JoinCode code={project.join_code} className="text-sm" />
        </div>

        <div className="flex gap-1">
          <Link
            href={`/projekt/${project.id}/navrh`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-ink-2 transition hover:border-border-strong hover:text-ink"
          >
            <ExternalLink size={14} aria-hidden />
            Otevřít
          </Link>
          <button
            type="button"
            onClick={remove}
            aria-label={`Smazat projekt ${project.name}`}
            className="rounded-lg p-2 text-muted transition hover:bg-bad-soft hover:text-bad"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      </Card>
    </li>
  );
}
