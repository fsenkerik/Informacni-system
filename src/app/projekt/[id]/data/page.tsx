"use client";

import { useState } from "react";
import { Card, EmptyState, Input } from "@/components/ui";
import { useSchemaStore, useSnapshot } from "@/lib/er/store";
import { useSimStore } from "@/lib/sim/simStore";
import { getRole, getScenario } from "@/lib/sim/scenarios";
import { foreignKeyColumn } from "@/lib/sim/generator";
import { attributesOf } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Prohlížeč dat, která simulace vygenerovala do žákových tabulek.
 * Tady je vidět, že cizí klíč není abstrakce – je to sloupec s číslem.
 */
export default function DataPage() {
  const entities = useSchemaStore((s) => s.entities);
  const project = useSchemaStore((s) => s.project);
  const snapshot = useSnapshot();
  const records = useSimStore((s) => s.records);
  const rowCounts = useSimStore((s) => s.rowCounts);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const scenario = getScenario(project?.scenario_key ?? "eshop");
  const current = snapshot;
  const selected = entities.find((e) => e.id === (activeId ?? entities[0]?.id));

  const totalRows = Object.values(rowCounts).reduce((sum, n) => sum + n, 0);

  if (entities.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <EmptyState
          title="Firma nemá tabulky"
          description="Nejdřív si na kartě Návrh vytvoř databázi, pak sem dorazí data."
        />
      </main>
    );
  }

  if (totalRows === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <EmptyState
          title="Zatím tu nejsou žádná data"
          description="Data vzniknou, až na kartě Provoz spustíš simulaci a začnou chodit zákazníci."
        />
      </main>
    );
  }

  const rows = selected ? (records[selected.id] ?? []) : [];
  const attributes = selected ? attributesOf(current, selected.id) : [];

  // Cizí klíče nejsou v atributech – dopočítaly se při simulaci z vazeb.
  const extraColumns = Array.from(
    new Set(
      rows.flatMap((r) =>
        Object.keys(r.data).filter((k) => !attributes.some((a) => a.name === k)),
      ),
    ),
  );

  const visible = filter
    ? rows.filter((r) =>
        Object.values(r.data).some((v) =>
          String(v ?? "").toLowerCase().includes(filter.toLowerCase()),
        ),
      )
    : rows;

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 gap-5 px-6 py-6">
      <nav className="w-56 shrink-0 space-y-1">
        {entities.map((entity) => {
          const role = getRole(scenario, entity.roleKey);
          const count = rowCounts[entity.id] ?? 0;
          const active = entity.id === selected?.id;
          return (
            <button
              key={entity.id}
              type="button"
              onClick={() => setActiveId(entity.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-ink-2 hover:border-border-strong",
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: role?.color ?? "var(--color-role-custom)" }}
                aria-hidden
              />
              <span className="truncate font-medium">{entity.name}</span>
              <span className="ml-auto tabular-nums text-xs text-muted">{count}</span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-ink">{selected?.name}</h1>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Hledat v datech…"
            className="w-64"
          />
        </div>

        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left">
                {attributes.map((attribute) => (
                  <th key={attribute.id} className="px-3 py-2 font-medium text-ink-2">
                    {attribute.name}
                    {attribute.isPrimaryKey ? (
                      <span className="ml-1 text-[10px] text-warn">PK</span>
                    ) : null}
                  </th>
                ))}
                {extraColumns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium text-accent">
                    {column}
                    <span className="ml-1 text-[10px]">FK</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((record) => (
                <tr key={record.id} className="border-b border-border/60 last:border-0">
                  {attributes.map((attribute) => (
                    <td key={attribute.id} className="px-3 py-1.5 text-ink">
                      {formatCell(record.data[attribute.name])}
                    </td>
                  ))}
                  {extraColumns.map((column) => (
                    <td key={column} className="px-3 py-1.5 font-mono text-xs text-accent">
                      {formatCell(record.data[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {extraColumns.length > 0 ? (
          <p className="mt-3 text-xs text-ink-2">
            Sloupce označené <span className="font-medium text-accent">FK</span> jsi
            nekreslil ručně – dopočítaly se z vazeb. Přesně takhle vzniká cizí klíč
            v opravdové databázi (například{" "}
            <code className="font-mono">{foreignKeyColumn("Zákazník")}</code>).
          </p>
        ) : null}

        <p className="mt-1 text-xs text-muted">
          Náhled posledních {visible.length} řádků. Celkem jich v tabulce je{" "}
          {selected ? (rowCounts[selected.id] ?? 0) : 0}.
        </p>
      </div>
    </main>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "ano" : "ne";
  if (typeof value === "number") return String(value);
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
