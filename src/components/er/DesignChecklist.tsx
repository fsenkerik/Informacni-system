"use client";

import { AlertCircle, CheckCircle2, Info, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui";
import { useSchemaStore, useSnapshot } from "@/lib/er/store";
import { validateSchema, type Finding, type FindingLevel } from "@/lib/er/validate";
import { getScenario } from "@/lib/sim/scenarios";

const LEVEL_META: Record<
  FindingLevel,
  { icon: typeof AlertCircle; tone: "bad" | "warn" | "accent"; label: string }
> = {
  error: { icon: AlertCircle, tone: "bad", label: "Zastaví provoz" },
  warn: { icon: Info, tone: "warn", label: "Špatný návyk" },
  hint: { icon: Lightbulb, tone: "accent", label: "Rada" },
};

/**
 * Kontrola návrhu běží při každé změně diagramu – dvojice tak nemusí spouštět
 * simulaci, aby zjistila, že jim chybí primární klíč.
 */
export function DesignChecklist() {
  const project = useSchemaStore((s) => s.project);
  const snapshot = useSnapshot();
  const select = useSchemaStore((s) => s.select);
  const highlight = useSchemaStore((s) => s.highlight);

  const scenario = getScenario(project?.scenario_key ?? "eshop");
  const findings = validateSchema(snapshot, scenario);

  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-ok/30 bg-ok-soft p-4 text-center">
        <CheckCircle2 className="mx-auto text-ok" size={22} aria-hidden />
        <p className="mt-2 text-sm font-semibold text-ok">Návrh je v pořádku</p>
        <p className="mt-1 text-xs text-ink-2">
          Můžeš přejít na kartu Provoz a pustit do firmy zákazníky.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {findings.map((finding) => (
        <FindingRow
          key={finding.id}
          finding={finding}
          onFocus={() => {
            if (finding.entityId) {
              select(finding.entityId);
              highlight([finding.entityId]);
            }
          }}
        />
      ))}
    </ul>
  );
}

function FindingRow({
  finding,
  onFocus,
}: {
  finding: Finding;
  onFocus: () => void;
}) {
  const meta = LEVEL_META[finding.level];
  const Icon = meta.icon;

  return (
    <li>
      <button
        type="button"
        onClick={onFocus}
        className="w-full rounded-lg border border-border bg-surface p-3 text-left transition hover:border-border-strong"
      >
        <div className="flex items-start gap-2">
          <Icon
            size={16}
            aria-hidden
            className={
              finding.level === "error"
                ? "mt-0.5 shrink-0 text-bad"
                : finding.level === "warn"
                  ? "mt-0.5 shrink-0 text-warn"
                  : "mt-0.5 shrink-0 text-accent"
            }
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{finding.title}</p>
            <p className="mt-0.5 text-xs text-ink-2">{finding.message}</p>
            <p className="mt-1.5 text-xs font-medium text-accent">{finding.fix}</p>
          </div>
        </div>
      </button>
    </li>
  );
}

export function ChecklistSummary() {
  const project = useSchemaStore((s) => s.project);
  const snapshot = useSnapshot();
  const scenario = getScenario(project?.scenario_key ?? "eshop");
  const findings = validateSchema(snapshot, scenario);
  const errors = findings.filter((f) => f.level === "error").length;
  const warnings = findings.filter((f) => f.level === "warn").length;

  if (findings.length === 0) {
    return <Badge tone="ok">Návrh je v pořádku</Badge>;
  }
  return (
    <div className="flex gap-1.5">
      {errors > 0 ? <Badge tone="bad">{errors}× zastaví provoz</Badge> : null}
      {warnings > 0 ? <Badge tone="warn">{warnings}× k opravě</Badge> : null}
    </div>
  );
}
