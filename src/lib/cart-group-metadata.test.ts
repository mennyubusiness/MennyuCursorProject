import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Cart } from "@/domain/types";
import { enrichCartUpdatedDetail } from "@/lib/cart-client-sync";
import {
  hasActiveGroupOrderDisplay,
  normalizeAuthoritativeCartSnapshot,
  normalizeQuickCartApiCart,
} from "@/lib/cart-group-metadata";
import {
  mergeAcceptedCartSnapshotMeta,
  resetCartSnapshotFreshnessForTests,
  shouldAcceptCartSnapshot,
} from "@/lib/cart-snapshot-freshness";
import { getCartPodContext } from "@/lib/cart-pod-context";
import { quickCartHasActiveGroupOrder, quickCartSubtitle } from "@/lib/quick-cart-display";

function line(id = "line_1") {
  return {
    id,
    menuItemId: "item_1",
    vendorId: "vendor_1",
    quantity: 1,
    priceCents: 500,
    specialInstructions: null as string | null,
  };
}

function baseCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "cart_1",
    podId: "pod_a",
    sessionId: "sess_1",
    items: [],
    groups: [],
    subtotalCents: 0,
    podName: "Willamette Garage",
    ...overrides,
  };
}

function hostGroupCart(): Cart {
  return baseCart({
    groupOrder: {
      role: "host",
      canCheckout: true,
      joinCode: "123456",
      groupOrderSessionId: "gos_1",
    },
    cartScope: "group_order",
  });
}

function emit(detail: Parameters<typeof enrichCartUpdatedDetail>[0]) {
  return enrichCartUpdatedDetail(detail);
}

