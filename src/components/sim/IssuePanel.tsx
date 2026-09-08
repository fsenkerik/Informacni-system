"use client";

import { useRouter } from "next/navigation";
import { AlertOctagon, Wrench } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { useSchemaStore } from "@/lib/er/store";
import { useSimStore } from "@/lib/sim/simStore";
import { ISSUE_TITLES } from "@/lib/sim/issues";

/**
 * Seznam chyb, na které simulace narazila – a hlavně tlačítko „Oprav to“,
 * které skočí do diagramu a zvýrazní přesně to místo. Bez něj by žák věděl,
 * že něco nefunguje, ale ne kde.
 */
export function IssuePanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const issues = useSimStore((s) => s.issues);
  const select = useSchemaStore((s) => s.select);
  const highlight = useSchemaStore((s) => s.highlight);
  const entities = useSchemaStore((s) => s.entities);

  if (issues.length === 0) {
    return (
      <p className="rounded-lg border border-ok/30 bg-ok-soft px-3 py-4 text-center text-sm text-ok">
        Zatím žádná chyba. Systém zvládá všechno, co po něm zákazníci chtějí.
      </p>
    );
  }

  function fix(entityId?: string, roles?: string[]) {
    const targets = entityId
      ? [entityId]
      : entities
          .filter((e) => e.roleKey && (roles ?? []).includes(e.roleKey))
          .map((e) => e.id);

    highlight(targets);
    if (targets.length === 1) select(targets[0]);
    router.push(`/projekt/${projectId}/navrh`);
  }

  return (
    <ul className="space-y-2">
      {issues.map((issue) => (
        <li
          key={`${issue.code}-${issue.entityId ?? ""}-${issue.relationshipId ?? ""}`}
          className="rounded-lg border border-bad/30 bg-surface p-3"
        >
          <div className="flex items-start gap-2">
            <AlertOctagon size={16} className="mt-0.5 shrink-0 text-bad" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">
                  {ISSUE_TITLES[issue.code]}
                </p>
                <Badge tone="bad">{issue.count}×</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-2">{issue.message}</p>
              <p className="mt-1.5 text-xs font-medium text-accent">{issue.fix}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2.5"
                onClick={() => fix(issue.entityId, issue.roles)}
              >
                <Wrench size={14} aria-hidden />
                Oprav to
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
