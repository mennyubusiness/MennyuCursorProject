/**
 * Stripe Connect transfer execution: prepare rows from PaymentAllocation, execute transfers idempotently.
 * Does not change payment allocation math — reads netVendorTransferCents only.
 */
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  isCancelledDueToRefundTransfer,
  isPartialRefundManualReviewTransfer,
  isVendorTransferExecutionBlockedByRefund,
} from "@/lib/vendor-payout-transfer-refund-eligibility";
import {
  IDEMPOTENCY_MISMATCH_BLOCKED_REASON,
  IDEMPOTENCY_MISMATCH_DISPLAY,
  IDEMPOTENCY_MISMATCH_STATUS,
  INSUFFICIENT_BALANCE_BLOCKED_REASON,
  INSUFFICIENT_BALANCE_DISPLAY,
  INSUFFICIENT_BALANCE_STATUS,
  isIdempotencyMismatchMessage,
  isIdempotencyMismatchTransfer,
  isStripeIdempotencyParameterMismatchError,
  isStripeInsufficientFundsError,
} from "@/lib/vendor-payout-transfer-failure";
import {
  buildVendorPayoutTransferGroup,
  buildVendorPayoutTransferStripeMetadata,
} from "@/lib/vendor-payout-transfer-stripe-metadata";
import {
  fetchStripePlatformBalance,
  type StripePlatformBalanceSnapshot,
} from "@/services/stripe-balance.service";
import { resolvePaymentStripeChargeId } from "@/services/stripe-payment-charge-details.service";

export const VENDOR_PAYOUT_TRANSFER_STATUS = {
  pending: "pending",
  blocked: "blocked",
  blockedInsufficientBalance: INSUFFICIENT_BALANCE_STATUS,
  blockedIdempotencyMismatch: IDEMPOTENCY_MISMATCH_STATUS,
  blockedPartialRefundReview: "blocked_partial_refund_review",
  cancelledDueToRefund: "cancelled_due_to_refund",
  submitted: "submitted",
  paid: "paid",
  failed: "failed",
} as const;

export const BLOCKED_DESTINATION_SENTINEL = "blocked";

/** Shown when Stripe balance cannot be fetched — no transfer attempts are made. */
export const BALANCE_UNAVAILABLE_ADMIN_MESSAGE =
  "Unable to verify Stripe available balance. Vendor Connect transfers were not attempted. Refresh balance and try again.";

type VendorStripeFields = {
  stripeConnectedAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
};

export function isVendorConnectPayoutReady(v: VendorStripeFields): boolean {
  return Boolean(
    v.stripeConnectedAccountId?.trim() && v.stripeChargesEnabled && v.stripePayoutsEnabled
  );
}

export function blockedReasonForVendor(v: VendorStripeFields): string {
  if (!v.stripeConnectedAccountId?.trim()) return "stripe_connect_account_missing";
  if (!v.stripeChargesEnabled) return "stripe_charges_not_enabled";
  if (!v.stripePayoutsEnabled) return "stripe_payouts_not_enabled";
  return "stripe_connect_incomplete";
}

function stableIdempotencyKey(paymentAllocationId: string): string {
  return `mennyu_vpt_${paymentAllocationId}`;
}

/** Rotate idempotency key after reconciliation finds no matching Stripe transfer. */
export function buildRotatedIdempotencyKey(
  paymentAllocationId: string,
  currentKey: string
): string {
  const base = stableIdempotencyKey(paymentAllocationId);
  const retryMatch = currentKey.match(/_r(\d+)$/);
  if (retryMatch) {
    return `${base}_r${parseInt(retryMatch[1]!, 10) + 1}`;
  }
  if (currentKey === base) {
    return `${base}_r1`;
  }
  return `${base}_r${Date.now()}`;
}

type VendorPayoutTransferStripeRow = {
  id: string;
  paymentAllocationId: string;
  paymentId: string;
  vendorOrderId: string;
  vendorId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  destinationAccountId: string;
  stripeChargeId: string | null;
};

