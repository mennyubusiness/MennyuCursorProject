import type { Cart, CartPodScope } from "@/domain/types";
import type { CartUpdateSource } from "@/lib/cart-client-sync";

const AUTHORITATIVE_SOURCES: ReadonlySet<CartUpdateSource> = new Set([
  "vendor-menu",
  "quick-cart",
  "cart-page",
  "group-order-start",
  "group-order-ended",
]);

/** True when cart carries an active host/participant group session for customer UI. */
export function hasActiveGroupOrderDisplay(cart: Cart | null | undefined): boolean {
  const group = cart?.groupOrder;
  if (!group) return false;
  if (group.role === "participant") return true;
  if (group.role === "host") return Boolean(group.joinCode?.trim());
  return false;
}

/** Strip stale group-order UI fields from authoritative cart snapshots (mutations, lifecycle). */
export function normalizeAuthoritativeCartSnapshot(
  cart: Cart,
  source?: CartUpdateSource
): Cart {
  if (source === "group-order-start") {
    return cart;
  }

  if (source === "group-order-ended") {
    const next: Cart = {
      ...cart,
      items: cart.items ?? [],
      groups: cart.groups ?? [],
      groupOrder: undefined,
    };
    if (next.items.length > 0) {
      next.cartScope = "assigned_pod";
    } else {
      delete next.cartScope;
    }
    return next;
  }

  if (source && !AUTHORITATIVE_SOURCES.has(source)) {
    return cart;
  }

  if (hasActiveGroupOrderDisplay(cart)) {
    return { ...cart, cartScope: "group_order" };
  }

  const next: Cart = { ...cart, groupOrder: undefined };
  if (next.items.length > 0) {
    next.cartScope = "assigned_pod";
  } else if (next.cartScope === "group_order") {
    delete next.cartScope;
  }
  return next;
}

/** Align Quick Cart API cart payload with response scope (solo vs active group). */
export function normalizeQuickCartApiCart(
  cart: Cart | null,
  scope: CartPodScope
): Cart | null {
  if (!cart) return null;
  if (scope === "group_order" && cart.groupOrder?.role === "unknown") {
    return { ...cart, cartScope: "group_order" };
  }
  if (hasActiveGroupOrderDisplay(cart)) {
    return { ...cart, cartScope: "group_order" };
  }
  return normalizeAuthoritativeCartSnapshot({ ...cart, cartScope: scope });
}
