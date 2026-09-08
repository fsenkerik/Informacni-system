import type { SchemaSnapshot } from "@/lib/types";
import { attributesOf } from "@/lib/types";
import { validateSchema } from "@/lib/er/validate";
import { entityForRole, resolveLink } from "@/lib/sim/requirements";
import type { IssueTally } from "@/lib/sim/engine";
import type { Scenario, SimMetrics } from "@/lib/sim/types";

/**
 * Odznaky odměňují to, co chceme, aby žáci uměli – ne to, kolik toho naklikali.
 * Každý má „proč“, aby si ho mohli přečíst i předtím, než ho získají.
 */

export interface Achievement {
  key: string;
  label: string;
  description: string;
  /** Jak ho získat – zobrazuje se u ještě nezískaných. */
  how: string;
  xp: number;
  emoji: string;
  check(ctx: AchievementContext): boolean;
}

export interface AchievementContext {
  snapshot: SchemaSnapshot;
  scenario: Scenario;
  metrics: SimMetrics;
  issues: IssueTally[];
  sizePreset: string;
}

function everyEntityHasPk(snapshot: SchemaSnapshot): boolean {
  if (snapshot.entities.length === 0) return false;
  return snapshot.entities.every((entity) =>
    attributesOf(snapshot, entity.id).some((a) => a.isPrimaryKey),
  );
}

function junctionResolved(ctx: AchievementContext): boolean {
  const link = ctx.scenario.expectedLinks.find((l) => l.relation === "M:N");
  if (!link) return false;
  const from = entityForRole(ctx.snapshot, link.from);
  const to = entityForRole(ctx.snapshot, link.to);
  if (!from || !to) return false;
  const resolution = resolveLink(ctx.snapshot, from, to, "M:N");
  return resolution.status === "ok" && resolution.junction !== null;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    key: "first_table",
    label: "První tabulka",
    description: "Založil jsi první tabulku své firmy.",
    how: "Přidej do diagramu libovolnou tabulku.",
    xp: 10,
    emoji: "🧱",
    check: (c) => c.snapshot.entities.length > 0,
  },
  {
    key: "primary_key",
    label: "Primární klíč",
    description: "Každá tvoje tabulka umí rozlišit své řádky.",
    how: "Dej primární klíč všem tabulkám, ne jen některým.",
    xp: 20,
    emoji: "🔑",
    check: (c) => everyEntityHasPk(c.snapshot),
  },
  {
    key: "foreign_key",
    label: "Cizí klíč",
    description: "Spojil jsi dvě tabulky vazbou 1:N.",
    how: "Nakresli vazbu 1:N mezi zákazníkem a objednávkou.",
    xp: 20,
    emoji: "🔗",
    check: (c) => c.snapshot.relationships.some((r) => r.kind === "1:N"),
  },
  {
    key: "junction",
    label: "Spojka M:N",
    description: "Rozložil jsi vazbu M:N na spojovací tabulku – jako profík.",
    how: "Vazbu M:N nahraď tabulkou uprostřed a dvěma vazbami 1:N.",
    xp: 40,
    emoji: "🔀",
    check: junctionResolved,
  },
  {
    key: "clean_design",
    label: "Čistý návrh",
    description: "Kontrola návrhu nenašla jedinou chybu, která by zastavila provoz.",
    how: "Vyřeš všechny červené položky v Kontrole návrhu.",
    xp: 50,
    emoji: "✨",
    check: (c) =>
      validateSchema(c.snapshot, c.scenario).every((f) => f.level !== "error"),
  },
  {
    key: "data_types",
    label: "Datový typ na jedničku",
    description: "Žádný sloupec nemá zjevně špatný datový typ.",
    how: "Zkontroluj typy u telefonu, ceny a data – bývají špatně nejčastěji.",
    xp: 30,
    emoji: "🎯",
    check: (c) =>
      validateSchema(c.snapshot, c.scenario).every((f) => !f.id.startsWith("type-")),
  },
  {
    key: "first_customer",
    label: "První zákazník",
    description: "Systém obsloužil prvního zákazníka od začátku do konce.",
    how: "Spusť provoz a nech systém dokončit celou cestu zákazníka.",
    xp: 20,
    emoji: "🙋",
    check: (c) => c.metrics.customersServed > 0,
  },
  {
    key: "no_loss",
    label: "Bez ztrát",
    description: "Padesát zákazníků a ani jeden neodešel s prázdnou.",
    how: "Obsluž 50 zákazníků, aniž bys jediného ztratil.",
    xp: 60,
    emoji: "🏅",
    check: (c) => c.metrics.customersServed >= 50 && c.metrics.customersLost === 0,
  },
  {
    key: "integrity",
    label: "Čistá data",
    description: "Sto zápisů a integrita dat pořád na sto procentech.",
    how: "Ohlídej si jedinečnost e-mailu a správné datové typy.",
    xp: 60,
    emoji: "🧼",
    check: (c) => c.metrics.recordsWritten >= 100 && c.metrics.dataIntegrity === 100,
  },
  {
    key: "peak_traffic",
    label: "Špičkový provoz",
    description: "Velká firma, sto zákazníků denně – a systém to ustál.",
    how: "Přepni firmu na velkou a obsluž 100 zákazníků bez ztráty.",
    xp: 80,
    emoji: "🚀",
    check: (c) =>
      c.sizePreset === "large" &&
      c.metrics.customersServed >= 100 &&
      c.metrics.customersLost === 0,
  },
  {
    key: "architect",
    label: "Architekt",
    description: "Kompletní informační systém, který běží bez jediné chyby.",
    how: "Obsaď všechny role ze zadání, měj čistý návrh a nulové ztráty.",
    xp: 100,
    emoji: "🏛️",
    check: (c) =>
      c.scenario.roles.every((role) => entityForRole(c.snapshot, role.key)) &&
      validateSchema(c.snapshot, c.scenario).every((f) => f.level !== "error") &&
      c.metrics.customersServed >= 20 &&
      c.metrics.customersLost === 0,
  },
];