export function buildStripeTransferCreateParams(row: VendorPayoutTransferStripeRow) {
  const params: {
    amount: number;
    currency: string;
    destination: string;
    transfer_group: string;
    metadata: Record<string, string>;
    source_transaction?: string;
  } = {
    amount: row.amountCents,
    currency: row.currency,
    destination: row.destinationAccountId,
    transfer_group: buildVendorPayoutTransferGroup(row.orderId),
    metadata: buildVendorPayoutTransferStripeMetadata({
      id: row.id,
      paymentAllocationId: row.paymentAllocationId,
      paymentId: row.paymentId,
      vendorOrderId: row.vendorOrderId,
      vendorId: row.vendorId,
      orderId: row.orderId,
    }),
  };
  const chargeId = row.stripeChargeId?.trim();
  if (chargeId) {
    params.source_transaction = chargeId;
  }
  return params;
}

const vendorPayoutTransferExecuteInclude = {
  vendorOrder: { select: { orderId: true } },
  paymentAllocation: {
    select: {
      id: true,
      paymentId: true,
      payment: {
        select: {
          stripeChargeId: true,
          stripePaymentIntentId: true,
        },
      },
    },
  },
} as const;

type AllocationWithVendor = Prisma.PaymentAllocationGetPayload<{
  include: { vendorOrder: { include: { vendor: true } } };
}>;

async function createRowForAllocation(
  tx: Prisma.TransactionClient,
  alloc: AllocationWithVendor
): Promise<void> {
  const existing = await tx.vendorPayoutTransfer.findUnique({
    where: { paymentAllocationId: alloc.id },
  });
  if (existing) return;

  const v = alloc.vendorOrder.vendor;
  const ready = isVendorConnectPayoutReady(v);
  const destination = ready ? v.stripeConnectedAccountId!.trim() : BLOCKED_DESTINATION_SENTINEL;
  const status = ready ? VENDOR_PAYOUT_TRANSFER_STATUS.pending : VENDOR_PAYOUT_TRANSFER_STATUS.blocked;
  const blockedReason = ready ? null : blockedReasonForVendor(v);

  await tx.vendorPayoutTransfer.create({
    data: {
      paymentAllocationId: alloc.id,
      vendorId: alloc.vendorOrder.vendorId,
      vendorOrderId: alloc.vendorOrderId,
      destinationAccountId: destination,
      amountCents: alloc.netVendorTransferCents,
      currency: "usd",
      status,
      blockedReason,
      idempotencyKey: stableIdempotencyKey(alloc.id),
    },
  });
}

/**
 * Idempotent: creates VendorPayoutTransfer rows for each allocation of this payment (skips existing).
 * Call inside the same DB transaction as payment creation, or after payment exists (repair).
 */
export async function ensureVendorPayoutTransferRecordsForPaymentInTx(
  tx: Prisma.TransactionClient,
  paymentId: string
): Promise<void> {
  const allocations = await tx.paymentAllocation.findMany({
    where: { paymentId },
    include: { vendorOrder: { include: { vendor: true } } },
  });
  for (const alloc of allocations) {
    await createRowForAllocation(tx, alloc);
  }
}

export async function ensureVendorPayoutTransferRecordsForPayment(paymentId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await ensureVendorPayoutTransferRecordsForPaymentInTx(tx, paymentId);
  });
}

export type ExecuteStripeTransferResult =
  | { outcome: "paid"; stripeTransferId: string }
  | { outcome: "blocked_insufficient_balance"; message: string }
  | { outcome: "blocked_idempotency_mismatch"; message: string }
  | { outcome: "blocked_balance_unavailable"; message: string }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; message: string }
  | { outcome: "reconciled_paid"; stripeTransferId: string };

type ExecuteOpts = {
  batchKey?: string;
  /** When set (batch/retry-all), avoids refetching Stripe balance per row. */
  balanceTracker?: BalanceTracker;
};

type BalanceTracker = {
  currency: string;
  remainingAvailableCents: number;
};

type BalanceTrackerResolveResult =
  | { ok: true; tracker: BalanceTracker }
  | { ok: false; error: string };

