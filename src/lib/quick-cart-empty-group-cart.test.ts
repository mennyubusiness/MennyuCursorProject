import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildActiveCartRecovery,
  shouldShowActiveRecovery,
} from "./quick-cart-active-recovery";
import {
  quickCartHasActiveGroupOrder,
  shouldShowFullCartInQuickCartDrawer,
} from "./quick-cart-display";
import type { Cart } from "@/domain/types";

const emptyHostGroupCart: Cart = {
  id: "cart_go",
  podId: "pod_a",
  sessionId: "sess_1",
  podName: "Pod A",
  items: [],
  groups: [],
  subtotalCents: 0,
  groupOrder: {
    role: "host",
    canCheckout: true,
    joinCode: "280963",
    groupOrderSessionId: "gos_1",
  },
  cartScope: "group_order",
};

describe("shouldShowFullCartInQuickCartDrawer", () => {
  it("shows empty host group cart on neutral scope (no browse pod)", () => {
    expect(
      shouldShowFullCartInQuickCartDrawer({
        scope: "group_order",
        browsePodId: null,
        assignedPodId: "pod_a",
      })
    ).toBe(true);
  });

  it("shows empty host group cart when browsing matching pod", () => {
    expect(
      shouldShowFullCartInQuickCartDrawer({
        scope: "group_order",
        browsePodId: "pod_a",
        assignedPodId: "pod_a",
      })
    ).toBe(true);
  });

  it("hides group cart drawer when browsing a different pod", () => {
    expect(
      shouldShowFullCartInQuickCartDrawer({
        scope: "group_order",
        browsePodId: "pod_b",
        assignedPodId: "pod_a",
      })
    ).toBe(false);
  });

  it("still requires browse pod match for solo assigned carts", () => {
    expect(
      shouldShowFullCartInQuickCartDrawer({
        scope: "assigned_pod",
        browsePodId: null,
        assignedPodId: "pod_a",
      })
    ).toBe(false);
  });
});

describe("quickCartHasActiveGroupOrder", () => {
  it("detects host and participant roles without items", () => {
    expect(quickCartHasActiveGroupOrder(emptyHostGroupCart)).toBe(true);
    expect(
      quickCartHasActiveGroupOrder({
        ...emptyHostGroupCart,
        groupOrder: { role: "participant", canCheckout: false },
      })
    ).toBe(true);
    expect(quickCartHasActiveGroupOrder(null)).toBe(false);
  });
});

describe("shouldShowActiveRecovery for group carts", () => {
  const hostRecovery = buildActiveCartRecovery({
    cart: emptyHostGroupCart,
    browsePodId: null,
    browsePodName: null,
  });

  it("does not replace in-drawer group cart with recovery on neutral scope", () => {
    expect(shouldShowActiveRecovery(hostRecovery, "neutral", false)).toBe(false);
  });

  it("still shows recovery when browsing a conflicting pod", () => {
    const conflict = buildActiveCartRecovery({
      cart: emptyHostGroupCart,
      browsePodId: "pod_b",
      browsePodName: "Other",
    });
    expect(shouldShowActiveRecovery(conflict, "browsing_pod", true)).toBe(true);
  });
});

describe("empty group cart wiring", () => {
  const drawerSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartDrawer.tsx"),
    "utf8"
  );
  const headerSrc = readFileSync(join(process.cwd(), "src/components/SiteHeaderNav.tsx"), "utf8");
  const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
  const cartServiceSrc = readFileSync(join(process.cwd(), "src/services/cart.service.ts"), "utf8");

  it("header opens Quick Cart drawer (not item-count gated)", () => {
    expect(headerSrc).toMatch(/canOpenQuickCart/);
    expect(headerSrc).toMatch(/openCart/);
    expect(headerSrc).not.toMatch(/itemCount\s*>\s*0[\s\S]*canOpenQuickCart/);
  });

  it("Quick Cart drawer footer works for empty group carts", () => {
    expect(drawerSrc).toMatch(/showGroupOrderFooter/);
    expect(drawerSrc).toMatch(/quickCartHasActiveGroupOrder/);
    expect(drawerSrc).not.toMatch(/showHostGroupEmpty\) && cart && \(hasItems/);
  });

  it("cart page loads active group cart before solo fallbacks", () => {
    expect(cartPageSrc).toMatch(/loadActiveGroupCartForCartPage/);
    expect(cartPageSrc).toMatch(/GroupOrderHostEmptyCartState/);
  });

  it("getQuickCartPayload resolves host group without browse pod", () => {
    expect(cartServiceSrc).toMatch(/resolveHostActiveGroupCartId/);
    expect(cartServiceSrc).toMatch(/shouldShowFullCartInQuickCartDrawer/);
  });
});
