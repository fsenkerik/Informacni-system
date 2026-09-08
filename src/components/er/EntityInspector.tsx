"use client";

import { Plus, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Input, Label, Select } from "@/components/ui";
import { useSchemaStore, useSnapshot } from "@/lib/er/store";
import { SEMANTIC_OPTIONS, guessSemantic } from "@/lib/er/semantics";
import { getRole, getScenario } from "@/lib/sim/scenarios";
import {
  DATA_TYPES,
  DATA_TYPE_INFO,
  attributesOf,
  type AttributeRecord,
  type DataType,
} from "@/lib/types";

export function EntityInspector({ entityId }: { entityId: string }) {
  const entities = useSchemaStore((s) => s.entities);
  const project = useSchemaStore((s) => s.project);
  const snapshot = useSnapshot();
  const renameEntity = useSchemaStore((s) => s.renameEntity);
  const setEntityRole = useSchemaStore((s) => s.setEntityRole);
  const deleteEntity = useSchemaStore((s) => s.deleteEntity);
  const createAttribute = useSchemaStore((s) => s.createAttribute);
  const updateAttribute = useSchemaStore((s) => s.updateAttribute);
  const deleteAttribute = useSchemaStore((s) => s.deleteAttribute);

  const entity = entities.find((e) => e.id === entityId);
  if (!entity) return null;

  const scenario = getScenario(project?.scenario_key ?? "eshop");
  const role = getRole(scenario, entity.roleKey);
  const attributes = attributesOf(snapshot, entity.id);
  const takenRoles = new Set(
    entities.filter((e) => e.id !== entity.id).map((e) => e.roleKey),
  );

  const missingSuggested = (role?.suggested ?? []).filter(
    (s) => !attributes.some((a) => a.name.toLowerCase() === s.name.toLowerCase()),
  );

  async function addSuggested() {
    for (const suggestion of missingSuggested) {
      await createAttribute({
        entityId,
        name: suggestion.name,
        dataType: suggestion.dataType,
        semanticKey: suggestion.semantic ?? null,
        isPrimaryKey: suggestion.isPrimaryKey,
        isRequired: suggestion.isRequired,
        isUnique: suggestion.isUnique,
      });
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="entity-name">Název tabulky</Label>
        <Input
          id="entity-name"
          value={entity.name}
          onChange={(e) => void renameEntity(entity.id, e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entity-role" hint="co tabulka ve firmě znamená">
          Role ve scénáři
        </Label>
        <Select
          id="entity-role"
          value={entity.roleKey ?? ""}
          onChange={(e) => void setEntityRole(entity.id, e.target.value || null)}
        >
          <option value="">Bez role – vlastní tabulka navíc</option>
          {scenario.roles.map((r) => (
            <option key={r.key} value={r.key} disabled={takenRoles.has(r.key)}>
              {r.label}
              {takenRoles.has(r.key) ? " (už je obsazená)" : ""}
            </option>
          ))}
        </Select>
        {role ? (
          <p className="text-xs text-ink-2">{role.description}</p>
        ) : (
          <p className="text-xs text-muted">
            Bez role se do téhle tabulky simulace nic nezapíše – zákazníci o ní nevědí.
          </p>
        )}
      </div>

      {missingSuggested.length > 0 ? (
        <Button variant="secondary" size="sm" className="w-full" onClick={addSuggested}>
          <Wand2 size={15} aria-hidden />
          Doplnit sloupce, které tabulka „{role?.label}“ obvykle má
        </Button>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Sloupce</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void createAttribute({
                entityId,
                name: `sloupec_${attributes.length + 1}`,
              })
            }
          >
            <Plus size={15} aria-hidden />
            Přidat
          </Button>
        </div>

        {attributes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted">
            Tabulka nemá sloupce. Bez nich se do ní nedá nic uložit.
          </p>
        ) : (
          <ul className="space-y-3">
            {attributes.map((attribute) => (
              <AttributeEditor
                key={attribute.id}
                attribute={attribute}
                onChange={(patch) => void updateAttribute(attribute.id, patch)}
                onDelete={() => void deleteAttribute(attribute.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <Button
        variant="danger"
        size="sm"
        className="w-full"
        onClick={() => void deleteEntity(entity.id)}
      >
        <Trash2 size={15} aria-hidden />
        Smazat tabulku
      </Button>
    </div>
  );
}

function AttributeEditor({
  attribute,
  onChange,
  onDelete,
}: {
  attribute: AttributeRecord;
  onChange: (patch: Partial<AttributeRecord>) => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2">
        <Input
          value={attribute.name}
          aria-label="Název sloupce"
          className="h-8 bg-surface text-sm"
          onChange={(e) => {
            const name = e.target.value;
            // Význam se odhadne z názvu, ale jen dokud si ho žák nenastaví sám.
            const patch: Partial<AttributeRecord> = { name };
            if (!attribute.semanticKey) {
              const guessed = guessSemantic(name);
              if (guessed) patch.semanticKey = guessed;
            }
            onChange(patch);
          }}
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Smazat sloupec ${attribute.name}`}
          className="shrink-0 rounded p-1.5 text-muted transition hover:bg-bad-soft hover:text-bad"
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select
          value={attribute.dataType}
          aria-label="Datový typ"
          className="h-8 bg-surface text-xs"
          onChange={(e) => onChange({ dataType: e.target.value as DataType })}
        >
          {DATA_TYPES.map((type) => (
            <option key={type} value={type}>
              {DATA_TYPE_INFO[type].label}
            </option>
          ))}
        </Select>

        <Select
          value={attribute.semanticKey ?? ""}
          aria-label="Význam sloupce"
          className="h-8 bg-surface text-xs"
          onChange={(e) => onChange({ semanticKey: e.target.value || null })}
        >
          <option value="">Bez významu</option>
          {SEMANTIC_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <p className="mt-1.5 text-[11px] text-muted">
        {DATA_TYPE_INFO[attribute.dataType].hint}
      </p>

      {attribute.dataType === "VARCHAR" ? (
        <div className="mt-2 flex items-center gap-2">
          <Label htmlFor={`len-${attribute.id}`}>Max. délka</Label>
          <Input
            id={`len-${attribute.id}`}
            type="number"
            min={1}
            max={4000}
            value={attribute.length ?? 255}
            className="h-8 w-24 bg-surface text-xs"
            onChange={(e) => onChange({ length: Number(e.target.value) || null })}
          />
        </div>
      ) : null}

      {attribute.dataType === "ENUM" ? (
        <div className="mt-2 space-y-1">
          <Label htmlFor={`enum-${attribute.id}`} hint="oddělené čárkou">
            Povolené hodnoty
          </Label>
          <Input
            id={`enum-${attribute.id}`}
            value={(attribute.enumValues ?? []).join(", ")}
            placeholder="nová, zaplacená, odeslaná"
            className="h-8 bg-surface text-xs"
            onChange={(e) =>
              onChange({
                enumValues: e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-3 text-xs">
        <Toggle
          checked={attribute.isPrimaryKey}
          onChange={(v) => onChange({ isPrimaryKey: v, isRequired: v || attribute.isRequired })}
          label="Primární klíč"
        />
        <Toggle
          checked={attribute.isRequired}
          onChange={(v) => onChange({ isRequired: v })}
          label="Povinné"
        />
        <Toggle
          checked={attribute.isUnique}
          onChange={(v) => onChange({ isUnique: v })}
          label="Jedinečné"
        />
      </div>

      {attribute.semanticKey === "email" && !attribute.isUnique ? (
        <Badge tone="warn" className="mt-2">
          Bez jedinečnosti ti vzniknou dva stejní zákazníci
        </Badge>
      ) : null}
    </li>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}
