import type { Scenario } from "../types";
import { buildCommerceJourney } from "./commerce";

export const autoservis: Scenario = {
  key: "autoservis",
  name: "Autoservis",
  emoji: "🔧",
  tagline: "Opravuješ auta zákazníkům",
  description:
    "Zákazník přiveze auto, ty na něj vypíšeš zakázku a do ní zapíšeš provedené " +
    "úkony. Na konci to spočítáš a vyfakturuješ.",
  roles: [
    {
      key: "customer",
      label: "Zákazník",
      description: "Majitel auta. Vrací se na pravidelný servis.",
      color: "var(--color-role-customer)",
      suggested: [
        { name: "id_zakaznika", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "jmeno", dataType: "VARCHAR", semantic: "name", isRequired: true },
        { name: "telefon", dataType: "PHONE", semantic: "phone", isRequired: true },
        { name: "email", dataType: "EMAIL", semantic: "email", isUnique: true },
      ],
    },
    {
      key: "product",
      label: "Servisní úkon",
      description: "Co všechno umíš udělat – výměna oleje, přezutí, diagnostika. Každý úkon má cenu.",
      color: "var(--color-role-product)",
      suggested: [
        { name: "id_ukonu", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "nazev", dataType: "VARCHAR", semantic: "product_name", isRequired: true },
        { name: "cena", dataType: "DECIMAL", semantic: "price", isRequired: true },
      ],
    },
    {
      key: "order",
      label: "Zakázka",
      description: "Jedna návštěva auta v servisu. Patří zákazníkovi a obsahuje úkony.",
      color: "var(--color-role-order)",
      suggested: [
        { name: "id_zakazky", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "prijato", dataType: "DATETIME", semantic: "created_at" },
        { name: "stav", dataType: "ENUM", semantic: "status" },
        { name: "cena_celkem", dataType: "DECIMAL", semantic: "total" },
      ],
    },
    {
      key: "order_item",
      label: "Provedený úkon",
      description: "Který úkon se na které zakázce udělal a kolikrát.",
      color: "var(--color-role-custom)",
      suggested: [
        { name: "id_radku", dataType: "INTEGER", isPrimaryKey: true, isRequired: true },
        { name: "pocet", dataType: "INTEGER", semantic: "qty", isRequired: true },
      ],
    },
  ],
  expectedLinks: [
    {
      from: "customer",
      to: "order",
      relation: "1:N",
      why: "Zákazník má za život víc zakázek, ale každá zakázka je jednoho zákazníka.",
    },
    {
      from: "order",
      to: "product",
      relation: "M:N",
      why: "Na jedné zakázce se dělá víc úkonů a jeden úkon se opakuje na spoustě zakázek.",
    },
  ],
  journey: buildCommerceJourney(),
};
