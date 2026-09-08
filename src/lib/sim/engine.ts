import type { AttributeRecord, EntityRecord, SchemaSnapshot } from "@/lib/types";
import { attributesOf } from "@/lib/types";
import {
  coerceToAttribute,
  foreignKeyColumn,
  makePerson,
  mulberry32,
  randomInt,
  valueForSemantic,
  valueForType,
  type PersonSeed,
  type Rng,
} from "./generator";
import * as issues from "./issues";
import { issueKey } from "./issues";
import { checkRequirements, entityForRole, resolveLink } from "./requirements";
import type {
  JourneyContext,
  Scenario,
  SimEvent,
  SimIssue,
  SimMetrics,
  SimRecord,
} from "./types";

/** Provozní doba firmy v herních minutách (8:00–20:00). */
const DAY_START = 8 * 60;
const DAY_END = 20 * 60;
const DAY_LENGTH = 24 * 60;
const OPEN_MINUTES = DAY_END - DAY_START;
const CATALOG_SIZE = 8;

export interface EngineOptions {
  snapshot: SchemaSnapshot;
  scenario: Scenario;
  seed: number;
  customersPerDay: number;
}

export interface TickResult {
  tick: number;
  /** Herní čas v minutách od začátku běhu. */
  clock: number;
  day: number;
  minuteOfDay: number;
  isOpen: boolean;
  events: SimEvent[];
  metrics: SimMetrics;
  newIssues: SimIssue[];
}

export interface IssueTally extends SimIssue {
  count: number;
  firstSeenTick: number;
  lastSeenTick: number;
}

/**
 * Simulace firmy.
 *
 * Nezná React ani Supabase – dostane snímek schématu a seed, vrací události.
 * Díky tomu je celý běh reprodukovatelný a dá se testovat z příkazové řádky.
 */
export class SimEngine {
  private snapshot: SchemaSnapshot;
  private readonly scenario: Scenario;
  private readonly customersPerDay: number;
  private readonly rng: Rng;

  private tickCount = 0;
  private clock = DAY_START;
  private records = new Map<string, SimRecord[]>();
  private pkCounters = new Map<string, number>();
  private uniqueIndex = new Map<string, Set<string>>();
  private naturalKeyIndex = new Map<string, Set<string>>();
  private issueTally = new Map<string, IssueTally>();
  private recordSeq = 0;

  private metrics: SimMetrics = {
    customersArrived: 0,
    customersServed: 0,
    customersLost: 0,
    ordersCreated: 0,
    revenue: 0,
    dataIntegrity: 100,
    recordsWritten: 0,
    integrityViolations: 0,
    daysElapsed: 0,
  };

  constructor(options: EngineOptions) {
    this.snapshot = options.snapshot;
    this.scenario = options.scenario;
    this.customersPerDay = Math.max(1, options.customersPerDay);
    this.rng = mulberry32(options.seed);
  }

  /** Schéma se mění za běhu – žák opraví vazbu a chyby musí hned přestat. */
  updateSnapshot(snapshot: SchemaSnapshot) {
    this.snapshot = snapshot;
  }

  getMetrics(): SimMetrics {
    return { ...this.metrics };
  }

  getIssues(): IssueTally[] {
    return [...this.issueTally.values()].sort((a, b) => b.count - a.count);
  }

  getRecords(entityId: string): SimRecord[] {
    return this.records.get(entityId) ?? [];
  }

  getAllRecords(): Map<string, SimRecord[]> {
    return this.records;
  }

  get currentTick() {
    return this.tickCount;
  }

  get currentClock() {
    return this.clock;
  }

