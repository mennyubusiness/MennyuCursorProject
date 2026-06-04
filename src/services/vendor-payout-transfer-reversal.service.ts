/**
 * Stripe Connect transfer reversals: prepare rows after platform refunds, execute reversals idempotently.
 *
 * Money model: customer refunds hit the platform PaymentIntent; vendor payouts are separate manual
 * transfers. Clawback from vendors requires reversing those transfers here — not automatic with refunds.
 *
 * First pass (narrow, explicit):
 * - Only creates reversal intents when RefundAttempt represents a **full** refund for the scope:
 *   - vendor_order: amountCents === that VendorOrder.totalCents
 *   - full_order (no vendorOrderId on attempt): amountCents === Order.totalCents
 * - Partial / proportional refunds: **deferred** — no reversal rows (money recovery must be manual or a future phase).
 * - Reversal amount per row = min(VendorPayoutTransfer.amountCents, transferred) — for paid transfers, the row amount matches VPT.
 * - Only VendorPayoutTransfer rows with status `paid` and a non-empty `stripeTransferId` are reversed.
 *   Pending/blocked/failed transfers: no reversal row (nothing to pull back from the connected account via this API).
 */
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { VENDOR_PAYOUT_TRANSFER_STATUS } from "@/services/vendor-payout-transfer.service";

export const VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS = {
  pending: "pending",
  submitted: "submitted",
  reversed: "reversed",
  failed: "failed",
  not_needed: "not_needed",
} as const;

export function stableTransferReversalIdempotencyKey(
  refundAttemptId: string,
  vendorPayoutTransferId: string
): string {
  return `mennyu_vptr_${refundAttemptId}_${vendorPayoutTransferId}`;
}

/**
 * Amount to request from Stripe for this transfer (never above what was transferred out).
 */
export function getVendorTransferReversalAmountCents(vpt: { amountCents: number; status: string }): number {
  if (vpt.status !== VENDOR_PAYOUT_TRANSFER_STATUS.paid || vpt.amountCents <= 0) {
    return 0;
  }
  return vpt.amountCents;
}

export type TransferReversalRefundEligibility =
  | { eligible: true; scope: "vendor_order"; vendorOrderId: string }
  | { eligible: true; scope: "full_order" }
  | { eligible: false; reason: string };

type RefundAttemptRow = {
  id: string;
  orderId: string;
  vendorOrderId: string | null;
  amountCents: number;
};

/**
 * First-pass rule: only full refunds for the scope (see module doc). Partial refunds → not eligible.
 */
export async function evaluateTransferReversalEligibilityForRefundAttempt(
  attempt: Pick<RefundAttemptRow, "orderId" | "vendorOrderId" | "amountCents">
): Promise<TransferReversalRefundEligibility> {
  const order = await prisma.order.findUnique({
    where: { id: attempt.orderId },
    select: { id: true, totalCents: true },
  });
  if (!order) {
    return { eligible: false, reason: "order_not_found" };
  }

  if (attempt.vendorOrderId) {
    const vo = await prisma.vendorOrder.findFirst({
      where: { id: attempt.vendorOrderId, orderId: attempt.orderId },
      select: { id: true, totalCents: true },
    });
    if (!vo) {
      return { eligible: false, reason: "vendor_order_not_found" };
    }
    if (attempt.amountCents !== vo.totalCents) {
      return {
        eligible: false,
        reason: `partial_or_mismatch_vendor_refund:attempt=${attempt.amountCents},vo_total=${vo.totalCents}`,
      };
    }
    return { eligible: true, scope: "vendor_order", vendorOrderId: vo.id };
  }

  if (attempt.amountCents !== order.totalCents) {
    return {
      eligible: false,
      reason: `partial_or_mismatch_full_refund:attempt=${attempt.amountCents},order_total=${order.totalCents}`,
    };
  }
  return { eligible: true, scope: "full_order" };
}

