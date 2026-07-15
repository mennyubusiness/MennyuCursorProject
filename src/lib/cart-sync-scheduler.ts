/**
 * Coalescing cart sync scheduler.
 * Optimistic UI updates apply immediately; server sync is debounced and batched.
 * Same-line quantity taps collapse to a single final setQuantity.
 */
import type { Cart } from "@/domain/types";
import type { CartItemSelectionInput } from "@/actions/cart.actions.types";
import type { CartUpdateSource } from "@/lib/cart-client-sync";
import type { CartMutationResult } from "@/lib/cart-optimistic-mutations";
import {
  enqueueCartMutation,
  flushCartMutations,
  hasPendingCartMutations,
  markCartSnapshotCommitted,
  subscribeCartMutationPending,
} from "@/lib/cart-mutation-queue";
import {
  applyOptimisticCartSnapshot,
  normalizeOptimisticCartSnapshot,
} from "@/lib/cart-optimistic-mutations";
import { mergeServerCartWithLocalPending } from "@/lib/cart-optimistic-merge";

export const CART_SYNC_DEBOUNCE_MS = 400;

const syncPendingListeners = new Set<() => void>();

function notifySyncPendingListeners(): void {
  for (const listener of syncPendingListeners) {
    listener();
  }
}

export function subscribeCartSyncPending(listener: () => void): () => void {
  syncPendingListeners.add(listener);
  return () => syncPendingListeners.delete(listener);
}

/** Subscribe to both serial queue and debounced sync scheduler. */
export function subscribeAnyCartPending(listener: () => void): () => void {
  const unsubQueue = subscribeCartMutationPending(listener);
  const unsubSync = subscribeCartSyncPending(listener);
  return () => {
    unsubQueue();
    unsubSync();
  };
}

export type CartSyncOperation =
  | {
      operationId: string;
      type: "setQuantity";
      cartItemId: string;
      quantity: number;
      specialInstructions?: string | null;
      clientVersion: number;
    }
  | {
      operationId: string;
      type: "removeLine";
      cartItemId: string;
      clientVersion: number;
    }
  | {
      operationId: string;
      type: "addItem";
      menuItemId: string;
      quantity: number;
      specialInstructions?: string | null;
      selections?: CartItemSelectionInput[] | null;
      optimisticLineId?: string | null;
      clientVersion: number;
    };

export type CartSyncBatchResult = {
  success: boolean;
  cart?: Cart;
  error?: string;
  code?: string;
  appliedOperations: Array<{ operationId: string; status: "applied" }>;
  rejectedOperations: Array<{
    operationId: string;
    status: "rejected";
    reason: string;
    code?: string;
  }>;
};

type CartSyncFlushFn = (input: {
  cartId: string;
  podId: string | null;
  operations: CartSyncOperation[];
}) => Promise<CartSyncBatchResult>;

type CartSyncSession = {
  cartId: string;
  podId: string | null;
  source: CartUpdateSource;
  getCurrentCart: () => Cart;
  applyLocal?: (cart: Cart) => void;
  setError?: (message: string | null) => void;
  flush: CartSyncFlushFn;
  /** Pending ops keyed for coalescing. Quantity ops keyed by cartItemId. */
  pendingByKey: Map<string, CartSyncOperation>;
  /** Ordered keys for stable flush order (adds keep insertion order). */
  pendingOrder: string[];
  debounceTimer: ReturnType<typeof setTimeout> | null;
  clientVersion: number;
  /** Snapshot before the first pending op in the current debounce window (for full rollback). */
  snapshotBeforeWindow: Cart | null;
  /** Last cart known confirmed by the server (never includes unresolved local-only lines). */
  confirmedCart: Cart | null;
  flushPromise: Promise<void> | null;
  resolveFlushWaiters: Array<() => void>;
  lastFlushOk: boolean;
  lastFlushError: string | null;
};

function hasUnresolvedLocalWork(session: CartSyncSession, flushVersion: number): boolean {
  return flushVersion < session.clientVersion || session.pendingByKey.size > 0;
}

