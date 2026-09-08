import type { AttributeRecord, DataType } from "@/lib/types";

/** Seedovaný generátor – stejný seed = stejný běh, jinak by nešly psát testy. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Kombinující diakritická znaménka (U+0300–U+036F) po normalizaci NFD. */
const COMBINING_MARKS = new RegExp("[\u0300-\u036f]", "g");

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const FIRST_NAMES = [
  "Jan", "Petr", "Tomáš", "Lukáš", "Martin", "Jakub", "Ondřej", "David",
  "Eva", "Jana", "Tereza", "Lucie", "Kateřina", "Anna", "Markéta", "Veronika",
  "Adam", "Filip", "Matěj", "Barbora", "Klára", "Nikola", "Šimon", "Zuzana",
] as const;

const LAST_NAMES = [
  "Novák", "Svoboda", "Dvořák", "Černý", "Procházka", "Kučera", "Veselý",
  "Horák", "Němec", "Marek", "Pospíšil", "Král", "Beneš", "Fiala", "Sedláček",
  "Doležal", "Zeman", "Kolář", "Navrátil", "Čermák",
] as const;

const CITIES = [
  "Praha", "Brno", "Ostrava", "Plzeň", "Olomouc", "Liberec", "Hradec Králové",
  "Pardubice", "Zlín", "Jihlava", "Karlovy Vary", "Ústí nad Labem", "Tábor",
] as const;

const STREETS = [
  "Nádražní", "Hlavní", "Školní", "Zahradní", "Polní", "Lipová", "Krátká",
  "Dlouhá", "Sadová", "Havlíčkova", "Masarykova", "Palackého",
] as const;

const EMAIL_DOMAINS = ["seznam.cz", "gmail.com", "email.cz", "centrum.cz"] as const;

const PRODUCTS = [
  "Bezdrátová myš", "Klávesnice", "Sluchátka", "Monitor 24\"", "Webkamera",
  "USB flash disk", "Powerbanka", "Reproduktor", "Stojan na notebook",
  "HDMI kabel", "Batoh na notebook", "Podložka pod myš",
] as const;

const COFFEE = [
  "Espresso", "Cappuccino", "Latte", "Filtrovaná káva", "Čaj", "Limonáda",
  "Croissant", "Cheesecake", "Toast", "Bagel",
] as const;

const SERVICES = [
  "Výměna oleje", "Přezutí kol", "Diagnostika", "Výměna brzd", "Servisní prohlídka",
  "Geometrie náprav", "Výměna baterie", "Čištění klimatizace",
] as const;

const RENTALS = [
  "Horské kolo", "Elektrokolo", "Koloběžka", "Stan", "Spacák", "Kajak",
  "Lyže", "Snowboard", "Vrtačka", "Míchačka",
] as const;

const ORDER_STATES = ["nová", "zaplacená", "odeslaná", "doručená"] as const;

const NOTES = [
  "Prosím zabalit jako dárek.", "Zvonek nefunguje.", "Volejte předem.",
  "Doručit odpoledne.", "", "", "",
] as const;

export interface PersonSeed {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  street: string;
}

