"use client";

import { useSimStore } from "@/lib/sim/simStore";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Metriky jsou pro žáka zpětná vazba: dobrý návrh = zelená čísla. */
export function MetricsPanel() {
  const metrics = useSimStore((s) => s.metrics);

  const lostShare =
    metrics.customersArrived > 0
      ? metrics.customersLost / metrics.customersArrived
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Metric
        label="Obsloužení zákazníci"
        value={formatNumber(metrics.customersServed)}
        tone="ok"
      />
      <Metric
        label="Ztracení zákazníci"
        value={formatNumber(metrics.customersLost)}
        tone={metrics.customersLost === 0 ? "neutral" : lostShare > 0.2 ? "bad" : "warn"}
      />
      <Metric
        label="Integrita dat"
        value={`${metrics.dataIntegrity} %`}
        tone={
          metrics.dataIntegrity === 100
            ? "ok"
            : metrics.dataIntegrity >= 90
              ? "warn"
              : "bad"
        }
      />
      <Metric label="Tržba" value={formatCurrency(metrics.revenue)} tone="neutral" />
      <Metric
        label="Objednávky"
        value={formatNumber(metrics.ordersCreated)}
        tone="neutral"
      />
      <Metric
        label="Zapsané řádky"
        value={formatNumber(metrics.recordsWritten)}
        tone="neutral"
      />
    </div>
  );
}

const TONE_CLASS = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  neutral: "text-ink",
} as const;

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof TONE_CLASS;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", TONE_CLASS[tone])}>
        {value}
      </p>
    </div>
  );
}