/**
 * Apply a server cart without letting the UI regress behind newer local intent.
 * When local mutations are still unresolved, layer them on top of the server snapshot.
 */
function applyServerCartPreservingPending(
  session: CartSyncSession,
  serverCart: Cart
): void {
  const local = session.getCurrentCart();
  session.confirmedCart = serverCart;
  const display =
    session.pendingByKey.size > 0
      ? mergeServerCartWithLocalPending(serverCart, local)
      : serverCart;
  applyOptimisticCartSnapshot(
    normalizeOptimisticCartSnapshot(display, local, session.source),
    session.source,
    session.applyLocal
  );
}

const sessions = new Map<string, CartSyncSession>();

function newOperationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function opKey(op: CartSyncOperation): string {
  if (op.type === "addItem" && op.optimisticLineId) {
    // Coalesce quantity bumps / cancel-remove that target the same pending optimistic line.
    return `line:${op.optimisticLineId}`;
  }
  if (op.type === "setQuantity" || op.type === "removeLine") {
    if (op.cartItemId.startsWith("optimistic:")) {
      return `line:${op.cartItemId}`;
    }
    return `qty:${op.cartItemId}`;
  }
  // Distinct add ops stay separate (different items / rapid adds).
  return `add:${op.operationId}`;
}

function getOrCreateSession(params: {
  cartId: string;
  podId: string | null;
  source: CartUpdateSource;
  getCurrentCart: () => Cart;
  applyLocal?: (cart: Cart) => void;
  setError?: (message: string | null) => void;
  flush: CartSyncFlushFn;
}): CartSyncSession {
  const id = params.cartId.trim();
  let session = sessions.get(id);
  if (!session) {
    session = {
      cartId: id,
      podId: params.podId,
      source: params.source,
      getCurrentCart: params.getCurrentCart,
      applyLocal: params.applyLocal,
      setError: params.setError,
      flush: params.flush,
      pendingByKey: new Map(),
      pendingOrder: [],
      debounceTimer: null,
      clientVersion: 0,
      snapshotBeforeWindow: null,
      confirmedCart: null,
      flushPromise: null,
      resolveFlushWaiters: [],
      lastFlushOk: true,
      lastFlushError: null,
    };
    sessions.set(id, session);
  } else {
    session.podId = params.podId;
    session.source = params.source;
    session.getCurrentCart = params.getCurrentCart;
    session.applyLocal = params.applyLocal;
    session.setError = params.setError;
    session.flush = params.flush;
  }
  return session;
}

function scheduleFlush(session: CartSyncSession, debounceMs: number): void {
  if (session.debounceTimer) {
    clearTimeout(session.debounceTimer);
  }
  session.debounceTimer = setTimeout(() => {
    session.debounceTimer = null;
    void flushSession(session);
  }, debounceMs);
}

