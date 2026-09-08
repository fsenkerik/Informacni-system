import { describe, expect, it } from "vitest";
import { SimEngine, runTicks } from "./engine";
import { describeReadiness } from "./requirements";
import { eshop } from "./scenarios/eshop";
import {
  buildSchema,
  changeAttributeType,
  correctEshopSchema,
  setUnique,
  withoutEntity,
  withoutLink,
} from "./testing";
import type { SimEvent } from "./types";

const DAY = 24 * 60;

function newEngine(snapshot = correctEshopSchema(), customersPerDay = 100) {
  return new SimEngine({ snapshot, scenario: eshop, seed: 42, customersPerDay });
}

function collect(results: { events: SimEvent[] }[]): SimEvent[] {
  return results.flatMap((r) => r.events);
}

describe("správně navržená firma", () => {
  it("obslouží zákazníky a neztratí ani jednoho", () => {
    const engine = newEngine();
    runTicks(engine, DAY);
    const m = engine.getMetrics();

    expect(m.customersArrived).toBeGreaterThan(50);
    expect(m.customersLost).toBe(0);
    expect(m.customersServed).toBe(m.customersArrived);
    expect(m.dataIntegrity).toBe(100);
    expect(m.revenue).toBeGreaterThan(0);
  });

  it("nehlásí žádnou chybu v návrhu", () => {
    const engine = newEngine();
    runTicks(engine, DAY);
    expect(engine.getIssues()).toEqual([]);
  });

  it("je reprodukovatelná – stejný seed dá stejný výsledek", () => {
    const a = newEngine();
    const b = newEngine();
    runTicks(a, DAY);
    runTicks(b, DAY);
    expect(a.getMetrics()).toEqual(b.getMetrics());
  });
});

describe("chybějící vazba Zákazník → Objednávka", () => {
  const broken = withoutLink(correctEshopSchema(), "Zakaznik", "Objednavka");

  it("zasekne zákazníka a řekne proč", () => {
    const engine = new SimEngine({
      snapshot: broken,
      scenario: eshop,
      seed: 7,
      customersPerDay: 100,
    });
    runTicks(engine, DAY);

    const issues = engine.getIssues();
    expect(issues.map((i) => i.code)).toContain("MISSING_LINK");

    const issue = issues.find((i) => i.code === "MISSING_LINK")!;
    expect(issue.message).toContain("Objednavka");
    expect(issue.fix).toContain("1:N");
    expect(engine.getMetrics().customersLost).toBeGreaterThan(0);
    expect(engine.getMetrics().customersServed).toBe(0);
  });

  it("po opravě schématu za běhu přestanou zákazníci mizet", () => {
    const engine = new SimEngine({
      snapshot: broken,
      scenario: eshop,
      seed: 7,
      customersPerDay: 100,
    });
    runTicks(engine, DAY);
    const lostBefore = engine.getMetrics().customersLost;
    expect(lostBefore).toBeGreaterThan(0);

    // Žák nakreslí chybějící vazbu – simulace běží dál.
    engine.updateSnapshot(correctEshopSchema());
    runTicks(engine, DAY);

    const after = engine.getMetrics();
    expect(after.customersLost).toBe(lostBefore);
    expect(after.customersServed).toBeGreaterThan(0);
  });
});

describe("vazba M:N", () => {
  const base = correctEshopSchema();

  it("bez spojovací tabulky selže s návodem, jak ji vyrobit", () => {
    const noJunction = buildSchema({
      entities: [
        {
          name: "Zakaznik",
          role: "customer",
          attrs: [
            { name: "id", type: "INTEGER", pk: true, required: true },
            { name: "jmeno", type: "VARCHAR", semantic: "name" },
          ],
        },
        {
          name: "Produkt",
          role: "product",
          attrs: [
            { name: "id", type: "INTEGER", pk: true, required: true },
            { name: "nazev", type: "VARCHAR", semantic: "product_name" },
            { name: "cena", type: "DECIMAL", semantic: "price" },
          ],
        },
        {
          name: "Objednavka",
          role: "order",
          attrs: [{ name: "id", type: "INTEGER", pk: true, required: true }],
        },
      ],
      links: [
        { from: "Zakaznik", to: "Objednavka", kind: "1:N" },
        { from: "Objednavka", to: "Produkt", kind: "M:N" },
      ],
    });

    const engine = new SimEngine({
      snapshot: noJunction,
      scenario: eshop,
      seed: 3,
      customersPerDay: 100,
    });
    runTicks(engine, DAY);

    const issue = engine.getIssues().find((i) => i.code === "MISSING_MN_JUNCTION");
    expect(issue).toBeDefined();
    expect(issue!.fix).toContain("1:N");
  });

  it("ruční spojovací tabulka (dvě vazby 1:N) je přijatá jako správné řešení", () => {
    const readiness = describeReadiness(base, eshop);
    expect(readiness.every((step) => step.ready)).toBe(true);
  });
});

describe("datové typy", () => {
  it("e-mail uložený jako celé číslo je odhalen", () => {
    const broken = changeAttributeType(correctEshopSchema(), "Zakaznik", "email", "INTEGER");
    const engine = new SimEngine({
      snapshot: broken,
      scenario: eshop,
      seed: 11,
      customersPerDay: 100,
    });
    runTicks(engine, DAY);

    const issue = engine.getIssues().find((i) => i.code === "WRONG_DATA_TYPE");
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("email");
    expect(engine.getMetrics().dataIntegrity).toBeLessThan(100);
  });
});

describe("chybějící jedinečnost e-mailu", () => {
  it("vede k duplicitním zákazníkům a poklesu integrity", () => {
    const broken = setUnique(correctEshopSchema(), "Zakaznik", "email", false);
    const engine = new SimEngine({
      snapshot: broken,
      scenario: eshop,
      seed: 5,
      customersPerDay: 100,
    });
    runTicks(engine, DAY * 3);

    const issue = engine.getIssues().find((i) => i.code === "DUPLICATE_KEY");
    expect(issue).toBeDefined();
    expect(engine.getMetrics().dataIntegrity).toBeLessThan(100);
  });
});

describe("chybějící tabulka", () => {
  it("řekne, kterou tabulku firma nemá", () => {
    const broken = withoutEntity(correctEshopSchema(), "Objednavka");
    const engine = new SimEngine({
      snapshot: broken,
      scenario: eshop,
      seed: 9,
      customersPerDay: 100,
    });
    const results = runTicks(engine, DAY);

    const issue = engine.getIssues().find((i) => i.code === "MISSING_ENTITY");
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("Objednávka");

    const failures = collect(results).filter((e) => e.type === "CUSTOMER_LOST");
    expect(failures.length).toBeGreaterThan(0);
  });
});

describe("provozní doba", () => {
  it("mimo otevírací dobu nikdo nechodí", () => {
    const engine = newEngine();
    // 8:00 je start; posuneme se o celý den a sledujeme noc 20:00–8:00.
    const results = runTicks(engine, DAY);
    const nightArrivals = results
      .filter((r) => !r.isOpen)
      .flatMap((r) => r.events)
      .filter((e) => e.type === "CUSTOMER_ARRIVED");
    expect(nightArrivals).toEqual([]);
  });
});
