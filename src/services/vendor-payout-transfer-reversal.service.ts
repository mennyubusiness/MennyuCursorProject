/**
 * Stripe Connect transfer reversals: prepare rows after platform refunds, execute reversals idempotently.
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
