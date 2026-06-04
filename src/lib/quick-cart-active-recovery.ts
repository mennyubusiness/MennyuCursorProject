import type {
  ActiveCartRecovery,
  Cart,
  CartPodScope,
  QuickCartApiResponse,
} from "@/domain/types";

const ACTIVE_GROUP_STATUSES = new Set(["active", "locked_checkout"]);

export function isActiveGroupSessionStatus(status: string | undefined | null): boolean {
  return Boolean(status && ACTIVE_GROUP_STATUSES.has(status));
}

export function buildActiveCartRecovery(params: {
  cart: Cart;
  browsePodId: string | null;
  browsePodName: string | null;
  participantCount?: number;
}): ActiveCartRecovery {
  const role = params.cart.groupOrder?.role ?? "solo";
  const kind =
    role === "host" ? "group_host" : role === "participant" ? "group_participant" : "solo_cart";

  const itemCount = params.cart.items.reduce((n, i) => n + i.quantity, 0);
  const isConflictingWithBrowsePod = Boolean(
    params.browsePodId && params.browsePodId !== params.cart.podId
  );
  const isCurrentContext = Boolean(
    params.browsePodId && params.browsePodId === params.cart.podId
  );

  return {
    kind,
    cartId: params.cart.id,
    podId: params.cart.podId,
    podName: params.cart.podName?.trim() || "Food pod",
    itemCount,
    subtotalCents: itemCount > 0 ? params.cart.subtotalCents : undefined,
    ...(kind === "group_host" && params.cart.groupOrder?.joinCode
      ? {
          groupCode: params.cart.groupOrder.joinCode,
          groupOrderSessionId: params.cart.groupOrder.groupOrderSessionId,
          participantCount: params.participantCount,
        }
      : {}),
    isCurrentContext,
    isConflictingWithBrowsePod,
  };
}

/** Show the compact recovery card (not the full in-drawer cart). */
export function shouldShowActiveRecovery(
  recovery: ActiveCartRecovery | null | undefined,
  scope: CartPodScope,
  requiresClearToSwitchPod: boolean
): boolean {
  if (!recovery) return false;
  if (scope === "neutral") return true;
  if (requiresClearToSwitchPod) return true;
  return false;
}

export function shouldShowActiveRecoverySection(payload: QuickCartApiResponse): boolean {
  return shouldShowActiveRecovery(
    payload.activeCartRecovery,
    payload.scope,
    payload.requiresClearToSwitchPod
  );
}

export function shouldSuppressNeutralGroupPromo(recovery: ActiveCartRecovery | null | undefined): boolean {
  return recovery?.kind === "group_host" || recovery?.kind === "group_participant";
}

export function recoveryItemCountLabel(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}
