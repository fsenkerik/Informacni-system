import type { DataType, RelationKind } from "@/lib/types";
import { DATA_TYPE_INFO } from "@/lib/types";
import type { IssueCode, SimIssue } from "./types";

/**
 * Katalog chyb.
 *
 * Pravidlo: každá hláška musí žákovi říct, CO se stalo v jeho firmě, ne jaké
 * pravidlo databáze porušil. „Objednávka nemá k komu patřit“ funguje,
 * „violation of foreign key constraint“ ne.
 */

export const ISSUE_TITLES: Record<IssueCode, string> = {
  MISSING_ENTITY: "Chybí tabulka",
  MISSING_LINK: "Chybí vazba",
  WRONG_LINK_KIND: "Špatný typ vazby",
  MISSING_MN_JUNCTION: "Chybí spojovací tabulka",
  MISSING_ATTRIBUTE: "Chybí sloupec",
  WRONG_DATA_TYPE: "Špatný datový typ",
  MISSING_PK: "Chybí primární klíč",
  DUPLICATE_KEY: "Duplicitní záznam",
  REQUIRED_EMPTY: "Povinný údaj chybí",
  VALUE_TOO_LONG: "Hodnota se nevejde",
  OUT_OF_STOCK: "Došlo zboží",
};

export function missingEntity(role: string, roleLabel: string): SimIssue {
  return {
    code: "MISSING_ENTITY",
    message: `Nemáš tabulku „${roleLabel}“, takže není kam ten údaj zapsat.`,
    fix: `Přidej do diagramu tabulku a označ ji rolí „${roleLabel}“.`,
    roles: [role],
  };
}

export function missingLink(
  fromLabel: string,
  toLabel: string,
  relation: RelationKind,
  roles: string[],
): SimIssue {
  const explanation =
    relation === "M:N"
      ? `Do jedné „${toLabel}“ patří víc „${fromLabel}“ a naopak – bez vazby se to nedá zaznamenat.`
      : `Záznam „${toLabel}“ neví, ke které „${fromLabel}“ patří.`;
  return {
    code: "MISSING_LINK",
    message: explanation,
    fix: `Spoj v diagramu „${fromLabel}“ a „${toLabel}“ vazbou ${relation}.`,
    roles,
  };
}

export function wrongLinkKind(
  fromLabel: string,
  toLabel: string,
  expected: RelationKind,
  actual: RelationKind,
  relationshipId: string,
  roles: string[],
): SimIssue {
  const why =
    expected === "1:N"
      ? `Jedna „${fromLabel}“ může mít víc „${toLabel}“, ale každá „${toLabel}“ patří jen jedné „${fromLabel}“.`
      : expected === "M:N"
        ? `Jedna „${fromLabel}“ může obsahovat víc „${toLabel}“ a jedna „${toLabel}“ může být ve víc „${fromLabel}“.`
        : `Ke každé „${fromLabel}“ patří právě jedna „${toLabel}“.`;
  return {
    code: "WRONG_LINK_KIND",
    message: `Vazba mezi „${fromLabel}“ a „${toLabel}“ je ${actual}, ale má být ${expected}. ${why}`,
    fix: `Klikni na vazbu a přepni ji na ${expected}.`,
    relationshipId,
    roles,
  };
}

export function missingJunction(
  fromLabel: string,
  toLabel: string,
  roles: string[],
): SimIssue {
  return {
    code: "MISSING_MN_JUNCTION",
    message: `Vazba M:N mezi „${fromLabel}“ a „${toLabel}“ se v databázi nedá uložit přímo – chybí spojovací tabulka.`,
    fix: `Vytvoř tabulku uprostřed (např. „Položka objednávky“) a veď do ní z obou stran vazbu 1:N.`,
    roles,
  };
}

export function missingAttribute(
  role: string,
  roleLabel: string,
  what: string,
  entityId?: string,
): SimIssue {
  return {
    code: "MISSING_ATTRIBUTE",
    message: `V tabulce „${roleLabel}“ chybí sloupec pro ${what}.`,
    fix: `Přidej do „${roleLabel}“ sloupec a nastav mu význam „${what}“.`,
    entityId,
    roles: [role],
  };
}

export function wrongDataType(
  role: string,
  roleLabel: string,
  columnName: string,
  actual: DataType,
  expected: DataType[],
  entityId?: string,
): SimIssue {
  const expectedLabels = expected.map((t) => DATA_TYPE_INFO[t].label).join(" nebo ");
  return {
    code: "WRONG_DATA_TYPE",
    message: `Sloupec „${columnName}“ v tabulce „${roleLabel}“ je ${DATA_TYPE_INFO[actual].label}, ale tenhle údaj potřebuje ${expectedLabels}.`,
    fix: `Změň datový typ sloupce „${columnName}“ na ${expectedLabels}.`,
    entityId,
    roles: [role],
  };
}

export function missingPrimaryKey(entityName: string, entityId: string): SimIssue {
  return {
    code: "MISSING_PK",
    message: `Tabulka „${entityName}“ nemá primární klíč, takže na její řádky nejde odkázat.`,
    fix: `Přidej sloupec typu Celé číslo a zaškrtni u něj primární klíč.`,
    entityId,
  };
}

export function duplicateKey(
  entityName: string,
  columnName: string,
  value: string,
  entityId: string,
): SimIssue {
  return {
    code: "DUPLICATE_KEY",
    message: `V tabulce „${entityName}“ je hodnota „${value}“ ve sloupci „${columnName}“ podruhé – vznikl duplicitní záznam.`,
    fix: `Zaškrtni u sloupce „${columnName}“ jedinečnost (UNIQUE).`,
    entityId,
  };
}

export function requiredEmpty(
  entityName: string,
  columnName: string,
  entityId: string,
): SimIssue {
  return {
    code: "REQUIRED_EMPTY",
    message: `Zákazník nevyplnil „${columnName}“, ale tabulka „${entityName}“ ho má jako povinný – zápis neprošel.`,
    fix: `Buď zruš povinnost u „${columnName}“, nebo ten údaj do cesty zákazníka doplň.`,
    entityId,
  };
}

export function valueTooLong(
  entityName: string,
  columnName: string,
  limit: number,
  entityId: string,
): SimIssue {
  return {
    code: "VALUE_TOO_LONG",
    message: `Do sloupce „${columnName}“ v tabulce „${entityName}“ se nevešla hodnota – limit je ${limit} znaků.`,
    fix: `Zvětši délku sloupce „${columnName}“, nebo mu dej typ Text.`,
    entityId,
  };
}

export function issueKey(issue: SimIssue): string {
  return [issue.code, issue.entityId ?? "", issue.relationshipId ?? ""].join("|");
}
