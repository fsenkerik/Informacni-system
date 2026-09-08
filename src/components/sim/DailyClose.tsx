"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSimStore } from "@/lib/sim/simStore";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";

/**
 * Denní uzávěrka.
 *
 * Na konci každého herního dne vyjede karta s tím, jak firma dopadla. Je to
 * jediný okamžik, kdy se čísla zastaví a dají se přečíst – při 60× rychlosti
 * jinak jen probleskují.
 */
export function DailyClose() {
  const den = useSimStore((s) => s.lastDay);

  return (
    <AnimatePresence>
      {den ? (
        <motion.div
          key={den.day}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [24, 0, 0, -8],
            scale: [0.96, 1, 1, 0.99],
          }}
          transition={{ duration: 5, times: [0, 0.06, 0.88, 1] }}
          className={cn(
            "pointer-events-none absolute right-5 top-5 z-20 w-64 rounded-card border p-4 shadow-2xl",
            den.profit >= 0
              ? "border-ok/40 bg-ok-soft"
              : "border-bad/40 bg-bad-soft",
          )}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-2">
            Uzávěrka dne {den.day + 1}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              den.profit >= 0 ? "text-ok" : "text-bad",
            )}
          >
            {den.profit >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(den.profit))}
          </p>

          <dl className="mt-3 space-y-1 text-xs text-ink-2">
            <Radek popis="Tržby" hodnota={formatCurrency(den.revenue)} />
            <Radek popis="Náklady" hodnota={`−${formatCurrency(den.expenses)}`} />
            <Radek
              popis="Obslouženo"
              hodnota={`${formatNumber(den.served)} zákazníků`}
            />
            {den.lost > 0 ? (
              <Radek
                popis="Ztraceno"
                hodnota={`${formatNumber(den.lost)} · ${formatCurrency(den.lostRevenue)}`}
                zvyraznit
              />
            ) : null}
          </dl>

          <p className="mt-3 text-xs font-medium text-ink">{verdikt(den)}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Radek({
  popis,
  hodnota,
  zvyraznit,
}: {
  popis: string;
  hodnota: string;
  zvyraznit?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{popis}</dt>
      <dd
        className={cn(
          "font-medium tabular-nums",
          zvyraznit ? "text-bad" : "text-ink",
        )}
      >
        {hodnota}
      </dd>
    </div>
  );
}

function verdikt(den: {
  profit: number;
  lost: number;
  served: number;
  lostRevenue: number;
}): string {
  if (den.lost > 0 && den.served === 0) {
    return "Systém neobsloužil nikoho. Podívej se na kartu Návrh, co mu chybí.";
  }
  if (den.lost > 0) {
    return `Kdyby systém zvládl i těch ${den.lost} zákazníků, měl jsi navíc ${formatCurrency(den.lostRevenue)}.`;
  }
  if (den.profit < 0) {
    return "Nikoho jsi neztratil, ale nájem se zatím nezaplatil. Zkus větší provoz.";
  }
  return "Všichni obslouženi a firma v plusu. Přesně tak to má vypadat.";
}