  /** Jeden tik = jedna herní minuta. */
  tick(): TickResult {
    this.tickCount += 1;
    this.clock += 1;

    const events: SimEvent[] = [];
    const issuesBefore = new Set(this.issueTally.keys());

    const minuteOfDay = this.clock % DAY_LENGTH;
    const day = Math.floor(this.clock / DAY_LENGTH);
    const isOpen = minuteOfDay >= DAY_START && minuteOfDay < DAY_END;

    if (minuteOfDay === 0) {
      this.metrics.daysElapsed = day;
      events.push({
        tick: this.tickCount,
        type: "DAY_ENDED",
        severity: "info",
        message: `Konec dne ${day}. Obslouženo ${this.metrics.customersServed} zákazníků.`,
      });
    }

    if (minuteOfDay === DAY_START) {
      this.restockCatalog(events);
    }

    if (isOpen) {
      this.seedCatalog(events);
      const arrivalChance = this.customersPerDay / OPEN_MINUTES;
      if (this.rng() < arrivalChance) {
        this.runJourney(events);
      }
    }

    this.recomputeIntegrity();

    const newIssues = [...this.issueTally.values()]
      .filter((i) => !issuesBefore.has(issueKey(i)))
      .map(stripTally);

    return {
      tick: this.tickCount,
      clock: this.clock,
      day,
      minuteOfDay,
      isOpen,
      events,
      metrics: this.getMetrics(),
      newIssues,
    };
  }

  // -------------------------------------------------------------------
  //  Cesta jednoho zákazníka
  // -------------------------------------------------------------------

  private runJourney(events: SimEvent[]) {
    this.metrics.customersArrived += 1;
    const customerId = `c${this.metrics.customersArrived}`;
    const person = makePerson(this.rng);

    events.push({
      tick: this.tickCount,
      type: "CUSTOMER_ARRIVED",
      severity: "info",
      message: `Přichází ${person.firstName} ${person.lastName}.`,
      customerId,
      customerName: `${person.firstName} ${person.lastName}`,
    });

    const ctx = this.createContext(person, events, customerId);

    for (const step of this.scenario.journey) {
      const blocking = checkRequirements(this.snapshot, this.scenario, step.requires);
      if (blocking) {
        if (step.optional) continue;
        this.recordIssue(blocking);
        this.metrics.customersLost += 1;
        events.push({
          tick: this.tickCount,
          type: "STEP_FAILED",
          severity: "error",
          message: blocking.message,
          customerId,
          stepKey: step.key,
          entityId: blocking.entityId,
          issue: blocking,
        });
        events.push({
          tick: this.tickCount,
          type: "CUSTOMER_LOST",
          severity: "error",
          message: `${person.firstName} odchází – systém tenhle nákup nezvládl.`,
          customerId,
        });
        return;
      }

      ctx.lastWriteIssue = null;
      const outcome = step.run(ctx);
      if (!outcome.ok) {
        this.recordIssue(outcome.issue);
        events.push({
          tick: this.tickCount,
          type: "STEP_FAILED",
          severity: "error",
          message: outcome.issue.message,
          customerId,
          stepKey: step.key,
          entityId: outcome.issue.entityId,
          issue: outcome.issue,
        });
        if (outcome.lost) {
          this.metrics.customersLost += 1;
          events.push({
            tick: this.tickCount,
            type: "CUSTOMER_LOST",
            severity: "error",
            message: `${person.firstName} odchází – zápis do databáze neprošel.`,
            customerId,
          });
          return;
        }
      }
    }

    this.metrics.customersServed += 1;
    events.push({
      tick: this.tickCount,
      type: "CUSTOMER_LEFT",
      severity: "info",
      message: `${person.firstName} má hotovo a odchází spokojeně.`,
      customerId,
    });
  }

