import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import {
  canDismissStaleRefundAttempt,
  type RefundAttemptBlockingContext,
} from "@/domain/stale-refund-attempt";

export type StaleRefundAttemptSummary = {
  id: string;
  amountCents: number;
  status: string;
  stripeRefundId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  dismissible: boolean;
  dismissBlockReason: string | null;
};

export class StaleRefundAttemptError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "StaleRefundAttemptError";
  }
}

function toBlockingContext(
  attempt: {
    id: string;
    status: string;
    amountCents: number;
    stripeRefundId: string | null;
    dismissedAsLegacyAt: Date | null;
    idempotencyKey: string;
    failureCode: string | null;
    failureMessage: string | null;
    createdAt: Date;
  },
  hasLinkedOrderRefund: boolean
): RefundAttemptBlockingContext {
  return { ...attempt, hasLinkedOrderRefund };
}

async function verifyNoConflictingStripeRefund(input: {
  stripePaymentIntentId: string | null;
  attempt: RefundAttemptBlockingContext;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!env.STRIPE_SECRET_KEY || !stripe || !input.stripePaymentIntentId) {
    return { ok: true };
  }

  try {
    const listed = await stripe.refunds.list({
      payment_intent: input.stripePaymentIntentId,
      limit: 100,
    });

    for (const refund of listed.data) {
      if (refund.status !== "succeeded" && refund.status !== "pending") continue;

      const meta = refund.metadata ?? {};
      if (meta.refundAttemptId === input.attempt.id) {
        return {
          ok: false,
          message:
            "Stripe shows a matching refund for this attempt. Inspect Stripe before dismissing.",
        };
      }
      if (
        meta.idempotencyKey === input.attempt.idempotencyKey ||
        meta.adminRefundIdempotencyKey === input.attempt.idempotencyKey
      ) {
        return {
          ok: false,
          message:
            "Stripe shows a refund with the same idempotency metadata. Inspect Stripe before dismissing.",
        };
      }
      if (refund.amount === input.attempt.amountCents) {
        return {
          ok: false,
          message:
            "Stripe shows a pending or succeeded refund for the same amount on this payment. Inspect Stripe before dismissing.",
        };
      }
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "Unable to verify Stripe refund state. Try again or inspect Stripe before dismissing.",
    };
  }
}

export async function dismissStaleRefundAttempt(input: {
  refundAttemptId: string;
  dismissedBy?: string;
}): Promise<{ ok: true; refundAttemptId: string; alreadyDismissed: boolean }> {
  const ra = await prisma.refundAttempt.findUnique({
    where: { id: input.refundAttemptId },
    include: {
      order: { select: { stripePaymentIntentId: true } },
      orderRefund: { select: { id: true, status: true, refundAttemptId: true } },
    },
  });

  if (!ra) {
    throw new StaleRefundAttemptError("NOT_FOUND", "Refund attempt not found.");
  }

  if (ra.dismissedAsLegacyAt != null) {
    return { ok: true, refundAttemptId: ra.id, alreadyDismissed: true };
  }

  const orderRefunds = await prisma.orderRefund.findMany({
    where: { orderId: ra.orderId },
    select: { refundAttemptId: true, status: true },
  });

  const attemptCtx = toBlockingContext(ra, ra.orderRefund != null);
  const eligibility = canDismissStaleRefundAttempt(attemptCtx, orderRefunds);
  if (!eligibility.ok) {
    throw new StaleRefundAttemptError(
      "NOT_DISMISSIBLE",
      eligibility.reason === "has_stripe_refund_id"
        ? "This refund attempt has a Stripe refund ID and cannot be dismissed here."
        : eligibility.reason === "linked_pending_ledger"
          ? "This refund attempt is linked to a pending refund ledger entry."
          : "This refund attempt is not eligible for stale dismissal."
    );
  }

  const stripeCheck = await verifyNoConflictingStripeRefund({
    stripePaymentIntentId: ra.order.stripePaymentIntentId,
    attempt: attemptCtx,
  });
  if (!stripeCheck.ok) {
    throw new StaleRefundAttemptError("STRIPE_VERIFY_FAILED", stripeCheck.message);
  }

  await prisma.refundAttempt.update({
    where: { id: ra.id },
    data: {
      dismissedAsLegacyAt: new Date(),
      dismissedAsLegacyBy: input.dismissedBy ?? "admin",
      failureMessage:
        ra.failureMessage ??
        (ra.status === "attempted"
          ? "Dismissed stale orphan attempt (no refund ledger / Stripe refund created)."
          : null),
    },
  });

  return { ok: true, refundAttemptId: ra.id, alreadyDismissed: false };
}
