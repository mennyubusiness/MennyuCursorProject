import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { optimisticDecrementCartItem } from "@/lib/cart-optimistic";
import { resolveQuickCartSnapshotAfterUpdate } from "@/lib/quick-cart-display";
import type { Cart } from "@/domain/types";

const singleItemCart: Cart = {
  id: "cart_1",
  podId: "pod_1",
  sessionId: "sess_1",
  subtotalCents: 500,
  cartScope: "assigned_pod",
  items: [
    {
      id: "line_1",
      menuItemId: "mi_1",
      vendorId: "v_1",
      quantity: 1,
      priceCents: 500,
      specialInstructions: null,
      menuItem: { name: "Latte" },
    },
  ],
  groups: [],
};

describe("Quick Cart final-item decrement", () => {
  it("optimistically removes the last line and zeroes subtotal", () => {
    const next = optimisticDecrementCartItem(singleItemCart, "line_1");
    expect(next?.items).toHaveLength(0);
    expect(next?.subtotalCents).toBe(0);
  });

  it("keeps empty cart snapshot for Quick Cart display", () => {
    const empty = optimisticDecrementCartItem(singleItemCart, "line_1");
    expect(resolveQuickCartSnapshotAfterUpdate(empty)).toEqual(empty);
  });

  it("decrement mutation uses remove when optimistic cart has no line", () => {
    const mutationSrc = readFileSync(
      join(process.cwd(), "src/lib/cart-optimistic-line-mutations.ts"),
      "utf8"
    );
    expect(mutationSrc).toMatch(/if \(!line\)/);
    expect(mutationSrc).toMatch(/removeFromCartAction/);
    expect(mutationSrc).toMatch(/optimisticDecrementCartItem/);
  });

  it("Quick Cart context does not close drawer for empty cart snapshots", () => {
    const contextSrc = readFileSync(
      join(process.cwd(), "src/components/cart/QuickCartContext.tsx"),
      "utf8"
    );
    const applyCartSnapshotBlock = contextSrc.slice(
      contextSrc.indexOf("const applyCartSnapshot = useCallback"),
      contextSrc.indexOf("const refreshCart = useCallback")
    );
    expect(applyCartSnapshotBlock).toMatch(/if \(next === null\)/);
    expect(applyCartSnapshotBlock).not.toMatch(/if \(!displayCart\)[\s\S]*?setIsOpen\(false\)/);
  });
});