describe("cart group metadata normalization", () => {
  beforeEach(() => {
    resetCartSnapshotFreshnessForTests();
  });

  it("solo add after group end clears stale groupOrder metadata", () => {
    let last = mergeAcceptedCartSnapshotMeta(null, emit({ cart: hostGroupCart(), source: "group-order-start" }));

    const end = emit({
      cart: normalizeAuthoritativeCartSnapshot(
        baseCart({ groupOrder: { role: "host", canCheckout: true, joinCode: "123456" } }),
        "group-order-ended"
      ),
      source: "group-order-ended",
    });
    expect(shouldAcceptCartSnapshot(end, last)).toBe(true);
    last = mergeAcceptedCartSnapshotMeta(last, end);

    const soloAdd = emit({
      cart: normalizeAuthoritativeCartSnapshot(
        baseCart({
          items: [line()],
          groups: [{ vendorId: "vendor_1", vendorName: "Vendor", items: [line()], subtotalCents: 500 }],
          subtotalCents: 500,
          groupOrder: { role: "unknown", canCheckout: false },
        }),
        "vendor-menu"
      ),
      source: "vendor-menu",
    });

    expect(soloAdd.cart?.groupOrder).toBeUndefined();
    expect(soloAdd.cart?.cartScope).toBe("assigned_pod");
    expect(shouldAcceptCartSnapshot(soloAdd, last)).toBe(true);
    last = mergeAcceptedCartSnapshotMeta(last, soloAdd);

    expect(hasActiveGroupOrderDisplay(soloAdd.cart)).toBe(false);
    expect(quickCartHasActiveGroupOrder(soloAdd.cart)).toBe(false);
  });

  it("Quick Cart header does not show Group order after solo add", () => {
    const cart = normalizeAuthoritativeCartSnapshot(
      baseCart({
        items: [line()],
        groupOrder: { role: "unknown", canCheckout: false },
      }),
      "vendor-menu"
    );
    const ctx = getCartPodContext({
      cart,
      browsingPodId: "pod_a",
      browsingPodName: "Willamette Garage",
      assignedPodId: "pod_a",
      assignedPodName: "Willamette Garage",
      requiresClearToSwitchPod: false,
    });
    expect(quickCartSubtitle(ctx)).toBe("For Willamette Garage");
    expect(ctx.cartScope).toBe("assigned_pod");
  });

  it("Quick Cart body does not treat post-end solo add as inaccessible group", () => {
    const cart = normalizeAuthoritativeCartSnapshot(
      baseCart({
        items: [line()],
        groupOrder: { role: "unknown", canCheckout: false },
      }),
      "vendor-menu"
    );
    const ctx = getCartPodContext({
      cart,
      browsingPodId: "pod_a",
      browsingPodName: "Willamette Garage",
      assignedPodId: "pod_a",
      assignedPodName: "Willamette Garage",
      requiresClearToSwitchPod: false,
    });
    expect(ctx.cartScope).not.toBe("group_order");
    expect(cart.groupOrder).toBeUndefined();
  });

  it("active group host still has group metadata", () => {
    const cart = normalizeAuthoritativeCartSnapshot(hostGroupCart(), "group-order-start");
    expect(hasActiveGroupOrderDisplay(cart)).toBe(true);
    expect(cart.groupOrder?.joinCode).toBe("123456");
    expect(cart.cartScope).toBe("group_order");
  });

  it("active group participant still has group metadata", () => {
    const cart = normalizeAuthoritativeCartSnapshot(
      baseCart({
        groupOrder: { role: "participant", canCheckout: false },
        cartScope: "group_order",
      }),
      "group-order-start"
    );
    expect(hasActiveGroupOrderDisplay(cart)).toBe(true);
  });

  it("inaccessible active group keeps unknown role with group_order scope from API", () => {
    const cart = normalizeQuickCartApiCart(
      baseCart({
        groupOrder: { role: "unknown", canCheckout: false },
      }),
      "group_order"
    );
    expect(cart?.groupOrder?.role).toBe("unknown");
    expect(cart?.cartScope).toBe("group_order");
  });

  it("normalizeQuickCartApiCart clears stale group metadata for assigned solo scope", () => {
    const cart = normalizeQuickCartApiCart(
      baseCart({
        items: [line()],
        groupOrder: { role: "unknown", canCheckout: false },
      }),
      "assigned_pod"
    );
    expect(cart?.groupOrder).toBeUndefined();
    expect(cart?.cartScope).toBe("assigned_pod");
  });

  it("regression: add-after-end sequence keeps item and solo display state", () => {
    let last = mergeAcceptedCartSnapshotMeta(null, emit({ cart: hostGroupCart(), source: "group-order-start" }));
    last = mergeAcceptedCartSnapshotMeta(
      last,
      emit({
        cart: normalizeAuthoritativeCartSnapshot(baseCart(), "vendor-menu"),
        source: "vendor-menu",
      })
    );
    last = mergeAcceptedCartSnapshotMeta(
      last,
      emit({
        cart: normalizeAuthoritativeCartSnapshot(baseCart(), "group-order-ended"),
        source: "group-order-ended",
      })
    );
    const add = emit({
      cart: normalizeAuthoritativeCartSnapshot(
        baseCart({
          items: [line()],
          groups: [{ vendorId: "vendor_1", vendorName: "Vendor", items: [line()], subtotalCents: 500 }],
          subtotalCents: 500,
          groupOrder: { role: "unknown", canCheckout: false },
        }),
        "vendor-menu"
      ),
      source: "vendor-menu",
    });
    expect(shouldAcceptCartSnapshot(add, last)).toBe(true);
    expect(add.cart?.items).toHaveLength(1);
    expect(add.cart?.groupOrder).toBeUndefined();
    const ctx = getCartPodContext({
      cart: add.cart!,
      browsingPodId: "pod_a",
      browsingPodName: "Willamette Garage",
      assignedPodId: "pod_a",
      assignedPodName: "Willamette Garage",
      requiresClearToSwitchPod: false,
    });
    expect(quickCartSubtitle(ctx)).not.toMatch(/^Group order ·/);
  });
});

describe("client wiring for group metadata cleanup", () => {
  const quickCartSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartContext.tsx"),
    "utf8"
  );
  const vendorSrc = readFileSync(
    join(process.cwd(), "src/components/vendor-menu/VendorMenuCartContext.tsx"),
    "utf8"
  );
  const syncSrc = readFileSync(join(process.cwd(), "src/lib/cart-client-sync.ts"), "utf8");

  it("QuickCartContext and VendorMenuCartContext normalize authoritative snapshots", () => {
    expect(quickCartSrc).toContain("normalizeAuthoritativeCartSnapshot");
    expect(quickCartSrc).toContain("normalizeQuickCartApiCart");
    expect(vendorSrc).toContain("normalizeAuthoritativeCartSnapshot");
    expect(syncSrc).toContain("normalizeAuthoritativeCartSnapshot");
  });
});
