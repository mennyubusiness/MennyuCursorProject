import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildHostGroupCartClientSnapshot,
  dispatchGroupOrderStartCartSnapshot,
} from "./group-order-start-sync";
import { shouldApplyCartSnapshot, shouldQuickCartApplyCartSnapshot } from "./cart-client-sync";

describe("group-order-start-sync", () => {
  it("buildHostGroupCartClientSnapshot marks host active group cart", () => {
    const cart = buildHostGroupCartClientSnapshot({
      cartId: "cart_new",
      podId: "pod_a",
      podName: "Willamette Garage",
      sessionId: "sess_1",
      joinCode: "123456",
      groupOrderSessionId: "gos_1",
    });
    expect(cart.groupOrder).toMatchObject({
      role: "host",
      joinCode: "123456",
      canCheckout: true,
    });
    expect(cart.cartScope).toBe("group_order");
    expect(cart).not.toHaveProperty("joinToken");
  });

  it("group-order-start snapshot applies across stale cart ids on same pod", () => {
    const incoming = buildHostGroupCartClientSnapshot({
      cartId: "cart_active",
      podId: "pod_a",
      podName: "Pod A",
      sessionId: "sess_1",
      joinCode: "654321",
      groupOrderSessionId: "gos_2",
    });
    const staleLocal = buildHostGroupCartClientSnapshot({
      cartId: "cart_stale",
      podId: "pod_a",
      podName: null,
      sessionId: "sess_1",
      joinCode: "111111",
      groupOrderSessionId: "gos_old",
    });
    expect(
      shouldApplyCartSnapshot(
        { cart: incoming, source: "group-order-start" },
        "vendor-menu",
        { cartId: "cart_stale", podId: "pod_a" }
      )
    ).toBe(true);
    expect(
      shouldQuickCartApplyCartSnapshot(
        { cart: incoming, source: "group-order-start" },
        staleLocal,
        "pod_a"
      )
    ).toBe(true);
  });
});

describe("Quick Cart group start wiring", () => {
  const groupSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartGroupSection.tsx"),
    "utf8"
  );

  it("shows Start group order and Join with code when browsing a pod", () => {
    expect(groupSrc).toContain("Ordering with friends?");
    expect(groupSrc).toContain("StartGroupOrderButton");
    expect(groupSrc).toContain("Join with code");
  });

  it("uses host group controls instead of participant join card", () => {
    expect(groupSrc).toContain("QuickCartHostGroupControls");
    expect(groupSrc).toContain('role === "host"');
    expect(groupSrc).not.toMatch(/Join with the host's code to add your items/);
  });

  it("does not expose joinToken", () => {
    expect(groupSrc).not.toMatch(/joinToken/i);
    expect(dispatchGroupOrderStartCartSnapshot).toBeDefined();
  });
});
