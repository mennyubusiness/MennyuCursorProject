import { describe, expect, it } from "vitest";
import { optimisticSimpleAdd, optimisticIncrementCartItem, optimisticRemoveCartItem } from "@/lib/cart-optimistic";
import type { Cart } from "@/domain/types";

const baseCart: Cart = {
  id: "c1",
  podId: "p1",
  sessionId: "s1",
  subtotalCents: 500,
  items: [
    {
      id: "line1",
      menuItemId: "mi1",
      vendorId: "v1",
      quantity: 1,
      priceCents: 500,
      specialInstructions: null,
      menuItem: { name: "Latte" },
    },
  ],
  groups: [
    {
      vendorId: "v1",
      vendorName: "Cafe",
      subtotalCents: 500,
      items: [
        {
          id: "line1",
          menuItemId: "mi1",
          vendorId: "v1",
          quantity: 1,
          priceCents: 500,
          specialInstructions: null,
          menuItem: { name: "Latte" },
        },
      ],
    },
  ],
};

describe("optimisticSimpleAdd", () => {
  it("increments quantity on matching simple line", () => {
    const next = optimisticSimpleAdd(baseCart, {
      menuItemId: "mi1",
      vendorId: "v1",
      vendorName: "Cafe",
      menuItemName: "Latte",
      unitPriceCents: 500,
    });
    expect(next?.items[0]?.quantity).toBe(2);
    expect(next?.subtotalCents).toBe(1000);
  });

  it("appends a temp line when no match", () => {
    const next = optimisticSimpleAdd(baseCart, {
      menuItemId: "mi2",
      vendorId: "v1",
      vendorName: "Cafe",
      menuItemName: "Muffin",
      unitPriceCents: 300,
    });
    expect(next?.items).toHaveLength(2);
    expect(next?.items[1]?.id.startsWith("optimistic:")).toBe(true);
    expect(next?.subtotalCents).toBe(800);
  });
});

describe("optimistic line quantity helpers", () => {
  it("returns null when line id is unknown", () => {
    expect(optimisticIncrementCartItem(baseCart, "missing")).toBeNull();
    expect(optimisticRemoveCartItem(baseCart, "missing")).toBeNull();
  });
});