async function flushSession(session: CartSyncSession): Promise<void> {
  if (session.pendingByKey.size === 0) {
    for (const resolve of session.resolveFlushWaiters.splice(0)) resolve();
    return;
  }

  if (session.flushPromise) {
    await session.flushPromise;
    if (session.pendingByKey.size > 0) {
      return flushSession(session);
    }
    return;
  }

  const operations = session.pendingOrder
    .map((key) => session.pendingByKey.get(key))
    .filter((op): op is CartSyncOperation => Boolean(op))
    // Cancelling an unsynced optimistic line needs no server call.
    .filter(
      (op) =>
        !(
          op.type === "removeLine" &&
          op.cartItemId.startsWith("optimistic:")
        )
    );
  const flushVersion = session.clientVersion;
  const snapshotBefore = session.snapshotBeforeWindow ?? session.getCurrentCart();

  session.pendingByKey.clear();
  session.pendingOrder = [];
  session.snapshotBeforeWindow = null;

  if (operations.length === 0) {
    session.lastFlushOk = true;
    session.lastFlushError = null;
    for (const resolve of session.resolveFlushWaiters.splice(0)) resolve();
    notifySyncPendingListeners();
    return;
  }

  session.flushPromise = enqueueCartMutation(session.cartId, async () => {
    try {
      const result = await session.flush({
        cartId: session.cartId,
        podId: session.podId,
        operations,
      });

      const stale = hasUnresolvedLocalWork(session, flushVersion);

      // Newer local ops landed while this batch was in flight.
      // Still adopt the server baseline when present, but keep pending local lines visible.
      if (stale) {
        if (result.cart) {
          markCartSnapshotCommitted(session.cartId);
          applyServerCartPreservingPending(session, result.cart);
        }
        if (result.rejectedOperations.length > 0) {
          const reasons = result.rejectedOperations.map((r) => r.reason).filter(Boolean);
          const unique = [...new Set(reasons)];
          const message =
            unique.length === 1
              ? unique[0]!
              : "Some items could not be updated. Please try again.";
          session.lastFlushOk = false;
          session.lastFlushError = message;
          session.setError?.(message);
        } else {
          session.lastFlushOk = true;
          session.lastFlushError = null;
        }
        return;
      }

      if (result.cart) {
        // Prefer merge-aware apply so a partial server cart cannot drop still-visible items.
        if (result.success && result.rejectedOperations.length === 0) {
          markCartSnapshotCommitted(session.cartId);
          session.confirmedCart = result.cart;
          applyOptimisticCartSnapshot(
            normalizeOptimisticCartSnapshot(result.cart, snapshotBefore, session.source),
            session.source,
            session.applyLocal
          );
          session.setError?.(null);
          session.lastFlushOk = true;
          session.lastFlushError = null;
          return;
        }

        // Partial failure: adopt server cart for applied ops, keep unrelated local lines.
        markCartSnapshotCommitted(session.cartId);
        applyServerCartPreservingPending(session, result.cart);
        const reasons = result.rejectedOperations.map((r) => r.reason).filter(Boolean);
        const unique = [...new Set(reasons)];
        const message =
          unique.length === 1
            ? unique[0]!
            : result.error ?? "Some items could not be updated. Please try again.";
        session.lastFlushOk = false;
        session.lastFlushError = message;
        session.setError?.(message);
        return;
      }

      if (!result.success) {
        // Never wipe newer local intent — only roll back when this batch is still current.
        if (!hasUnresolvedLocalWork(session, flushVersion)) {
          const rollback = session.confirmedCart ?? snapshotBefore;
          applyOptimisticCartSnapshot(rollback, session.source, session.applyLocal);
        }
        session.lastFlushOk = false;
        session.lastFlushError = result.error ?? "We couldn't update your cart. Please try again.";
        session.setError?.(session.lastFlushError);
      } else {
        markCartSnapshotCommitted(session.cartId);
        session.lastFlushOk = true;
        session.lastFlushError = null;
      }
    } catch (error) {
      // Do not roll back the whole cart when newer local mutations exist.
      if (!hasUnresolvedLocalWork(session, flushVersion)) {
        const rollback = session.confirmedCart ?? snapshotBefore;
        applyOptimisticCartSnapshot(rollback, session.source, session.applyLocal);
      }
      session.lastFlushOk = false;
      session.lastFlushError =
        error instanceof Error ? error.message : "We couldn't update your cart. Please try again.";
      session.setError?.(session.lastFlushError);
    }
  }).finally(() => {
    session.flushPromise = null;
    notifySyncPendingListeners();
    for (const resolve of session.resolveFlushWaiters.splice(0)) resolve();
    // If more ops arrived during flush, schedule another pass.
    if (session.pendingByKey.size > 0) {
      scheduleFlush(session, 0);
    }
  });

  notifySyncPendingListeners();
  await session.flushPromise;
}

/**
 * Apply optimistic cart immediately, then schedule a coalesced server sync.
 */