async function resolveBalanceTracker(
  currency: string,
  opts?: ExecuteOpts
): Promise<BalanceTrackerResolveResult> {
  if (opts?.balanceTracker) {
    return { ok: true, tracker: opts.balanceTracker };
  }
  const result = await fetchStripePlatformBalance(currency);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    tracker: {
      currency: result.balance.currency,
      remainingAvailableCents: result.balance.availableCents,
    },
  };
}

function hasSufficientTrackedBalance(tracker: BalanceTracker, amountCents: number): boolean {
  return amountCents <= tracker.remainingAvailableCents;
}

function consumeTrackedBalance(tracker: BalanceTracker | undefined, amountCents: number): void {
  if (!tracker || amountCents <= 0) return;
  tracker.remainingAvailableCents = Math.max(0, tracker.remainingAvailableCents - amountCents);
}

async function markBlockedIdempotencyMismatch(
  transferId: string,
  rawMessage: string,
  opts?: ExecuteOpts
): Promise<void> {
  await prisma.vendorPayoutTransfer.update({
    where: { id: transferId },
    data: {
      status: VENDOR_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch,
      blockedReason: IDEMPOTENCY_MISMATCH_BLOCKED_REASON,
      failureMessage: rawMessage.slice(0, 2000),
      failedAt: new Date(),
      ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
    },
  });
}

async function markBlockedInsufficientBalance(
  transferId: string,
  message: string,
  opts?: ExecuteOpts
): Promise<void> {
  await prisma.vendorPayoutTransfer.update({
    where: { id: transferId },
    data: {
      status: VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
      blockedReason: INSUFFICIENT_BALANCE_BLOCKED_REASON,
      failureMessage: message.slice(0, 2000),
      failedAt: new Date(),
      ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
    },
  });
}

function stripeErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Check Stripe for an existing matching transfer before creating a new one. */
async function reconcileBeforeSendIfNeeded(
  transferId: string
): Promise<ExecuteStripeTransferResult | null> {
  const { reconcileVendorPayoutTransfer } = await import(
    "./vendor-payout-transfer-reconciliation.service"
  );
  const reconcile = await reconcileVendorPayoutTransfer(transferId);
  if (reconcile.outcome === "updated_paid" || reconcile.outcome === "already_paid") {
    return {
      outcome: "reconciled_paid",
      stripeTransferId: reconcile.stripeTransferId ?? "",
    };
  }
  return null;
}

const ELIGIBLE_RETRY_TRANSFER_STATUSES = [
  VENDOR_PAYOUT_TRANSFER_STATUS.pending,
  VENDOR_PAYOUT_TRANSFER_STATUS.failed,
  VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
] as const;

function eligibleRetryTransferWhere(take?: number) {
  return {
    where: {
      destinationAccountId: { not: BLOCKED_DESTINATION_SENTINEL },
      OR: [{ stripeTransferId: null }, { stripeTransferId: "" }],
      status: { in: [...ELIGIBLE_RETRY_TRANSFER_STATUSES] },
    },
    orderBy: { createdAt: "asc" as const },
    ...(take != null ? { take } : {}),
  };
}

/**
 * Executes one pending transfer: idempotent via Stripe idempotency key; skips blocked/non-positive safely.
 */
