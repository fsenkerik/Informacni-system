import type { Scenario } from "../types";
import { buildCommerceJourney } from "./commerce";

export const pujcovna: Scenario = {
  key: "pujcovna",
  name: "Půjčovna",
  emoji: "🚲",
  tagline: "Půjčuješ kola, lyže a nářadí",
  description:
    "Zákazník si přijde půjčit vybavení. Musíš vědět, kdo si co půjčil, kolik kusů " +
    "a kolik za to zaplatil. Zásoba se ti mezitím tenčí.",
  roles: [
    {
      key: "customer",
      label: "Zákazník",
      description: "Ten, kdo si půjčuje. Stálí zákazníci chodí opakovaně.",
      color: "var(--color-role-customer)",
      suggested: [
        { name: "id_zakaznika", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "jmeno", dataType: "VARCHAR", semantic: "name", isRequired: true },
        { name: "email", dataType: "EMAIL", semantic: "email", isUnique: true },
        { name: "telefon", dataType: "PHONE", semantic: "phone" },
      ],
    },
    {
      key: "product",
      label: "Vybavení",
      description: "Co se dá půjčit. Má denní sazbu a omezený počet kusů.",
      color: "var(--color-role-product)",
      suggested: [
        { name: "id_vybaveni", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "nazev", dataType: "VARCHAR", semantic: "product_name", isRequired: true },
        { name: "sazba_za_den", dataType: "DECIMAL", semantic: "price", isRequired: true },
        { name: "kusu_skladem", dataType: "INTEGER", semantic: "stock" },
      ],
    },
    {
      key: "order",
      label: "Výpůjčka",
      description: "Jedna návštěva zákazníka. Může si najednou půjčit víc věcí.",
      color: "var(--color-role-order)",
      suggested: [
        { name: "id_vypujcky", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "od", dataType: "DATETIME", semantic: "created_at" },
        { name: "vraceno", dataType: "BOOLEAN", semantic: "paid" },
        { name: "celkem", dataType: "DECIMAL", semantic: "total" },
      ],
    },
    {
      key: "order_item",
      label: "Půjčená věc",
      description: "Které vybavení a kolik kusů si zákazník v dané výpůjčce vzal.",
      color: "var(--color-role-custom)",
      suggested: [
        { name: "id_radku", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "pocet_kusu", dataType: "INTEGER", semantic: "qty", isRequired: true },
      ],
    },
  ],
  expectedLinks: [
    {
      from: "customer",
      to: "order",
      relation: "1:N",
      why: "Jeden zákazník si půjčuje opakovaně, ale každá výpůjčka je jen jednoho zákazníka.",
    },
    {
      from: "order",
      to: "product",
      relation: "M:N",
      why: "V jedné výpůjčce může být víc věcí a jedno kolo se půjčuje pořád dokola.",
    },
  ],
  journey: buildCommerceJourney(),
};