export function scheduleOptimisticCartSync(params: {
  cartId: string;
  podId?: string | null;
  source: CartUpdateSource;
  getCurrentCart: () => Cart;
  applyOptimistic: (cart: Cart) => Cart | null;
  buildOperation: (ctx: { operationId: string; clientVersion: number }) => CartSyncOperation;
  applyLocal?: (cart: Cart) => void;
  setError?: (message: string | null) => void;
  flush: CartSyncFlushFn;
  debounceMs?: number;
}): { operationId: string; clientVersion: number; flushPromise: Promise<CartMutationResult> } {
  const session = getOrCreateSession({
    cartId: params.cartId,
    podId: params.podId ?? null,
    source: params.source,
    getCurrentCart: params.getCurrentCart,
    applyLocal: params.applyLocal,
    setError: params.setError,
    flush: params.flush,
  });

  const snapshotBefore = params.getCurrentCart();
  if (!session.snapshotBeforeWindow) {
    session.snapshotBeforeWindow = snapshotBefore;
  }
  if (!session.confirmedCart) {
    session.confirmedCart = snapshotBefore;
  }

  session.clientVersion += 1;
  const clientVersion = session.clientVersion;
  const operationId = newOperationId();

  const optimisticRaw = params.applyOptimistic(snapshotBefore);
  if (optimisticRaw) {
    applyOptimisticCartSnapshot(
      normalizeOptimisticCartSnapshot(optimisticRaw, snapshotBefore, params.source),
      params.source,
      params.applyLocal
    );
  }

  const op = params.buildOperation({ operationId, clientVersion });
  const key = opKey(op);
  if (!session.pendingByKey.has(key)) {
    session.pendingOrder.push(key);
  }
  session.pendingByKey.set(key, op);
  notifySyncPendingListeners();

  scheduleFlush(session, params.debounceMs ?? CART_SYNC_DEBOUNCE_MS);

  const flushPromise = new Promise<CartMutationResult>((resolve) => {
    session.resolveFlushWaiters.push(() => {
      const cart = params.getCurrentCart();
      if (session.lastFlushOk) {
        resolve({ success: true, cart });
      } else {
        resolve({
          success: false,
          error: session.lastFlushError ?? "We couldn't update your cart. Please try again.",
          cart,
        });
      }
    });
  });

  return { operationId, clientVersion, flushPromise };
}

/** Wait for pending debounced syncs for a cart (or all). Used by navigation flush. */
export async function flushCartSyncScheduler(cartId?: string | null): Promise<void> {
  if (cartId?.trim()) {
    const session = sessions.get(cartId.trim());
    if (!session) return;
    if (session.debounceTimer) {
      clearTimeout(session.debounceTimer);
      session.debounceTimer = null;
    }
    await flushSession(session);
    return;
  }
  await Promise.all([...sessions.keys()].map((id) => flushCartSyncScheduler(id)));
}

export function hasPendingCartSync(cartId?: string | null): boolean {
  if (cartId?.trim()) {
    const session = sessions.get(cartId.trim());
    if (!session) return false;
    return (
      session.pendingByKey.size > 0 ||
      session.debounceTimer != null ||
      session.flushPromise != null
    );
  }
  for (const session of sessions.values()) {
    if (
      session.pendingByKey.size > 0 ||
      session.debounceTimer != null ||
      session.flushPromise != null
    ) {
      return true;
    }
  }
  return false;
}

export function getPendingCartSyncOperationCount(cartId?: string | null): number {
  if (cartId?.trim()) {
    return sessions.get(cartId.trim())?.pendingByKey.size ?? 0;
  }
  let total = 0;
  for (const session of sessions.values()) {
    total += session.pendingByKey.size;
  }
  return total;
}

/** Flush debounced sync + in-flight serial mutations before navigation. */
export async function flushAllCartWork(cartId?: string | null): Promise<void> {
  await flushCartSyncScheduler(cartId);
  await flushCartMutations(cartId);
}

export function hasAnyPendingCartWork(cartId?: string | null): boolean {
  return hasPendingCartSync(cartId) || hasPendingCartMutations(cartId);
}

/** @internal */
export function resetCartSyncSchedulerForTests(): void {
  for (const session of sessions.values()) {
    if (session.debounceTimer) clearTimeout(session.debounceTimer);
  }
  sessions.clear();
  notifySyncPendingListeners();
}
