import type { Cart, CartGroupOrderDisplay, CartPodScope } from "@/domain/types";

export type { CartPodScope };

export type CartPodContext = {
  cartScope: CartPodScope;
  cartPodId: string | null;
  cartPodName: string | null;
  browsingPodId: string | null;
  browsingPodName: string | null;
  /** Assigned cart pod when another pod is blocking browse (switch guard). */
  assignedPodId: string | null;
  canStartOrderHere: boolean;
  requiresClearToSwitchPod: boolean;
};

export function isActiveGroupOrderRole(
  role: CartGroupOrderDisplay["role"] | undefined
): boolean {
  return role === "host" || role === "participant";
}

/** Viewer lacks access to an active group cart at this pod (server scope group_order + unknown role). */
export function isInaccessibleGroupOrderView(
  cart: Cart | null | undefined,
  cartScope: CartPodScope
): boolean {
  return cartScope === "group_order" && cart?.groupOrder?.role === "unknown";
}

/** True when the cart row is committed to a pod (items or active group session). */
export function isCartRowAssigned(params: {
  itemCount: number;
  hasActiveGroupSession: boolean;
}): boolean {
  return params.itemCount > 0 || params.hasActiveGroupSession;
}

/**
 * Derive customer-facing pod scope from cart payload + optional browse pod.
 * Browsing never implies assignment; stale cookies must not force `assigned_pod`.
 */
export function getCartPodContext(params: {
  cart: Cart | null;
  browsingPodId: string | null;
  browsingPodName: string | null;
  assignedPodId: string | null;
  assignedPodName: string | null;
  requiresClearToSwitchPod: boolean;
}): CartPodContext {
  const groupRole = params.cart?.groupOrder?.role;
  const itemCount = params.cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const cartHasAssignment =
    params.cart != null &&
    isCartRowAssigned({
      itemCount,
      hasActiveGroupSession: isActiveGroupOrderRole(groupRole),
    });

  let cartScope: CartPodScope = "neutral";
  const explicitScope = params.cart?.cartScope;
  if (explicitScope === "group_order" && params.cart?.groupOrder?.role === "unknown") {
    cartScope = "group_order";
  } else if (params.cart && isActiveGroupOrderRole(groupRole)) {
    cartScope = "group_order";
  } else if (cartHasAssignment) {
    cartScope = "assigned_pod";
  } else if (params.browsingPodId) {
    cartScope = "browsing_pod";
  } else if (
    explicitScope === "assigned_pod" ||
    explicitScope === "browsing_pod" ||
    explicitScope === "neutral"
  ) {
    cartScope = explicitScope;
  }

  const cartPodId =
    cartScope === "assigned_pod" || cartScope === "group_order"
      ? params.cart?.podId ?? params.assignedPodId
      : null;
  const cartPodName =
    cartScope === "assigned_pod" || cartScope === "group_order"
      ? params.cart?.podName?.trim() || params.assignedPodName
      : null;

  const canStartOrderHere =
    cartScope === "browsing_pod" &&
    Boolean(params.browsingPodId) &&
    !params.requiresClearToSwitchPod;

  return {
    cartScope,
    cartPodId,
    cartPodName,
    browsingPodId: params.browsingPodId,
    browsingPodName: params.browsingPodName,
    assignedPodId: params.assignedPodId,
    canStartOrderHere,
    requiresClearToSwitchPod: params.requiresClearToSwitchPod,
  };
}
