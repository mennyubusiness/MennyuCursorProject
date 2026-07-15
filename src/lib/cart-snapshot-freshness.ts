import type { Cart } from "@/domain/types";
import type { CartUpdateSource, CartUpdatedDetail } from "@/lib/cart-client-sync";

export type CartSnapshotMeta = {
  clientSequence: number;
  lastMutationGeneration: number;
  lastLifecycleGeneration: number;
  cartId: string | null;
  podId: string | null;
  itemCount: number;
  source?: CartUpdateSource;
};

let globalClientSequence = 0;
let mutationGeneration = 0;
let lifecycleGeneration = 0;
const lastKnownCartByPod = new Map<string, Cart>();

const DEBUG_STALE_SNAPSHOT = process.env.NODE_ENV !== "production";

export function resetCartSnapshotFreshnessForTests(): void {
  globalClientSequence = 0;
  mutationGeneration = 0;
  lifecycleGeneration = 0;
  lastKnownCartByPod.clear();
}

export function cartSnapshotItemCount(cart: Cart | null | undefined): number {
  return cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
}

export function isMutationCartSource(source?: CartUpdateSource): boolean {
  return source === "vendor-menu" || source === "quick-cart" || source === "cart-page";
}

export function isExplicitCartClearSource(source?: CartUpdateSource): boolean {
  return source === "checkout" || source === "order-page";
}

export function isLifecycleCartSource(source?: CartUpdateSource): boolean {
  return source === "group-order-start" || source === "group-order-ended";
}

function bumpMutationGeneration(): number {
  mutationGeneration += 1;
  return mutationGeneration;
}

function bumpLifecycleGeneration(): number {
  lifecycleGeneration += 1;
  return lifecycleGeneration;
}

export function enrichCartUpdatedDetail(detail: CartUpdatedDetail): CartUpdatedDetail {
  const clientSequence = ++globalClientSequence;
  const enriched: CartUpdatedDetail = { ...detail, clientSequence };

  if (isMutationCartSource(detail.source)) {
    enriched.mutationGeneration = bumpMutationGeneration();
  }
  if (isLifecycleCartSource(detail.source)) {
    enriched.lifecycleGeneration = bumpLifecycleGeneration();
    if (detail.source === "group-order-ended") {
      enriched.endAtMutationGeneration = mutationGeneration;
    }
  }

  return enriched;
}

export function buildCartSnapshotMeta(detail: CartUpdatedDetail): CartSnapshotMeta {
  const itemCount = cartSnapshotItemCount(detail.cart);
  return {
    clientSequence: detail.clientSequence ?? 0,
    lastMutationGeneration: detail.mutationGeneration ?? 0,
    lastLifecycleGeneration: detail.lifecycleGeneration ?? 0,
    cartId: detail.cart?.id ?? null,
    podId: detail.cart?.podId ?? null,
    itemCount,
    source: detail.source,
  };
}

export function mergeAcceptedCartSnapshotMeta(
  prev: CartSnapshotMeta | null,
  detail: CartUpdatedDetail
): CartSnapshotMeta {
  const next = buildCartSnapshotMeta(detail);
  return {
    ...next,
    lastMutationGeneration: Math.max(
      prev?.lastMutationGeneration ?? 0,
      detail.mutationGeneration ?? 0
    ),
    lastLifecycleGeneration: Math.max(
      prev?.lastLifecycleGeneration ?? 0,
      detail.lifecycleGeneration ?? 0
    ),
  };
}

export function logIgnoredStaleCartSnapshot(
  reason: string,
  detail: Partial<CartUpdatedDetail>,
  lastAccepted: CartSnapshotMeta | null
): void {
  if (!DEBUG_STALE_SNAPSHOT) return;
  console.debug("[cart-snapshot] ignored stale snapshot", {
    reason,
    source: detail.source,
    clientSequence: detail.clientSequence,
    itemCount: cartSnapshotItemCount(detail.cart),
    lastAccepted,
  });
}

/**
 * Reject snapshots that would regress cart state (older sequence, stale empty clears).
 * Mutation successes beat background/lifecycle clears unless lifecycle is newer than mutations.
 */
export function shouldAcceptCartSnapshot(
  detail: CartUpdatedDetail | undefined,
  lastAccepted: CartSnapshotMeta | null
): boolean {
  if (!detail || detail.cart === undefined) return false;

  if (detail.clientSequence == null) {
    return true;
  }

  if (lastAccepted && detail.clientSequence <= lastAccepted.clientSequence) {
    logIgnoredStaleCartSnapshot("older-or-equal-client-sequence", detail, lastAccepted);
    return false;
  }

  if (isExplicitCartClearSource(detail.source)) {
    return true;
  }

  const incomingCount = cartSnapshotItemCount(detail.cart);
  if (!lastAccepted || incomingCount >= lastAccepted.itemCount) {
    return true;
  }

  if (isMutationCartSource(detail.source)) {
    return true;
  }

  if (detail.source === "group-order-ended") {
    const endAtMut = detail.endAtMutationGeneration ?? 0;
    const lastMut = lastAccepted.lastMutationGeneration ?? 0;
    if (lastMut > endAtMut) {
      logIgnoredStaleCartSnapshot("stale-group-order-ended-after-mutation", detail, lastAccepted);
      return false;
    }
    return true;
  }

  logIgnoredStaleCartSnapshot("stale-empty-or-regressive-snapshot", detail, lastAccepted);
  return false;
}

/**
 * Reject stale GET /api/cart payloads that would regress displayed cart qty.
 * Background fetches must never remove items/qty that a newer local mutation already showed.
 */
export function shouldAcceptApiCartPayload(
  payload: { cart: Cart | null },
  lastAccepted: CartSnapshotMeta | null
): boolean {
  const incomingCount = cartSnapshotItemCount(payload.cart);
  if (!lastAccepted) return true;
  if (incomingCount >= lastAccepted.itemCount) {
    return true;
  }
  logIgnoredStaleCartSnapshot(
    incomingCount === 0
      ? "stale-api-empty-after-mutation"
      : "stale-api-regressive-after-mutation",
    { cart: payload.cart, source: undefined },
    lastAccepted
  );
  return false;
}

export function rememberAcceptedCartSnapshot(cart: Cart | null): void {
  const podId = cart?.podId?.trim();
  if (!podId || !cart) {
    return;
  }
  lastKnownCartByPod.set(podId, cart);
}

/** Prefer fresher in-memory cart over stale SSR props after router.refresh remounts. */
export function resolveInitialVendorMenuCart(initialCart: Cart): Cart {
  const remembered = lastKnownCartByPod.get(initialCart.podId);
  if (!remembered) return initialCart;
  const rememberedCount = cartSnapshotItemCount(remembered);
  const initialCount = cartSnapshotItemCount(initialCart);
  if (rememberedCount >= initialCount) {
    return remembered;
  }
  return initialCart;
}