export async function executeVendorPayoutTransfer(
  transferId: string,
  opts?: ExecuteOpts
): Promise<ExecuteStripeTransferResult> {
  if (!env.STRIPE_SECRET_KEY || !stripe) {
    return { outcome: "failed", message: "Stripe is not configured." };
  }

  const row = await prisma.vendorPayoutTransfer.findUnique({
    where: { id: transferId },
    include: vendorPayoutTransferExecuteInclude,
  });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (isVendorTransferExecutionBlockedByRefund(row)) {
    return {
      outcome: "skipped",
      reason: isCancelledDueToRefundTransfer(row)
        ? "cancelled_due_to_refund"
        : isPartialRefundManualReviewTransfer(row)
          ? "blocked_partial_refund_review"
          : "not_payable",
    };
  }
  if (row.status === VENDOR_PAYOUT_TRANSFER_STATUS.paid && row.stripeTransferId) {
    return { outcome: "skipped", reason: "already_paid" };
  }
  if (row.stripeTransferId?.trim() && row.status !== VENDOR_PAYOUT_TRANSFER_STATUS.paid) {
    return { outcome: "skipped", reason: "inconsistent_stripe_transfer_id" };
  }
  if (
    row.status === VENDOR_PAYOUT_TRANSFER_STATUS.blocked ||
    row.destinationAccountId === BLOCKED_DESTINATION_SENTINEL
  ) {
    return { outcome: "skipped", reason: "blocked" };
  }
  if (row.status !== VENDOR_PAYOUT_TRANSFER_STATUS.pending) {
    return { outcome: "skipped", reason: `status_${row.status}` };
  }
  if (row.amountCents <= 0) {
    await prisma.vendorPayoutTransfer.update({
      where: { id: transferId },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
        submittedAt: new Date(),
        ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
      },
    });
    return { outcome: "paid", stripeTransferId: "" };
  }

  const reconciledEarly = await reconcileBeforeSendIfNeeded(transferId);
  if (reconciledEarly) {
    if (opts?.batchKey) {
      await prisma.vendorPayoutTransfer.update({
        where: { id: transferId },
        data: { batchKey: opts.batchKey },
      });
    }
    return reconciledEarly;
  }

  let stripeChargeId = row.paymentAllocation.payment.stripeChargeId?.trim() ?? null;
  if (!stripeChargeId) {
    stripeChargeId = await resolvePaymentStripeChargeId(row.paymentAllocation.paymentId);
  }
  const usesSourceTransaction = Boolean(stripeChargeId);

  if (!usesSourceTransaction) {
    const balanceResolved = await resolveBalanceTracker(row.currency, opts);
    if (!balanceResolved.ok) {
      return {
        outcome: "blocked_balance_unavailable",
        message: BALANCE_UNAVAILABLE_ADMIN_MESSAGE,
      };
    }
    const tracker = balanceResolved.tracker;
    if (!hasSufficientTrackedBalance(tracker, row.amountCents)) {
      await markBlockedInsufficientBalance(transferId, INSUFFICIENT_BALANCE_DISPLAY, opts);
      return { outcome: "blocked_insufficient_balance", message: INSUFFICIENT_BALANCE_DISPLAY };
    }
  }

  const balanceTrackerForConsume = opts?.balanceTracker;

  try {
    const tr = await stripe.transfers.create(
      buildStripeTransferCreateParams({
        id: row.id,
        paymentAllocationId: row.paymentAllocationId,
        paymentId: row.paymentAllocation.paymentId,
        vendorOrderId: row.vendorOrderId,
        vendorId: row.vendorId,
        orderId: row.vendorOrder.orderId,
        amountCents: row.amountCents,
        currency: row.currency,
        destinationAccountId: row.destinationAccountId,
        stripeChargeId,
      }),
      { idempotencyKey: row.idempotencyKey }
    );

    if (!usesSourceTransaction && balanceTrackerForConsume) {
      consumeTrackedBalance(balanceTrackerForConsume, row.amountCents);
    }

    await prisma.vendorPayoutTransfer.update({
      where: { id: transferId },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
        stripeTransferId: tr.id,
        submittedAt: new Date(),
        blockedReason: null,
        failureMessage: null,
        failedAt: null,
        ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
      },
    });
    return { outcome: "paid", stripeTransferId: tr.id };
  } catch (e) {
    const message = stripeErrorMessage(e);
    if (isStripeIdempotencyParameterMismatchError(e)) {
      await markBlockedIdempotencyMismatch(transferId, message, opts);
      return { outcome: "blocked_idempotency_mismatch", message: IDEMPOTENCY_MISMATCH_DISPLAY };
    }
    if (isStripeInsufficientFundsError(e)) {
      await markBlockedInsufficientBalance(transferId, message, opts);
      return { outcome: "blocked_insufficient_balance", message };
    }
    await prisma.vendorPayoutTransfer.update({
      where: { id: transferId },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
        failureMessage: message.slice(0, 2000),
        failedAt: new Date(),
      },
    });
    return { outcome: "failed", message };
  }
}