  private createContext(
    person: PersonSeed,
    events: SimEvent[],
    customerId: string,
  ): JourneyContext {
    // Šipkové funkce schválně: `this` uvnitř zůstává instancí enginu,
    // takže není potřeba aliasovat.
    const ctx: JourneyContext = {
      snapshot: this.snapshot,
      scenarioKey: this.scenario.key,
      tick: this.tickCount,
      random: () => this.rng(),
      memory: new Map<string, unknown>(),
      lastWriteIssue: null,

      roleEntity: (role) => {
        const entity = entityForRole(this.snapshot, role);
        if (!entity) throw new Error(`Role ${role} není v diagramu.`);
        return entity;
      },
      hasRole: (role) => Boolean(entityForRole(this.snapshot, role)),
      insert: (role, extra) => {
        const entity = entityForRole(this.snapshot, role);
        if (!entity) return null;
        return this.writeRecord(entity, person, extra, ctx, events, customerId);
      },
      insertInto: (entity, extra) =>
        this.writeRecord(entity, person, extra, ctx, events, customerId),
      pickExisting: (role) => {
        const entity = entityForRole(this.snapshot, role);
        if (!entity) return undefined;
        const list = this.records.get(entity.id) ?? [];
        if (list.length === 0) return undefined;
        return list[Math.floor(this.rng() * list.length)];
      },
      allOf: (role) => {
        const entity = entityForRole(this.snapshot, role);
        if (!entity) return [];
        return this.records.get(entity.id) ?? [];
      },
      resolveJunction: (fromRole, toRole) => {
        const from = entityForRole(this.snapshot, fromRole);
        const to = entityForRole(this.snapshot, toRole);
        if (!from || !to) return null;
        const link = resolveLink(this.snapshot, from, to, "M:N");
        return link.status === "ok" ? link.junction : null;
      },
      link: (child, parent, parentEntity) => {
        const column = foreignKeyColumn(parentEntity.name);
        child.data[column] = this.primaryKeyValue(parent);
      },
      getValue: (record, semantic) => {
        const attribute = this.attributeBySemantic(record.entityId, semantic);
        if (!attribute) return undefined;
        return record.data[attribute.name];
      },
      setValue: (record, semantic, value) => {
        const attribute = this.attributeBySemantic(record.entityId, semantic);
        if (!attribute) return;
        const coerced = coerceToAttribute(value, attribute);
        if (coerced.ok) record.data[attribute.name] = coerced.value;
      },
      fail: (issue, opts) => ({ ok: false, issue, lost: opts?.lost ?? false }),
      warn: (issue) => {
        this.recordIssue(issue);
        events.push({
          tick: this.tickCount,
          type: "STEP_FAILED",
          severity: "warn",
          message: issue.message,
          customerId,
          entityId: issue.entityId,
          issue,
        });
      },
      emit: (event) => {
        events.push({ ...event, tick: this.tickCount, customerId });
      },
      addRevenue: (amount) => {
        this.metrics.revenue += amount;
        this.metrics.ordersCreated += 1;
      },
    };

    return ctx;
  }

  // -------------------------------------------------------------------
  //  Zápis do „tabulky“
  // -------------------------------------------------------------------

  private writeRecord(
    entity: EntityRecord,
    person: PersonSeed,
    extra: Record<string, unknown> | undefined,
    ctx: JourneyContext,
    events: SimEvent[],
    customerId: string,
  ): SimRecord | null {
    const attributes = attributesOf(this.snapshot, entity.id);
    const data: Record<string, unknown> = {};

    if (!attributes.some((a) => a.isPrimaryKey)) {
      this.recordIssue(issues.missingPrimaryKey(entity.name, entity.id));
    }

    for (const attribute of attributes) {
      const raw = this.rawValueFor(attribute, entity, person, extra);

      if (attribute.isPrimaryKey) {
        data[attribute.name] = this.nextPrimaryKey(entity, attribute);
        continue;
      }

      const written = this.writeValue(entity, attribute, raw);
      if (!written.ok) {
        this.recordIssue(written.issue);
        this.metrics.integrityViolations += 1;
        if (attribute.isRequired) {
          ctx.lastWriteIssue = written.issue;
          return null;
        }
        data[attribute.name] = null;
        continue;
      }
      data[attribute.name] = written.value;
    }

    const record: SimRecord = {
      id: `r${(this.recordSeq += 1)}`,
      entityId: entity.id,
      data,
      tick: this.tickCount,
    };

    const list = this.records.get(entity.id) ?? [];
    list.push(record);
    this.records.set(entity.id, list);
    this.metrics.recordsWritten += 1;

    events.push({
      tick: this.tickCount,
      type: "RECORD_INSERTED",
      severity: "info",
      message: `Nový řádek v tabulce „${entity.name}“.`,
      entityId: entity.id,
      recordId: record.id,
      customerId,
    });

    return record;
  }

