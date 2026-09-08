import type { EntityRecord, SchemaSnapshot } from "@/lib/types";
import { DATA_TYPE_INFO, attributesOf } from "@/lib/types";
import { foreignKeyColumn } from "@/lib/sim/generator";

/**
 * Převod žákova diagramu na SQL.
 *
 * Není to jen ozdoba – tohle je most mezi „nakreslil jsem obdélníky“ a
 * „takhle to vypadá v opravdové databázi“. Cizí klíče se dopočítají z vazeb,
 * takže je vidět, že 1:N znamená sloupec navíc na straně N.
 */

function identifier(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean.length > 0 ? clean.toLowerCase() : "tabulka";
}

function primaryKeyOf(snapshot: SchemaSnapshot, entity: EntityRecord) {
  return attributesOf(snapshot, entity.id).find((a) => a.isPrimaryKey) ?? null;
}

export function generateSql(snapshot: SchemaSnapshot): string {
  const { entities, relationships } = snapshot;
  if (entities.length === 0) {
    return "-- Zatím tu není žádná tabulka.\n-- Přidej první a SQL se dopíše samo.";
  }

  const lines: string[] = [
    "-- Takhle by tvůj návrh vypadal v opravdové databázi.",
    "-- Cizí klíče se dopočítaly z vazeb, které jsi nakreslil.",
    "",
  ];

  for (const entity of entities) {
    const attributes = attributesOf(snapshot, entity.id);
    const columns: string[] = [];

    for (const attribute of attributes) {
      const sqlType = DATA_TYPE_INFO[attribute.dataType].sql(attribute.length);
      const parts = [`  ${identifier(attribute.name)} ${sqlType}`];
      if (attribute.isRequired || attribute.isPrimaryKey) parts.push("NOT NULL");
      if (attribute.isUnique && !attribute.isPrimaryKey) parts.push("UNIQUE");
      if (attribute.defaultValue) parts.push(`DEFAULT '${attribute.defaultValue}'`);
      columns.push(parts.join(" "));
    }

    // Cizí klíče: u 1:N je sloupec na straně N, u 1:1 na cílové tabulce.
    const foreignKeys: string[] = [];
    for (const relationship of relationships) {
      if (relationship.kind === "M:N") continue;
      if (relationship.toEntityId !== entity.id) continue;

      const parent = entities.find((e) => e.id === relationship.fromEntityId);
      if (!parent) continue;
      const parentPk = primaryKeyOf(snapshot, parent);
      if (!parentPk) continue;

      const column = identifier(foreignKeyColumn(parent.name));
      if (attributes.some((a) => identifier(a.name) === column)) continue;

      const parentType = DATA_TYPE_INFO[parentPk.dataType].sql(parentPk.length);
      columns.push(`  ${column} ${parentType}`);
      foreignKeys.push(
        `  FOREIGN KEY (${column}) REFERENCES ${identifier(parent.name)}(${identifier(parentPk.name)})`,
      );
    }

    const pk = attributes.filter((a) => a.isPrimaryKey);
    const constraints: string[] = [];
    if (pk.length > 0) {
      constraints.push(
        `  PRIMARY KEY (${pk.map((a) => identifier(a.name)).join(", ")})`,
      );
    }

    const enumChecks = attributes
      .filter((a) => a.dataType === "ENUM" && (a.enumValues?.length ?? 0) > 0)
      .map(
        (a) =>
          `  CHECK (${identifier(a.name)} IN (${a
            .enumValues!.map((v) => `'${v.replace(/'/g, "''")}'`)
            .join(", ")}))`,
      );

    const body = [...columns, ...constraints, ...foreignKeys, ...enumChecks];
    if (body.length === 0) {
      lines.push(`-- Tabulka „${entity.name}“ zatím nemá sloupce.`, "");
      continue;
    }

    lines.push(`CREATE TABLE ${identifier(entity.name)} (`);
    lines.push(body.join(",\n"));
    lines.push(");", "");
  }

  const unresolved = relationships.filter(
    (r) => r.kind === "M:N" && !r.junctionEntityId,
  );
  if (unresolved.length > 0) {
    lines.push("-- Pozor: tyhle vazby M:N zatím nemají spojovací tabulku,");
    lines.push("-- takže se do SQL nedají zapsat:");
    for (const relationship of unresolved) {
      const from = entities.find((e) => e.id === relationship.fromEntityId);
      const to = entities.find((e) => e.id === relationship.toEntityId);
      lines.push(`--   ${from?.name ?? "?"} ↔ ${to?.name ?? "?"}`);
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
