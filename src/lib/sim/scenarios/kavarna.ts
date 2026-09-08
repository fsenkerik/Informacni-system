import type { Scenario } from "../types";
import { buildCommerceJourney } from "./commerce";

export const kavarna: Scenario = {
  key: "kavarna",
  name: "Kavárna",
  emoji: "☕",
  tagline: "Vedeš kavárnu na náměstí",
  description:
    "Hosté si sedají ke stolu a objednávají. Na účtenku se zapíše, co si dali, " +
    "kolik toho bylo a kolik to stálo.",
  roles: [
    {
      key: "customer",
      label: "Host",
      description: "Ten, kdo si sedne ke stolu. Někteří chodí denně.",
      color: "var(--color-role-customer)",
      suggested: [
        { name: "id_hosta", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "jmeno", dataType: "VARCHAR", semantic: "name", isRequired: true },
        { name: "email", dataType: "EMAIL", semantic: "email", isUnique: true },
        { name: "telefon", dataType: "PHONE", semantic: "phone" },
      ],
    },
    {
      key: "product",
      label: "Nápoj / jídlo",
      description: "Položka z nabídky. Má cenu a někdy i zásobu surovin.",
      color: "var(--color-role-product)",
      suggested: [
        { name: "id_polozky_menu", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "nazev", dataType: "VARCHAR", semantic: "product_name", isRequired: true },
        { name: "cena", dataType: "DECIMAL", semantic: "price", isRequired: true },
        { name: "zasoba", dataType: "INTEGER", semantic: "stock" },
      ],
    },
    {
      key: "order",
      label: "Účtenka",
      description: "Jedna návštěva jednoho hosta. Sečte se na ni všechno, co si dal.",
      color: "var(--color-role-order)",
      suggested: [
        { name: "id_uctenky", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "cas", dataType: "DATETIME", semantic: "created_at" },
        { name: "zaplaceno", dataType: "BOOLEAN", semantic: "paid" },
        { name: "celkem", dataType: "DECIMAL", semantic: "total" },
      ],
    },
    {
      key: "order_item",
      label: "Položka účtenky",
      description: "Co konkrétně a kolikrát si host dal. Spojuje účtenku s nabídkou.",
      color: "var(--color-role-custom)",
      suggested: [
        { name: "id_polozky", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "pocet", dataType: "INTEGER", semantic: "qty", isRequired: true },
      ],
    },
  ],
  expectedLinks: [
    {
      from: "customer",
      to: "order",
      relation: "1:N",
      why: "Host se vrací, takže má postupně víc účtenek. Každá účtenka je ale jen jednoho hosta.",
    },
    {
      from: "order",
      to: "product",
      relation: "M:N",
      why: "Na jedné účtence je víc položek z nabídky a jedno espresso je na spoustě účtenek.",
    },
  ],
  journey: buildCommerceJourney(),
};