  private rawValueFor(
    attribute: AttributeRecord,
    entity: EntityRecord,
    person: PersonSeed,
    extra: Record<string, unknown> | undefined,
  ): unknown {
    if (extra && attribute.semanticKey && attribute.semanticKey in extra) {
      return extra[attribute.semanticKey];
    }
    if (extra && attribute.name in extra) {
      return extra[attribute.name];
    }
    if (attribute.semanticKey) {
      const value = valueForSemantic(attribute.semanticKey, this.rng, {
        person,
        scenarioKey: this.scenario.key,
        tick: this.tickCount,
      });
      if (value !== null) return value;
    }
    // Sloupec bez nastaveného významu – vyplní se aspoň něco podle typu,
    // aby žák viděl, že „nějaká data“ v tabulce jsou.
    void entity;
    return valueForType(attribute.dataType, this.rng);
  }

  private writeValue(
    entity: EntityRecord,
    attribute: AttributeRecord,
    raw: unknown,
  ): { ok: true; value: unknown } | { ok: false; issue: SimIssue } {
    const coerced = coerceToAttribute(raw, attribute);
    if (!coerced.ok) {
      if (coerced.reason === "length") {
        return {
          ok: false,
          issue: issues.valueTooLong(entity.name, attribute.name, coerced.limit, entity.id),
        };
      }
      return {
        ok: false,
        issue: issues.wrongDataType(
          entity.roleKey ?? "",
          entity.name,
          attribute.name,
          attribute.dataType,
          [coerced.expected],
          entity.id,
        ),
      };
    }

    if (coerced.value === null && attribute.isRequired) {
      return {
        ok: false,
        issue: issues.requiredEmpty(entity.name, attribute.name, entity.id),
      };
    }

    if (coerced.value === null) return { ok: true, value: null };

    const key = `${entity.id}:${attribute.id}`;
    const asText = String(coerced.value);

    if (attribute.isUnique) {
      const seen = this.uniqueIndex.get(key) ?? new Set<string>();
      if (seen.has(asText)) {
        // Skutečná databáze by zápis odmítla; my se nejdřív pokusíme
        // vygenerovat jinou hodnotu, ať žák nepřichází o zákazníky
        // za správně navržené schéma.
        const retry = this.retryUniqueValue(attribute, seen);
        if (retry === null) {
          return {
            ok: false,
            issue: issues.duplicateKey(entity.name, attribute.name, asText, entity.id),
          };
        }
        seen.add(retry);
        this.uniqueIndex.set(key, seen);
        return { ok: true, value: retry };
      }
      seen.add(asText);
      this.uniqueIndex.set(key, seen);
      return { ok: true, value: coerced.value };
    }

    // Sloupec, který se jako klíč chová (e-mail, telefon), ale UNIQUE nemá:
    // duplicity vzniknou samy a integrita dat klesne.
    if (attribute.semanticKey === "email" || attribute.semanticKey === "phone") {
      const seen = this.naturalKeyIndex.get(key) ?? new Set<string>();
      if (seen.has(asText)) {
        this.recordIssue(
          issues.duplicateKey(entity.name, attribute.name, asText, entity.id),
        );
        this.metrics.integrityViolations += 1;
      }
      seen.add(asText);
      this.naturalKeyIndex.set(key, seen);
    }

    return { ok: true, value: coerced.value };
  }

