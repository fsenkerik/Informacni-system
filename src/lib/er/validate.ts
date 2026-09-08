import type { SchemaSnapshot } from "@/lib/types";
import { attributesOf } from "@/lib/types";
import type { Scenario } from "@/lib/sim/types";
import { entityForRole, resolveLink } from "@/lib/sim/requirements";

/**
 * Kontrola návrhu – to, co by v Accessu žákovi nikdo neřekl.
 *
 * Běží bez simulace, takže dvojice vidí problémy hned při kreslení.
 * Dělí se na tři úrovně: `error` brání provozu, `warn` je špatný návyk,
 * `hint` je rada do budoucna.
 */

export type FindingLevel = "error" | "warn" | "hint";

export interface Finding {
  id: string;
  level: FindingLevel;
  title: string;
  message: string;
  fix: string;
  entityId?: string;
  relationshipId?: string;
}

/** Názvy sloupců, u kterých se dá typ odhadnout – a často bývá špatně. */
const TYPE_HINTS: { match: RegExp; expect: string[]; why: string }[] = [
  {
    match: /telefon|mobil|phone/i,
    expect: ["PHONE", "VARCHAR", "TEXT"],
    why: "Telefon není číslo – má předvolbu, mezery a někdy i nulu na začátku.",
  },
  {
    match: /email|mail/i,
    expect: ["EMAIL", "VARCHAR", "TEXT"],
    why: "E-mail je text, který musí obsahovat zavináč.",
  },
  {
    match: /cena|castka|sazba|price|celkem|suma/i,
    expect: ["DECIMAL", "INTEGER"],
    why: "S cenou se počítá, takže musí být číslo – jinak nesečteš tržbu.",
  },
  {
    match: /datum|date|cas|termin/i,
    expect: ["DATE", "DATETIME"],
    why: "Datum jako text nejde řadit ani porovnávat.",
  },
  {
    match: /pocet|mnozstvi|kusu|qty|sklad|zasoba/i,
    expect: ["INTEGER"],
    why: "Počet kusů je celé číslo.",
  },
  {
    match: /^(je_|ma_|zaplaceno|aktivni|vraceno)/i,
    expect: ["BOOLEAN"],
    why: "Odpověď ano/ne se ukládá jako logická hodnota.",
  },
];

/**
 * Sloupce, které vypadají, že do jedné buňky cpou víc hodnot (porušení 1NF).
 *
 * Vzory jsou schválně ukotvené na začátek názvu: `polozky` je podezřelé,
 * ale `id_polozky` je úplně v pořádku primární klíč spojovací tabulky.
 */
const NOT_ATOMIC = /^(seznam|polozky|produkty|telefony|emaily|adresy|kontakty)|_1$|_2$/i;

/** Klíčové sloupce se na atomicitu netestují – `id_polozky` není seznam. */
const KEY_LIKE = /^id_|_id$/i;

