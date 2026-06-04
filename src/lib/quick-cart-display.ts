import type { Cart, CartGroupOrderDisplay, CartPodScope } from "@/domain/types";
import type { GroupOrderViewerContext } from "@/lib/group-order-viewer-context";
import { getCartPodContext, type CartPodContext } from "@/lib/cart-pod-context";

/** Attach pod + group-order UI fields to a scoped cart (API / mutations). */
export function attachQuickCartDisplay(
  cart: Cart,
  ctx: GroupOrderViewerContext,
  podName: string | null | undefined,
  cartScope: CartPodScope
): Cart {
  const groupOrder: CartGroupOrderDisplay = {
    role: ctx.viewerRole,
    canCheckout: ctx.canCheckout,
    ...(ctx.viewerRole === "host" && ctx.joinCode && ctx.groupOrderSessionId
      ? {
          joinCode: ctx.joinCode,
          groupOrderSessionId: ctx.groupOrderSessionId,
        }
      : {}),
  };

  return {
    ...cart,
    podName: podName?.trim() || null,
    groupOrder,
    cartScope,
  };
}

export function buildCartPodContextForDisplay(params: {
  cart: Cart | null;
  browsingPodId: string | null;
  browsingPodName: string | null;
  assignedPodId: string | null;
  assignedPodName: string | null;
  requiresClearToSwitchPod: boolean;
}): CartPodContext {
  return getCartPodContext(params);
}

export function quickCartSubtitle(ctx: CartPodContext): string {
  const podLabel = ctx.cartPodName ?? ctx.browsingPodName;

  if (ctx.cartScope === "group_order") {
    return podLabel ? `Group order · ${podLabel}` : "Group order";
  }
  if (ctx.cartScope === "assigned_pod") {
    return podLabel ? `For ${podLabel}` : "For this pod";
  }
  if (ctx.cartScope === "browsing_pod") {
    return podLabel ? `Browsing ${podLabel}` : "Browsing a pod";
  }
  return "Choose a pod to start an order";
}

export function quickCartPodLinkLabel(ctx: CartPodContext): string {
  const name = ctx.cartPodName ?? ctx.browsingPodName;
  if (name) return `Back to ${name}`;
  return "Explore pods";
}

export function quickCartEmptyTitle(ctx: CartPodContext): string {
  if (ctx.cartScope === "neutral") return "Find a food pod to start your order.";
  if (ctx.cartScope === "browsing_pod") return "Add items from a vendor in this pod.";
  return "Your cart is empty";
}

export function quickCartFooterCtaLabel(params: {
  hasItems: boolean;
  groupRole: CartGroupOrderDisplay["role"] | undefined;
  canCheckout: boolean;
  cartScope: CartPodScope;
}): string {
  const { hasItems, groupRole, canCheckout, cartScope } = params;

  if (groupRole === "participant") {
    return hasItems ? "View my items" : "View group cart";
  }
  if (groupRole === "host" || cartScope === "group_order") {
    return hasItems ? "Go to group cart" : "Go to cart";
  }
  if (!canCheckout) {
    return "Go to cart";
  }
  return hasItems ? "Review cart & checkout" : "Go to cart";
}
