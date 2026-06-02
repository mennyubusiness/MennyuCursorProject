import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "@/domain/types";

const sessionStore = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => sessionStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    sessionStore.set(key, value);
  },
  removeItem: (key: string) => {
    sessionStore.delete(key);
  },
  clear: () => {
    sessionStore.clear();
  },
});

import {
  cartClearAppliesToContext,
  cartSnapshotAppliesToContext,
  consumePendingClientCartClear,
  emptyCartSnapshot,
  ensureCartSnapshotScalars,
  markPendingClientCartClear,
  PENDING_CART_CLEAR_STORAGE_KEY,
  readMennyuCheckoutCookie,
  shouldApplyCartFetchResult,
  shouldApplyCartSnapshot,
  shouldQuickCartApplyCartSnapshot,
} from "@/lib/cart-client-sync";

function cart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "cart_1",
    podId: "pod_a",
    sessionId: "sess_1",
    items: [],
    groups: [],
    subtotalCents: 0,
    ...overrides,
  };
}

describe("cart-client-sync", () => {
  const ctx = { cartId: "cart_1", podId: "pod_a" };

  beforeEach(() => {
    sessionStore.clear();
  });

  it("cartSnapshotAppliesToContext matches cartId and podId", () => {
    expect(cartSnapshotAppliesToContext(cart(), ctx)).toBe(true);
    expect(cartSnapshotAppliesToContext(cart({ id: "cart_2" }), ctx)).toBe(false);
    expect(cartSnapshotAppliesToContext(cart({ podId: "pod_b" }), ctx)).toBe(false);
    expect(cartSnapshotAppliesToContext(null, ctx)).toBe(false);
  });

  it("shouldApplyCartSnapshot ignores same source", () => {
    expect(
      shouldApplyCartSnapshot({ cart: cart(), source: "quick-cart" }, "quick-cart", ctx)
    ).toBe(false);
    expect(
      shouldApplyCartSnapshot({ cart: cart(), source: "vendor-menu" }, "vendor-menu", ctx)
    ).toBe(false);
  });

  it("shouldApplyCartSnapshot applies cross-source snapshots for same cart/pod", () => {
    expect(
      shouldApplyCartSnapshot({ cart: cart(), source: "quick-cart" }, "vendor-menu", ctx)
    ).toBe(true);
    expect(
      shouldApplyCartSnapshot({ cart: cart(), source: "vendor-menu" }, "quick-cart", ctx)
    ).toBe(true);
    expect(
      shouldApplyCartSnapshot({ cart: cart(), source: "checkout" }, "quick-cart", ctx)
    ).toBe(true);
  });

  it("shouldApplyCartSnapshot rejects mismatched pod", () => {
    expect(
      shouldApplyCartSnapshot(
        { cart: cart({ podId: "pod_other" }), source: "quick-cart" },
        "vendor-menu",
        ctx
      )
    ).toBe(false);
  });

  it("shouldQuickCartApplyCartSnapshot accepts same-pod vendor-menu when local cartId is stale", () => {
    const local = cart({ id: "cart_stale", podId: "pod_a" });
    const incoming = cart({ id: "cart_current", podId: "pod_a", items: [{ id: "li_1" } as never] });
    expect(
      shouldQuickCartApplyCartSnapshot(
        { cart: incoming, source: "vendor-menu" },
        local,
        "pod_a"
      )
    ).toBe(true);
  });

  it("shouldQuickCartApplyCartSnapshot accepts Pod B snapshot when local empty Pod A cart and route is Pod B", () => {
    const local = cart({ id: "cart_a", podId: "pod_a", items: [] });
    const incoming = cart({
      id: "cart_b",
      podId: "pod_b",
      items: [{ id: "li_1", quantity: 1 } as never],
    });
    expect(
      shouldQuickCartApplyCartSnapshot(
        { cart: incoming, source: "vendor-menu" },
        local,
        "pod_b"
      )
    ).toBe(true);
  });

  it("shouldQuickCartApplyCartSnapshot rejects Pod B snapshot while route scope is Pod A", () => {
    expect(
      shouldQuickCartApplyCartSnapshot(
        { cart: cart({ podId: "pod_b", id: "cart_b" }), source: "vendor-menu" },
        cart({ podId: "pod_a" }),
        "pod_a"
      )
    ).toBe(false);
  });

  it("shouldQuickCartApplyCartSnapshot rejects cross-pod snapshots", () => {
    expect(
      shouldQuickCartApplyCartSnapshot(
        { cart: cart({ podId: "pod_b" }), source: "vendor-menu" },
        cart(),
        "pod_a"
      )
    ).toBe(false);
  });

  it("shouldQuickCartApplyCartSnapshot ignores quick-cart source", () => {
    expect(
      shouldQuickCartApplyCartSnapshot(
        { cart: cart(), source: "quick-cart" },
        null,
        "pod_a"
      )
    ).toBe(false);
  });

  it("ensureCartSnapshotScalars fills missing podId from fallback", () => {
    const partial = { ...cart(), podId: "" as string };
    const fixed = ensureCartSnapshotScalars(partial, { podId: "pod_a" });
    expect(fixed.podId).toBe("pod_a");
  });

  it("shouldApplyCartFetchResult rejects stale fetch after generation bump", () => {
    expect(
      shouldApplyCartFetchResult({
        generationAtStart: 1,
        currentGeneration: 2,
        podAtStart: "pod_a",
        currentPodId: "pod_a",
      })
    ).toBe(false);
  });

  it("shouldApplyCartFetchResult rejects fetch started for previous pod", () => {
    expect(
      shouldApplyCartFetchResult({
        generationAtStart: 1,
        currentGeneration: 1,
        podAtStart: "pod_a",
        currentPodId: "pod_b",
      })
    ).toBe(false);
  });

  it("shouldApplyCartFetchResult accepts matching generation and pod", () => {
    expect(
      shouldApplyCartFetchResult({
        generationAtStart: 3,
        currentGeneration: 3,
        podAtStart: "pod_b",
        currentPodId: "pod_b",
      })
    ).toBe(true);
  });

  it("shouldApplyCartSnapshot applies cart-page snapshots to other listeners", () => {
    expect(
      shouldApplyCartSnapshot({ cart: cart(), source: "cart-page" }, "quick-cart", ctx)
    ).toBe(true);
    expect(
      shouldApplyCartSnapshot({ cart: cart(), source: "cart-page" }, "vendor-menu", ctx)
    ).toBe(true);
  });

  it("cartClearAppliesToContext matches pod and cartId when present", () => {
    expect(
      cartClearAppliesToContext({ cartId: "cart_1", podId: "pod_a" }, ctx)
    ).toBe(true);
    expect(
      cartClearAppliesToContext({ cartId: "cart_2", podId: "pod_a" }, ctx)
    ).toBe(false);
    expect(
      cartClearAppliesToContext({ cartId: "cart_1", podId: "pod_b" }, ctx)
    ).toBe(false);
    expect(
      cartClearAppliesToContext({ cartId: "cart_1", podId: "pod_a" }, { podId: "pod_a" })
    ).toBe(true);
  });

  it("emptyCartSnapshot zeroes items and subtotal", () => {
    const empty = emptyCartSnapshot({ id: "cart_1", podId: "pod_a", sessionId: "s1" });
    expect(empty.items).toEqual([]);
    expect(empty.groups).toEqual([]);
    expect(empty.subtotalCents).toBe(0);
    expect(empty.sessionId).toBe("s1");
  });

  it("consumePendingClientCartClear only consumes matching orderId", () => {
    sessionStorage.clear();
    markPendingClientCartClear({ cartId: "cart_1", podId: "pod_a", orderId: "ord_1" });
    expect(consumePendingClientCartClear("ord_2")).toBeNull();
    expect(sessionStorage.getItem(PENDING_CART_CLEAR_STORAGE_KEY)).not.toBeNull();
    expect(consumePendingClientCartClear("ord_1")).toEqual({
      cartId: "cart_1",
      podId: "pod_a",
      orderId: "ord_1",
    });
    expect(sessionStorage.getItem(PENDING_CART_CLEAR_STORAGE_KEY)).toBeNull();
  });

  it("readMennyuCheckoutCookie parses checkout marker", () => {
    vi.stubGlobal("document", {
      cookie: `mennyu_checkout=${encodeURIComponent(JSON.stringify({ orderId: "ord_1", cartId: "cart_1" }))}`,
    });
    expect(readMennyuCheckoutCookie()).toEqual({ orderId: "ord_1", cartId: "cart_1" });
  });
});
