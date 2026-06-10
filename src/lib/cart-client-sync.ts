import type { Cart } from "@/domain/types";
import {
  enrichCartUpdatedDetail,
} from "@/lib/cart-snapshot-freshness";
import { normalizeAuthoritativeCartSnapshot } from "@/lib/cart-group-metadata";

export type { CartSnapshotMeta } from "@/lib/cart-snapshot-freshness";
export {
  buildCartSnapshotMeta,
  enrichCartUpdatedDetail,
  mergeAcceptedCartSnapshotMeta,
  rememberAcceptedCartSnapshot,
  resolveInitialVendorMenuCart,
  shouldAcceptApiCartPayload,
  shouldAcceptCartSnapshot,
} from "@/lib/cart-snapshot-freshness";

export const CART_UPDATED_EVENT = "mennyu:cart-updated";
export const CART_CLEARED_EVENT = "mennyu:cart-cleared";
export const PENDING_CART_CLEAR_STORAGE_KEY = "mennyu:pending-cart-clear";

export type CartUpdateSource =
  | "vendor-menu"
  | "quick-cart"
  | "cart-page"
  | "checkout"
  | "order-page"
  | "group-order-start"
  | "group-order-ended";

export type CartClearSource = "checkout" | "order-page" | CartUpdateSource;

export type CartUpdatedDetail = {
  cart?: Cart | null;
  /** When true, listeners should refetch (e.g. unknown mutation). */
  refresh?: boolean;
  /** Origin of the snapshot — listeners skip their own source to avoid rebroadcast loops. */
  source?: CartUpdateSource;
  /** Monotonic client dispatch order — assigned in dispatchCartUpdated. */
  clientSequence?: number;
  /** Bumped on vendor-menu / quick-cart / cart-page mutation snapshots. */
  mutationGeneration?: number;
  /** Bumped on group-order-start / group-order-ended lifecycle snapshots. */
  lifecycleGeneration?: number;
  /** Mutation generation at group-order-ended dispatch — stale ends after later adds are ignored. */
  endAtMutationGeneration?: number;
};

export type CartClearedDetail = {
  cartId: string;
  podId: string;
  /** Empty cart from server when available. */
  cart?: Cart | null;
  source?: CartClearSource;
};

export type CartSnapshotContext = {
  cartId: string;
  podId: string;
};

export type PendingCartClear = {
  cartId: string;
  podId: string;
  orderId: string;
};

export type MennyuCheckoutCookie = {
  orderId: string;
  cartId: string;
};

const MENNYU_CHECKOUT_COOKIE_NAME = "mennyu_checkout";

/** Client-side checkout marker set before Stripe redirect (see CheckoutForm). */
export function readMennyuCheckoutCookie(): MennyuCheckoutCookie | null {
  if (typeof document === "undefined") return null;
  const prefix = `${MENNYU_CHECKOUT_COOKIE_NAME}=`;
  const entry = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(prefix));
  if (!entry) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(entry.slice(prefix.length))) as MennyuCheckoutCookie;
    if (typeof parsed.orderId === "string" && typeof parsed.cartId === "string") {
      return parsed;
    }
  } catch {
    /* ignore malformed cookie */
  }
  return null;
}

export function clearMennyuCheckoutCookieClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${MENNYU_CHECKOUT_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/** True when a cart snapshot belongs to the given cart/pod (ignore foreign pods). */
export function cartSnapshotAppliesToContext(
  cart: Cart | null | undefined,
  ctx: CartSnapshotContext
): boolean {
  if (!cart) return false;
  if (cart.id !== ctx.cartId) return false;
  if (cart.podId !== ctx.podId) return false;
  return true;
}

/** Whether a listener should apply (not rebroadcast) an incoming cart snapshot. */
export function shouldApplyCartSnapshot(
  detail: CartUpdatedDetail | undefined,
  listenerSource: CartUpdateSource,
  ctx: CartSnapshotContext
): boolean {
  if (!detail || detail.cart === undefined) return false;
  if (detail.source === listenerSource) return false;
  if (detail.source === "group-order-start") {
    return Boolean(detail.cart?.podId && detail.cart.podId === ctx.podId);
  }
  if (detail.source === "group-order-ended") {
    if (detail.cart === null) return true;
    return Boolean(detail.cart.podId && detail.cart.podId === ctx.podId);
  }
  return cartSnapshotAppliesToContext(detail.cart, ctx);
}

/**
 * Quick Cart listener: route pod is authoritative; stale local cart from another pod
 * must not block current-pod snapshots.
 */
export function shouldQuickCartApplyCartSnapshot(
  detail: CartUpdatedDetail | undefined,
  localCart: Cart | null,
  currentPodId: string | null
): boolean {
  if (!detail || detail.cart === undefined) return false;
  if (detail.source === "quick-cart") return false;
  if (detail.source === "group-order-start") {
    const started = detail.cart;
    return Boolean(started && currentPodId && started.podId === currentPodId);
  }
  if (detail.source === "group-order-ended") {
    if (detail.cart === null) return true;
    const ended = detail.cart;
    return !currentPodId || !ended?.podId || ended.podId === currentPodId;
  }

  const incoming = detail.cart;
  if (incoming && currentPodId && incoming.podId && incoming.podId !== currentPodId) {
    return false;
  }

  if (currentPodId && incoming?.podId === currentPodId) {
    return true;
  }

  if (!localCart?.id || !localCart.podId) return true;

  if (currentPodId && localCart.podId !== currentPodId) {
    return false;
  }

  if (incoming?.podId && incoming.podId === localCart.podId) return true;

  return cartSnapshotAppliesToContext(incoming, {
    cartId: localCart.id,
    podId: localCart.podId,
  });
}

/** Ignore stale GET /api/cart responses after pod change or newer snapshot apply. */
export function shouldApplyCartFetchResult(params: {
  generationAtStart: number;
  currentGeneration: number;
  podAtStart: string | null;
  currentPodId: string | null;
}): boolean {
  if (params.generationAtStart !== params.currentGeneration) return false;
  if (
    params.podAtStart &&
    params.currentPodId &&
    params.podAtStart !== params.currentPodId
  ) {
    return false;
  }
  return true;
}

/** Ensure mutation/optimistic snapshots carry id + podId for scope guards. */
export function ensureCartSnapshotScalars(
  cart: Cart,
  fallback?: Partial<Pick<Cart, "id" | "podId" | "sessionId">>
): Cart {
  return {
    ...cart,
    id: cart.id || fallback?.id || cart.id,
    podId: cart.podId || fallback?.podId || cart.podId,
    sessionId: cart.sessionId || fallback?.sessionId || cart.sessionId,
  };
}

/** True when a cart-clear event targets this cart/pod context. */
export function cartClearAppliesToContext(
  detail: CartClearedDetail | undefined,
  ctx: Partial<CartSnapshotContext> & { podId: string }
): boolean {
  if (!detail) return false;
  if (detail.podId !== ctx.podId) return false;
  if (detail.cartId && ctx.cartId && detail.cartId !== ctx.cartId) return false;
  return true;
}

export function emptyCartSnapshot(base: {
  id: string;
  podId: string;
  sessionId?: string;
}): Cart {
  return {
    id: base.id,
    podId: base.podId,
    sessionId: base.sessionId ?? "",
    items: [],
    groups: [],
    subtotalCents: 0,
  };
}

export function markPendingClientCartClear(payload: PendingCartClear): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PENDING_CART_CLEAR_STORAGE_KEY, JSON.stringify(payload));
}

export function consumePendingClientCartClear(orderId: string): PendingCartClear | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_CART_CLEAR_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCartClear;
    if (parsed.orderId !== orderId) return null;
    sessionStorage.removeItem(PENDING_CART_CLEAR_STORAGE_KEY);
    return parsed;
  } catch {
    sessionStorage.removeItem(PENDING_CART_CLEAR_STORAGE_KEY);
    return null;
  }
}

/** Push cart snapshot to Quick Cart, vendor menu, and header badge without GET /api/cart. */
export function dispatchCartUpdated(detail: CartUpdatedDetail): CartUpdatedDetail | null {
  if (typeof window === "undefined") return null;
  const enriched = enrichCartUpdatedDetail(detail);
  const normalized =
    enriched.cart != null
      ? {
          ...enriched,
          cart: normalizeAuthoritativeCartSnapshot(
            ensureCartSnapshotScalars(enriched.cart),
            enriched.source
          ),
        }
      : enriched;
  window.dispatchEvent(new CustomEvent<CartUpdatedDetail>(CART_UPDATED_EVENT, { detail: normalized }));
  if (normalized.cart) {
    window.dispatchEvent(new CustomEvent("mennyu:cart-added"));
  }
  return normalized;
}

/** Clear client cart state after checkout — listeners apply locally, never rebroadcast. */
export function dispatchCartCleared(detail: CartClearedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CartClearedDetail>(CART_CLEARED_EVENT, { detail }));
  const empty =
    detail.cart ??
    emptyCartSnapshot({ id: detail.cartId, podId: detail.podId });
  dispatchCartUpdated({
    cart: empty,
    source: detail.source === "order-page" ? "order-page" : "checkout",
  });
}

/** @deprecated Use dispatchCartUpdated({ cart }) */
export function dispatchCartItemAdded(): void {
  dispatchCartUpdated({});
}
