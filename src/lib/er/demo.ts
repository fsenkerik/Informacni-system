import type { ProjectRow } from "@/lib/supabase/types";
import type { SchemaSnapshot } from "@/lib/types";

/**
 * Ukázkový projekt pro hodinu.
 *
 * Běží úplně bez databáze, takže se dá pustit na projektor dřív, než se třída
 * vůbec přihlásí. Schéma je schválně *skoro* hotové – chybí vazba mezi
 * zákazníkem a objednávkou, aby bylo hned co ukázat: zákazníci začnou mizet
 * a po dokreslení jedné čáry přestanou.
 */
export const DEMO_PROJECT_ID = "ukazka";

export const DEMO_PROJECT: ProjectRow = {
  id: DEMO_PROJECT_ID,
  class_id: null,
  name: "Ukázková firma",
  company_name: "Ukázkový e-shop",
  scenario_key: "eshop",
  join_code: "UKAZKA",
  size_preset: "small",
  free_mode: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

interface DemoAttr {
  name: string;
  type: SchemaSnapshot["attributes"][number]["dataType"];
  semantic?: string;
  pk?: boolean;
  required?: boolean;
  unique?: boolean;
}

interface DemoEntity {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  attrs: DemoAttr[];
}

const ENTITIES: DemoEntity[] = [
  {
    id: "demo-zakaznik",
    name: "Zakaznik",
    role: "customer",
    x: 40,
    y: 40,
    attrs: [
      { name: "id_zakaznika", type: "INTEGER", pk: true, required: true },
      { name: "jmeno", type: "VARCHAR", semantic: "name", required: true },
      { name: "email", type: "EMAIL", semantic: "email", unique: true },
      { name: "telefon", type: "PHONE", semantic: "phone" },
    ],
  },
  {
    id: "demo-objednavka",
    name: "Objednavka",
    role: "order",
    x: 400,
    y: 40,
    attrs: [
      { name: "id_objednavky", type: "INTEGER", pk: true, required: true },
      { name: "datum", type: "DATETIME", semantic: "created_at" },
      { name: "celkem", type: "DECIMAL", semantic: "total" },
    ],
  },
  {
    id: "demo-polozka",
    name: "PolozkaObjednavky",
    role: "order_item",
    x: 400,
    y: 340,
    attrs: [
      { name: "id_polozky", type: "INTEGER", pk: true, required: true },
      { name: "mnozstvi", type: "INTEGER", semantic: "qty", required: true },
    ],
  },
  {
    id: "demo-produkt",
    name: "Produkt",
    role: "product",
    x: 760,
    y: 340,
    attrs: [
      { name: "id_produktu", type: "INTEGER", pk: true, required: true },
      { name: "nazev", type: "VARCHAR", semantic: "product_name", required: true },
      { name: "cena", type: "DECIMAL", semantic: "price", required: true },
      { name: "sklad", type: "INTEGER", semantic: "stock" },
    ],
  },
];

export function buildDemoSchema(): SchemaSnapshot {
  return {
    projectId: DEMO_PROJECT_ID,
    entities: ENTITIES.map((e) => ({
      id: e.id,
      projectId: DEMO_PROJECT_ID,
      name: e.name,
      roleKey: e.role,
      posX: e.x,
      posY: e.y,
      color: null,
    })),
    attributes: ENTITIES.flatMap((entity) =>
      entity.attrs.map((attr, index) => ({
        id: `${entity.id}-a${index}`,
        entityId: entity.id,
        projectId: DEMO_PROJECT_ID,
        name: attr.name,
        dataType: attr.type,
        length: null,
        enumValues: null,
        isPrimaryKey: Boolean(attr.pk),
        isRequired: Boolean(attr.required),
        isUnique: Boolean(attr.unique),
        defaultValue: null,
        semanticKey: attr.semantic ?? null,
        orderIndex: index,
      })),
    ),
    // Vazba Zakaznik → Objednavka schválně chybí. To je ta ukázka.
    relationships: [
      {
        id: "demo-r1",
        projectId: DEMO_PROJECT_ID,
        fromEntityId: "demo-objednavka",
        toEntityId: "demo-polozka",
        kind: "1:N",
        fromLabel: null,
        toLabel: null,
        junctionEntityId: null,
        onDelete: "restrict",
      },
      {
        id: "demo-r2",
        projectId: DEMO_PROJECT_ID,
        fromEntityId: "demo-produkt",
        toEntityId: "demo-polozka",
        kind: "1:N",
        fromLabel: null,
        toLabel: null,
        junctionEntityId: null,
        onDelete: "restrict",
      },
    ],
  };
}
