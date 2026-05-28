import type { Cart } from "@/domain/types";

export const CART_UPDATED_EVENT = "mennyu:cart-updated";
export const CART_CLEARED_EVENT = "mennyu:cart-cleared";
export const PENDING_CART_CLEAR_STORAGE_KEY = "mennyu:pending-cart-clear";

export type CartUpdateSource = "vendor-menu" | "quick-cart" | "cart-page" | "checkout" | "order-page";

export type CartClearSource = "checkout" | "order-page" | CartUpdateSource;

export type CartUpdatedDetail = {
  cart?: Cart | null;
  /** When true, listeners should refetch (e.g. unknown mutation). */
  refresh?: boolean;
  /** Origin of the snapshot — listeners skip their own source to avoid rebroadcast loops. */
  source?: CartUpdateSource;
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
  return cartSnapshotAppliesToContext(detail.cart, ctx);
}

/**
 * Quick Cart listener: accept same-pod snapshots even when local cartId is stale
 * (e.g. after checkout clear + navigation before refreshCart realigns).
 */
export function shouldQuickCartApplyCartSnapshot(
  detail: CartUpdatedDetail | undefined,
  localCart: Cart | null,
  currentPodId: string | null
): boolean {
  if (!detail || detail.cart === undefined) return false;
  if (detail.source === "quick-cart") return false;

  const incoming = detail.cart;
  if (incoming && currentPodId && incoming.podId && incoming.podId !== currentPodId) {
    return false;
  }

  if (!localCart?.id || !localCart.podId) return true;

  if (incoming?.podId && incoming.podId === localCart.podId) return true;

  return cartSnapshotAppliesToContext(incoming, {
    cartId: localCart.id,
    podId: localCart.podId,
  });
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
export function dispatchCartUpdated(detail: CartUpdatedDetail): void {
  if (typeof window === "undefined") return;
  const normalized =
    detail.cart != null ? { ...detail, cart: ensureCartSnapshotScalars(detail.cart) } : detail;
  window.dispatchEvent(new CustomEvent<CartUpdatedDetail>(CART_UPDATED_EVENT, { detail: normalized }));
  if (normalized.cart) {
    window.dispatchEvent(new CustomEvent("mennyu:cart-added"));
  }
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