/**
 * Admin retry: failed/blocked insufficient balance → pending (clear error), then runs Stripe transfer again.
 * Blocked Connect rows cannot be retried here.
 */
export async function retryFailedVendorPayoutTransfer(
  transferId: string,
  opts?: ExecuteOpts
): Promise<ExecuteStripeTransferResult> {
  const row = await prisma.vendorPayoutTransfer.findUnique({ where: { id: transferId } });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (isVendorTransferExecutionBlockedByRefund(row)) {
    return {
      outcome: "skipped",
      reason: isCancelledDueToRefundTransfer(row)
        ? "cancelled_due_to_refund"
        : "blocked_partial_refund_review",
    };
  }
  if (row.status === VENDOR_PAYOUT_TRANSFER_STATUS.paid && row.stripeTransferId) {
    return { outcome: "skipped", reason: "already_paid" };
  }
  if (row.stripeTransferId?.trim() && row.status !== VENDOR_PAYOUT_TRANSFER_STATUS.paid) {
    return { outcome: "skipped", reason: "inconsistent_stripe_transfer_id" };
  }
  if (
    isIdempotencyMismatchTransfer(row) ||
    isIdempotencyMismatchMessage(row.failureMessage)
  ) {
    if (row.status !== VENDOR_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch) {
      await markBlockedIdempotencyMismatch(
        transferId,
        row.failureMessage ?? IDEMPOTENCY_MISMATCH_DISPLAY
      );
    }
    return { outcome: "blocked_idempotency_mismatch", message: IDEMPOTENCY_MISMATCH_DISPLAY };
  }
  const retryable =
    row.status === VENDOR_PAYOUT_TRANSFER_STATUS.failed ||
    row.status === VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance;
  if (!retryable) {
    return { outcome: "skipped", reason: `not_retryable_status_${row.status}` };
  }
  if (row.destinationAccountId === BLOCKED_DESTINATION_SENTINEL) {
    return { outcome: "skipped", reason: "blocked_destination" };
  }

  const reconciledEarly = await reconcileBeforeSendIfNeeded(transferId);
  if (reconciledEarly) {
    if (opts?.batchKey) {
      await prisma.vendorPayoutTransfer.update({
        where: { id: transferId },
        data: { batchKey: opts.batchKey },
      });
    }
    return reconciledEarly;
  }

  let executeOpts = opts;
  if (row.amountCents > 0 && !opts?.balanceTracker) {
    const balanceResolved = await resolveBalanceTracker(row.currency, opts);
    if (!balanceResolved.ok) {
      return {
        outcome: "blocked_balance_unavailable",
        message: BALANCE_UNAVAILABLE_ADMIN_MESSAGE,
      };
    }
    executeOpts = { ...opts, balanceTracker: balanceResolved.tracker };
  }

  await prisma.vendorPayoutTransfer.update({
    where: { id: transferId },
    data: {
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      failureMessage: null,
      failedAt: null,
      blockedReason: null,
    },
  });
  return executeVendorPayoutTransfer(transferId, executeOpts);
}

/**
 * Reconcile first; if no matching Stripe transfer, rotate idempotency key and retry once.
 * Admin-only — requires prior reconciliation no_match (enforced here by re-running reconcile).
 */
