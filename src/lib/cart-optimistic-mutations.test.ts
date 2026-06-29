import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "@/domain/types";
import {
  optimisticDecrementCartItem,
  optimisticIncrementCartItem,
  optimisticRemoveCartItem,
  optimisticSimpleAdd,
  optimisticUpdateCartItemQuantity,
} from "@/lib/cart-optimistic";
import {
  applyOptimisticCartSnapshot,
  normalizeOptimisticCartSnapshot,
  reconcileCartMutationResult,
  runOptimisticCartMutation,
} from "@/lib/cart-optimistic-mutations";
import { resetCartMutationQueuesForTests } from "@/lib/cart-mutation-queue";
import { resetCartSnapshotFreshnessForTests } from "@/lib/cart-snapshot-freshness";

const baseCart: Cart = {
  id: "cart_1",
  podId: "pod_1",
  sessionId: "sess_1",
  subtotalCents: 1000,
  items: [
    {
      id: "line_1",
      menuItemId: "mi_1",
      vendorId: "v_1",
      quantity: 2,
      priceCents: 500,
      specialInstructions: null,
      menuItem: { name: "Latte" },
    },
  ],
  groups: [
    {
      vendorId: "v_1",
      vendorName: "Cafe",
      subtotalCents: 1000,
      items: [
        {
          id: "line_1",
          menuItemId: "mi_1",
          vendorId: "v_1",
          quantity: 2,
          priceCents: 500,
          specialInstructions: null,
          menuItem: { name: "Latte" },
        },
      ],
    },
  ],
};

describe("cart optimistic line mutations", () => {
  it("increments quantity and subtotal immediately", () => {
    const next = optimisticIncrementCartItem(baseCart, "line_1");
    expect(next?.items[0]?.quantity).toBe(3);
    expect(next?.subtotalCents).toBe(1500);
  });

  it("decrements quantity immediately", () => {
    const next = optimisticDecrementCartItem(baseCart, "line_1");
    expect(next?.items[0]?.quantity).toBe(1);
    expect(next?.subtotalCents).toBe(500);
  });

  it("removes the row when decrement reaches zero", () => {
    const single = optimisticUpdateCartItemQuantity(baseCart, "line_1", 1);
    const removed = optimisticDecrementCartItem(single!, "line_1");
    expect(removed?.items).toHaveLength(0);
    expect(removed?.subtotalCents).toBe(0);
  });

  it("removes a line optimistically", () => {
    const next = optimisticRemoveCartItem(baseCart, "line_1");
    expect(next?.items).toHaveLength(0);
  });
});

describe("runOptimisticCartMutation", () => {
  beforeEach(() => {
    resetCartMutationQueuesForTests();
    resetCartSnapshotFreshnessForTests();
    vi.restoreAllMocks();
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
    });
  });

  it("applies optimistic cart before server resolves", async () => {
    const applied: Cart[] = [];
    let resolveServer!: (value: { success: true; cart: Cart }) => void;
    const server = new Promise<{ success: true; cart: Cart }>((resolve) => {
      resolveServer = resolve;
    });

    const pending = runOptimisticCartMutation({
      cartId: baseCart.id,
      source: "quick-cart",
      getCurrentCart: () => baseCart,
      applyOptimistic: (cart) => optimisticIncrementCartItem(cart, "line_1"),
      runServer: () => server,
      applyLocal: (cart) => {
        applied.push(cart);
      },
    });

    await Promise.resolve();
    expect(applied[0]?.items[0]?.quantity).toBe(3);

    resolveServer({
      success: true,
      cart: optimisticIncrementCartItem(baseCart, "line_1")!,
    });
    await pending;
    expect(applied.at(-1)?.items[0]?.quantity).toBe(3);
  });

  it("rolls back failed mutations to the pre-mutation snapshot", async () => {
    const applied: Cart[] = [];

    await runOptimisticCartMutation({
      cartId: baseCart.id,
      source: "quick-cart",
      getCurrentCart: () => baseCart,
      applyOptimistic: (cart) => optimisticIncrementCartItem(cart, "line_1"),
      runServer: async () => ({ success: false, error: "nope" }),
      applyLocal: (cart) => {
        applied.push(cart);
      },
      setError: () => {},
    });

    expect(applied[0]?.items[0]?.quantity).toBe(3);
    expect(applied.at(-1)?.items[0]?.quantity).toBe(2);
  });

  it("accumulates rapid increments without regressing to stale qty", async () => {
    let current = baseCart;
    const applied: number[] = [];

    const run = () =>
      runOptimisticCartMutation({
        cartId: baseCart.id,
        source: "quick-cart",
        getCurrentCart: () => current,
        applyOptimistic: (cart) => {
          const next = optimisticIncrementCartItem(cart, "line_1");
          if (next) current = next;
          return next;
        },
        runServer: async () => {
          await new Promise((r) => setTimeout(r, 5));
          return {
            success: true,
            cart: current,
          };
        },
        applyLocal: (cart) => {
          current = cart;
          applied.push(cart.items[0]?.quantity ?? 0);
        },
      });

    await Promise.all([run(), run(), run()]);
    expect(applied[0]).toBe(3);
    expect(applied.at(-1)).toBe(5);
  });

  it("broadcasts optimistic snapshots for badge listeners", () => {
    const dispatched: unknown[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (event: Event) => {
        dispatched.push((event as CustomEvent).detail);
      },
    });

    applyOptimisticCartSnapshot(
      normalizeOptimisticCartSnapshot(
        optimisticSimpleAdd(baseCart, {
          menuItemId: "mi_2",
          vendorId: "v_1",
          vendorName: "Cafe",
          menuItemName: "Muffin",
          unitPriceCents: 300,
        })!,
        baseCart,
        "vendor-menu"
      ),
      "vendor-menu"
    );

    expect((dispatched[0] as { cart?: Cart }).cart?.items).toHaveLength(2);
  });

  it("reconcileCartMutationResult clears errors on success", () => {
    const errors: Array<string | null> = [];
    const ok = reconcileCartMutationResult({
      cartId: baseCart.id,
      source: "cart-page",
      snapshotBefore: baseCart,
      result: {
        success: true,
        cart: optimisticIncrementCartItem(baseCart, "line_1")!,
      },
      setError: (message) => {
        errors.push(message);
      },
    });
    expect(ok).toBe(true);
    expect(errors).toEqual([null]);
  });
});
