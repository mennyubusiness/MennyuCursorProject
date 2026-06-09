import type { Cart } from "@/domain/types";
import { dispatchCartUpdated } from "@/lib/cart-client-sync";

/** Client cart snapshot after host starts an active group order (empty cart is valid). */
export function buildHostGroupCartClientSnapshot(args: {
  cartId: string;
  podId: string;
  podName: string | null;
  sessionId: string;
  joinCode: string;
  groupOrderSessionId: string;
}): Cart {
  return {
    id: args.cartId,
    podId: args.podId,
    podName: args.podName,
    sessionId: args.sessionId,
    items: [],
    groups: [],
    subtotalCents: 0,
    cartScope: "group_order",
    groupOrder: {
      role: "host",
      canCheckout: true,
      joinCode: args.joinCode,
      groupOrderSessionId: args.groupOrderSessionId,
    },
  };
}

/** Push authoritative host group cart to Quick Cart, vendor menu, and cart page listeners. */
export function dispatchGroupOrderStartCartSnapshot(cart: Cart): void {
  dispatchCartUpdated({ cart, source: "group-order-start" });
}
