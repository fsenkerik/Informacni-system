"use client";

import { ArrowLeftRight, Split, Trash2 } from "lucide-react";
import { Badge, Button, Label } from "@/components/ui";
import { useSchemaStore } from "@/lib/er/store";
import { getRole, getScenario } from "@/lib/sim/scenarios";
import { RELATION_KINDS, type RelationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_EXPLANATION: Record<RelationKind, string> = {
  "1:1": "Ke každému záznamu vlevo patří právě jeden vpravo. Používá se zřídka.",
  "1:N": "Jeden záznam vlevo může mít víc záznamů vpravo. Nejčastější vazba.",
  "M:N": "Obojí může mít víc. V databázi se musí rozložit na tabulku uprostřed.",
};

export function RelationshipInspector({
  relationshipId,
  onSelectEntity,
}: {
  relationshipId: string;
  onSelectEntity: (id: string) => void;
}) {
  const relationships = useSchemaStore((s) => s.relationships);
  const entities = useSchemaStore((s) => s.entities);
  const project = useSchemaStore((s) => s.project);
  const updateRelationship = useSchemaStore((s) => s.updateRelationship);
  const deleteRelationship = useSchemaStore((s) => s.deleteRelationship);
  const createEntity = useSchemaStore((s) => s.createEntity);
  const createAttribute = useSchemaStore((s) => s.createAttribute);
  const createRelationship = useSchemaStore((s) => s.createRelationship);

  const relationship = relationships.find((r) => r.id === relationshipId);
  if (!relationship) return null;

  const from = entities.find((e) => e.id === relationship.fromEntityId);
  const to = entities.find((e) => e.id === relationship.toEntityId);
  if (!from || !to) return null;

  const scenario = getScenario(project?.scenario_key ?? "eshop");
  const junctionRole = getRole(scenario, "order_item");
  const needsJunction = relationship.kind === "M:N" && !relationship.junctionEntityId;

  /**
   * Rozklad M:N na dvě vazby 1:N.
   * Původní M:N čára zmizí – v relační databázi opravdu neexistuje, a nechat
   * ji tam by žáka mátlo, až se bude dívat na vygenerované SQL.
   */
  async function decomposeManyToMany() {
    if (!from || !to) return;
    const junction = await createEntity({
      name: junctionRole?.label.replace(/\s+/g, "") ?? `${from.name}${to.name}`,
      roleKey: junctionRole ? junctionRole.key : null,
      posX: (from.posX + to.posX) / 2,
      posY: (from.posY + to.posY) / 2 + 180,
    });
    if (!junction) return;

    for (const suggestion of junctionRole?.suggested ?? []) {
      await createAttribute({
        entityId: junction.id,
        name: suggestion.name,
        dataType: suggestion.dataType,
        semanticKey: suggestion.semantic ?? null,
        isPrimaryKey: suggestion.isPrimaryKey,
        isRequired: suggestion.isRequired,
        isUnique: suggestion.isUnique,
      });
    }

    await createRelationship({
      fromEntityId: from.id,
      toEntityId: junction.id,
      kind: "1:N",
    });
    await createRelationship({
      fromEntityId: to.id,
      toEntityId: junction.id,
      kind: "1:N",
    });
    await deleteRelationship(relationshipId);
    onSelectEntity(junction.id);
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Vazba</Label>
        <div className="mt-1.5 flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => onSelectEntity(from.id)}
            className="rounded bg-surface-3 px-2 py-1 font-medium text-ink hover:bg-border"
          >
            {from.name}
          </button>
          <span className="text-muted">→</span>
          <button
            type="button"
            onClick={() => onSelectEntity(to.id)}
            className="rounded bg-surface-3 px-2 py-1 font-medium text-ink hover:bg-border"
          >
            {to.name}
          </button>
        </div>
      </div>

      <div>
        <Label>Typ vazby</Label>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {RELATION_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => void updateRelationship(relationshipId, { kind })}
              className={cn(
                "rounded-lg border px-2 py-2 font-mono text-sm font-semibold transition",
                relationship.kind === kind
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-ink-2 hover:border-border-strong",
              )}
            >
              {kind}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-2">
          {KIND_EXPLANATION[relationship.kind]}
        </p>
      </div>

      {needsJunction ? (
        <div className="rounded-lg border border-bad/30 bg-bad-soft p-3">
          <Badge tone="bad">Takhle to databáze neuloží</Badge>
          <p className="mt-2 text-xs text-ink-2">
            Vazba M:N nejde zapsat přímo. Potřebuje tabulku uprostřed, do které
            povedou dvě vazby 1:N – tam se pak ukládá i množství.
          </p>
          <Button size="sm" className="mt-3 w-full" onClick={decomposeManyToMany}>
            <Split size={15} aria-hidden />
            Vytvořit spojovací tabulku
          </Button>
        </div>
      ) : null}

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() =>
          void updateRelationship(relationshipId, {
            fromEntityId: relationship.toEntityId,
            toEntityId: relationship.fromEntityId,
          })
        }
      >
        <ArrowLeftRight size={15} aria-hidden />
        Otočit směr
      </Button>

      <Button
        variant="danger"
        size="sm"
        className="w-full"
        onClick={() => void deleteRelationship(relationshipId)}
      >
        <Trash2 size={15} aria-hidden />
        Smazat vazbu
      </Button>
    </div>
  );
}
