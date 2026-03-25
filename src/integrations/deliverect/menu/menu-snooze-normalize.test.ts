import { describe, expect, it } from "vitest";
import { runPhase1aDeliverectMenuImport } from "./phase1a-pipeline";

const deliverectMeta = {
  sourcePayloadKind: "deliverect_menu_webhook_v1" as const,
};

describe("Deliverect snooze → canonical isAvailable", () => {
  it("marks snoozed product unavailable (snoozed: true)", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [{ _id: "cat-1", name: "Food", productIds: ["p-snoozed"] }],
        products: {
          "p-snoozed": {
            _id: "p-snoozed",
            name: "Snoozed pizza",
            price: 1299,
            snoozed: true,
          },
        },
      },
      vendorId: "vendor_snooze_test",
      deliverect: deliverectMeta,
    });

    expect(result.ok).toBe(true);
    expect(result.menu).not.toBeNull();
    const p = result.menu!.products.find((x) => x.deliverectId === "p-snoozed");
    expect(p?.isAvailable).toBe(false);
  });

  it("marks product unavailable when available: false", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [{ _id: "cat-1", name: "Food", productIds: ["p-off"] }],
        products: {
          "p-off": {
            _id: "p-off",
            name: "Off menu",
            price: 500,
            available: false,
          },
        },
      },
      vendorId: "vendor_snooze_test",
      deliverect: deliverectMeta,
    });

    expect(result.ok).toBe(true);
    const p = result.menu!.products.find((x) => x.deliverectId === "p-off");
    expect(p?.isAvailable).toBe(false);
  });

  it("marks snoozed modifier option unavailable", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [{ _id: "cat-1", name: "Food", productIds: ["p1"] }],
        products: {
          p1: {
            _id: "p1",
            name: "Burger",
            price: 1000,
            subProducts: {
              mg_toppings: {
                name: "Toppings",
                min: 0,
                max: 2,
                subProducts: {
                  opt_ok: { name: "Lettuce", price: 0 },
                  opt_snoozed: { name: "Snoozed sauce", price: 50, snoozed: true },
                },
              },
            },
          },
        },
      },
      vendorId: "vendor_snooze_test",
      deliverect: deliverectMeta,
    });

    expect(result.ok).toBe(true);
    expect(result.menu).not.toBeNull();
    const g = result.menu!.modifierGroupDefinitions.find((x) => x.deliverectId === "mg_toppings");
    expect(g).toBeDefined();
    const snoozed = g!.options.find((o) => o.deliverectId === "opt_snoozed");
    const ok = g!.options.find((o) => o.deliverectId === "opt_ok");
    expect(snoozed?.isAvailable).toBe(false);
    expect(ok?.isAvailable).toBe(true);
  });

  it("marks modifier option unavailable for isSnoozed alias", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [{ _id: "cat-1", name: "Food", productIds: ["p1"] }],
        products: {
          p1: {
            _id: "p1",
            name: "Salad",
            price: 800,
            subProducts: {
              mg1: {
                name: "Dressing",
                min: 0,
                max: 1,
                subProducts: {
                  opt_alias: { name: "Ranch", price: 0, isSnoozed: true },
                },
              },
            },
          },
        },
      },
      vendorId: "vendor_snooze_test",
      deliverect: deliverectMeta,
    });

    expect(result.ok).toBe(true);
    const g = result.menu!.modifierGroupDefinitions.find((x) => x.deliverectId === "mg1");
    const opt = g!.options.find((o) => o.deliverectId === "opt_alias");
    expect(opt?.isAvailable).toBe(false);
  });
});
