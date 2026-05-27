/**
 * Unified entry for automatic refund decisions (cancel / vendor denial / routing).
 *
 * Money model (Open Order):
 * - Customer pays the platform via PaymentIntent (not destination charges).
 * - Vendor payouts are separate manual Stripe transfers from PaymentAllocation.netVendorTransferCents.
 * - Customer refund debits the platform balance via Stripe refunds on the PaymentIntent.
 * - Vendor clawback is a separate VendorPayoutTransferReversal workflow (not automatic here).
 * - Full-order / full-vendor refunds may prepare reversal rows when the transfer was paid.
 * - Partial refunds after vendor payout may require platform absorption (admin Phase 2).
 * - No Stripe application_fee on charges.
 */
import type { RefundDecision } from "@/lib/refund-decision";
import {
  buildRefundIdempotencyKey,
  executeRefund,
  type RefundResult,
} from "@/services/refund.service";
import { mapRefundDecisionToScope } from "@/domain/order-refund";
import { mapRefundReasonToInitiatedByRole } from "@/lib/refund-initiated-by";
import { recordPendingRefund } from "@/services/refund-ledger.service";
import { prisma } from "@/lib/db";

export type ProcessRefundDecisionResult =
  | { outcome: "not_required" }
  | { outcome: "auto_executed"; result: RefundResult }
  | {
      outcome: "admin_review_queued";
      orderRefundId: string;
      amountCents: number;
      message: string;
    };

const ADMIN_REVIEW_NOTE =
  "Awaiting platform admin review before Stripe customer refund. Complete in admin Payments & Refunds.";

export async function recordRefundAwaitingAdminReview(
  decision: RefundDecision
): Promise<{ orderRefundId: string; created: boolean }> {
  const amountCents = decision.amountCents ?? 0;
  const idempotencyKey = buildRefundIdempotencyKey(decision);

  const existing = await prisma.orderRefund.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return { orderRefundId: existing.id, created: false };
  }

  const order = await prisma.order.findUnique({
    where: { id: decision.orderId },
    select: {
      stripePaymentIntentId: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, stripePaymentIntentId: true, stripeChargeId: true },
      },
    },
  });
  const payment = order?.payments[0] ?? null;
  const piId = payment?.stripePaymentIntentId ?? order?.stripePaymentIntentId ?? "";

  const row = await recordPendingRefund({
    orderId: decision.orderId,
    vendorOrderId: decision.vendorOrderId ?? null,
    amountCents,
    idempotencyKey,
    reason: decision.reason,
    refundScope: mapRefundDecisionToScope({
      scope: decision.scope,
      reason: decision.reason,
    }),
    initiatedByRole: mapRefundReasonToInitiatedByRole(decision.reason),
    stripePaymentIntentId: piId,
    adminNote: ADMIN_REVIEW_NOTE,
    customerVisibleNote:
      "Your refund is being reviewed by our team. We will update you when it is processed.",
  });

  return { orderRefundId: row.id, created: row.created };
}

/**
 * Routes a RefundDecision: admin review queue (no Stripe), or automatic executeRefund.
 */
export async function processRefundDecision(
  decision: RefundDecision,
  opts?: { customerVisibleNote?: string | null }
): Promise<ProcessRefundDecisionResult> {
  if (!decision.required || decision.scope === "none") {
    return { outcome: "not_required" };
  }

  if (decision.requiresAdminReview) {
    const { orderRefundId } = await recordRefundAwaitingAdminReview(decision);
    return {
      outcome: "admin_review_queued",
      orderRefundId,
      amountCents: decision.amountCents ?? 0,
      message:
        "Refund requires platform admin review. No Stripe refund was attempted. Use Payments & Refunds on the admin order page.",
    };
  }

  if (!decision.canAutoRefund) {
    return { outcome: "not_required" };
  }

  const result = await executeRefund(decision, {
    customerVisibleNote: opts?.customerVisibleNote ?? null,
  });
  return { outcome: "auto_executed", result };
}

/** API-friendly refund payload for cancel / denial routes. */
export function toApiRefundPayload(
  processed: ProcessRefundDecisionResult
): { success: boolean; code?: string; message?: string; amountCents?: number; requiresAdminReview?: boolean } | undefined {
  if (processed.outcome === "not_required") return undefined;
  if (processed.outcome === "admin_review_queued") {
    return {
      success: false,
      code: "REQUIRES_ADMIN_REVIEW",
      message: processed.message,
      amountCents: processed.amountCents,
      requiresAdminReview: true,
    };
  }
  const r = processed.result;
  return r.success
    ? { success: true, amountCents: r.amountCents }
    : {
        success: false,
        code: r.code,
        message: r.message,
        amountCents: r.amountCents,
      };
}