export function evaluateAchievements(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => {
    try {
      return a.check(ctx);
    } catch {
      return false;
    }
  }).map((a) => a.key);
}

export function xpFor(keys: string[]): number {
  return ACHIEVEMENTS.filter((a) => keys.includes(a.key)).reduce(
    (sum, a) => sum + a.xp,
    0,
  );
}

/** Level roste po stovkách XP – ať je první postup rychlý. */
export function levelFor(xp: number): { level: number; toNext: number; progress: number } {
  const level = Math.floor(xp / 100) + 1;
  const inLevel = xp % 100;
  return { level, toNext: 100 - inLevel, progress: inLevel };
}

/** Mise vedou začátečníka krok za krokem, než ho pustíme samotného. */
export interface Mission {
  key: string;
  label: string;
  hint: string;
  done(ctx: AchievementContext): boolean;
}

export const MISSIONS: Mission[] = [
  {
    key: "m1",
    label: "Založ tabulku pro zákazníky",
    hint: "V diagramu klikni na tlačítko s rolí Zákazník.",
    done: (c) => Boolean(entityForRole(c.snapshot, "customer")),
  },
  {
    key: "m2",
    label: "Dej jí primární klíč",
    hint: "Sloupec typu Celé číslo se zaškrtnutým PK.",
    done: (c) => {
      const entity = entityForRole(c.snapshot, "customer");
      if (!entity) return false;
      return attributesOf(c.snapshot, entity.id).some((a) => a.isPrimaryKey);
    },
  },
  {
    key: "m3",
    label: "Přidej tabulku pro objednávky",
    hint: "Bez ní nemá zákazník kde nakoupit.",
    done: (c) => Boolean(entityForRole(c.snapshot, "order")),
  },
  {
    key: "m4",
    label: "Spoj zákazníka a objednávku vazbou 1:N",
    hint: "Táhni čáru z tabulky Zákazník do tabulky Objednávka.",
    done: (c) => {
      const from = entityForRole(c.snapshot, "customer");
      const to = entityForRole(c.snapshot, "order");
      if (!from || !to) return false;
      return resolveLink(c.snapshot, from, to, "1:N").status === "ok";
    },
  },
  {
    key: "m5",
    label: "Přidej sortiment a vazbu M:N",
    hint: "Objednávka obsahuje víc produktů – budeš potřebovat tabulku uprostřed.",
    done: junctionResolved,
  },
  {
    key: "m6",
    label: "Spusť provoz a obsluž prvního zákazníka",
    hint: "Karta Provoz, tlačítko Spustit.",
    done: (c) => c.metrics.customersServed > 0,
  },
];
