"use client";

import { motion } from "motion/react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useSimStore } from "@/lib/sim/simStore";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";

/**
 * Výsledovka firmy.
 *
 * Tohle je odměna i trest v jednom: dobře navržená databáze vydělává, špatná
 * platí nájem a nemá z čeho. Číslo „ušlé tržby“ spojuje chybu v diagramu
 * přímo s penězi – to je věta, kterou si žák zapamatuje líp než „chybí cizí klíč“.
 */
export function BusinessPanel() {
  const metrics = useSimStore((s) => s.metrics);
  const ledger = useSimStore((s) => s.ledger);

  const vydelava = metrics.profit >= 0;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_1.4fr]">
      <div
        className={cn(
          "rounded-card border p-4",
          vydelava ? "border-ok/30 bg-ok-soft" : "border-bad/30 bg-bad-soft",
        )}
      >
        <div className="flex items-center gap-1.5">
          {vydelava ? (
            <TrendingUp size={15} className="text-ok" aria-hidden />
          ) : (
            <TrendingDown size={15} className="text-bad" aria-hidden />
          )}
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-2">
            {vydelava ? "Firma vydělává" : "Firma prodělává"}
          </p>
        </div>

        <motion.p
          key={Math.round(metrics.profit)}
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "mt-1 text-3xl font-semibold tabular-nums",
            vydelava ? "text-ok" : "text-bad",
          )}
        >
          {formatCurrency(metrics.profit)}
        </motion.p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted">Tržby</p>
            <p className="font-semibold tabular-nums text-ink">
              {formatCurrency(metrics.revenue)}
            </p>
          </div>
          <div>
            <p className="text-muted">Náklady</p>
            <p className="font-semibold tabular-nums text-ink">
              −{formatCurrency(metrics.expenses)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          label="Ušlé tržby"
          value={formatCurrency(metrics.lostRevenue)}
          tone={metrics.lostRevenue > 0 ? "bad" : "neutral"}
          note={
            metrics.lostRevenue > 0
              ? "tolik odešlo se zákazníky, které systém nezvládl"
              : "nic ti neuteklo"
          }
        />
        <Tile
          label="Obslouženo"
          value={formatNumber(metrics.customersServed)}
          tone="ok"
          note={`z ${formatNumber(metrics.customersArrived)} příchozích`}
        />
        <Tile
          label="Integrita dat"
          value={`${metrics.dataIntegrity} %`}
          tone={
            metrics.dataIntegrity === 100
              ? "ok"
              : metrics.dataIntegrity >= 90
                ? "warn"
                : "bad"
          }
          note={
            metrics.dataIntegrity === 100
              ? "žádný pokažený zápis"
              : `${formatNumber(metrics.integrityViolations)}× se zápis pokazil`
          }
        />
        <div className="col-span-2 lg:col-span-3">
          <ProfitBars ledger={ledger} />
        </div>
      </div>
    </div>
  );
}

const TONE = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  neutral: "text-ink",
} as const;

function Tile({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: keyof typeof TONE;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", TONE[tone])}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted">{note}</p>
    </div>
  );
}

/** Sloupec za každý uzavřený den – nahoru zisk, dolů ztráta. */
function ProfitBars({ ledger }: { ledger: { day: number; profit: number }[] }) {
  if (ledger.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-center text-[11px] text-muted">
        Po prvním uzavřeném dni se tu objeví graf zisku
      </div>
    );
  }

  const max = Math.max(...ledger.map((d) => Math.abs(d.profit)), 1);

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted">Zisk po dnech</p>
      <div className="mt-2 flex h-16 items-center gap-1">
        {ledger.slice(-14).map((den) => {
          const vyska = Math.max(3, (Math.abs(den.profit) / max) * 28);
          const kladny = den.profit >= 0;
          return (
            <div
              key={den.day}
              title={`Den ${den.day + 1}: ${formatCurrency(den.profit)}`}
              className="flex h-full flex-1 flex-col justify-center"
            >
              <div className="flex h-7 items-end justify-center">
                {kladny ? (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: vyska }}
                    className="w-full rounded-t bg-ok"
                  />
                ) : null}
              </div>
              <div className="h-px bg-border" />
              <div className="flex h-7 items-start justify-center">
                {!kladny ? (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: vyska }}
                    className="w-full rounded-b bg-bad"
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
