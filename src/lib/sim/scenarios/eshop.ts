import type { Scenario } from "../types";
import { buildCommerceJourney } from "./commerce";

export const eshop: Scenario = {
  key: "eshop",
  name: "E-shop",
  emoji: "📦",
  tagline: "Prodáváš elektroniku po internetu",
  description:
    "Zákazníci si u tebe objednávají zboží. Potřebuješ vědět, kdo si co objednal, " +
    "kolik kusů a jestli už zaplatil.",
  roles: [
    {
      key: "customer",
      label: "Zákazník",
      description: "Člověk, který si u tebe objednává. Vrací se, takže si ho musíš pamatovat.",
      color: "var(--color-role-customer)",
      suggested: [
        { name: "id_zakaznika", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "jmeno", dataType: "VARCHAR", semantic: "name", isRequired: true },
        { name: "email", dataType: "EMAIL", semantic: "email", isUnique: true },
        { name: "telefon", dataType: "PHONE", semantic: "phone" },
        { name: "mesto", dataType: "VARCHAR", semantic: "city" },
      ],
    },
    {
      key: "product",
      label: "Produkt",
      description: "Zboží, které prodáváš. Má cenu a nějaký počet kusů na skladě.",
      color: "var(--color-role-product)",
      suggested: [
        { name: "id_produktu", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "nazev", dataType: "VARCHAR", semantic: "product_name", isRequired: true },
        { name: "cena", dataType: "DECIMAL", semantic: "price", isRequired: true },
        { name: "sklad", dataType: "INTEGER", semantic: "stock" },
      ],
    },
    {
      key: "order",
      label: "Objednávka",
      description: "Jeden nákup jednoho zákazníka. Vzniká v okamžiku, kdy něco objedná.",
      color: "var(--color-role-order)",
      suggested: [
        { name: "id_objednavky", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "datum", dataType: "DATETIME", semantic: "created_at" },
        { name: "stav", dataType: "ENUM", semantic: "status" },
        { name: "celkem", dataType: "DECIMAL", semantic: "total" },
      ],
    },
    {
      key: "order_item",
      label: "Položka objednávky",
      description:
        "Tabulka uprostřed mezi objednávkou a produktem. Drží, kolik kusů čeho si zákazník dal.",
      color: "var(--color-role-custom)",
      suggested: [
        { name: "id_polozky", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "mnozstvi", dataType: "INTEGER", semantic: "qty", isRequired: true },
      ],
    },
  ],
  expectedLinks: [
    {
      from: "customer",
      to: "order",
      relation: "1:N",
      why: "Jeden zákazník může mít víc objednávek, ale objednávka patří vždy jednomu zákazníkovi.",
    },
    {
      from: "order",
      to: "product",
      relation: "M:N",
      why: "V objednávce může být víc produktů a jeden produkt může být ve víc objednávkách.",
    },
  ],
  journey: buildCommerceJourney(),
};
