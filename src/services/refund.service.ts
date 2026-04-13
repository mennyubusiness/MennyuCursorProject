/**
 * Refund execution: precheck eligibility then Stripe refund.
 * Uses refund decision layer; does not change decision rules.
 * Treats canAutoRefund as "eligible for automatic attempt," not guaranteed success.
 * Persists outcomes in RefundAttempt for idempotency and so failed refunds can feed Needs Attention.
 */
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import type { RefundDecision } from "@/lib/refund-decision";
import { prepareTransferReversalsForRefundAttempt } from "@/services/vendor-payout-transfer-reversal.service";

export type RefundResultSuccess = {
  success: true;
  refundId?: string;
  /** Local RefundAttempt id — use for transfer reversal prep / support. */
  refundAttemptId?: string;
  amountCents: number;
  message?: string;
};

export type RefundResultFailure = {
  success: false;
  code: string;
  message: string;
  amountCents?: number;
};

export type RefundResult = RefundResultSuccess | RefundResultFailure;

export type RefundPrecheckResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/** Build unique key for this refund context (idempotency and persistence). */
export function buildRefundIdempotencyKey(decision: RefundDecision): string {
  const { reason, orderId, vendorOrderId } = decision;
  return vendorOrderId
    ? `${reason}:${orderId}:${vendorOrderId}`
    : `${reason}:${orderId}`;
}

function isDevBypassPaymentIntent(piId: string | null): boolean {
  if (!piId) return true;
  if (process.env.NODE_ENV !== "production" && piId.startsWith("dev_bypass_"))
    return true;
  return false;
}

/**
 * Precheck: payment exists, PaymentIntent is captured, and requested amount
 * does not exceed remaining refundable amount.
 */
export async function precheckRefundEligibility(
  orderId: string,
  amountCents: number
): Promise<RefundPrecheckResult> {
  if (amountCents <= 0) {
    return { eligible: false, reason: "amount_must_be_positive" };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { stripePaymentIntentId: true },
  });
  if (!order) {
    return { eligible: false, reason: "order_not_found" };
  }

  const piId = order.stripePaymentIntentId;
  if (!piId) {
    return { eligible: false, reason: "no_payment_intent" };
  }
  if (isDevBypassPaymentIntent(piId)) {
    return { eligible: false, reason: "dev_bypass_no_live_refund" };
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId },
    select: { stripePaymentIntentId: true, amountCents: true },
  });
  if (!payment) {
    return { eligible: false, reason: "payment_not_recorded" };
  }

  if (!stripe) {
    return { eligible: false, reason: "stripe_not_configured" };
  }

  let amountReceived = 0;
  let totalRefunded = 0;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (pi.status !== "succeeded") {
      return { eligible: false, reason: "payment_not_captured" };
    }
    amountReceived = pi.amount_received ?? 0;

    const refunds = await stripe.refunds.list({ payment_intent: piId });
    for (const r of refunds.data) {
      if (r.status === "succeeded") totalRefunded += r.amount ?? 0;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { eligible: false, reason: `stripe_retrieve_failed: ${msg}` };
  }

  const remaining = amountReceived - totalRefunded;
  if (remaining < amountCents) {
    return {
      eligible: false,
      reason: `refund_exceeds_remaining: remaining=${remaining}, requested=${amountCents}`,
    };
  }

  return { eligible: true };
}

/**
 * Execute a refund from a RefundDecision. Checks idempotency (skip if already succeeded),
 * runs precheck, creates Stripe refund, then persists outcome in RefundAttempt.
 * Returns normalized result; does not throw. Callers should not break order flow on failure.
 */
