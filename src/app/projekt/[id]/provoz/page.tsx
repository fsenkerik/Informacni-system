"use client";

import { useEffect } from "react";
import { PackagePlus, Pause, Play, Square } from "lucide-react";
import { SimStage } from "@/components/sim/SimStage";
import { BusinessPanel } from "@/components/sim/BusinessPanel";
import { IssuePanel } from "@/components/sim/IssuePanel";
import { EventLog, formatClock } from "@/components/sim/EventLog";
import { Badge, Button, Card, Select } from "@/components/ui";
import { useSchemaStore, useSnapshot } from "@/lib/er/store";
import { useFirmStore } from "@/lib/firma/store";
import { SPEEDS, useSimStore } from "@/lib/sim/simStore";
import { describeReadiness } from "@/lib/sim/requirements";
import { getScenario } from "@/lib/sim/scenarios";
import { SIZE_PRESET_INFO, type SizePreset } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function OperationsPage() {
  const project = useSchemaStore((s) => s.project);
  const projectId = useSchemaStore((s) => s.projectId);
  const entities = useSchemaStore((s) => s.entities);
  const current = useSnapshot();

  const status = useSimStore((s) => s.status);
  const speed = useSimStore((s) => s.speed);
  const clock = useSimStore((s) => s.clock);
  const day = useSimStore((s) => s.day);
  const isOpen = useSimStore((s) => s.isOpen);
  const start = useSimStore((s) => s.start);
  const pause = useSimStore((s) => s.pause);
  const resume = useSimStore((s) => s.resume);
  const stop = useSimStore((s) => s.stop);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const syncSchema = useSimStore((s) => s.syncSchema);
  const watch = useSimStore((s) => s.watch);
  const restockNow = useSimStore((s) => s.restockNow);

  const loadFirm = useFirmStore((s) => s.load);
  const settings = useFirmStore((s) => s.settings);
  const catalog = useFirmStore((s) => s.catalog);

  const scenario = getScenario(project?.scenario_key ?? "eshop");
  const readiness = describeReadiness(current, scenario);
  const blocking = readiness.filter((step) => !step.ready && !step.optional);

  // Když spolužák během provozu opraví diagram, engine musí dostat novou verzi.
  useEffect(() => {
    syncSchema(current);
  }, [current, syncSchema]);

  useEffect(() => {
    if (!projectId) return;
    return watch(projectId);
  }, [projectId, watch]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function run() {
      await loadFirm(projectId!);
      if (cancelled) return;
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadFirm]);

  async function handleStart() {
    if (!projectId || !project) return;
    await start({
      projectId,
      snapshot: current,
      scenarioKey: project.scenario_key,
      sizePreset: project.size_preset,
      settings,
      catalog,
    });
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-[1600px] min-h-0 flex-col gap-4 px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {status === "running" ? (
            <Button variant="secondary" onClick={pause}>
              <Pause size={16} aria-hidden />
              Pozastavit
            </Button>
          ) : status === "paused" ? (
            <Button onClick={resume}>
              <Play size={16} aria-hidden />
              Pokračovat
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={entities.length === 0}>
              <Play size={16} aria-hidden />
              Spustit provoz
            </Button>
          )}

          {status !== "idle" ? (
            <Button variant="ghost" onClick={() => void stop()}>
              <Square size={16} aria-hidden />
              Ukončit
            </Button>
          ) : null}

          {status !== "idle" && !settings.autoRestock ? (
            <Button variant="secondary" onClick={() => restockNow()}>
              <PackagePlus size={16} aria-hidden />
              Doplnit sklad
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {SPEEDS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSpeed(option.value)}
              title={option.hint}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                speed === option.value
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-ink-2 hover:border-border-strong",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <SizeSelector />

        <div className="ml-auto flex items-center gap-3">
          <Badge tone={isOpen ? "ok" : "neutral"}>
            {isOpen ? "Otevřeno" : "Zavřeno"}
          </Badge>
          <div className="rounded-lg border border-border bg-surface px-3 py-1.5">
            <span className="text-xs text-muted">Den {day + 1} ·</span>
            <span className="ml-1.5 font-mono text-sm font-semibold tabular-nums text-ink">
              {formatClock(clock)}
            </span>
          </div>
        </div>
      </div>

      {blocking.length > 0 && status === "idle" ? (
        <Card className="border-warn/40 bg-warn-soft">
          <p className="text-sm font-semibold text-warn">
            Firma zatím nezvládne celou cestu zákazníka
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
            {blocking.map((step) => (
              <li key={step.stepKey}>
                <span className="font-medium text-ink">{step.label}:</span>{" "}
                {step.issue?.message}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-2">
            Spustit to můžeš i tak – uvidíš přesně, kde se zákazníci zaseknou.
          </p>
        </Card>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-h-0 flex-col gap-4">
          <SimStage />
          <BusinessPanel />
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="flex min-h-0 flex-col p-0">
            <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-ink">
              Co je špatně
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <IssuePanel projectId={projectId ?? ""} />
            </div>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col p-0">
            <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-ink">
              Provozní deník
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <EventLog />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

/** Velikost firmy určuje, kolik zákazníků denně dorazí. */
function SizeSelector() {
  const project = useSchemaStore((s) => s.project);
  const status = useSimStore((s) => s.status);

  async function change(value: SizePreset) {
    if (!project) return;
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const supabase = getSupabaseBrowserClient();
    await supabase.from("projects").update({ size_preset: value }).eq("id", project.id);
    useSchemaStore.setState({ project: { ...project, size_preset: value } });
  }

  if (!project) return null;

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Velikost firmy"
        className="h-9 w-52 text-xs"
        value={project.size_preset}
        disabled={status !== "idle"}
        onChange={(e) => void change(e.target.value as SizePreset)}
      >
        {(Object.keys(SIZE_PRESET_INFO) as SizePreset[]).map((key) => (
          <option key={key} value={key}>
            {SIZE_PRESET_INFO[key].label} – {SIZE_PRESET_INFO[key].customersPerDay}/den
          </option>
        ))}
      </Select>
    </div>
  );
}
