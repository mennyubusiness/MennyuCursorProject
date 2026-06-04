import { describe, expect, it } from "vitest";
import { getCartPodContext, isCartRowAssigned } from "./cart-pod-context";
import type { Cart } from "@/domain/types";

const baseCart: Cart = {
  id: "cart_1",
  podId: "pod_a",
  sessionId: "sess_1",
  items: [],
  groups: [],
  subtotalCents: 0,
  podName: "Downtown Food Pod",
};

describe("cart-pod-context", () => {
  it("neutral when no cart, browse, or assignment", () => {
    const ctx = getCartPodContext({
      cart: null,
      browsingPodId: null,
      browsingPodName: null,
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    });
    expect(ctx.assignedPodId).toBeNull();
    expect(ctx.cartScope).toBe("neutral");
    expect(ctx.cartPodName).toBeNull();
  });

  it("browsing_pod for empty cart on pod route without items", () => {
    const ctx = getCartPodContext({
      cart: { ...baseCart, items: [], cartScope: "browsing_pod" },
      browsingPodId: "pod_a",
      browsingPodName: "Downtown Food Pod",
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    });
    expect(ctx.cartScope).toBe("browsing_pod");
    expect(ctx.cartPodId).toBeNull();
  });

  it("assigned_pod when cart has items", () => {
    const ctx = getCartPodContext({
      cart: {
        ...baseCart,
        items: [{ id: "l1", menuItemId: "m1", vendorId: "v1", quantity: 1, priceCents: 100, specialInstructions: null }],
        groups: [],
        subtotalCents: 100,
      },
      browsingPodId: "pod_a",
      browsingPodName: "Downtown Food Pod",
      assignedPodId: "pod_a",
      assignedPodName: "Downtown Food Pod",
      requiresClearToSwitchPod: false,
    });
    expect(ctx.cartScope).toBe("assigned_pod");
    expect(ctx.cartPodName).toBe("Downtown Food Pod");
  });

  it("does not treat stale browse alone as assigned", () => {
    const ctx = getCartPodContext({
      cart: null,
      browsingPodId: "pod_stale",
      browsingPodName: "Stale Pod",
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    });
    expect(ctx.cartScope).toBe("browsing_pod");
    expect(ctx.cartPodId).toBeNull();
  });

  it("isCartRowAssigned requires items or active group", () => {
    expect(isCartRowAssigned({ itemCount: 0, hasActiveGroupSession: false })).toBe(false);
    expect(isCartRowAssigned({ itemCount: 1, hasActiveGroupSession: false })).toBe(true);
    expect(isCartRowAssigned({ itemCount: 0, hasActiveGroupSession: true })).toBe(true);
  });
});
