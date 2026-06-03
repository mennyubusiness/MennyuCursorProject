/**
 * Orphaned / legacy RefundAttempt rows that block new refunds without a real in-flight refund.
 */

export const STALE_REFUND_ATTEMPT_GRACE_MS = 2 * 60 * 1000;

export type RefundAttemptBlockingContext = {
  id: string;
  status: string;
  amountCents: number;
  stripeRefundId: string | null;
  dismissedAsLegacyAt: Date | null;
  hasLinkedOrderRefund: boolean;
  idempotencyKey: string;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
};

export type OrderRefundLinkContext = {
  refundAttemptId: string | null;
  status: string;
};

export function isRefundAttemptDismissed(attempt: {
  dismissedAsLegacyAt: Date | null;
}): boolean {
  return attempt.dismissedAsLegacyAt != null;
}

function linkedOrderRefund(
  attemptId: string,
  orderRefunds: OrderRefundLinkContext[]
): OrderRefundLinkContext | undefined {
  return orderRefunds.find((r) => r.refundAttemptId === attemptId);
}

/** Attempt blocks refunds as stale local state (dismissible), not a real Stripe in-flight refund. */
export function isStaleBlockingRefundAttempt(
  attempt: RefundAttemptBlockingContext,
  orderRefunds: OrderRefundLinkContext[]
): boolean {
  if (isRefundAttemptDismissed(attempt)) return false;
  if (attempt.status === "succeeded") return false;
  if (attempt.stripeRefundId) return false;

  const linked = linkedOrderRefund(attempt.id, orderRefunds);
  if (
    linked &&
    (linked.status === "pending" || linked.status === "requires_action" || linked.status === "succeeded")
  ) {
    return false;
  }

  if (attempt.status === "failed") return false;
  if (attempt.status === "attempted") return true;

  if (attempt.status === "pending") {
    return Date.now() - attempt.createdAt.getTime() > STALE_REFUND_ATTEMPT_GRACE_MS;
  }

  return false;
}

/** Real in-flight refund (Stripe or pending ledger) — not dismissible as stale. */
export function isRealInFlightRefundAttempt(
  attempt: RefundAttemptBlockingContext,
  orderRefunds: OrderRefundLinkContext[]
): boolean {
  if (isRefundAttemptDismissed(attempt)) return false;
  if (isStaleBlockingRefundAttempt(attempt, orderRefunds)) return false;

  if (attempt.stripeRefundId && (attempt.status === "attempted" || attempt.status === "pending")) {
    return true;
  }

  const linked = linkedOrderRefund(attempt.id, orderRefunds);
  if (linked && (linked.status === "pending" || linked.status === "requires_action")) {
    return true;
  }

  return false;
}

export function canDismissStaleRefundAttempt(
  attempt: RefundAttemptBlockingContext,
  orderRefunds: OrderRefundLinkContext[]
): { ok: true } | { ok: false; reason: string } {
  if (isRefundAttemptDismissed(attempt)) {
    return { ok: false, reason: "already_dismissed" };
  }
  if (attempt.status === "succeeded") {
    return { ok: false, reason: "succeeded_not_dismissible" };
  }
  if (attempt.stripeRefundId) {
    return { ok: false, reason: "has_stripe_refund_id" };
  }

  const linked = linkedOrderRefund(attempt.id, orderRefunds);
  if (linked && (linked.status === "pending" || linked.status === "requires_action")) {
    return { ok: false, reason: "linked_pending_ledger" };
  }
  if (linked && linked.status === "succeeded") {
    return { ok: false, reason: "linked_succeeded_ledger" };
  }

  if (attempt.status === "failed") return { ok: true };
  if (attempt.status === "attempted" && !attempt.hasLinkedOrderRefund) return { ok: true };
  if (
    attempt.status === "pending" &&
    !attempt.hasLinkedOrderRefund &&
    Date.now() - attempt.createdAt.getTime() > STALE_REFUND_ATTEMPT_GRACE_MS
  ) {
    return { ok: true };
  }

  return { ok: false, reason: "not_stale" };
}

export function findStaleBlockingRefundAttempts(
  attempts: RefundAttemptBlockingContext[],
  orderRefunds: OrderRefundLinkContext[]
): RefundAttemptBlockingContext[] {
  return attempts.filter((a) => isStaleBlockingRefundAttempt(a, orderRefunds));
}