  private retryUniqueValue(
    attribute: AttributeRecord,
    seen: Set<string>,
  ): string | null {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attribute.semanticKey
        ? valueForSemantic(attribute.semanticKey, this.rng, {
            person: makePerson(this.rng),
            scenarioKey: this.scenario.key,
            tick: this.tickCount,
          })
        : valueForType(attribute.dataType, this.rng);
      const coerced = coerceToAttribute(candidate, attribute);
      if (!coerced.ok || coerced.value === null) continue;
      const asText = String(coerced.value);
      if (!seen.has(asText)) return asText;
    }
    return null;
  }

  private nextPrimaryKey(entity: EntityRecord, attribute: AttributeRecord): unknown {
    const next = (this.pkCounters.get(entity.id) ?? 0) + 1;
    this.pkCounters.set(entity.id, next);
    if (attribute.dataType === "INTEGER" || attribute.dataType === "DECIMAL") {
      return next;
    }
    return `${entity.name.slice(0, 3).toUpperCase()}-${String(next).padStart(4, "0")}`;
  }

  private primaryKeyValue(record: SimRecord): unknown {
    const pk = attributesOf(this.snapshot, record.entityId).find((a) => a.isPrimaryKey);
    if (pk && record.data[pk.name] !== undefined) return record.data[pk.name];
    return record.id;
  }

  private attributeBySemantic(entityId: string, semantic: string) {
    return attributesOf(this.snapshot, entityId).find((a) => a.semanticKey === semantic);
  }

  // -------------------------------------------------------------------
  //  Katalog a metriky
  // -------------------------------------------------------------------

  /** Sklad se naplní, jakmile má firma tabulku produktů – i za běhu. */
  private seedCatalog(events: SimEvent[]) {
    const entity = entityForRole(this.snapshot, "product");
    if (!entity) return;
    const existing = this.records.get(entity.id) ?? [];
    if (existing.length > 0) return;

    const person = makePerson(this.rng);
    const ctx = this.createContext(person, [], "seed");
    for (let i = 0; i < CATALOG_SIZE; i += 1) {
      this.writeRecord(entity, person, undefined, ctx, [], "seed");
    }
    events.push({
      tick: this.tickCount,
      type: "RECORD_INSERTED",
      severity: "info",
      message: `Do tabulky „${entity.name}“ se nahrál sortiment (${CATALOG_SIZE} položek).`,
      entityId: entity.id,
    });
  }

  /** Ráno se doplní sklad – firma, která nikdy nenaskladní, není chyba žáka. */
  private restockCatalog(events: SimEvent[]) {
    const entity = entityForRole(this.snapshot, "product");
    if (!entity) return;
    const stockAttr = this.attributeBySemantic(entity.id, "stock");
    if (!stockAttr) return;

    const list = this.records.get(entity.id) ?? [];
    let restocked = 0;
    for (const record of list) {
      const current = Number(record.data[stockAttr.name] ?? 0);
      if (current > 10) continue;
      record.data[stockAttr.name] = randomInt(this.rng, 20, 60);
      restocked += 1;
    }
    if (restocked > 0) {
      events.push({
        tick: this.tickCount,
        type: "RECORD_INSERTED",
        severity: "info",
        message: `Ráno dorazilo zboží – naskladněno ${restocked} položek.`,
        entityId: entity.id,
      });
    }
  }

  private recordIssue(issue: SimIssue) {
    const key = issueKey(issue);
    const existing = this.issueTally.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastSeenTick = this.tickCount;
      // Text se může změnit, když žák tabulku přejmenuje.
      existing.message = issue.message;
      return;
    }
    this.issueTally.set(key, {
      ...issue,
      count: 1,
      firstSeenTick: this.tickCount,
      lastSeenTick: this.tickCount,
    });
  }

  private recomputeIntegrity() {
    const { recordsWritten, integrityViolations } = this.metrics;
    const attempts = recordsWritten + integrityViolations;
    // Zaokrouhluje se dolů schválně: jediné porušení integrity musí být
    // v metrice vidět, jinak by se 99,9 % tvářilo jako čistý návrh.
    this.metrics.dataIntegrity =
      attempts === 0 ? 100 : Math.floor((recordsWritten / attempts) * 100);
  }
}

/** Z počítadla chyb udělá zase obyčejnou chybu pro UI. */
function stripTally(tally: IssueTally): SimIssue {
  return {
    code: tally.code,
    message: tally.message,
    fix: tally.fix,
    entityId: tally.entityId,
    relationshipId: tally.relationshipId,
    roles: tally.roles,
  };
}

/** Pomůcka pro testy a pro rychlé „přehraj mi 200 tiků“. */
export function runTicks(engine: SimEngine, count: number): TickResult[] {
  const results: TickResult[] = [];
  for (let i = 0; i < count; i += 1) results.push(engine.tick());
  return results;
}

export { DAY_START, DAY_END, DAY_LENGTH, OPEN_MINUTES, randomInt };
