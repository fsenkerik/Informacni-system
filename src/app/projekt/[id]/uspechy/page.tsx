"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useSchemaStore, useSnapshot } from "@/lib/er/store";
import { useSimStore } from "@/lib/sim/simStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getScenario } from "@/lib/sim/scenarios";
import {
  ACHIEVEMENTS,
  MISSIONS,
  evaluateAchievements,
  levelFor,
  xpFor,
  type AchievementContext,
} from "@/lib/game/achievements";
import { cn } from "@/lib/utils";

export default function AchievementsPage() {
  const projectId = useSchemaStore((s) => s.projectId);
  const project = useSchemaStore((s) => s.project);
  const snapshot = useSnapshot();
  const metrics = useSimStore((s) => s.metrics);
  const issues = useSimStore((s) => s.issues);

  const context: AchievementContext = useMemo(
    () => ({
      snapshot,
      scenario: getScenario(project?.scenario_key ?? "eshop"),
      metrics,
      issues,
      sizePreset: project?.size_preset ?? "small",
    }),
    // snapshot() je nová reference při každé změně diagramu, takže stačí ona.
    [snapshot, project, metrics, issues],
  );

  const unlocked = useMemo(() => evaluateAchievements(context), [context]);
  const xp = xpFor(unlocked);
  const { level, progress, toNext } = levelFor(xp);

  // Odemčené odznaky se ukládají, aby zůstaly i po zavření prohlížeče.
  useEffect(() => {
    if (!projectId || unlocked.length === 0) return;
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      await supabase.from("project_achievements").upsert(
        unlocked.map((key) => ({
          project_id: projectId,
          achievement_key: key,
          xp: ACHIEVEMENTS.find((a) => a.key === key)?.xp ?? 0,
        })),
        { onConflict: "project_id,achievement_key", ignoreDuplicates: true },
      );
      await supabase
        .from("project_progress")
        .upsert({ project_id: projectId, xp, level }, { onConflict: "project_id" });
    })();
  }, [projectId, unlocked, xp, level]);

  // Oslava se odvozuje přímo z posledního odemčeného odznaku a zhasne sama
  // klíčovými snímky – žádný stav, žádné kaskádové překreslování.
  const newest = unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
  const celebrated = newest ? ACHIEVEMENTS.find((a) => a.key === newest) : null;

  const missionsDone = MISSIONS.filter((m) => m.done(context)).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Úroveň firmy</p>
            <p className="text-3xl font-semibold text-ink">{level}</p>
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="flex justify-between text-xs text-ink-2">
              <span>{xp} XP</span>
              <span>ještě {toNext} XP do dalšího levelu</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
          <Badge tone="accent">
            {unlocked.length} z {ACHIEVEMENTS.length} odznaků
          </Badge>
        </div>
      </Card>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Mise</h2>
          <span className="text-sm text-ink-2">
            {missionsDone} / {MISSIONS.length} hotovo
          </span>
        </div>
        <ol className="mt-3 space-y-2">
          {MISSIONS.map((mission) => {
            const done = mission.done(context);
            return (
              <li
                key={mission.key}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-4 py-3",
                  done ? "border-ok/30 bg-ok-soft" : "border-border bg-surface",
                )}
              >
                {done ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden />
                ) : (
                  <Circle size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                )}
                <div>
                  <p className={cn("text-sm font-medium", done ? "text-ok" : "text-ink")}>
                    {mission.label}
                  </p>
                  {!done ? (
                    <p className="mt-0.5 text-xs text-ink-2">{mission.hint}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">Odznaky</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((achievement) => {
            const has = unlocked.includes(achievement.key);
            return (
              <li
                key={achievement.key}
                className={cn(
                  "rounded-card border p-4 transition",
                  has ? "border-accent/40 bg-surface" : "border-border bg-surface-2",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("text-2xl", !has && "opacity-30 grayscale")} aria-hidden>
                    {achievement.emoji}
                  </span>
                  {has ? (
                    <Badge tone="accent">+{achievement.xp} XP</Badge>
                  ) : (
                    <Lock size={14} className="mt-1 text-muted" aria-hidden />
                  )}
                </div>
                <p className={cn("mt-2 font-medium", has ? "text-ink" : "text-ink-2")}>
                  {achievement.label}
                </p>
                <p className="mt-1 text-xs text-ink-2">
                  {has ? achievement.description : achievement.how}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <AnimatePresence>
        {celebrated ? (
          <motion.div
            key={celebrated.key}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1, 0], y: [40, 0, 0, 12], scale: [0.9, 1, 1, 0.97] }}
            transition={{ duration: 2.8, times: [0, 0.12, 0.82, 1] }}
            className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-accent/40 bg-surface px-5 py-3 shadow-xl"
          >
            <p className="text-sm font-semibold text-ink">
              {celebrated.emoji} Nový odznak: {celebrated.label}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
