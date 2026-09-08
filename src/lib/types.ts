/**
 * Doménové typy DataFirmy.
 *
 * Schéma, které žák navrhne, se neukládá jako skutečné SQL tabulky – je to
 * metadata (entity / atributy / vazby). Tenhle soubor je jediné místo, kde se
 * definuje, co všechno takové schéma může obsahovat.
 */

export const DATA_TYPES = [
  "TEXT",
  "VARCHAR",
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "EMAIL",
  "PHONE",
  "ENUM",
] as const;

export type DataType = (typeof DATA_TYPES)[number];

export const RELATION_KINDS = ["1:1", "1:N", "M:N"] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const SIZE_PRESETS = ["small", "medium", "large"] as const;
export type SizePreset = (typeof SIZE_PRESETS)[number];

export type OnDelete = "restrict" | "cascade" | "set_null";
export type Severity = "info" | "warn" | "error";
export type RunStatus = "running" | "paused" | "finished";

/** Kolik zákazníků denně chodí do firmy dané velikosti. */
export const SIZE_PRESET_INFO: Record<
  SizePreset,
  { label: string; customersPerDay: number; hint: string }
> = {
  small: {
    label: "Malá firma",
    customersPerDay: 20,
    hint: "20 zákazníků denně – klidné tempo, dobré na první pokus",
  },
  medium: {
    label: "Střední firma",
    customersPerDay: 50,
    hint: "50 zákazníků denně – chyby v návrhu se začnou projevovat",
  },
  large: {
    label: "Velká firma",
    customersPerDay: 100,
    hint: "100 zákazníků denně – špatný návrh to nevydrží",
  },
};

/** Popis datového typu pro žáka + odpovídající SQL typ do náhledu. */
export const DATA_TYPE_INFO: Record<
  DataType,
  { label: string; sql: (length?: number | null) => string; hint: string }
> = {
  TEXT: {
    label: "Text",
    sql: () => "TEXT",
    hint: "Libovolně dlouhý text – popis, poznámka",
  },
  VARCHAR: {
    label: "Krátký text",
    sql: (length) => `VARCHAR(${length ?? 255})`,
    hint: "Text s omezenou délkou – jméno, název, adresa",
  },
  INTEGER: {
    label: "Celé číslo",
    sql: () => "INTEGER",
    hint: "Počet kusů, rok, počet bodů. Ne telefon!",
  },
  DECIMAL: {
    label: "Desetinné číslo",
    sql: () => "DECIMAL(10,2)",
    hint: "Cena, hmotnost, sazba DPH",
  },
  BOOLEAN: {
    label: "Ano / ne",
    sql: () => "BOOLEAN",
    hint: "Zaplaceno, aktivní, na skladě",
  },
  DATE: {
    label: "Datum",
    sql: () => "DATE",
    hint: "Datum narození, datum dodání",
  },
  DATETIME: {
    label: "Datum a čas",
    sql: () => "TIMESTAMP",
    hint: "Kdy přesně objednávka vznikla",
  },
  EMAIL: {
    label: "E-mail",
    sql: () => "VARCHAR(254)",
    hint: "Text, který musí obsahovat @",
  },
  PHONE: {
    label: "Telefon",
    sql: () => "VARCHAR(20)",
    hint: "Text, ne číslo – kvůli nulám a předvolbě",
  },
  ENUM: {
    label: "Výběr z možností",
    sql: () => "VARCHAR(50)",
    hint: "Stav objednávky: nová / odeslaná / zrušená",
  },
};

export interface EntityRecord {
  id: string;
  projectId: string;
  name: string;
  roleKey: string | null;
  posX: number;
  posY: number;
  color: string | null;
}

export interface AttributeRecord {
  id: string;
  entityId: string;
  projectId: string;
  name: string;
  dataType: DataType;
  length: number | null;
  enumValues: string[] | null;
  isPrimaryKey: boolean;
  isRequired: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  semanticKey: string | null;
  orderIndex: number;
}

export interface RelationshipRecord {
  id: string;
  projectId: string;
  fromEntityId: string;
  toEntityId: string;
  kind: RelationKind;
  fromLabel: string | null;
  toLabel: string | null;
  junctionEntityId: string | null;
  onDelete: OnDelete;
}

/** Kompletní snímek návrhu – jediný vstup, který potřebuje simulační engine. */
export interface SchemaSnapshot {
  projectId: string;
  entities: EntityRecord[];
  attributes: AttributeRecord[];
  relationships: RelationshipRecord[];
}

export function attributesOf(
  snapshot: SchemaSnapshot,
  entityId: string,
): AttributeRecord[] {
  return snapshot.attributes
    .filter((a) => a.entityId === entityId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function entityByRole(
  snapshot: SchemaSnapshot,
  roleKey: string,
): EntityRecord | undefined {
  return snapshot.entities.find((e) => e.roleKey === roleKey);
}
