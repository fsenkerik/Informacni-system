import { randomInt } from "../generator";
import type { JourneyStep, SimRecord } from "../types";

/**
 * Společná cesta zákazníka pro všechny obchodní scénáře.
 *
 * Role jsou vždy stejné (customer / product / order / order_item), mění se jen
 * jejich pojmenování ve scénáři – v kavárně je „Zákazník“ Host a „Objednávka“
 * Účtenka. Logika zůstává jedna, takže se testuje jednou.
 */
export function buildCommerceJourney(): JourneyStep[] {
  return [
    {
      key: "customer",
      label: "Zákazník se zapisuje do systému",
      requires: [{ kind: "entity", role: "customer" }],
      run(ctx) {
        // Část zákazníků se vrací – díky tomu je poznat chybějící UNIQUE na e-mailu.
        const returning = ctx.random() < 0.3 ? ctx.pickExisting("customer") : undefined;
        if (returning) {
          ctx.memory.set("customer", returning);
          ctx.emit({
            type: "STEP_OK",
            severity: "info",
            message: "Vrací se stálý zákazník, systém ho poznal.",
            entityId: returning.entityId,
            stepKey: "customer",
          });
          return { ok: true };
        }

        const created = ctx.insert("customer");
        if (!created) {
          return ctx.fail(ctx.lastWriteIssue!, { lost: true });
        }
        ctx.memory.set("customer", created);
        return { ok: true };
      },
    },

    {
      key: "order",
      label: "Zakládá se objednávka",
      requires: [
        { kind: "entity", role: "order" },
        { kind: "link", from: "customer", to: "order", relation: "1:N" },
      ],
      run(ctx) {
        const customer = ctx.memory.get("customer") as SimRecord | undefined;
        const order = ctx.insert("order");
        if (!order) return ctx.fail(ctx.lastWriteIssue!, { lost: true });

        if (customer) {
          ctx.link(order, customer, ctx.roleEntity("customer"));
        }
        ctx.memory.set("order", order);
        return { ok: true };
      },
    },

    {
      key: "items",
      label: "Do objednávky se přidávají položky",
      requires: [
        { kind: "entity", role: "product" },
        { kind: "link", from: "order", to: "product", relation: "M:N" },
      ],
      run(ctx) {
        const order = ctx.memory.get("order") as SimRecord | undefined;
        const catalog = ctx.allOf("product");
        if (catalog.length === 0) return { ok: true };

        const junction = ctx.resolveJunction("order", "product");
        const orderEntity = ctx.roleEntity("order");
        const productEntity = ctx.roleEntity("product");
        const howMany = randomInt(ctx.random, 1, Math.min(3, catalog.length));

        let total = 0;
        for (let i = 0; i < howMany; i += 1) {
          const product = catalog[Math.floor(ctx.random() * catalog.length)];
          const qty = randomInt(ctx.random, 1, 3);

          if (junction) {
            const item = ctx.insertInto(junction);
            if (!item) return ctx.fail(ctx.lastWriteIssue!, { lost: true });
            if (order) ctx.link(item, order, orderEntity);
            ctx.link(item, product, productEntity);
            ctx.setValue(item, "qty", qty);
          }

          const stock = ctx.getValue(product, "stock");
          if (typeof stock === "number") {
            if (stock <= 0) {
              // Vyprodáno je provozní situace, ne chyba návrhu – patří do logu,
              // ne mezi chyby, které má žák v diagramu opravovat.
              ctx.emit({
                type: "STEP_FAILED",
                severity: "warn",
                message: `Zboží „${describe(product)}“ je vyprodané, doskladní se ráno.`,
                entityId: product.entityId,
                stepKey: "items",
              });
            } else {
              ctx.setValue(product, "stock", Math.max(0, stock - qty));
            }
          }

          const price = ctx.getValue(product, "price");
          if (typeof price === "number") total += price * qty;
        }

        ctx.memory.set("total", total);
        return { ok: true };
      },
    },

    {
      key: "payment",
      label: "Zákazník platí",
      requires: [
        {
          kind: "attribute",
          role: "product",
          semantic: "price",
          types: ["DECIMAL", "INTEGER"],
        },
      ],
      run(ctx) {
        const order = ctx.memory.get("order") as SimRecord | undefined;
        const total = Math.round(Number(ctx.memory.get("total") ?? 0) * 100) / 100;

        if (order) {
          ctx.setValue(order, "total", total);
          ctx.setValue(order, "paid", true);
          ctx.setValue(order, "status", "zaplacená");
        }
        ctx.addRevenue(total);
        ctx.emit({
          type: "STEP_OK",
          severity: "info",
          message: `Zaplaceno ${Math.round(total).toLocaleString("cs-CZ")} Kč.`,
          amount: total,
          stepKey: "payment",
          entityId: order?.entityId,
        });
        return { ok: true };
      },
    },
  ];
}

function describe(record: SimRecord): string {
  const value = Object.values(record.data).find(
    (v) => typeof v === "string" && v.length > 0 && !String(v).includes("@"),
  );
  return typeof value === "string" ? value : "položka";
}
