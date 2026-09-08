import type {
  AttributeRecord,
  DataType,
  EntityRecord,
  RelationKind,
  RelationshipRecord,
  SchemaSnapshot,
} from "@/lib/types";

/**
 * Stavebnice schémat pro testy a pro ukázkový projekt do hodiny.
 * Umožňuje popsat „správně navrženou firmu“ i „firmu s konkrétní chybou“
 * na pár řádcích, takže testy čtou jako zadání pro žáky.
 */

export interface AttrSpec {
  name: string;
  type?: DataType;
  semantic?: string;
  pk?: boolean;
  required?: boolean;
  unique?: boolean;
  length?: number;
}

export interface EntitySpec {
  name: string;
  role?: string;
  attrs: AttrSpec[];
}

export interface LinkSpec {
  from: string;
  to: string;
  kind: RelationKind;
  junction?: string;
}

export interface SchemaSpec {
  entities: EntitySpec[];
  links?: LinkSpec[];
}

export function buildSchema(spec: SchemaSpec, projectId = "p1"): SchemaSnapshot {
  const entities: EntityRecord[] = [];
  const attributes: AttributeRecord[] = [];
  const relationships: RelationshipRecord[] = [];
  const byName = new Map<string, EntityRecord>();

  spec.entities.forEach((e, index) => {
    const entity: EntityRecord = {
      id: `e-${index + 1}`,
      projectId,
      name: e.name,
      roleKey: e.role ?? null,
      posX: 120 + index * 260,
      posY: 120,
      color: null,
    };
    entities.push(entity);
    byName.set(e.name, entity);

    e.attrs.forEach((a, order) => {
      attributes.push({
        id: `a-${index + 1}-${order + 1}`,
        entityId: entity.id,
        projectId,
        name: a.name,
        dataType: a.type ?? "VARCHAR",
        length: a.length ?? null,
        enumValues: null,
        isPrimaryKey: Boolean(a.pk),
        isRequired: Boolean(a.required),
        isUnique: Boolean(a.unique),
        defaultValue: null,
        semanticKey: a.semantic ?? null,
        orderIndex: order,
      });
    });
  });

  (spec.links ?? []).forEach((l, index) => {
    const from = byName.get(l.from);
    const to = byName.get(l.to);
    if (!from || !to) throw new Error(`Vazba odkazuje na neznámou tabulku: ${l.from} → ${l.to}`);
    relationships.push({
      id: `r-${index + 1}`,
      projectId,
      fromEntityId: from.id,
      toEntityId: to.id,
      kind: l.kind,
      fromLabel: null,
      toLabel: null,
      junctionEntityId: l.junction ? (byName.get(l.junction)?.id ?? null) : null,
      onDelete: "restrict",
    });
  });

  return { projectId, entities, attributes, relationships };
}

/** Správně navržený e-shop – referenční schéma pro testy i pro demo. */
export function correctEshopSchema(): SchemaSnapshot {
  return buildSchema({
    entities: [
      {
        name: "Zakaznik",
        role: "customer",
        attrs: [
          { name: "id_zakaznika", type: "INTEGER", pk: true, required: true },
          { name: "jmeno", type: "VARCHAR", semantic: "name", required: true },
          { name: "email", type: "EMAIL", semantic: "email", unique: true },
          { name: "telefon", type: "PHONE", semantic: "phone" },
        ],
      },
      {
        name: "Produkt",
        role: "product",
        attrs: [
          { name: "id_produktu", type: "INTEGER", pk: true, required: true },
          { name: "nazev", type: "VARCHAR", semantic: "product_name", required: true },
          { name: "cena", type: "DECIMAL", semantic: "price", required: true },
          { name: "sklad", type: "INTEGER", semantic: "stock" },
        ],
      },
      {
        name: "Objednavka",
        role: "order",
        attrs: [
          { name: "id_objednavky", type: "INTEGER", pk: true, required: true },
          { name: "datum", type: "DATETIME", semantic: "created_at" },
          { name: "celkem", type: "DECIMAL", semantic: "total" },
        ],
      },
      {
        name: "PolozkaObjednavky",
        role: "order_item",
        attrs: [
          { name: "id_polozky", type: "INTEGER", pk: true, required: true },
          { name: "mnozstvi", type: "INTEGER", semantic: "qty" },
        ],
      },
    ],
    links: [
      { from: "Zakaznik", to: "Objednavka", kind: "1:N" },
      { from: "Objednavka", to: "PolozkaObjednavky", kind: "1:N" },
      { from: "Produkt", to: "PolozkaObjednavky", kind: "1:N" },
    ],
  });
}

/** Odebere vazbu mezi dvěma tabulkami – simuluje typickou chybu žáka. */
export function withoutLink(
  snapshot: SchemaSnapshot,
  fromName: string,
  toName: string,
): SchemaSnapshot {
  const from = snapshot.entities.find((e) => e.name === fromName);
  const to = snapshot.entities.find((e) => e.name === toName);
  return {
    ...snapshot,
    relationships: snapshot.relationships.filter(
      (r) =>
        !(
          (r.fromEntityId === from?.id && r.toEntityId === to?.id) ||
          (r.fromEntityId === to?.id && r.toEntityId === from?.id)
        ),
    ),
  };
}

export function withoutEntity(
  snapshot: SchemaSnapshot,
  name: string,
): SchemaSnapshot {
  const entity = snapshot.entities.find((e) => e.name === name);
  if (!entity) return snapshot;
  return {
    ...snapshot,
    entities: snapshot.entities.filter((e) => e.id !== entity.id),
    attributes: snapshot.attributes.filter((a) => a.entityId !== entity.id),
    relationships: snapshot.relationships.filter(
      (r) => r.fromEntityId !== entity.id && r.toEntityId !== entity.id,
    ),
  };
}

export function changeAttributeType(
  snapshot: SchemaSnapshot,
  entityName: string,
  attributeName: string,
  dataType: DataType,
): SchemaSnapshot {
  const entity = snapshot.entities.find((e) => e.name === entityName);
  return {
    ...snapshot,
    attributes: snapshot.attributes.map((a) =>
      a.entityId === entity?.id && a.name === attributeName ? { ...a, dataType } : a,
    ),
  };
}

export function setUnique(
  snapshot: SchemaSnapshot,
  entityName: string,
  attributeName: string,
  isUnique: boolean,
): SchemaSnapshot {
  const entity = snapshot.entities.find((e) => e.name === entityName);
  return {
    ...snapshot,
    attributes: snapshot.attributes.map((a) =>
      a.entityId === entity?.id && a.name === attributeName ? { ...a, isUnique } : a,
    ),
  };
}