export type PrepareTransferReversalsResult = {
  refundAttemptId: string;
  outcome:
    | "created_pending"
    | "idempotent_noop"
    | "skipped_ineligible"
    | "skipped_no_paid_transfers";
  reason?: string;
  createdCount: number;
  transferIds: string[];
};

export type PrepareMissingTransferReversalResult =
  | {
      ok: true;
      outcome: "created_pending" | "idempotent_noop";
      reversalId: string;
      refundAttemptId: string;
      vendorPayoutTransferId: string;
      amountCents: number;
    }
  | {
      ok: false;
      outcome:
        | "manual_review"
        | "skipped_ineligible"
        | "duplicate_existing_reversal"
        | "not_found";
      reason: string;
    };

function orderRefundAppliesToTransfer(input: {
  refund: {
    vendorOrderId: string | null;
    amountCents: number;
    refundScope: string;
  };
  orderTotalCents: number;
  vendorOrderId: string;
  vendorOrderTotalCents: number;
}): boolean {
  const scope = input.refund.refundScope;
  if ((scope === "full_order" || scope === "system_cancel") && !input.refund.vendorOrderId) {
    return input.refund.amountCents === input.orderTotalCents;
  }
  if (scope === "full_vendor_order" && input.refund.vendorOrderId === input.vendorOrderId) {
    return input.refund.amountCents === input.vendorOrderTotalCents;
  }
  return false;
}

/**
 * Safe admin repair for historical full-order/full-vendor refunds where the customer refund
 * succeeded but the transfer reversal row was never prepared.
 */
