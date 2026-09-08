"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Key, Asterisk, Fingerprint } from "lucide-react";
import { DATA_TYPE_INFO, type AttributeRecord, type EntityRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export type EntityNodeData = {
  entity: EntityRecord;
  attributes: AttributeRecord[];
  roleLabel: string | null;
  roleColor: string;
  highlighted: boolean;
  hasError: boolean;
};

export type EntityNodeType = Node<EntityNodeData, "entity">;

/**
 * Tabulka na plátně vypadá jako tabulka, ne jako abstraktní obdélník –
 * žák hned vidí sloupce, typy i klíče, takže diagram a databáze splývají.
 */
export function EntityNode({ data, selected }: NodeProps<EntityNodeType>) {
  const { entity, attributes, roleLabel, roleColor, highlighted, hasError } = data;

  return (
    <div
      className={cn(
        "w-64 overflow-hidden rounded-xl border bg-white shadow-lg transition",
        selected ? "border-accent ring-2 ring-accent/40" : "border-canvas-line",
        highlighted && "ring-4 ring-warn/60",
        hasError && !selected && "border-bad",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-accent" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-accent" />

      <header
        className="px-3 py-2 text-white"
        style={{ backgroundColor: roleColor }}
      >
        <p className="truncate text-sm font-semibold">{entity.name}</p>
        <p className="text-[11px] opacity-90">
          {roleLabel ?? "bez role – simulace ji zatím nepoužije"}
        </p>
      </header>

      {attributes.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted">
          Zatím žádné sloupce. Klikni na tabulku a přidej je.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {attributes.map((attribute) => (
            <li
              key={attribute.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              {attribute.isPrimaryKey ? (
                <Key size={12} className="shrink-0 text-warn" aria-label="primární klíč" />
              ) : attribute.isUnique ? (
                <Fingerprint size={12} className="shrink-0 text-accent" aria-label="jedinečné" />
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span className="truncate font-medium text-ink">{attribute.name}</span>
              {attribute.isRequired ? (
                <Asterisk size={10} className="shrink-0 text-bad" aria-label="povinné" />
              ) : null}
              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted">
                {DATA_TYPE_INFO[attribute.dataType].sql(attribute.length)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
