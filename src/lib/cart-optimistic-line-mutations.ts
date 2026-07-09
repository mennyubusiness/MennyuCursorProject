"use client";

import { syncCartBatchAction } from "@/actions/cart.actions";
import type { CartUpdateSource } from "@/lib/cart-client-sync";
import type { Cart } from "@/domain/types";
import {
  optimisticDecrementCartItem,
  optimisticIncrementCartItem,
  optimisticRemoveCartItem,
  optimisticSimpleAdd,
  optimisticUpdateCartItemQuantity,
  type OptimisticSimpleAddParams,
} from "@/lib/cart-optimistic";
import type { CartMutationResult } from "@/lib/cart-optimistic-mutations";
import {
  scheduleOptimisticCartSync,
  type CartSyncBatchResult,
  type CartSyncOperation,
} from "@/lib/cart-sync-scheduler";

export type CartLineMutationBase = {
  cartId: string;
  podId: string;
  cartItemId: string;
  source: CartUpdateSource;
  getCurrentCart: () => Cart;
  applyLocal?: (cart: Cart) => void;
  setError?: (message: string | null) => void;
  specialInstructions?: string | null;
};

function isOptimisticLineId(cartItemId: string): boolean {
  return cartItemId.startsWith("optimistic:");
}

async function defaultBatchFlush(input: {
  cartId: string;
  podId: string | null;
  operations: CartSyncOperation[];
}): Promise<CartSyncBatchResult> {
  const result = await syncCartBatchAction(
    input.cartId,
    input.operations.map((op) => {
      if (op.type === "setQuantity") {
        return {
          operationId: op.operationId,
          type: "setQuantity" as const,
          cartItemId: op.cartItemId,
          quantity: op.quantity,
          specialInstructions: op.specialInstructions,
        };
      }
      if (op.type === "removeLine") {
        return {
          operationId: op.operationId,
          type: "removeLine" as const,
          cartItemId: op.cartItemId,
        };
      }
      return {
        operationId: op.operationId,
        type: "addItem" as const,
        menuItemId: op.menuItemId,
        quantity: op.quantity,
        specialInstructions: op.specialInstructions,
        selections: op.selections,
      };
    }),
    input.podId
  );

  return {
    success: result.success,
    cart: result.cart,
    error: result.success ? undefined : result.error,
    code: result.success ? undefined : result.code,
    appliedOperations: result.appliedOperations,
    rejectedOperations: result.rejectedOperations,
  };
}

function scheduleLineQuantitySync(
  params: CartLineMutationBase,
  applyOptimistic: (cart: Cart) => Cart | null
): Promise<CartMutationResult> {
  const { flushPromise } = scheduleOptimisticCartSync({
    cartId: params.cartId,
    podId: params.podId,
    source: params.source,
    getCurrentCart: params.getCurrentCart,
    applyLocal: params.applyLocal,
    setError: params.setError,
    applyOptimistic,
    flush: defaultBatchFlush,
    buildOperation: ({ operationId, clientVersion }) => {
      const cart = params.getCurrentCart();
      const line = cart.items.find((item) => item.id === params.cartItemId);

      // Line gone after optimistic decrement/remove.
      if (!line) {
        if (isOptimisticLineId(params.cartItemId)) {
          // Cancel pending optimistic add by syncing remove against the temp id as a no-op add qty 0
          // — server never saw this line; send removeLine which will be rejected as item_gone (ok).
          return {
            operationId,
            type: "removeLine",
            cartItemId: params.cartItemId,
            clientVersion,
          };
        }
        return {
          operationId,
          type: "removeLine",
          cartItemId: params.cartItemId,
          clientVersion,
        };
      }

      // Quantity changes on an unsynced optimistic line become an addItem with final qty.
      if (isOptimisticLineId(params.cartItemId)) {
        return {
          operationId,
          type: "addItem",
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          specialInstructions: params.specialInstructions ?? line.specialInstructions ?? null,
          selections:
            line.selections?.map((s) => ({
              modifierOptionId: s.modifierOptionId,
              quantity: s.quantity,
            })) ?? null,
          optimisticLineId: params.cartItemId,
          clientVersion,
        };
      }

      return {
        operationId,
        type: "setQuantity",
        cartItemId: params.cartItemId,
        quantity: line.quantity,
        specialInstructions: params.specialInstructions ?? null,
        clientVersion,
      };
    },
  });

  return flushPromise;
}

