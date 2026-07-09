import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "@/domain/types";
import {
  CART_SYNC_DEBOUNCE_MS,
  flushCartSyncScheduler,
  getPendingCartSyncOperationCount,
  hasPendingCartSync,
  resetCartSyncSchedulerForTests,
  scheduleOptimisticCartSync,
} from "@/lib/cart-sync-scheduler";
import {
  optimisticIncrementCartItem,
  optimisticSimpleAdd,
  optimisticUpdateCartItemQuantity,
} from "@/lib/cart-optimistic";
import { resetCartMutationQueuesForTests } from "@/lib/cart-mutation-queue";
import { resetCartSnapshotFreshnessForTests } from "@/lib/cart-snapshot-freshness";

const baseCart: Cart = {
  id: "cart_1",
  podId: "pod_1",
  sessionId: "sess_1",
  subtotalCents: 500,
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

describe("cart-sync-scheduler", () => {
  beforeEach(() => {
    resetCartSyncSchedulerForTests();
    resetCartMutationQueuesForTests();
    resetCartSnapshotFreshnessForTests();
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCartSyncSchedulerForTests();
  });

  it("applies five rapid increments immediately and syncs once with final quantity", async () => {
    let current = baseCart;
    const flushCalls: Array<{ quantity: number }> = [];

    for (let i = 0; i < 5; i++) {
      scheduleOptimisticCartSync({
        cartId: current.id,
        podId: current.podId,
        source: "quick-cart",
        getCurrentCart: () => current,
        applyLocal: (cart) => {
          current = cart;
        },
        applyOptimistic: (cart) => optimisticIncrementCartItem(cart, "line_1"),
        buildOperation: ({ operationId, clientVersion }) => {
          const line = current.items.find((item) => item.id === "line_1");
          return {
            operationId,
            type: "setQuantity",
            cartItemId: "line_1",
            quantity: line?.quantity ?? 0,
            clientVersion,
          };
        },
        flush: async ({ operations }) => {
          const qtyOp = operations.find((op) => op.type === "setQuantity");
          expect(operations).toHaveLength(1);
          expect(qtyOp?.type).toBe("setQuantity");
          if (qtyOp?.type === "setQuantity") {
            flushCalls.push({ quantity: qtyOp.quantity });
            current = optimisticUpdateCartItemQuantity(current, "line_1", qtyOp.quantity)!;
          }
          return {
            success: true,
            cart: current,
            appliedOperations: operations.map((op) => ({
              operationId: op.operationId,
              status: "applied" as const,
            })),
            rejectedOperations: [],
          };
        },
      });
    }

    expect(current.items[0]?.quantity).toBe(6);
    expect(getPendingCartSyncOperationCount("cart_1")).toBe(1);
    expect(hasPendingCartSync("cart_1")).toBe(true);

    await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS + 10);
    await flushCartSyncScheduler("cart_1");

    expect(flushCalls).toEqual([{ quantity: 6 }]);
    expect(hasPendingCartSync("cart_1")).toBe(false);
  });

  it("adds different items immediately without waiting for prior sync", async () => {
    let current: Cart = { ...baseCart, items: [], groups: [], subtotalCents: 0 };
    const flushBatches: number[] = [];

    const add = (menuItemId: string, name: string) =>
      scheduleOptimisticCartSync({
        cartId: current.id,
        podId: current.podId,
        source: "vendor-menu",
        getCurrentCart: () => current,
        applyLocal: (cart) => {
          current = cart;
        },
        applyOptimistic: (cart) =>
          optimisticSimpleAdd(cart, {
            menuItemId,
            vendorId: "v_1",
            vendorName: "Cafe",
            menuItemName: name,
            unitPriceCents: 300,
          }),
        buildOperation: ({ operationId, clientVersion }) => ({
          operationId,
          type: "addItem",
          menuItemId,
          quantity: 1,
          clientVersion,
        }),
        flush: async ({ operations }) => {
          flushBatches.push(operations.length);
          return {
            success: true,
            cart: current,
            appliedOperations: operations.map((op) => ({
              operationId: op.operationId,
              status: "applied" as const,
            })),
            rejectedOperations: [],
          };
        },
      });

    add("mi_a", "A");
    add("mi_b", "B");
    add("mi_c", "C");

    expect(current.items).toHaveLength(3);
    expect(current.subtotalCents).toBe(900);

    await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS + 10);
    await flushCartSyncScheduler("cart_1");

    expect(flushBatches[0]).toBe(3);
  });

  it("does not let a stale batch overwrite newer optimistic quantity", async () => {
    let current = baseCart;
    let resolveSlow!: (value: {
      success: true;
      cart: Cart;
      appliedOperations: Array<{ operationId: string; status: "applied" }>;
      rejectedOperations: [];
    }) => void;
    const slowFlush = new Promise<Parameters<typeof resolveSlow>[0]>((resolve) => {
      resolveSlow = resolve;
    });
    let flushCount = 0;

    scheduleOptimisticCartSync({
      cartId: current.id,
      podId: current.podId,
      source: "quick-cart",
      getCurrentCart: () => current,
      applyLocal: (cart) => {
        current = cart;
      },
      applyOptimistic: (cart) => optimisticUpdateCartItemQuantity(cart, "line_1", 3),
      buildOperation: ({ operationId, clientVersion }) => ({
        operationId,
        type: "setQuantity",
        cartItemId: "line_1",
        quantity: 3,
        clientVersion,
      }),
      flush: async () => {
        flushCount += 1;
        if (flushCount === 1) {
          return slowFlush;
        }
        return {
          success: true,
          cart: current,
          appliedOperations: [],
          rejectedOperations: [],
        };
      },
      debounceMs: 10,
    });

    await vi.advanceTimersByTimeAsync(20);

    // Newer intent while first batch is in flight.
    scheduleOptimisticCartSync({
      cartId: current.id,
      podId: current.podId,
      source: "quick-cart",
      getCurrentCart: () => current,
      applyLocal: (cart) => {
        current = cart;
      },
      applyOptimistic: (cart) => optimisticUpdateCartItemQuantity(cart, "line_1", 5),
      buildOperation: ({ operationId, clientVersion }) => ({
        operationId,
        type: "setQuantity",
        cartItemId: "line_1",
        quantity: 5,
        clientVersion,
      }),
      flush: async () => ({
        success: true,
        cart: current,
        appliedOperations: [],
        rejectedOperations: [],
      }),
      debounceMs: 10,
    });

    expect(current.items[0]?.quantity).toBe(5);

    // Stale server says qty 3 — must not win over local 5 while newer pending exists.
    resolveSlow({
      success: true,
      cart: optimisticUpdateCartItemQuantity(baseCart, "line_1", 3)!,
      appliedOperations: [{ operationId: "old", status: "applied" }],
      rejectedOperations: [],
    });

    await vi.advanceTimersByTimeAsync(50);
    await flushCartSyncScheduler("cart_1");

    expect(current.items[0]?.quantity).toBe(5);
  });

  it("surfaces partial failure without discarding successful optimistic items when cart returned", async () => {
    let current: Cart = { ...baseCart, items: [], groups: [], subtotalCents: 0 };
    const errors: Array<string | null> = [];

    scheduleOptimisticCartSync({
      cartId: current.id,
      podId: current.podId,
      source: "vendor-menu",
      getCurrentCart: () => current,
      applyLocal: (cart) => {
        current = cart;
      },
      setError: (message) => errors.push(message),
      applyOptimistic: (cart) =>
        optimisticSimpleAdd(cart, {
          menuItemId: "mi_ok",
          vendorId: "v_1",
          vendorName: "Cafe",
          menuItemName: "Ok",
          unitPriceCents: 200,
        }),
      buildOperation: ({ operationId, clientVersion }) => ({
        operationId,
        type: "addItem",
        menuItemId: "mi_ok",
        quantity: 1,
        clientVersion,
      }),
      flush: async ({ operations }) => {
        const serverCart = optimisticSimpleAdd(baseCart, {
          menuItemId: "mi_ok",
          vendorId: "v_1",
          vendorName: "Cafe",
          menuItemName: "Ok",
          unitPriceCents: 200,
        })!;
        return {
          success: false,
          error: "Item is no longer available.",
          cart: serverCart,
          appliedOperations: [{ operationId: operations[0]!.operationId, status: "applied" }],
          rejectedOperations: [
            {
              operationId: "failed_op",
              status: "rejected",
              reason: "Item is no longer available.",
            },
          ],
        };
      },
      debounceMs: 10,
    });

    await vi.advanceTimersByTimeAsync(20);
    await flushCartSyncScheduler("cart_1");

    expect(current.items.some((i) => i.menuItemId === "mi_ok")).toBe(true);
    expect(errors.some((e) => e?.includes("no longer available"))).toBe(true);
  });

  it("removes line visually at quantity zero", () => {
    let current = baseCart;
    scheduleOptimisticCartSync({
      cartId: current.id,
      podId: current.podId,
      source: "quick-cart",
      getCurrentCart: () => current,
      applyLocal: (cart) => {
        current = cart;
      },
      applyOptimistic: (cart) => optimisticUpdateCartItemQuantity(cart, "line_1", 0),
      buildOperation: ({ operationId, clientVersion }) => ({
        operationId,
        type: "removeLine",
        cartItemId: "line_1",
        clientVersion,
      }),
      flush: async () => ({
        success: true,
        cart: current,
        appliedOperations: [],
        rejectedOperations: [],
      }),
      debounceMs: 50,
    });

    expect(current.items).toHaveLength(0);
    expect(current.subtotalCents).toBe(0);
  });
});
