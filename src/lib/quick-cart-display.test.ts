import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  attachQuickCartDisplay,
  quickCartEmptyTitle,
  quickCartFooterCtaLabel,
  quickCartPodLinkLabel,
  quickCartSubtitle,
  buildCartPodContextForDisplay,
  resolveQuickCartSnapshotAfterUpdate,
} from "./quick-cart-display";
import type { Cart } from "@/domain/types";
import type { GroupOrderViewerContext } from "./group-order-viewer-context";
import { getCartPodContext } from "./cart-pod-context";

const soloCtx: GroupOrderViewerContext = {
  isGroupOrder: false,
  groupOrderSessionId: null,
  viewerRole: "solo",
  viewerParticipantId: null,
  hostParticipantId: null,
  hostUserId: null,
  canViewAllLines: true,
  canEditAllLines: true,
  canCheckout: true,
  joinCode: null,
};

const baseCart: Cart = {
  id: "cart_1",
  podId: "pod_a",
  sessionId: "sess_1",
  items: [],
  groups: [],
  subtotalCents: 0,
};

describe("quick-cart-display", () => {
  it("attachQuickCartDisplay sets cartScope", () => {
    const out = attachQuickCartDisplay(baseCart, soloCtx, "Riverside Pod", "browsing_pod");
    expect(out.podName).toBe("Riverside Pod");
    expect(out.cartScope).toBe("browsing_pod");
    expect(out.groupOrder?.joinCode).toBeUndefined();
    expect("joinToken" in (out.groupOrder ?? {})).toBe(false);
  });

  it("neutral subtitle does not show pod name", () => {
    const ctx = getCartPodContext({
      cart: null,
      browsingPodId: null,
      browsingPodName: null,
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    });
    expect(quickCartSubtitle(ctx)).toBe("Choose a pod to start an order");
    expect(quickCartEmptyTitle(ctx)).toContain("Find a food pod");
  });

  it("browsing subtitle uses Browsing prefix not For", () => {
    const ctx = getCartPodContext({
      cart: { ...baseCart, podName: "Downtown" },
      browsingPodId: "pod_a",
      browsingPodName: "Downtown",
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    });
    expect(quickCartSubtitle(ctx)).toBe("Browsing Downtown");
  });

  it("assigned subtitle uses For prefix", () => {
    const ctx = getCartPodContext({
      cart: {
        ...baseCart,
        podName: "Downtown",
        items: [
          {
            id: "l1",
            menuItemId: "m1",
            vendorId: "v1",
            quantity: 1,
            priceCents: 100,
            specialInstructions: null,
          },
        ],
      },
      browsingPodId: "pod_a",
      browsingPodName: "Downtown",
      assignedPodId: "pod_a",
      assignedPodName: "Downtown",
      requiresClearToSwitchPod: false,
    });
    expect(quickCartSubtitle(ctx)).toBe("For Downtown");
  });

  it("footer CTA labels differ by scope", () => {
    expect(
      quickCartFooterCtaLabel({
        hasItems: false,
        groupRole: "solo",
        canCheckout: true,
        cartScope: "neutral",
      })
    ).toBe("Go to cart");
    expect(
      quickCartFooterCtaLabel({
        hasItems: true,
        groupRole: "solo",
        canCheckout: true,
        cartScope: "assigned_pod",
      })
    ).toBe("Review cart & checkout");
  });

  it("buildCartPodContextForDisplay matches getCartPodContext", () => {
    const built = buildCartPodContextForDisplay({
      cart: null,
      browsingPodId: null,
      browsingPodName: null,
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    });
    expect(built.cartScope).toBe("neutral");
  });

  it("neutral pod link goes to explore", () => {
    const ctx = getCartPodContext({
      cart: null,
      browsingPodId: null,
      browsingPodName: null,
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    });
    expect(quickCartPodLinkLabel(ctx)).toBe("Explore pods");
  });

  it("resolveQuickCartSnapshotAfterUpdate drops empty solo carts", () => {
    expect(resolveQuickCartSnapshotAfterUpdate(baseCart)).toBeNull();
    expect(
      resolveQuickCartSnapshotAfterUpdate({
        ...baseCart,
        items: [{ id: "l1", menuItemId: "m1", vendorId: "v1", quantity: 1, priceCents: 500, specialInstructions: null }],
      })
    ).not.toBeNull();
  });

  it("resolveQuickCartSnapshotAfterUpdate keeps empty group host carts", () => {
    expect(
      resolveQuickCartSnapshotAfterUpdate({
        ...baseCart,
        groupOrder: { role: "host", canCheckout: true, joinCode: "123456" },
      })
    ).not.toBeNull();
  });
});

describe("QuickCartDrawer source", () => {
  const drawerSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartDrawer.tsx"),
    "utf8"
  );
  const groupSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartGroupSection.tsx"),
    "utf8"
  );

  it("does not render duplicate Open full cart page link", () => {
    expect(drawerSrc).not.toContain("Open full cart page");
  });

  it("neutral group section has Join with code without for this pod", () => {
    expect(groupSrc).toContain("Join with code");
    expect(groupSrc).toMatch(/Ordering with friends/);
    expect(groupSrc).not.toMatch(/for this pod/);
    expect(groupSrc).not.toMatch(/href="\/group-order\/join"/);
  });

  it("does not expose joinToken in quick cart components", () => {
    expect(drawerSrc).not.toMatch(/joinToken/i);
    expect(groupSrc).not.toMatch(/joinToken/i);
  });
});