export function optimisticIncrementCartItemMutation(
  params: CartLineMutationBase
): Promise<CartMutationResult> {
  return scheduleLineQuantitySync(params, (cart) =>
    optimisticIncrementCartItem(cart, params.cartItemId)
  );
}

export function optimisticDecrementCartItemMutation(
  params: CartLineMutationBase
): Promise<CartMutationResult> {
  return scheduleLineQuantitySync(params, (cart) =>
    optimisticDecrementCartItem(cart, params.cartItemId)
  );
}

export function optimisticRemoveCartItemMutation(
  params: Omit<CartLineMutationBase, "specialInstructions">
): Promise<CartMutationResult> {
  const { flushPromise } = scheduleOptimisticCartSync({
    cartId: params.cartId,
    podId: params.podId,
    source: params.source,
    getCurrentCart: params.getCurrentCart,
    applyLocal: params.applyLocal,
    setError: params.setError,
    applyOptimistic: (cart) => optimisticRemoveCartItem(cart, params.cartItemId),
    flush: defaultBatchFlush,
    buildOperation: ({ operationId, clientVersion }) => ({
      operationId,
      type: "removeLine",
      cartItemId: params.cartItemId,
      clientVersion,
    }),
  });

  return flushPromise;
}

export function optimisticSetCartItemQuantityMutation(
  params: CartLineMutationBase & { quantity: number }
): Promise<CartMutationResult> {
  const { quantity, ...base } = params;
  return scheduleLineQuantitySync(base, (cart) =>
    optimisticUpdateCartItemQuantity(cart, base.cartItemId, quantity)
  );
}

/** Immediate optimistic simple add + debounced/batched server sync. */
export function scheduleOptimisticSimpleAdd(params: {
  cartId: string;
  podId: string;
  source: CartUpdateSource;
  getCurrentCart: () => Cart;
  applyLocal?: (cart: Cart) => void;
  setError?: (message: string | null) => void;
  optimistic: OptimisticSimpleAddParams;
}): Promise<CartMutationResult> {
  let createdOptimisticLineId: string | null = null;

  const { flushPromise } = scheduleOptimisticCartSync({
    cartId: params.cartId,
    podId: params.podId,
    source: params.source,
    getCurrentCart: params.getCurrentCart,
    applyLocal: params.applyLocal,
    setError: params.setError,
    applyOptimistic: (cart) => {
      const beforeIds = new Set(cart.items.map((i) => i.id));
      const next = optimisticSimpleAdd(cart, params.optimistic);
      if (next) {
        const created = next.items.find((i) => !beforeIds.has(i.id));
        createdOptimisticLineId = created?.id ?? null;
        // If we bumped an existing line, track that line for coalescing qty into add.
        if (!createdOptimisticLineId) {
          const bumped = next.items.find((i) => {
            const prev = cart.items.find((p) => p.id === i.id);
            return prev && prev.quantity !== i.quantity && i.menuItemId === params.optimistic.menuItemId;
          });
          createdOptimisticLineId = bumped?.id ?? null;
        }
      }
      return next;
    },
    flush: defaultBatchFlush,
    buildOperation: ({ operationId, clientVersion }) => {
      const cart = params.getCurrentCart();
      const line =
        (createdOptimisticLineId
          ? cart.items.find((i) => i.id === createdOptimisticLineId)
          : null) ??
        cart.items.find((i) => i.menuItemId === params.optimistic.menuItemId && !(i.selections?.length));

      const quantity = line?.quantity ?? params.optimistic.quantity ?? 1;
      const optimisticLineId =
        createdOptimisticLineId && isOptimisticLineId(createdOptimisticLineId)
          ? createdOptimisticLineId
          : createdOptimisticLineId;

      // If we only bumped a real server line, sync as setQuantity.
      if (line && !isOptimisticLineId(line.id)) {
        return {
          operationId,
          type: "setQuantity",
          cartItemId: line.id,
          quantity,
          specialInstructions: null,
          clientVersion,
        };
      }

      return {
        operationId,
        type: "addItem",
        menuItemId: params.optimistic.menuItemId,
        quantity,
        specialInstructions: null,
        selections: null,
        optimisticLineId: optimisticLineId ?? undefined,
        clientVersion,
      };
    },
  });

  return flushPromise;
}
