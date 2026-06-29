import type { Cart } from "@/domain/types";
import {
  dispatchCartUpdated,
  ensureCartSnapshotScalars,
  type CartUpdateSource,
} from "@/lib/cart-client-sync";
import { normalizeAuthoritativeCartSnapshot } from "@/lib/cart-group-metadata";
import type {
  CartMutationFailureResult,
  CartMutationSuccessResult,
} from "@/lib/cart-mutation-client-result";
import {
  enqueueCartMutation,
  markCartSnapshotCommitted,
} from "@/lib/cart-mutation-queue";

export type CartMutationResult = CartMutationSuccessResult | CartMutationFailureResult;

const DEFAULT_MUTATION_ERROR = "We couldn't update your cart. Please try again.";

export function normalizeOptimisticCartSnapshot(
  cart: Cart,
  fallback: Cart,
  source: CartUpdateSource
): Cart {
  return normalizeAuthoritativeCartSnapshot(
    ensureCartSnapshotScalars(cart, {
      id: fallback.id,
      podId: fallback.podId,
      sessionId: fallback.sessionId,
    }),
    source
  );
}

/** Broadcast optimistic/canonical cart to Quick Cart, vendor menu, cart page, and badge listeners. */
export function publishOptimisticCartSnapshot(cart: Cart, source: CartUpdateSource): void {
  dispatchCartUpdated({ cart, source });
}

export function applyOptimisticCartSnapshot(
  cart: Cart,
  source: CartUpdateSource,
  applyLocal?: (cart: Cart) => void
): Cart {
  publishOptimisticCartSnapshot(cart, source);
  applyLocal?.(cart);
  return cart;
}

export function reconcileCartMutationResult(params: {
  cartId: string;
  source: CartUpdateSource;
  snapshotBefore: Cart;
  result: CartMutationResult;
  applyLocal?: (cart: Cart) => void;
  setError?: (message: string | null) => void;
  fallbackError?: string;
}): boolean {
  const {
    cartId,
    source,
    snapshotBefore,
    result,
    applyLocal,
    setError,
    fallbackError = DEFAULT_MUTATION_ERROR,
  } = params;

  if (result.success) {
    markCartSnapshotCommitted(cartId);
    applyOptimisticCartSnapshot(
      normalizeOptimisticCartSnapshot(result.cart, snapshotBefore, source),
      source,
      applyLocal
    );
    setError?.(null);
    return true;
  }

  markCartSnapshotCommitted(cartId);
  if (result.cart) {
    applyOptimisticCartSnapshot(
      normalizeOptimisticCartSnapshot(result.cart, snapshotBefore, source),
      source,
      applyLocal
    );
  } else {
    applyOptimisticCartSnapshot(snapshotBefore, source, applyLocal);
  }
  setError?.(result.error || fallbackError);
  return false;
}

/**
 * Apply an optimistic cart change immediately, run the server mutation, then reconcile or roll back.
 * Mutations are serialized per cartId; each job reads the latest cart via getCurrentCart().
 */
export async function runOptimisticCartMutation(params: {
  cartId: string;
  source: CartUpdateSource;
  getCurrentCart: () => Cart;
  applyOptimistic: (cart: Cart) => Cart | null;
  runServer: () => Promise<CartMutationResult>;
  applyLocal?: (cart: Cart) => void;
  setError?: (message: string | null) => void;
  fallbackError?: string;
}): Promise<CartMutationResult> {
  const {
    cartId,
    source,
    getCurrentCart,
    applyOptimistic,
    runServer,
    applyLocal,
    setError,
    fallbackError,
  } = params;

  return enqueueCartMutation(cartId, async () => {
    const snapshotBefore = getCurrentCart();
    const optimisticRaw = applyOptimistic(snapshotBefore);
    if (optimisticRaw) {
      applyOptimisticCartSnapshot(
        normalizeOptimisticCartSnapshot(optimisticRaw, snapshotBefore, source),
        source,
        applyLocal
      );
    }

    try {
      const result = await runServer();
      reconcileCartMutationResult({
        cartId,
        source,
        snapshotBefore,
        result,
        applyLocal,
        setError,
        fallbackError,
      });
      return result;
    } catch (error) {
      applyOptimisticCartSnapshot(snapshotBefore, source, applyLocal);
      const message =
        error instanceof Error ? error.message : fallbackError ?? DEFAULT_MUTATION_ERROR;
      setError?.(message);
      return { success: false, error: message };
    }
  });
}
