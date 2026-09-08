"use client";

import { AnimatePresence, motion } from "motion/react";
import { DoorOpen, User } from "lucide-react";
import { useSchemaStore } from "@/lib/er/store";
import { useSimStore } from "@/lib/sim/simStore";
import { getRole, getScenario } from "@/lib/sim/scenarios";
import { DailyClose } from "./DailyClose";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Pořadí tabulek na scéně kopíruje cestu zákazníka zleva doprava. */
const ROLE_ORDER = ["customer", "order", "order_item", "product"];

export function SimStage() {
  const entities = useSchemaStore((s) => s.entities);
  const project = useSchemaStore((s) => s.project);
  const records = useSimStore((s) => s.records);
  const flashes = useSimStore((s) => s.flashes);
  const active = useSimStore((s) => s.activeCustomer);
  const status = useSimStore((s) => s.status);
  const moneyPops = useSimStore((s) => s.moneyPops);

  const scenario = getScenario(project?.scenario_key ?? "eshop");

  const ordered = [...entities].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.roleKey ?? "");
    const bi = ROLE_ORDER.indexOf(b.roleKey ?? "");
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const atDoor = active && !active.entityId;

  return (
    <div className="relative flex min-h-[280px] flex-1 items-center gap-4 overflow-x-auto rounded-card bg-canvas p-6">
      {/* Dveře do firmy */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="flex h-24 w-16 items-center justify-center rounded-lg border-2 border-dashed border-canvas-line text-canvas-muted">
          <DoorOpen size={22} aria-hidden />
        </div>
        <span className="text-[11px] text-canvas-muted">Vchod</span>
        <div className="h-10">
          <AnimatePresence>
            {atDoor ? <CustomerAvatar name={active.name} state="walking" /> : null}
          </AnimatePresence>
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-canvas-muted">
          Firma zatím nemá jedinou tabulku. Vrať se na kartu Návrh.
        </p>
      ) : null}

      {ordered.map((entity) => {
        const role = getRole(scenario, entity.roleKey);
        const rows = records[entity.id] ?? [];
        const flashedAt = flashes[entity.id] ?? 0;
        const isActive = active?.entityId === entity.id;

        return (
          <div key={entity.id} className="flex shrink-0 flex-col items-center gap-2">
            {/* `key` se mění s každým zápisem, takže se pulz přehraje znovu. */}
            <motion.div
              key={flashedAt}
              initial={{ boxShadow: "0 0 0 3px rgba(79,70,229,0.75)" }}
              animate={{ boxShadow: "0 0 0 0px rgba(79,70,229,0)" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={cn(
                "w-48 overflow-hidden rounded-xl border bg-canvas-2",
                isActive && active?.state === "lost"
                  ? "border-bad"
                  : "border-canvas-line",
              )}
            >
              <div
                className="px-3 py-2 text-white"
                style={{ backgroundColor: role?.color ?? "var(--color-role-custom)" }}
              >
                <p className="truncate text-sm font-semibold">{entity.name}</p>
              </div>
              <div className="px-3 py-3">
                <p className="text-2xl font-semibold tabular-nums text-canvas-ink">
                  {formatNumber(rows.length)}
                </p>
                <p className="text-[11px] text-canvas-muted">
                  {rows.length === 1 ? "řádek" : rows.length < 5 ? "řádky" : "řádků"}
                </p>
              </div>
            </motion.div>

            <div className="h-10">
              <AnimatePresence>
                {isActive ? (
                  <CustomerAvatar name={active.name} state={active.state} />
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        );
      })}

      {/* Každá koruna, co proteče pokladnou, je vidět. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center gap-8">
        <AnimatePresence>
          {moneyPops.map((pop) => (
            <motion.span
              key={pop.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: [0, 1, 1, 0], y: [12, -24, -48, -72] }}
              transition={{ duration: 1.8, times: [0, 0.15, 0.7, 1] }}
              className={cn(
                "text-lg font-semibold tabular-nums drop-shadow",
                pop.amount >= 0 ? "text-ok" : "text-bad",
              )}
            >
              {pop.amount >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(pop.amount))}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <DailyClose />

      {active && active.state === "lost" ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute inset-x-6 bottom-4 rounded-lg border border-bad/50 bg-bad-soft px-4 py-2 text-sm text-bad"
        >
          {active.message}
        </motion.div>
      ) : null}

      {status === "idle" ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-card bg-canvas/80 backdrop-blur-[2px]">
          <p className="text-sm text-canvas-muted">
            Zmáčkni Spustit a do firmy začnou chodit zákazníci.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CustomerAvatar({
  name,
  state,
}: {
  name: string;
  state: "walking" | "written" | "lost";
}) {
  return (
    <motion.div
      layoutId="aktivni-zakaznik"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="flex flex-col items-center gap-0.5"
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-white",
          state === "lost" ? "bg-bad" : state === "written" ? "bg-ok" : "bg-accent",
        )}
      >
        <User size={16} aria-hidden />
      </div>
      <span className="max-w-[80px] truncate text-[10px] text-canvas-muted">{name}</span>
    </motion.div>
  );
}
