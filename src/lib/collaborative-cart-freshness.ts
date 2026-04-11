/**
 * Collaborative group-order cart freshness — polling policy.
 *
 * Change detection: `GET /api/cart/group-order-fingerprint` returns a compact fingerprint
 * (see `group-order-fingerprint.service.ts`); `GroupOrderCartPoll` compares it before `router.refresh()`.
 * A fuller snapshot API can reuse the same fingerprint helper and extend the payload later.
 */

/** Only sessions where others may still change the shared cart warrant polling. */
export function isGroupOrderSessionPollableStatus(status: string): boolean {
  return status === "active" || status === "locked_checkout";
}

/**
 * Whether the collaborative poller should run. Callers already know if a group session exists on the cart
 * (`goState.active`); this narrows terminal states that should not refresh (submitted/ended/expired).
 */
export function shouldPollCollaborativeGroupCart(args: {
  hasGroupSession: boolean;
  sessionStatus: string;
}): boolean {
  return args.hasGroupSession && isGroupOrderSessionPollableStatus(args.sessionStatus);
}
