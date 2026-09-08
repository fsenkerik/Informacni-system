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
  DayResult,
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

/**
 * Ekonomika firmy – schválně jednoduchá, aby si ji žák spočítal i na papíře.
 * Zboží nakupuješ za 60 % prodejní ceny, marže je tedy 40 %. Nájem, energie
 * a mzdy platíš každý den bez ohledu na to, jestli něco prodáš – proto firma
 * se špatně navrženou databází spolehlivě prodělá.
 */
const PURCHASE_RATIO = 0.6;
const FIXED_DAILY_COST = 2000;

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
  private ledger: DayResult[] = [];
  private chargedDays = new Set<number>();
  private day = { revenue: 0, expenses: 0, served: 0, lost: 0, lostRevenue: 0 };

  private metrics: SimMetrics = {
    customersArrived: 0,
    customersServed: 0,
    customersLost: 0,
    ordersCreated: 0,
    revenue: 0,
    expenses: 0,
    profit: 0,
    lostRevenue: 0,
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

    if (minuteOfDay === 0 && this.tickCount > 1) {
      this.closeDay(day - 1, events);
    }

    // Nájem a naskladnění platíš každý den, i kdyby nepřišel jediný zákazník.
    if (isOpen && !this.chargedDays.has(day)) {
      this.chargedDays.add(day);
      this.addExpense(FIXED_DAILY_COST);
      events.push({
        tick: this.tickCount,
        type: "EXPENSE",
        severity: "info",
        message: `Zaplacen nájem, energie a mzdy za den ${day + 1}.`,
        amount: -FIXED_DAILY_COST,
      });
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
        this.registerLostCustomer();
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
          this.registerLostCustomer();
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
    this.day.served += 1;
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
        this.day.revenue += amount;
        this.metrics.ordersCreated += 1;
        this.recomputeProfit();
      },
      addExpense: (amount, duvod) => {
        this.addExpense(amount);
        events.push({
          tick: this.tickCount,
          type: "EXPENSE",
          severity: "info",
          message: duvod,
          amount: -amount,
          customerId,
        });
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

    // První sklad se musí zaplatit, jinak by firma prodávala zboží, které
    // nikdy nekoupila – a začátek podnikání by vypadal jako hotové peníze.
    const cost = this.catalogValue(entity) * PURCHASE_RATIO;
    this.addExpense(cost);

    events.push({
      tick: this.tickCount,
      type: "EXPENSE",
      severity: "info",
      message: `Nakoupen počáteční sklad (${CATALOG_SIZE} položek) za ${Math.round(cost).toLocaleString("cs-CZ")} Kč.`,
      entityId: entity.id,
      amount: -Math.round(cost),
    });
  }

  /** Ráno se doplní sklad – firma, která nikdy nenaskladní, není chyba žáka. */
  private restockCatalog(events: SimEvent[]) {
    const entity = entityForRole(this.snapshot, "product");
    if (!entity) return;
    const stockAttr = this.attributeBySemantic(entity.id, "stock");
    if (!stockAttr) return;

    const priceAttr = this.attributeBySemantic(entity.id, "price");
    const list = this.records.get(entity.id) ?? [];
    let restocked = 0;
    let cost = 0;

    for (const record of list) {
      const current = Number(record.data[stockAttr.name] ?? 0);
      if (current > 10) continue;
      const target = randomInt(this.rng, 20, 60);
      record.data[stockAttr.name] = target;
      restocked += 1;

      const price = priceAttr ? Number(record.data[priceAttr.name]) : NaN;
      if (Number.isFinite(price)) {
        cost += (target - Math.max(0, current)) * price * PURCHASE_RATIO;
      }
    }

    if (restocked > 0) {
      this.addExpense(cost);
      events.push({
        tick: this.tickCount,
        type: "EXPENSE",
        severity: "info",
        message: `Naskladněno ${restocked} položek za ${Math.round(cost).toLocaleString("cs-CZ")} Kč.`,
        entityId: entity.id,
        amount: -Math.round(cost),
      });
    }
  }

  // -------------------------------------------------------------------
  //  Peníze
  // -------------------------------------------------------------------

  private addExpense(amount: number) {
    if (amount <= 0) return;
    this.metrics.expenses += amount;
    this.day.expenses += amount;
    this.recomputeProfit();
  }

  private recomputeProfit() {
    this.metrics.profit =
      Math.round((this.metrics.revenue - this.metrics.expenses) * 100) / 100;
  }

  /**
   * Odhad, o kolik firma přišla, když zákazníka nedokázala obsloužit.
   * Bere průměrnou cenu ze sortimentu krát obvyklý počet kusů v objednávce –
   * díky tomu je hned vidět, kolik stojí chybějící vazba za jediný den.
   */
  private estimateBasket(): number {
    const entity = entityForRole(this.snapshot, "product");
    if (!entity) return 0;
    const priceAttr = this.attributeBySemantic(entity.id, "price");
    if (!priceAttr) return 0;

    const prices = (this.records.get(entity.id) ?? [])
      .map((r) => Number(r.data[priceAttr.name]))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (prices.length === 0) return 0;

    const average = prices.reduce((sum, n) => sum + n, 0) / prices.length;
    return Math.round(average * 2 * 100) / 100;
  }

  private registerLostCustomer() {
    this.metrics.customersLost += 1;
    this.day.lost += 1;
    const missed = this.estimateBasket();
    this.metrics.lostRevenue += missed;
    this.day.lostRevenue += missed;
  }

  private closeDay(day: number, events: SimEvent[]) {
    const result: DayResult = {
      day,
      revenue: Math.round(this.day.revenue * 100) / 100,
      expenses: Math.round(this.day.expenses * 100) / 100,
      profit: Math.round((this.day.revenue - this.day.expenses) * 100) / 100,
      served: this.day.served,
      lost: this.day.lost,
      lostRevenue: Math.round(this.day.lostRevenue * 100) / 100,
    };

    this.ledger.push(result);
    this.metrics.daysElapsed = day + 1;
    this.day = { revenue: 0, expenses: 0, served: 0, lost: 0, lostRevenue: 0 };

    events.push({
      tick: this.tickCount,
      type: "DAY_ENDED",
      severity: result.profit >= 0 ? "info" : "warn",
      message:
        result.profit >= 0
          ? `Konec dne ${day + 1}. Zisk ${Math.round(result.profit).toLocaleString("cs-CZ")} Kč.`
          : `Konec dne ${day + 1}. Ztráta ${Math.round(Math.abs(result.profit)).toLocaleString("cs-CZ")} Kč.`,
      dayResult: result,
    });
  }

  getLedger(): DayResult[] {
    return [...this.ledger];
  }

  /** Pořizovací hodnota celého skladu – kolik v něm leží peněz. */
  private catalogValue(entity: EntityRecord): number {
    const priceAttr = this.attributeBySemantic(entity.id, "price");
    const stockAttr = this.attributeBySemantic(entity.id, "stock");
    if (!priceAttr) return 0;

    return (this.records.get(entity.id) ?? []).reduce((sum, record) => {
      const price = Number(record.data[priceAttr.name]);
      const stock = stockAttr ? Number(record.data[stockAttr.name]) : 1;
      if (!Number.isFinite(price)) return sum;
      return sum + price * (Number.isFinite(stock) ? stock : 1);
    }, 0);
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
