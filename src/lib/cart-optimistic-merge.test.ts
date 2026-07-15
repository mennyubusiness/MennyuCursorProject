import { describe, expect, it } from "vitest";
import type { Cart } from "@/domain/types";
import { mergeServerCartWithLocalPending } from "@/lib/cart-optimistic-merge";

function cart(items: Array<{ id: string; menuItemId: string; quantity: number; name?: string }>): Cart {
  return {
    id: "cart_1",
    podId: "pod_1",
    sessionId: "sess_1",
    subtotalCents: items.reduce((n, i) => n + i.quantity * 100, 0),
    items: items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      vendorId: "v_1",
      quantity: i.quantity,
      priceCents: 100,
      specialInstructions: null,
      menuItem: { name: i.name ?? i.menuItemId },
    })),
    groups: [],
  };
}

describe("mergeServerCartWithLocalPending", () => {
  it("keeps optimistic lines missing from a lagging server snapshot", () => {
    const server = cart([{ id: "line_a", menuItemId: "mi_a", quantity: 1, name: "A" }]);
    const local = cart([
      { id: "line_a", menuItemId: "mi_a", quantity: 1, name: "A" },
      { id: "optimistic:mi_b:1", menuItemId: "mi_b", quantity: 1, name: "B" },
      { id: "optimistic:mi_c:1", menuItemId: "mi_c", quantity: 2, name: "C" },
    ]);

    const merged = mergeServerCartWithLocalPending(server, local);
    expect(merged.items.map((i) => i.menuItemId).sort()).toEqual(["mi_a", "mi_b", "mi_c"]);
    expect(merged.subtotalCents).toBe(400);
  });

  it("prefers higher local quantity on the same line while sync is pending", () => {
    const server = cart([{ id: "line_1", menuItemId: "mi_1", quantity: 2 }]);
    const local = cart([{ id: "line_1", menuItemId: "mi_1", quantity: 5 }]);
    const merged = mergeServerCartWithLocalPending(server, local);
    expect(merged.items[0]?.quantity).toBe(5);
  });

  it("does not duplicate when optimistic line already exists on server under a real id", () => {
    const server = cart([{ id: "line_b", menuItemId: "mi_b", quantity: 1, name: "B" }]);
    const local = cart([
      { id: "optimistic:mi_b:1", menuItemId: "mi_b", quantity: 1, name: "B" },
    ]);
    const merged = mergeServerCartWithLocalPending(server, local);
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0]?.id).toBe("line_b");
  });
});