export async function retryVendorPayoutTransferWithNewKey(
  transferId: string,
  opts?: ExecuteOpts
): Promise<ExecuteStripeTransferResult> {
  const row = await prisma.vendorPayoutTransfer.findUnique({ where: { id: transferId } });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (isVendorTransferExecutionBlockedByRefund(row)) {
    return { outcome: "skipped", reason: "cancelled_or_blocked_by_refund" };
  }
  if (row.status === VENDOR_PAYOUT_TRANSFER_STATUS.paid && row.stripeTransferId) {
    return { outcome: "skipped", reason: "already_paid" };
  }
  if (row.stripeTransferId?.trim()) {
    return { outcome: "skipped", reason: "inconsistent_stripe_transfer_id" };
  }
  if (!isIdempotencyMismatchTransfer(row)) {
    return { outcome: "skipped", reason: "not_idempotency_mismatch" };
  }
  if (row.destinationAccountId === BLOCKED_DESTINATION_SENTINEL) {
    return { outcome: "skipped", reason: "blocked_destination" };
  }

  const { reconcileVendorPayoutTransfer } = await import(
    "./vendor-payout-transfer-reconciliation.service"
  );
  const reconcile = await reconcileVendorPayoutTransfer(transferId);
  if (
    reconcile.outcome === "updated_paid" ||
    reconcile.outcome === "already_paid"
  ) {
    return {
      outcome: "reconciled_paid",
      stripeTransferId: reconcile.stripeTransferId ?? "",
    };
  }
  if (
    reconcile.outcome === "unchanged_ambiguous" ||
    reconcile.outcome === "mismatch"
  ) {
    return {
      outcome: "skipped",
      reason: `reconciliation_${reconcile.outcome}`,
    };
  }
  if (reconcile.outcome !== "unchanged_not_found") {
    return { outcome: "skipped", reason: `reconciliation_${reconcile.outcome}` };
  }

  let executeOpts = opts;
  if (row.amountCents > 0 && !opts?.balanceTracker) {
    const balanceResolved = await resolveBalanceTracker(row.currency, opts);
    if (!balanceResolved.ok) {
      return {
        outcome: "blocked_balance_unavailable",
        message: BALANCE_UNAVAILABLE_ADMIN_MESSAGE,
      };
    }
    executeOpts = { ...opts, balanceTracker: balanceResolved.tracker };
  }

  const newKey = buildRotatedIdempotencyKey(row.paymentAllocationId, row.idempotencyKey);
  const rotationNote = `Idempotency key rotated from ${row.idempotencyKey} to ${newKey} after reconciliation found no matching Stripe Connect transfer.`;

  await prisma.vendorPayoutTransfer.update({
    where: { id: transferId },
    data: {
      idempotencyKey: newKey,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      blockedReason: null,
      failureMessage: rotationNote.slice(0, 2000),
      failedAt: null,
    },
  });

  return executeVendorPayoutTransfer(transferId, executeOpts);
}

export type PayoutTransferBatchSummary = {
  batchKey: string;
  examined: number;
  /** Transfers settled (updated from Stripe + newly sent). */
  settled: number;
  updatedFromStripe: number;
  retried: number;
  skipped: number;
  failed: number;
  blockedInsufficientBalance: number;
  stillBlocked: number;
  failures: Array<{ transferId: string; message: string }>;
};

export type PayoutTransferBatchRunResult =
  | { ok: true; summary: PayoutTransferBatchSummary }
  | {
      ok: false;
      code: "balance_unavailable";
      error: string;
      balanceError: string;
      summary: PayoutTransferBatchSummary;
    };

function summarizeExecuteResult(
  transferId: string,
  r: ExecuteStripeTransferResult,
  summary: PayoutTransferBatchSummary
): void {
  if (r.outcome === "reconciled_paid") {
    summary.settled++;
    summary.updatedFromStripe++;
  } else if (r.outcome === "paid") {
    summary.settled++;
    summary.retried++;
  } else if (r.outcome === "skipped" || r.outcome === "blocked_balance_unavailable") {
    summary.skipped++;
  } else if (r.outcome === "blocked_insufficient_balance") {
    summary.blockedInsufficientBalance++;
    summary.stillBlocked++;
    summary.failures.push({ transferId, message: r.message });
  } else if (r.outcome === "blocked_idempotency_mismatch") {
    summary.failed++;
    summary.stillBlocked++;
    summary.failures.push({ transferId, message: r.message });
  } else if (r.outcome === "failed") {
    summary.failed++;
    summary.failures.push({ transferId, message: r.message });
  }
}

function emptyBatchSummary(batchKey: string): PayoutTransferBatchSummary {
  return {
    batchKey,
    examined: 0,
    settled: 0,
    updatedFromStripe: 0,
    retried: 0,
    skipped: 0,
    failed: 0,
    blockedInsufficientBalance: 0,
    stillBlocked: 0,
    failures: [],
  };
}