export function makePerson(rng: Rng): PersonSeed {
  const firstName = pick(rng, FIRST_NAMES);
  const lastName = pick(rng, LAST_NAMES);
  const slug = `${firstName}.${lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "");
  return {
    firstName,
    lastName,
    email: `${slug}@${pick(rng, EMAIL_DOMAINS)}`,
    phone: `+420 ${randomInt(rng, 601, 799)} ${randomInt(rng, 100, 999)} ${randomInt(rng, 100, 999)}`,
    city: pick(rng, CITIES),
    street: `${pick(rng, STREETS)} ${randomInt(rng, 1, 89)}`,
  };
}

export function catalogFor(scenarioKey: string): readonly string[] {
  switch (scenarioKey) {
    case "kavarna":
      return COFFEE;
    case "autoservis":
      return SERVICES;
    case "pujcovna":
      return RENTALS;
    default:
      return PRODUCTS;
  }
}

/** Hodnoty podle významu sloupce – tohle simulace „ví“ o žákově schématu. */
export function valueForSemantic(
  semantic: string,
  rng: Rng,
  context: { person?: PersonSeed; scenarioKey: string; tick: number },
): unknown {
  const person = context.person;
  switch (semantic) {
    case "name":
      return person ? `${person.firstName} ${person.lastName}` : pick(rng, catalogFor(context.scenarioKey));
    case "first_name":
      return person?.firstName ?? pick(rng, FIRST_NAMES);
    case "last_name":
      return person?.lastName ?? pick(rng, LAST_NAMES);
    case "email":
      return person?.email ?? `info${randomInt(rng, 1, 999)}@${pick(rng, EMAIL_DOMAINS)}`;
    case "phone":
      return person?.phone ?? `+420 ${randomInt(rng, 601, 799)} ${randomInt(rng, 100, 999)} ${randomInt(rng, 100, 999)}`;
    case "city":
      return person?.city ?? pick(rng, CITIES);
    case "street":
      return person?.street ?? pick(rng, STREETS);
    case "price":
      return randomInt(rng, 49, 4990) + 0.9;
    case "stock":
      return randomInt(rng, 15, 60);
    case "qty":
      return randomInt(rng, 1, 3);
    case "total":
      return 0;
    case "status":
      return pick(rng, ORDER_STATES);
    case "paid":
      return rng() > 0.15;
    case "created_at":
      return new Date(Date.UTC(2025, 8, 1) + context.tick * 60000).toISOString();
    case "birth_date":
      return `${randomInt(rng, 1965, 2008)}-${String(randomInt(rng, 1, 12)).padStart(2, "0")}-${String(randomInt(rng, 1, 28)).padStart(2, "0")}`;
    case "note":
      return pick(rng, NOTES);
    case "product_name":
      return pick(rng, catalogFor(context.scenarioKey));
    default:
      return null;
  }
}

/** Když sloupec nemá nastavený význam, vyplní se aspoň něco podle typu. */
export function valueForType(dataType: DataType, rng: Rng): unknown {
  switch (dataType) {
    case "INTEGER":
      return randomInt(rng, 1, 100);
    case "DECIMAL":
      return randomInt(rng, 10, 9999) / 10;
    case "BOOLEAN":
      return rng() > 0.5;
    case "DATE":
      return `2025-0${randomInt(rng, 1, 9)}-${String(randomInt(rng, 1, 28)).padStart(2, "0")}`;
    case "DATETIME":
      return new Date(Date.UTC(2025, 8, randomInt(rng, 1, 28))).toISOString();
    case "EMAIL":
      return `test${randomInt(rng, 1, 9999)}@example.cz`;
    case "PHONE":
      return `+420 ${randomInt(rng, 601, 799)} ${randomInt(rng, 100, 999)} ${randomInt(rng, 100, 999)}`;
    case "ENUM":
      return pick(rng, ORDER_STATES);
    default:
      return `Údaj ${randomInt(rng, 1, 9999)}`;
  }
}

export type CoercionResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "type"; expected: DataType }
  | { ok: false; reason: "length"; limit: number };

/**
 * Pokus zapsat hodnotu do sloupce tak, jak ho žák nadefinoval.
 * Tady vznikají ty „organické“ chyby – e-mail se do celého čísla nevejde.
 */
export function coerceToAttribute(
  value: unknown,
  attribute: AttributeRecord,
): CoercionResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  switch (attribute.dataType) {
    case "INTEGER": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return { ok: false, reason: "type", expected: "INTEGER" };
      return { ok: true, value: Math.round(n) };
    }
    case "DECIMAL": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return { ok: false, reason: "type", expected: "DECIMAL" };
      return { ok: true, value: Math.round(n * 100) / 100 };
    }
    case "BOOLEAN": {
      if (typeof value === "boolean") return { ok: true, value };
      if (value === "ano" || value === "ne") return { ok: true, value: value === "ano" };
      return { ok: false, reason: "type", expected: "BOOLEAN" };
    }
    case "DATE":
    case "DATETIME": {
      const asDate = new Date(String(value));
      if (Number.isNaN(asDate.getTime())) {
        return { ok: false, reason: "type", expected: attribute.dataType };
      }
      return {
        ok: true,
        value: attribute.dataType === "DATE"
          ? asDate.toISOString().slice(0, 10)
          : asDate.toISOString(),
      };
    }
    case "EMAIL": {
      const text = String(value);
      if (!text.includes("@")) return { ok: false, reason: "type", expected: "EMAIL" };
      return { ok: true, value: text };
    }
    case "ENUM": {
      const text = String(value);
      const allowed = attribute.enumValues ?? [];
      if (allowed.length > 0 && !allowed.includes(text)) {
        return { ok: false, reason: "type", expected: "ENUM" };
      }
      return { ok: true, value: text };
    }
    case "VARCHAR":
    case "PHONE": {
      const text = String(value);
      const limit = attribute.length ?? (attribute.dataType === "PHONE" ? 20 : 255);
      if (text.length > limit) return { ok: false, reason: "length", limit };
      return { ok: true, value: text };
    }
    default:
      return { ok: true, value: String(value) };
  }
}

/** Název sloupce s cizím klíčem – ať to v prohlížeči dat vypadá jako v SQL. */
export function foreignKeyColumn(parentEntityName: string): string {
  const base = parentEntityName
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${base || "rodic"}_id`;
}