export async function prepareMissingTransferReversalForRefund(input: {
  orderId: string;
  vendorPayoutTransferId: string;
  orderRefundId?: string | null;
}): Promise<PrepareMissingTransferReversalResult> {
  const vpt = await prisma.vendorPayoutTransfer.findUnique({
    where: { id: input.vendorPayoutTransferId },
    include: {
      vendorOrder: {
        select: {
          id: true,
          orderId: true,
          totalCents: true,
          order: { select: { id: true, totalCents: true } },
        },
      },
      reversals: {
        select: {
          id: true,
          status: true,
          refundAttemptId: true,
          amountCents: true,
        },
      },
    },
  });

  if (!vpt || vpt.vendorOrder.orderId !== input.orderId) {
    return { ok: false, outcome: "not_found", reason: "vendor_payout_transfer_not_found_for_order" };
  }

  if (vpt.reversals.length > 0) {
    const existing = vpt.reversals[0];
    return {
      ok: true,
      outcome: "idempotent_noop",
      reversalId: existing.id,
      refundAttemptId: existing.refundAttemptId,
      vendorPayoutTransferId: vpt.id,
      amountCents: existing.amountCents,
    };
  }

  if (vpt.status !== VENDOR_PAYOUT_TRANSFER_STATUS.paid || !vpt.stripeTransferId?.trim()) {
    return { ok: false, outcome: "skipped_ineligible", reason: "transfer_not_paid_via_connect" };
  }

  const reversalAmountCents = getVendorTransferReversalAmountCents(vpt);
  if (reversalAmountCents <= 0 || reversalAmountCents > vpt.amountCents) {
    return { ok: false, outcome: "skipped_ineligible", reason: "unsafe_reversal_amount" };
  }

  const refunds = await prisma.orderRefund.findMany({
    where: {
      orderId: input.orderId,
      ...(input.orderRefundId ? { id: input.orderRefundId } : {}),
      status: "succeeded",
      refundScope: { in: ["full_order", "system_cancel", "full_vendor_order"] },
    },
    select: {
      id: true,
      vendorOrderId: true,
      amountCents: true,
      refundScope: true,
      refundAttemptId: true,
      refundAttempt: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const safeRefund = refunds.find((refund) => {
    if (!refund.refundAttemptId || refund.refundAttempt?.status !== "succeeded") {
      return false;
    }
    return orderRefundAppliesToTransfer({
      refund,
      orderTotalCents: vpt.vendorOrder.order.totalCents,
      vendorOrderId: vpt.vendorOrderId,
      vendorOrderTotalCents: vpt.vendorOrder.totalCents,
    });
  });

  if (!safeRefund) {
    const hasRefundWithoutAttempt = refunds.some((refund) =>
      orderRefundAppliesToTransfer({
        refund,
        orderTotalCents: vpt.vendorOrder.order.totalCents,
        vendorOrderId: vpt.vendorOrderId,
        vendorOrderTotalCents: vpt.vendorOrder.totalCents,
      })
    );
    return {
      ok: false,
      outcome: "manual_review",
      reason: hasRefundWithoutAttempt
        ? "matching_refund_missing_succeeded_refund_attempt_link"
        : "no_safe_full_scope_succeeded_refund",
    };
  }
  const refundAttemptId = safeRefund.refundAttemptId;
  if (!refundAttemptId) {
    return {
      ok: false,
      outcome: "manual_review",
      reason: "matching_refund_missing_succeeded_refund_attempt_link",
    };
  }

  const idempotencyKey = stableTransferReversalIdempotencyKey(refundAttemptId, vpt.id);
  try {
    const created = await prisma.vendorPayoutTransferReversal.create({
      data: {
        vendorPayoutTransferId: vpt.id,
        vendorOrderId: vpt.vendorOrderId,
        orderId: input.orderId,
        refundAttemptId,
        vendorId: vpt.vendorId,
        amountCents: reversalAmountCents,
        currency: vpt.currency ?? "usd",
        status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending,
        idempotencyKey,
      },
      select: { id: true },
    });
    return {
      ok: true,
      outcome: "created_pending",
      reversalId: created.id,
      refundAttemptId,
      vendorPayoutTransferId: vpt.id,
      amountCents: reversalAmountCents,
    };
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : "";
    if (code === "P2002") {
      const existing = await prisma.vendorPayoutTransferReversal.findUnique({
        where: {
          refundAttemptId_vendorPayoutTransferId: {
            refundAttemptId,
            vendorPayoutTransferId: vpt.id,
          },
        },
        select: { id: true, amountCents: true },
      });
      if (existing) {
        return {
          ok: true,
          outcome: "idempotent_noop",
          reversalId: existing.id,
          refundAttemptId,
          vendorPayoutTransferId: vpt.id,
          amountCents: existing.amountCents,
        };
      }
      return { ok: false, outcome: "duplicate_existing_reversal", reason: "duplicate_reversal_key" };
    }
    throw e;
  }
}

/**
 * Idempotent: creates pending VendorPayoutTransferReversal rows for each paid transfer affected by this refund.
 * Safe to call multiple times; duplicate (refundAttempt × transfer) rows are prevented by unique constraint.
 */
export async function prepareTransferReversalsForRefundAttempt(
  refundAttemptId: string
): Promise<PrepareTransferReversalsResult> {
  const attempt = await prisma.refundAttempt.findUnique({
    where: { id: refundAttemptId },
    select: { id: true, orderId: true, vendorOrderId: true, amountCents: true, status: true },
  });
  if (!attempt || attempt.status !== "succeeded") {
    return {
      refundAttemptId,
      outcome: "skipped_ineligible",
      reason: "refund_attempt_missing_or_not_succeeded",
      createdCount: 0,
      transferIds: [],
    };
  }

  const eligibility = await evaluateTransferReversalEligibilityForRefundAttempt(attempt);
  if (!eligibility.eligible) {
    return {
      refundAttemptId,
      outcome: "skipped_ineligible",
      reason: eligibility.reason,
      createdCount: 0,
      transferIds: [],
    };
  }

  const payments = await prisma.payment.findMany({
    where: { orderId: attempt.orderId },
    select: { id: true },
  });
  if (payments.length === 0) {
    return {
      refundAttemptId,
      outcome: "skipped_no_paid_transfers",
      reason: "no_payments_for_order",
      createdCount: 0,
      transferIds: [],
    };
  }

  const allocationWhere: Prisma.PaymentAllocationWhereInput = {
    paymentId: { in: payments.map((p) => p.id) },
    ...(eligibility.scope === "vendor_order"
      ? { vendorOrderId: eligibility.vendorOrderId }
      : {}),
  };

  const allocations = await prisma.paymentAllocation.findMany({
    where: allocationWhere,
    select: {
      id: true,
      vendorOrderId: true,
      payoutTransfer: {
        select: {
          id: true,
          vendorId: true,
          vendorOrderId: true,
          amountCents: true,
          status: true,
          stripeTransferId: true,
          currency: true,
        },
      },
    },
  });

  const toCreate: Array<{
    vpt: NonNullable<(typeof allocations)[number]["payoutTransfer"]>;
    orderId: string;
    reversalAmountCents: number;
  }> = [];
  for (const a of allocations) {
    const vpt = a.payoutTransfer;
    if (!vpt) continue;
    const reversalAmountCents = getVendorTransferReversalAmountCents(vpt);
    if (reversalAmountCents <= 0 || !vpt.stripeTransferId?.trim()) {
      continue;
    }
    toCreate.push({ vpt, orderId: attempt.orderId, reversalAmountCents });
  }

  if (toCreate.length === 0) {
    return {
      refundAttemptId,
      outcome: "skipped_no_paid_transfers",
      reason: "no_paid_stripe_transfers_for_scope",
      createdCount: 0,
      transferIds: [],
    };
  }

  const transferIds: string[] = [];
  let createdCount = 0;
  for (const { vpt, orderId, reversalAmountCents } of toCreate) {
    const existingRow = await prisma.vendorPayoutTransferReversal.findUnique({
      where: {
        refundAttemptId_vendorPayoutTransferId: {
          refundAttemptId,
          vendorPayoutTransferId: vpt.id,
        },
      },
    });
    if (existingRow) {
      transferIds.push(vpt.id);
      continue;
    }

    const idempotencyKey = stableTransferReversalIdempotencyKey(refundAttemptId, vpt.id);
    try {
      await prisma.vendorPayoutTransferReversal.create({
        data: {
          vendorPayoutTransferId: vpt.id,
          vendorOrderId: vpt.vendorOrderId,
          orderId,
          refundAttemptId,
          vendorId: vpt.vendorId,
          amountCents: reversalAmountCents,
          currency: vpt.currency ?? "usd",
          status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending,
          idempotencyKey,
        },
      });
      createdCount++;
      transferIds.push(vpt.id);
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
      if (code === "P2002") {
        transferIds.push(vpt.id);
        continue;
      }
      throw e;
    }
  }

  if (createdCount === 0 && toCreate.length > 0) {
    return {
      refundAttemptId,
      outcome: "idempotent_noop",
      reason: "all_transfers_already_had_reversal_rows",
      createdCount: 0,
      transferIds,
    };
  }

  return {
    refundAttemptId,
    outcome: "created_pending",
    createdCount,
    transferIds,
  };
}

export type ExecuteTransferReversalResult =
  | { outcome: "reversed"; stripeTransferReversalId: string }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; message: string };

/**
 * Executes one pending reversal via Stripe (idempotent key on row). Does not throw.
 */
export async function executeVendorPayoutTransferReversal(
  reversalId: string,
  opts?: { batchKey?: string }
): Promise<ExecuteTransferReversalResult> {
  if (!env.STRIPE_SECRET_KEY || !stripe) {
    return { outcome: "failed", message: "Stripe is not configured." };
  }

  const row = await prisma.vendorPayoutTransferReversal.findUnique({
    where: { id: reversalId },
    include: {
      vendorPayoutTransfer: { select: { stripeTransferId: true, status: true, amountCents: true } },
    },
  });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (row.status === VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.reversed && row.stripeTransferReversalId) {
    return { outcome: "skipped", reason: "already_reversed" };
  }
  if (row.status === VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.failed) {
    return { outcome: "skipped", reason: "already_failed" };
  }
  if (row.status === VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.not_needed) {
    return { outcome: "skipped", reason: "not_needed" };
  }
  if (row.status !== VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending) {
    return { outcome: "skipped", reason: `status_${row.status}` };
  }

  const trId = row.vendorPayoutTransfer.stripeTransferId?.trim();
  if (!trId) {
    await prisma.vendorPayoutTransferReversal.update({
      where: { id: reversalId },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.failed,
        failureMessage: "missing_stripe_transfer_id_on_parent",
        failedAt: new Date(),
      },
    });
    return { outcome: "failed", message: "Parent transfer has no stripeTransferId." };
  }

  if (row.amountCents <= 0) {
    await prisma.vendorPayoutTransferReversal.update({
      where: { id: reversalId },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.not_needed,
        failureMessage: null,
        updatedAt: new Date(),
      },
    });
    return { outcome: "skipped", reason: "zero_amount" };
  }

  await prisma.vendorPayoutTransferReversal.update({
    where: { id: reversalId },
    data: { status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.submitted },
  });

  try {
    const reversal = await stripe.transfers.createReversal(
      trId,
      { amount: row.amountCents },
      { idempotencyKey: row.idempotencyKey }
    );

    await prisma.vendorPayoutTransferReversal.update({
      where: { id: reversalId },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.reversed,
        stripeTransferReversalId: reversal.id,
        submittedAt: new Date(),
        failureMessage: null,
        ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
      },
    });
    return { outcome: "reversed", stripeTransferReversalId: reversal.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.vendorPayoutTransferReversal.update({
      where: { id: reversalId },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.failed,
        failureMessage: message.slice(0, 2000),
        failedAt: new Date(),
      },
    });
    return { outcome: "failed", message };
  }
}