async function runEligibleVendorPayoutTransferRetries(params: {
  batchKey: string;
  take?: number;
}): Promise<PayoutTransferBatchRunResult> {
  const rows = await prisma.vendorPayoutTransfer.findMany(eligibleRetryTransferWhere(params.take));

  const summary = emptyBatchSummary(params.batchKey);
  summary.examined = rows.length;

  if (rows.length === 0) {
    return { ok: true, summary };
  }

  const balanceResult = await fetchStripePlatformBalance("usd");
  if (!balanceResult.ok) {
    return {
      ok: false,
      code: "balance_unavailable",
      error: BALANCE_UNAVAILABLE_ADMIN_MESSAGE,
      balanceError: balanceResult.error,
      summary,
    };
  }

  const tracker: BalanceTracker = {
    currency: balanceResult.balance.currency,
    remainingAvailableCents: balanceResult.balance.availableCents,
  };

  for (const row of rows) {
    const r =
      row.status === VENDOR_PAYOUT_TRANSFER_STATUS.pending
        ? await executeVendorPayoutTransfer(row.id, { batchKey: params.batchKey, balanceTracker: tracker })
        : await retryFailedVendorPayoutTransfer(row.id, { batchKey: params.batchKey, balanceTracker: tracker });
    summarizeExecuteResult(row.id, r, summary);
  }

  return { ok: true, summary };
}

/**
 * Processes pending transfers (optionally filtered by batchKey for future use). Continues past failures.
 * Uses one Stripe balance fetch and stops blocking individual rows when available balance is exhausted.
 */
export async function runManualVendorPayoutTransferBatch(params?: {
  batchKey?: string;
}): Promise<PayoutTransferBatchRunResult> {
  const batchKey = params?.batchKey ?? new Date().toISOString().slice(0, 10);

  const pending = await prisma.vendorPayoutTransfer.findMany({
    where: {
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      destinationAccountId: { not: BLOCKED_DESTINATION_SENTINEL },
    },
    orderBy: { createdAt: "asc" },
  });

  const summary = emptyBatchSummary(batchKey);
  summary.examined = pending.length;

  const balanceResult = await fetchStripePlatformBalance("usd");
  if (!balanceResult.ok) {
    return {
      ok: false,
      code: "balance_unavailable",
      error: BALANCE_UNAVAILABLE_ADMIN_MESSAGE,
      balanceError: balanceResult.error,
      summary,
    };
  }

  const tracker: BalanceTracker = {
    currency: balanceResult.balance.currency,
    remainingAvailableCents: balanceResult.balance.availableCents,
  };

  for (const row of pending) {
    const r = await executeVendorPayoutTransfer(row.id, { batchKey, balanceTracker: tracker });
    summarizeExecuteResult(row.id, r, summary);
  }

  return { ok: true, summary };
}

/**
 * Retry eligible transfers (pending/failed/blocked insufficient balance) with reconcile-before-send.
 */
export async function retryAllEligibleFailedVendorPayoutTransfers(params?: {
  batchKey?: string;
}): Promise<PayoutTransferBatchRunResult> {
  const batchKey = params?.batchKey ?? `retry-${new Date().toISOString().slice(0, 10)}`;
  return runEligibleVendorPayoutTransferRetries({ batchKey });
}

/** Cron-safe retry for pending/failed/retryable vendor transfers (excludes refund-blocked rows). */
export async function retryEligibleVendorPayoutTransfersJob(params?: {
  take?: number;
  batchKey?: string;
}): Promise<PayoutTransferBatchRunResult> {
  const batchKey = params?.batchKey ?? `retry-${new Date().toISOString().slice(0, 10)}`;
  return runEligibleVendorPayoutTransferRetries({ batchKey, take: params?.take ?? 100 });
}

export type AutoVendorPayoutTransferSummary = {
  examined: number;
  settled: number;
  skipped: number;
  failed: number;
  blockedInsufficientBalance: number;
};

/**
 * After payment success: ensure transfer rows exist and attempt Stripe Connect transfers.
 * Failures are logged but do not throw — post-payment flow must continue.
 */
