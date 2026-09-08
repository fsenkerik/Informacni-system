import type { DataType } from "@/lib/types";

/**
 * „Význam sloupce“ je most mezi tím, jak si sloupec pojmenoval žák, a tím,
 * co do něj má simulace generovat. Bez něj by systém nevěděl, že do
 * `jmeno_a_prijmeni` patří jméno člověka.
 */
export interface SemanticOption {
  key: string;
  label: string;
  hint: string;
  types: DataType[];
}

export const SEMANTIC_OPTIONS: SemanticOption[] = [
  { key: "name", label: "Jméno / název", hint: "Jméno člověka nebo název věci", types: ["VARCHAR", "TEXT"] },
  { key: "first_name", label: "Křestní jméno", hint: "Jen jméno", types: ["VARCHAR", "TEXT"] },
  { key: "last_name", label: "Příjmení", hint: "Jen příjmení", types: ["VARCHAR", "TEXT"] },
  { key: "email", label: "E-mail", hint: "Adresa se zavináčem", types: ["EMAIL", "VARCHAR", "TEXT"] },
  { key: "phone", label: "Telefon", hint: "Telefonní číslo jako text", types: ["PHONE", "VARCHAR", "TEXT"] },
  { key: "city", label: "Město", hint: "Město bydliště", types: ["VARCHAR", "TEXT"] },
  { key: "street", label: "Ulice a číslo", hint: "Zbytek adresy", types: ["VARCHAR", "TEXT"] },
  { key: "product_name", label: "Název zboží / služby", hint: "Co prodáváš nebo nabízíš", types: ["VARCHAR", "TEXT"] },
  { key: "price", label: "Cena", hint: "Cena za kus – musí jít sečíst", types: ["DECIMAL", "INTEGER"] },
  { key: "stock", label: "Počet skladem", hint: "Kolik kusů máš", types: ["INTEGER"] },
  { key: "qty", label: "Množství v objednávce", hint: "Kolik kusů si zákazník vzal", types: ["INTEGER"] },
  { key: "total", label: "Celková částka", hint: "Součet za celou objednávku", types: ["DECIMAL", "INTEGER"] },
  { key: "status", label: "Stav", hint: "Nová / zaplacená / odeslaná", types: ["ENUM", "VARCHAR", "TEXT"] },
  { key: "paid", label: "Zaplaceno / vyřízeno", hint: "Ano nebo ne", types: ["BOOLEAN"] },
  { key: "created_at", label: "Datum a čas vzniku", hint: "Kdy záznam vznikl", types: ["DATETIME", "DATE"] },
  { key: "birth_date", label: "Datum narození", hint: "Jen datum", types: ["DATE"] },
  { key: "note", label: "Poznámka", hint: "Volný text od zákazníka", types: ["TEXT", "VARCHAR"] },
];

export function findSemantic(key: string | null): SemanticOption | undefined {
  if (!key) return undefined;
  return SEMANTIC_OPTIONS.find((s) => s.key === key);
}

/** Odhadne význam podle názvu sloupce, aby ho žák nemusel vybírat ručně. */
export function guessSemantic(name: string): string | null {
  const value = name
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();

  const rules: [RegExp, string][] = [
    [/^(jmeno|nazev|name|title)/, "name"],
    [/krestni/, "first_name"],
    [/prijmeni/, "last_name"],
    [/mail/, "email"],
    [/telefon|mobil|phone/, "phone"],
    [/mesto|city/, "city"],
    [/ulice|adresa|street/, "street"],
    [/celkem|suma|total/, "total"],
    [/cena|sazba|price/, "price"],
    [/sklad|zasoba|stock|kusu_skladem/, "stock"],
    [/mnozstvi|pocet|qty/, "qty"],
    [/stav|status/, "status"],
    [/zaplaceno|vraceno|paid/, "paid"],
    [/narozeni|birth/, "birth_date"],
    [/datum|cas|vytvoreno|prijato|created/, "created_at"],
    [/poznamka|note/, "note"],
  ];

  for (const [pattern, key] of rules) {
    if (pattern.test(value)) return key;
  }
  return null;
}