export function validateSchema(
  snapshot: SchemaSnapshot,
  scenario: Scenario,
): Finding[] {
  const findings: Finding[] = [];
  const { entities, relationships } = snapshot;

  // --- Chybějící role ze zadání -------------------------------------
  for (const role of scenario.roles) {
    if (!entityForRole(snapshot, role.key)) {
      findings.push({
        id: `role-${role.key}`,
        level: "error",
        title: `Chybí tabulka „${role.label}“`,
        message: role.description,
        fix: `Přidej tabulku a v panelu vpravo jí nastav roli „${role.label}“.`,
      });
    }
  }

  // --- Duplicitní názvy tabulek --------------------------------------
  const nameCount = new Map<string, number>();
  for (const entity of entities) {
    const key = entity.name.trim().toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  for (const entity of entities) {
    if ((nameCount.get(entity.name.trim().toLowerCase()) ?? 0) > 1) {
      findings.push({
        id: `dup-entity-${entity.id}`,
        level: "warn",
        title: `Dvě tabulky se jmenují „${entity.name}“`,
        message: "V databázi nemůžou mít dvě tabulky stejný název.",
        fix: "Přejmenuj jednu z nich.",
        entityId: entity.id,
      });
    }
  }

  for (const entity of entities) {
    const attributes = attributesOf(snapshot, entity.id);

    // --- Prázdná tabulka --------------------------------------------
    if (attributes.length === 0) {
      findings.push({
        id: `empty-${entity.id}`,
        level: "warn",
        title: `Tabulka „${entity.name}“ nemá žádné sloupce`,
        message: "Prázdná tabulka nic neuloží.",
        fix: "Klikni na tabulku a přidej jí sloupce – nabídku máš v panelu vpravo.",
        entityId: entity.id,
      });
      continue;
    }

    // --- Primární klíč ----------------------------------------------
    const primaryKeys = attributes.filter((a) => a.isPrimaryKey);
    if (primaryKeys.length === 0) {
      findings.push({
        id: `pk-${entity.id}`,
        level: "error",
        title: `Tabulka „${entity.name}“ nemá primární klíč`,
        message:
          "Bez primárního klíče se řádky nedají od sebe odlišit a nejde na ně odkázat z jiné tabulky.",
        fix: "Přidej sloupec typu Celé číslo a zaškrtni u něj PK.",
        entityId: entity.id,
      });
    }

    // --- Duplicitní sloupce ------------------------------------------
    const seen = new Set<string>();
    for (const attribute of attributes) {
      const key = attribute.name.trim().toLowerCase();
      if (seen.has(key)) {
        findings.push({
          id: `dup-attr-${attribute.id}`,
          level: "warn",
          title: `Sloupec „${attribute.name}“ je v tabulce „${entity.name}“ dvakrát`,
          message: "Stejný název sloupce nemůže být v jedné tabulce dvakrát.",
          fix: "Jeden z nich přejmenuj nebo smaž.",
          entityId: entity.id,
        });
      }
      seen.add(key);

      // --- Odhad špatného datového typu ------------------------------
      for (const hint of TYPE_HINTS) {
        if (!hint.match.test(attribute.name)) continue;
        if (hint.expect.includes(attribute.dataType)) continue;
        findings.push({
          id: `type-${attribute.id}`,
          level: "warn",
          title: `„${attribute.name}“ má nejspíš špatný datový typ`,
          message: hint.why,
          fix: `Zkus u sloupce „${attribute.name}“ typ ${hint.expect[0]}.`,
          entityId: entity.id,
        });
        break;
      }

      // --- Porušení 1. normální formy --------------------------------
      if (
        !attribute.isPrimaryKey &&
        !KEY_LIKE.test(attribute.name) &&
        NOT_ATOMIC.test(attribute.name)
      ) {
        findings.push({
          id: `nf1-${attribute.id}`,
          level: "hint",
          title: `Sloupec „${attribute.name}“ vypadá, že drží víc hodnot najednou`,
          message:
            "Do jedné buňky patří jedna hodnota. Když do ní cpeš seznam, nejde v něm pak vyhledávat.",
          fix: "Udělej z toho samostatnou tabulku a spoj ji vazbou 1:N.",
          entityId: entity.id,
        });
      }
    }

    // --- Osiřelá tabulka ---------------------------------------------
    const connected = relationships.some(
      (r) =>
        r.fromEntityId === entity.id ||
        r.toEntityId === entity.id ||
        r.junctionEntityId === entity.id,
    );
    if (!connected && entities.length > 1) {
      findings.push({
        id: `orphan-${entity.id}`,
        level: "warn",
        title: `Tabulka „${entity.name}“ nikam nevede`,
        message:
          "Nemá jedinou vazbu, takže její data se nedají spojit se zbytkem systému.",
        fix: "Táhni z ní čáru do tabulky, se kterou souvisí.",
        entityId: entity.id,
      });
    }
  }

  // --- Vazby, které scénář očekává ------------------------------------
  for (const expected of scenario.expectedLinks) {
    const from = entityForRole(snapshot, expected.from);
    const to = entityForRole(snapshot, expected.to);
    if (!from || !to) continue;

    const resolution = resolveLink(snapshot, from, to, expected.relation);
    if (resolution.status === "ok") continue;

    if (resolution.status === "missing") {
      findings.push({
        id: `link-${expected.from}-${expected.to}`,
        level: "error",
        title: `Chybí vazba ${expected.relation} mezi „${from.name}“ a „${to.name}“`,
        message: expected.why,
        fix: "Táhni čáru z jedné tabulky do druhé a vyber typ vazby.",
      });
    } else if (resolution.status === "mn-no-junction") {
      findings.push({
        id: `junction-${expected.from}-${expected.to}`,
        level: "error",
        title: `Vazba M:N mezi „${from.name}“ a „${to.name}“ potřebuje tabulku uprostřed`,
        message:
          "Relační databáze neumí uložit M:N přímo. Musí vzniknout spojovací tabulka, do které vedou dvě vazby 1:N.",
        fix: "Klikni na vazbu a použij tlačítko Vytvořit spojovací tabulku.",
        relationshipId: resolution.relationship.id,
      });
    } else {
      findings.push({
        id: `kind-${resolution.relationship.id}`,
        level: "error",
        title: `Vazba mezi „${from.name}“ a „${to.name}“ má být ${expected.relation}`,
        message: expected.why,
        fix: `Klikni na vazbu a přepni ji na ${expected.relation}.`,
        relationshipId: resolution.relationship.id,
      });
    }
  }

  return findings;
}

export function summarize(findings: Finding[]) {
  return {
    errors: findings.filter((f) => f.level === "error").length,
    warnings: findings.filter((f) => f.level === "warn").length,
    hints: findings.filter((f) => f.level === "hint").length,
  };
}