export async function executeVendorPayoutTransfersForPayment(
  paymentId: string,
  opts?: { batchKey?: string }
): Promise<AutoVendorPayoutTransferSummary> {
  await ensureVendorPayoutTransferRecordsForPayment(paymentId);

  const rows = await prisma.vendorPayoutTransfer.findMany({
    where: {
      paymentAllocation: { paymentId },
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      destinationAccountId: { not: BLOCKED_DESTINATION_SENTINEL },
    },
    orderBy: { createdAt: "asc" },
  });

  const summary: AutoVendorPayoutTransferSummary = {
    examined: rows.length,
    settled: 0,
    skipped: 0,
    failed: 0,
    blockedInsufficientBalance: 0,
  };

  if (rows.length === 0) return summary;

  const balanceResult = await fetchStripePlatformBalance("usd");
  const tracker = balanceResult.ok
    ? {
        currency: balanceResult.balance.currency,
        remainingAvailableCents: balanceResult.balance.availableCents,
      }
    : undefined;

  const batchKey = opts?.batchKey ?? `auto-payment-${paymentId.slice(0, 8)}`;

  for (const row of rows) {
    const r = await executeVendorPayoutTransfer(row.id, { batchKey, balanceTracker: tracker });
    if (r.outcome === "paid" || r.outcome === "reconciled_paid") {
      summary.settled++;
    } else if (r.outcome === "skipped" || r.outcome === "blocked_balance_unavailable") {
      summary.skipped++;
    } else if (r.outcome === "blocked_insufficient_balance") {
      summary.blockedInsufficientBalance++;
    } else {
      summary.failed++;
    }
  }

  return summary;
}

export type VendorPayoutTransferGlobalSummary = {
  pendingCount: number;
  pendingAmountCents: number;
  retryableCount: number;
  retryableAmountCents: number;
  blockedReviewCount: number;
  vendorOwedAmountCents: number;
};

export async function getVendorPayoutTransferGlobalSummary(): Promise<VendorPayoutTransferGlobalSummary> {
  const [pendingRows, retryableRows, blockedReviewRows, owedRows] = await Promise.all([
    prisma.vendorPayoutTransfer.findMany({
      where: {
        status: { in: [VENDOR_PAYOUT_TRANSFER_STATUS.pending, VENDOR_PAYOUT_TRANSFER_STATUS.submitted] },
        destinationAccountId: { not: BLOCKED_DESTINATION_SENTINEL },
      },
      select: { amountCents: true },
    }),
    prisma.vendorPayoutTransfer.findMany({
      where: {
        status: {
          in: [
            VENDOR_PAYOUT_TRANSFER_STATUS.failed,
            VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
          ],
        },
        destinationAccountId: { not: BLOCKED_DESTINATION_SENTINEL },
        OR: [{ stripeTransferId: null }, { stripeTransferId: "" }],
      },
      select: { amountCents: true },
    }),
    prisma.vendorPayoutTransfer.findMany({
      where: {
        status: {
          in: [
            VENDOR_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
            VENDOR_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch,
          ],
        },
      },
      select: { amountCents: true },
    }),
    prisma.vendorPayoutTransfer.findMany({
      where: {
        status: {
          in: [
            VENDOR_PAYOUT_TRANSFER_STATUS.pending,
            VENDOR_PAYOUT_TRANSFER_STATUS.submitted,
            VENDOR_PAYOUT_TRANSFER_STATUS.failed,
            VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
          ],
        },
        destinationAccountId: { not: BLOCKED_DESTINATION_SENTINEL },
        OR: [{ stripeTransferId: null }, { stripeTransferId: "" }],
      },
      select: { amountCents: true },
    }),
  ]);

  const sum = (rows: { amountCents: number }[]) =>
    rows.reduce((total, row) => total + row.amountCents, 0);

  return {
    pendingCount: pendingRows.length,
    pendingAmountCents: sum(pendingRows),
    retryableCount: retryableRows.length,
    retryableAmountCents: sum(retryableRows),
    blockedReviewCount: blockedReviewRows.length,
    vendorOwedAmountCents: sum(owedRows),
  };
}

export type { StripePlatformBalanceSnapshot };
