"use client";

import { useState } from "react";
import { ListChecks, Plus, SlidersHorizontal } from "lucide-react";
import { ErCanvas } from "@/components/er/ErCanvas";
import { EntityInspector } from "@/components/er/EntityInspector";
import { RelationshipInspector } from "@/components/er/RelationshipInspector";
import { ChecklistSummary, DesignChecklist } from "@/components/er/DesignChecklist";
import { Badge, Button } from "@/components/ui";
import { useSchemaStore, useSnapshot } from "@/lib/er/store";
import { getScenario } from "@/lib/sim/scenarios";
import { entityForRole } from "@/lib/sim/requirements";
import { cn } from "@/lib/utils";

type PanelTab = "properties" | "check";

export default function DesignPage() {
  const [tab, setTab] = useState<PanelTab>("properties");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);

  const project = useSchemaStore((s) => s.project);
  const entities = useSchemaStore((s) => s.entities);
  const selectedEntityId = useSchemaStore((s) => s.selectedEntityId);
  const select = useSchemaStore((s) => s.select);
  const createEntity = useSchemaStore((s) => s.createEntity);
  const createAttribute = useSchemaStore((s) => s.createAttribute);
  const canEdit = useSchemaStore((s) => s.canEdit);
  const snapshot = useSnapshot();

  const scenario = getScenario(project?.scenario_key ?? "eshop");
  const current = snapshot;
  const missingRoles = scenario.roles.filter((role) => !entityForRole(current, role.key));

  async function addRoleTable(roleKey: string) {
    const role = scenario.roles.find((r) => r.key === roleKey);
    if (!role) return;

    const created = await createEntity({
      name: role.label.replace(/\s+/g, ""),
      roleKey: role.key,
      posX: 120 + entities.length * 300,
      posY: 140 + (entities.length % 2) * 260,
    });
    if (!created) return;

    for (const suggestion of role.suggested) {
      await createAttribute({
        entityId: created.id,
        name: suggestion.name,
        dataType: suggestion.dataType,
        semanticKey: suggestion.semantic ?? null,
        isPrimaryKey: suggestion.isPrimaryKey,
        isRequired: suggestion.isRequired,
        isUnique: suggestion.isUnique,
      });
    }
    setSelectedRelationshipId(null);
    setTab("properties");
  }

  return (
    <div className="flex min-h-0 flex-1">
      <section className="relative min-w-0 flex-1">
        <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
          {canEdit ? (
            <>
          <Button
            size="sm"
            onClick={() =>
              void createEntity({
                name: `Tabulka${entities.length + 1}`,
                posX: 160 + entities.length * 60,
                posY: 160 + entities.length * 40,
              })
            }
          >
            <Plus size={15} aria-hidden />
            Nová tabulka
          </Button>

          {missingRoles.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() => void addRoleTable(role.key)}
              className="rounded-lg border border-canvas-line bg-canvas-2 px-3 py-1.5 text-xs font-medium text-canvas-ink transition hover:border-accent"
            >
              + {role.label}
            </button>
          ))}
            </>
          ) : (
            <span className="rounded-lg bg-canvas-2/90 px-3 py-1.5 text-xs text-canvas-muted">
              Jen pro čtení – diagram upravují členové skupiny.
            </span>
          )}
        </div>

        {canEdit ? (
          <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-canvas-2/90 px-3 py-2 text-xs text-canvas-muted backdrop-blur">
            Vazbu nakreslíš tažením z pravého okraje tabulky do levého okraje jiné.
          </div>
        ) : null}

        <ErCanvas
          selectedRelationshipId={selectedRelationshipId}
          onSelectRelationship={setSelectedRelationshipId}
        />
      </section>

      <aside className="flex w-[380px] shrink-0 flex-col border-l border-border bg-surface">
        <div className="flex border-b border-border">
          <PanelTabButton
            active={tab === "properties"}
            onClick={() => setTab("properties")}
            icon={<SlidersHorizontal size={15} aria-hidden />}
          >
            Vlastnosti
          </PanelTabButton>
          <PanelTabButton
            active={tab === "check"}
            onClick={() => setTab("check")}
            icon={<ListChecks size={15} aria-hidden />}
          >
            Kontrola návrhu
          </PanelTabButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "check" ? (
            <DesignChecklist />
          ) : selectedRelationshipId ? (
            <RelationshipInspector
              relationshipId={selectedRelationshipId}
              onSelectEntity={(id) => {
                select(id);
                setSelectedRelationshipId(null);
              }}
            />
          ) : selectedEntityId ? (
            <EntityInspector entityId={selectedEntityId} />
          ) : (
            <ScenarioBriefing scenarioKey={scenario.key} />
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <ChecklistSummary />
        </div>
      </aside>
    </div>
  );
}

function PanelTabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
        active ? "border-accent text-accent" : "border-transparent text-ink-2 hover:text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Zadání scénáře – co má firma umět, než ji pustíme do provozu. */
function ScenarioBriefing({ scenarioKey }: { scenarioKey: string }) {
  const scenario = getScenario(scenarioKey);

  return (
    <div className="space-y-5">
      <div>
        <span className="text-2xl" aria-hidden>
          {scenario.emoji}
        </span>
        <h2 className="mt-1 text-lg font-semibold text-ink">{scenario.name}</h2>
        <p className="mt-1 text-sm text-ink-2">{scenario.description}</p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Co musí firma umět
        </h3>
        <ul className="mt-2 space-y-2">
          {scenario.roles.map((role) => (
            <li key={role.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: role.color }}
                  aria-hidden
                />
                <p className="text-sm font-medium text-ink">{role.label}</p>
              </div>
              <p className="mt-1 text-xs text-ink-2">{role.description}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Vazby, které potřebuješ
        </h3>
        <ul className="mt-2 space-y-2">
          {scenario.expectedLinks.map((link) => {
            const from = scenario.roles.find((r) => r.key === link.from);
            const to = scenario.roles.find((r) => r.key === link.to);
            return (
              <li key={`${link.from}-${link.to}`} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-ink">{from?.label}</span>
                  <Badge tone="accent" className="font-mono">
                    {link.relation}
                  </Badge>
                  <span className="font-medium text-ink">{to?.label}</span>
                </div>
                <p className="mt-1 text-xs text-ink-2">{link.why}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs text-muted">
        Klikni na tabulku nebo vazbu v diagramu a uprav ji tady.
      </p>
    </div>
  );
}
