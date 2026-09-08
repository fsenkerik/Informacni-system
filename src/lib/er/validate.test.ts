import { describe, expect, it } from "vitest";
import { validateSchema } from "./validate";
import { eshop } from "@/lib/sim/scenarios/eshop";
import { buildSchema, correctEshopSchema, withoutLink } from "@/lib/sim/testing";

function idsOf(schema: Parameters<typeof validateSchema>[0]) {
  return validateSchema(schema, eshop).map((f) => f.id);
}

describe("kontrola návrhu", () => {
  it("na správném e-shopu nic nehlásí", () => {
    expect(validateSchema(correctEshopSchema(), eshop)).toEqual([]);
  });

  it("najde chybějící vazbu mezi zákazníkem a objednávkou", () => {
    const broken = withoutLink(correctEshopSchema(), "Zakaznik", "Objednavka");
    const findings = validateSchema(broken, eshop);
    const link = findings.find((f) => f.id === "link-customer-order");

    expect(link).toBeDefined();
    expect(link!.level).toBe("error");
    expect(link!.title).toContain("1:N");
  });

  it("neoznačí primární klíč spojovací tabulky za porušení 1NF", () => {
    // `id_polozky` obsahuje slovo „polozky“, ale je to obyčejný klíč.
    expect(idsOf(correctEshopSchema()).some((id) => id.startsWith("nf1-"))).toBe(false);
  });

  it("porušení 1NF pozná, když sloupec opravdu drží seznam", () => {
    const schema = buildSchema({
      entities: [
        {
          name: "Zakaznik",
          role: "customer",
          attrs: [
            { name: "id_zakaznika", type: "INTEGER", pk: true },
            { name: "jmeno", type: "VARCHAR", semantic: "name" },
            { name: "telefony", type: "VARCHAR" },
          ],
        },
      ],
    });
    expect(idsOf(schema).some((id) => id.startsWith("nf1-"))).toBe(true);
  });

  it("upozorní na telefon uložený jako číslo", () => {
    const schema = buildSchema({
      entities: [
        {
          name: "Zakaznik",
          role: "customer",
          attrs: [
            { name: "id_zakaznika", type: "INTEGER", pk: true },
            { name: "telefon", type: "INTEGER" },
          ],
        },
      ],
    });
    const finding = validateSchema(schema, eshop).find((f) =>
      f.title.includes("telefon"),
    );
    expect(finding).toBeDefined();
    expect(finding!.message).toContain("předvolbu");
  });

  it("hlásí tabulku bez primárního klíče", () => {
    const schema = buildSchema({
      entities: [
        {
          name: "Zakaznik",
          role: "customer",
          attrs: [{ name: "jmeno", type: "VARCHAR", semantic: "name" }],
        },
      ],
    });
    const finding = validateSchema(schema, eshop).find((f) => f.id.startsWith("pk-"));
    expect(finding).toBeDefined();
    expect(finding!.level).toBe("error");
  });
});
