"use client";

import { useSimStore } from "@/lib/sim/simStore";
import { cn } from "@/lib/utils";

const SEVERITY_CLASS = {
  info: "text-ink-2",
  warn: "text-warn",
  error: "text-bad",
} as const;

/** Živý provozní deník. Čte se shora dolů, nejnovější nahoře. */
export function EventLog() {
  const log = useSimStore((s) => s.log);
  const clock = useSimStore((s) => s.clock);

  if (log.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted">
        Zatím se nic nestalo.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/70">
      {log.map((event, index) => (
        <li
          key={`${event.tick}-${index}-${event.type}`}
          className="flex gap-2 px-3 py-1.5 text-xs"
        >
          <span className="shrink-0 font-mono tabular-nums text-muted">
            {formatClock(event.tick > 0 ? event.tick + 8 * 60 : clock)}
          </span>
          <span className={cn("min-w-0", SEVERITY_CLASS[event.severity])}>
            {event.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function formatClock(minutes: number): string {
  const inDay = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(inDay / 60);
  const m = inDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