/**
 * Admin retry: failed → pending (clear error), then runs Stripe reversal again.
 */
export async function retryFailedVendorPayoutTransferReversal(
  reversalId: string,
  opts?: { batchKey?: string }
): Promise<ExecuteTransferReversalResult> {
  const row = await prisma.vendorPayoutTransferReversal.findUnique({ where: { id: reversalId } });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (
    row.status === VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.reversed &&
    row.stripeTransferReversalId?.trim()
  ) {
    return { outcome: "skipped", reason: "already_reversed" };
  }
  if (row.status !== VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.failed) {
    return { outcome: "skipped", reason: `not_failed_status_${row.status}` };
  }
  await prisma.vendorPayoutTransferReversal.update({
    where: { id: reversalId },
    data: {
      status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending,
      failureMessage: null,
      failedAt: null,
    },
  });
  return executeVendorPayoutTransferReversal(reversalId, opts);
}

export type TransferReversalBatchSummary = {
  batchKey: string;
  examined: number;
  reversed: number;
  skipped: number;
  failed: number;
  failures: Array<{ reversalId: string; message: string }>;
};

export async function runPendingTransferReversalBatch(params?: {
  batchKey?: string;
}): Promise<TransferReversalBatchSummary> {
  const batchKey = params?.batchKey ?? new Date().toISOString().slice(0, 10);

  const pending = await prisma.vendorPayoutTransferReversal.findMany({
    where: { status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending },
    orderBy: { createdAt: "asc" },
  });

  const summary: TransferReversalBatchSummary = {
    batchKey,
    examined: pending.length,
    reversed: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const row of pending) {
    const r = await executeVendorPayoutTransferReversal(row.id, { batchKey });
    if (r.outcome === "reversed") {
      summary.reversed++;
    } else if (r.outcome === "skipped") {
      summary.skipped++;
    } else {
      summary.failed++;
      summary.failures.push({ reversalId: row.id, message: r.message });
    }
  }

  return summary;
}
