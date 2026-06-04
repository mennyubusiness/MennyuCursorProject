import type { Cart, CartGroupOrderDisplay } from "@/domain/types";
import type { GroupOrderViewerContext } from "@/lib/group-order-viewer-context";

/** Attach pod + group-order UI fields to a scoped cart (API / mutations). */
export function attachQuickCartDisplay(
  cart: Cart,
  ctx: GroupOrderViewerContext,
  podName: string | null | undefined
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
  };
}

export type QuickCartPodContext = {
  podId: string | null;
  podName: string | null;
};

export function resolveQuickCartPodContext(
  cart: Cart | null,
  clientPodId: string | null
): QuickCartPodContext {
  const podId = cart?.podId ?? clientPodId ?? null;
  const podName = cart?.podName?.trim() || null;
  return { podId, podName };
}

export function quickCartSubtitle(params: {
  podName: string | null;
  groupRole: CartGroupOrderDisplay["role"] | undefined;
}): string {
  const { podName, groupRole } = params;
  const podLabel = podName ? podName : null;

  if (groupRole === "host") {
    return podLabel ? `Group order · ${podLabel}` : "Group order";
  }
  if (groupRole === "participant") {
    return podLabel ? `Your items · ${podLabel}` : "Your items · group order";
  }
  if (groupRole === "unknown") {
    return podLabel ? `Group order · ${podLabel}` : "Group order";
  }
  if (podLabel) {
    return `For ${podLabel}`;
  }
  return "Multi-vendor · one checkout";
}

export function quickCartPodLinkLabel(podName: string | null): string {
  return podName ? `Back to ${podName}` : "Browse this pod";
}

export function quickCartFooterCtaLabel(params: {
  hasItems: boolean;
  groupRole: CartGroupOrderDisplay["role"] | undefined;
  canCheckout: boolean;
}): string {
  const { hasItems, groupRole, canCheckout } = params;

  if (groupRole === "participant") {
    return hasItems ? "View my items" : "View group cart";
  }
  if (groupRole === "host") {
    return hasItems ? "Go to group cart" : "Go to cart";
  }
  if (!canCheckout) {
    return "Go to cart";
  }
  return hasItems ? "Review cart & checkout" : "Go to cart";
}
