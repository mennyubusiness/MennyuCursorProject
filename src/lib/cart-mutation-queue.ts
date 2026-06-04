import type { Cart } from "@/domain/types";

type CartQueueState = {
  chain: Promise<unknown>;
  pendingCount: number;
  lastCommittedSeq: number;
};

const queues = new Map<string, CartQueueState>();
const pendingListeners = new Set<() => void>();

function getQueue(cartId: string): CartQueueState {
  const id = cartId.trim();
  let state = queues.get(id);
  if (!state) {
    state = {
      chain: Promise.resolve(),
      pendingCount: 0,
      lastCommittedSeq: 0,
    };
    queues.set(id, state);
  }
  return state;
}

function notifyPendingListeners(): void {
  for (const listener of pendingListeners) {
    listener();
  }
}

export function subscribeCartMutationPending(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

export function getPendingCartMutationCount(cartId?: string | null): number {
  if (cartId?.trim()) {
    return queues.get(cartId.trim())?.pendingCount ?? 0;
  }
  let total = 0;
  for (const state of queues.values()) {
    total += state.pendingCount;
  }
  return total;
}

export function hasPendingCartMutations(cartId?: string | null): boolean {
  return getPendingCartMutationCount(cartId) > 0;
}

/**
 * Serialize cart mutations per cartId so concurrent adds cannot race on the server or client.
 */
export function enqueueCartMutation<T>(cartId: string, run: () => Promise<T>): Promise<T> {
  const state = getQueue(cartId);
  state.pendingCount += 1;
  notifyPendingListeners();

  const runPromise = state.chain.then(() => run());
  state.chain = runPromise.then(
    () => undefined,
    () => undefined
  );

  return runPromise.finally(() => {
    state.pendingCount = Math.max(0, state.pendingCount - 1);
    notifyPendingListeners();
  });
}

/** Wait until all in-flight mutations for this cart (or all carts) finish. */
export async function flushCartMutations(cartId?: string | null): Promise<void> {
  if (cartId?.trim()) {
    await getQueue(cartId).chain;
    return;
  }
  await Promise.all([...queues.values()].map((s) => s.chain));
}

/** Bump per-cart commit sequence after a successful server mutation. */
export function markCartSnapshotCommitted(cartId: string): number {
  const state = getQueue(cartId);
  state.lastCommittedSeq += 1;
  return state.lastCommittedSeq;
}

/** True when an incoming snapshot commit seq is older than the latest applied commit. */
export function isStaleCartSnapshotCommit(cartId: string, commitSeq: number): boolean {
  return commitSeq < getQueue(cartId).lastCommittedSeq;
}

/** Apply server cart only when commit seq is current; logs stale drops in development. */
export function applyCartSnapshotIfCurrent(
  cartId: string,
  commitSeq: number,
  apply: (cart: Cart) => void,
  cart: Cart
): boolean {
  if (isStaleCartSnapshotCommit(cartId, commitSeq)) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[cart-mutation-queue] Dropped stale cart response", {
        cartId,
        commitSeq,
        lastCommittedSeq: getQueue(cartId).lastCommittedSeq,
      });
    }
    return false;
  }
  apply(cart);
  return true;
}

/** @internal Reset queue state for tests. */
export function resetCartMutationQueuesForTests(): void {
  queues.clear();
}