export async function executeRefund(decision: RefundDecision): Promise<RefundResult> {
  if (!decision.required || decision.scope === "none") {
    return {
      success: false,
      code: "NO_REFUND_REQUIRED",
      message: "Refund not required for this decision.",
    };
  }

  const amountCents = decision.amountCents ?? 0;
  if (amountCents <= 0) {
    return {
      success: false,
      code: "INVALID_AMOUNT",
      message: "Refund amount must be positive.",
      amountCents,
    };
  }

  const idempotencyKey = buildRefundIdempotencyKey(decision);

  let record: { id: string; status: string } | null = await prisma.refundAttempt.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true },
  });

  if (record) {
    if (record.status === "succeeded") {
      const row = await prisma.refundAttempt.findUnique({
        where: { idempotencyKey },
        select: { stripeRefundId: true, amountCents: true },
      });
      await prepareTransferReversalsAfterSuccessfulRefund(record.id);
      return {
        success: true,
        refundAttemptId: record.id,
        refundId: row?.stripeRefundId ?? undefined,
        amountCents: row?.amountCents ?? amountCents,
        message: "Already refunded (idempotent).",
      };
    }
    if (record.status === "attempted") {
      return {
        success: false,
        code: "REFUND_IN_PROGRESS",
        message: "A refund for this context is already in progress.",
        amountCents,
      };
    }
    if (record.status === "failed") {
      await prisma.refundAttempt.update({
        where: { id: record.id },
        data: { status: "attempted", failureCode: null, failureMessage: null, updatedAt: new Date() },
      });
    }
  } else {
    try {
      record = await prisma.refundAttempt.create({
        data: {
          idempotencyKey,
          orderId: decision.orderId,
          vendorOrderId: decision.vendorOrderId ?? null,
          amountCents,
          status: "attempted",
          reason: decision.reason,
        },
        select: { id: true, status: true },
      });
    } catch (e: unknown) {
      const isUnique = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
      if (isUnique) {
        const again = await prisma.refundAttempt.findUnique({
          where: { idempotencyKey },
          select: { id: true, status: true, stripeRefundId: true, amountCents: true },
        });
        if (again?.status === "succeeded") {
          await prepareTransferReversalsAfterSuccessfulRefund(again.id);
          return {
            success: true,
            refundAttemptId: again.id,
            refundId: again.stripeRefundId ?? undefined,
            amountCents: again.amountCents,
            message: "Already refunded (idempotent).",
          };
        }
        if (again?.status === "attempted") {
          return {
            success: false,
            code: "REFUND_IN_PROGRESS",
            message: "A refund for this context is already in progress.",
            amountCents,
          };
        }
      }
      return {
        success: false,
        code: "PERSISTENCE_FAILED",
        message: "Could not create refund attempt record.",
        amountCents,
      };
    }
  }

  record = await prisma.refundAttempt.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true },
  });
  if (!record) {
    return {
      success: false,
      code: "PERSISTENCE_FAILED",
      message: "Could not find refund attempt record.",
      amountCents,
    };
  }

  const precheck = await precheckRefundEligibility(decision.orderId, amountCents);
  if (!precheck.eligible) {
    await prisma.refundAttempt.update({
      where: { id: record.id },
      data: {
        status: "failed",
        failureCode: "PRECHECK_FAILED",
        failureMessage: precheck.reason,
        updatedAt: new Date(),
      },
    });
    return {
      success: false,
      code: "PRECHECK_FAILED",
      message: precheck.reason,
      amountCents,
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: decision.orderId },
    select: { stripePaymentIntentId: true },
  });
  const piId = order?.stripePaymentIntentId;
  if (!piId || isDevBypassPaymentIntent(piId)) {
    await prisma.refundAttempt.update({
      where: { id: record.id },
      data: {
        status: "failed",
        failureCode: "NO_PAYMENT_INTENT",
        failureMessage: "No live payment intent to refund.",
        updatedAt: new Date(),
      },
    });
    return {
      success: false,
      code: "NO_PAYMENT_INTENT",
      message: "No live payment intent to refund.",
      amountCents,
    };
  }

  if (!stripe) {
    await prisma.refundAttempt.update({
      where: { id: record.id },
      data: {
        status: "failed",
        failureCode: "STRIPE_NOT_CONFIGURED",
        failureMessage: "Stripe is not configured.",
        updatedAt: new Date(),
      },
    });
    return {
      success: false,
      code: "STRIPE_NOT_CONFIGURED",
      message: "Stripe is not configured.",
      amountCents,
    };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: piId,
      amount: amountCents,
      reason: "requested_by_customer",
      metadata: {
        orderId: decision.orderId,
        ...(decision.vendorOrderId && { vendorOrderId: decision.vendorOrderId }),
        reason: decision.reason,
      },
    });

    await prisma.refundAttempt.update({
      where: { id: record.id },
      data: {
        status: "succeeded",
        stripeRefundId: refund.id,
        failureCode: null,
        failureMessage: null,
        updatedAt: new Date(),
      },
    });

    await prepareTransferReversalsAfterSuccessfulRefund(record.id);

    return {
      success: true,
      refundAttemptId: record.id,
      refundId: refund.id,
      amountCents,
      message: refund.status === "succeeded" ? undefined : `Refund status: ${refund.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.refundAttempt.update({
      where: { id: record.id },
      data: {
        status: "failed",
        failureCode: "STRIPE_REFUND_FAILED",
        failureMessage: msg,
        updatedAt: new Date(),
      },
    });
    return {
      success: false,
      code: "STRIPE_REFUND_FAILED",
      message: msg,
      amountCents,
    };
  }
}
