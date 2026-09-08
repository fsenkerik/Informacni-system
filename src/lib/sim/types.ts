import type {
  DataType,
  EntityRecord,
  RelationKind,
  SchemaSnapshot,
} from "@/lib/types";

/**
 * Simulace není sada náhodných zápisů – je to *cesta zákazníka*.
 * Jeden zákazník přijde a projde krok po kroku celý scénář: zaregistruje se,
 * založí objednávku, přidá položky, zaplatí. Každý krok si napřed ověří, jestli
 * to žákovo schéma vůbec umí. Když ne, zákazník se v tom kroku zasekne a je
 * vidět přesně kde – to je ten okamžik, kvůli kterému celá aplikace vzniká.
 */

/** Požadavek kroku na návrh schématu. */
export type Requirement =
  | { kind: "entity"; role: string }
  | { kind: "link"; from: string; to: string; relation: RelationKind }
  | { kind: "attribute"; role: string; semantic: string; types?: DataType[] };

export type IssueCode =
  | "MISSING_ENTITY"
  | "MISSING_LINK"
  | "WRONG_LINK_KIND"
  | "MISSING_MN_JUNCTION"
  | "MISSING_ATTRIBUTE"
  | "WRONG_DATA_TYPE"
  | "MISSING_PK"
  | "DUPLICATE_KEY"
  | "REQUIRED_EMPTY"
  | "VALUE_TOO_LONG"
  | "OUT_OF_STOCK";

export interface SimIssue {
  code: IssueCode;
  message: string;
  /** Co má žák udělat, aby to zmizelo. */
  fix: string;
  entityId?: string;
  relationshipId?: string;
  /** Role, které se problém týká – pro zvýraznění v diagramu. */
  roles?: string[];
}

export interface SimRecord {
  id: string;
  entityId: string;
  data: Record<string, unknown>;
  tick: number;
}

export type SimEventType =
  | "CUSTOMER_ARRIVED"
  | "STEP_OK"
  | "STEP_FAILED"
  | "RECORD_INSERTED"
  | "CUSTOMER_LEFT"
  | "CUSTOMER_LOST"
  | "EXPENSE"
  | "DAY_ENDED";

export interface SimEvent {
  tick: number;
  type: SimEventType;
  severity: "info" | "warn" | "error";
  /** Věta, kterou uvidí žák v logu. Vždy česky a konkrétně. */
  message: string;
  customerId?: string;
  /** Jméno zákazníka pro animaci – ať se netahá parsováním z věty. */
  customerName?: string;
  entityId?: string;
  stepKey?: string;
  issue?: SimIssue;
  recordId?: string;
  /** Částka v korunách. Kladná = příjem, záporná = výdaj. */
  amount?: number;
  /** Uzávěrka dne u události DAY_ENDED. */
  dayResult?: DayResult;
}

/** Výsledek jednoho obchodního dne – z toho se skládá výsledovka firmy. */
export interface DayResult {
  day: number;
  revenue: number;
  expenses: number;
  profit: number;
  served: number;
  lost: number;
  lostRevenue: number;
}

export interface SimMetrics {
  customersArrived: number;
  customersServed: number;
  customersLost: number;
  ordersCreated: number;
  revenue: number;
  /** Nákup zboží a fixní náklady (nájem, energie, mzdy). */
  expenses: number;
  /** Tržby minus náklady. Záporný zisk = firma prodělává. */
  profit: number;
  /** Kolik peněz uteklo se zákazníky, které systém nedokázal obsloužit. */
  lostRevenue: number;
  /** Podíl zápisů, které prošly bez porušení integrity, v procentech. */
  dataIntegrity: number;
  recordsWritten: number;
  integrityViolations: number;
  daysElapsed: number;
}

export interface JourneyContext {
  snapshot: SchemaSnapshot;
  scenarioKey: string;
  tick: number;
  /** Náhodné číslo 0–1 ze seedovaného generátoru (běh je reprodukovatelný). */
  random(): number;
  /** Entita, kterou žák označil danou rolí. Krok ji má zaručenou requirements. */
  roleEntity(role: string): EntityRecord;
  /** Existuje entita s touto rolí? Pro nepovinné části cesty. */
  hasRole(role: string): boolean;
  /** Vloží nový záznam do tabulky dané role. Vrací null, když zápis neprošel. */
  insert(role: string, extra?: Record<string, unknown>): SimRecord | null;
  /** Zápis do konkrétní entity – potřeba u spojovací tabulky u M:N. */
  insertInto(
    entity: EntityRecord,
    extra?: Record<string, unknown>,
  ): SimRecord | null;
  /** Náhodný už existující záznam dané role (např. vracející se zákazník). */
  pickExisting(role: string): SimRecord | undefined;
  allOf(role: string): SimRecord[];
  /** Tabulka uprostřed vazby M:N, ať už ji žák udělal ručně nebo tlačítkem. */
  resolveJunction(fromRole: string, toRole: string): EntityRecord | null;
  /** Zapíše do potomka cizí klíč na rodiče. */
  link(child: SimRecord, parent: SimRecord, parentEntity: EntityRecord): void;
  /** Čtení a zápis hodnoty podle významu sloupce, ne podle jeho názvu. */
  getValue(record: SimRecord, semantic: string): unknown;
  setValue(record: SimRecord, semantic: string, value: unknown): void;
  /** Odkládací paměť v rámci jedné cesty zákazníka (záznamy i mezisoučty). */
  memory: Map<string, unknown>;
  /** Ukončí krok neúspěchem s konkrétním vysvětlením. */
  fail(issue: SimIssue, opts?: { lost?: boolean }): StepOutcome;
  /** Zaznamená problém, ale cesta pokračuje dál. */
  warn(issue: SimIssue): void;
  emit(event: Omit<SimEvent, "tick">): void;
  addRevenue(amount: number): void;
  addExpense(amount: number, duvod: string): void;
  /** Poslední chyba zápisu – kroky ji používají místo vlastní diagnostiky. */
  lastWriteIssue: SimIssue | null;
}

export type StepOutcome =
  | { ok: true }
  /** Cesta zákazníka končí – tohle už nedojde do konce. */
  | { ok: false; issue: SimIssue; lost: boolean };

export interface JourneyStep {
  key: string;
  /** Věta v průběhové liště: „Zákazník zakládá objednávku“. */
  label: string;
  requires: Requirement[];
  /** Nepovinný krok se při nesplnění requirements přeskočí místo selhání. */
  optional?: boolean;
  run(ctx: JourneyContext): StepOutcome;
}

export interface RoleDef {
  key: string;
  label: string;
  description: string;
  color: string;
  /** Co v té tabulce obvykle bývá – nabídne se žákovi jedním klikem. */
  suggested: {
    name: string;
    dataType: DataType;
    semantic?: string;
    isPrimaryKey?: boolean;
    isRequired?: boolean;
    isUnique?: boolean;
  }[];
}

export interface Scenario {
  key: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  roles: RoleDef[];
  journey: JourneyStep[];
  /** Vazby, které scénář očekává – ukazujeme je jako zadání i v kontrole návrhu. */
  expectedLinks: { from: string; to: string; relation: RelationKind; why: string }[];
}
