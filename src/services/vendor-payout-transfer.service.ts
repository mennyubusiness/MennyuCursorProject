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
  INSUFFICIENT_BALANCE_BLOCKED_REASON,
  INSUFFICIENT_BALANCE_DISPLAY,
  INSUFFICIENT_BALANCE_STATUS,
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

export const VENDOR_PAYOUT_TRANSFER_STATUS = {
  pending: "pending",
  blocked: "blocked",
  blockedInsufficientBalance: INSUFFICIENT_BALANCE_STATUS,
  submitted: "submitted",
  paid: "paid",
  failed: "failed",
} as const;

export const BLOCKED_DESTINATION_SENTINEL = "blocked";

/** Shown when Stripe balance cannot be fetched — no transfer attempts are made. */
export const BALANCE_UNAVAILABLE_ADMIN_MESSAGE =
  "Unable to verify Stripe available balance. Payout transfers were not attempted. Refresh balance and try again.";

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
  | { outcome: "blocked_balance_unavailable"; message: string }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; message: string };

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
    include: { vendorOrder: { select: { orderId: true } } },
  });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
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

  try {
    const tr = await stripe.transfers.create(
      {
        amount: row.amountCents,
        currency: row.currency,
        destination: row.destinationAccountId,
        transfer_group: buildVendorPayoutTransferGroup(row.vendorOrder.orderId),
        metadata: buildVendorPayoutTransferStripeMetadata({
          id: row.id,
          paymentAllocationId: row.paymentAllocationId,
          vendorOrderId: row.vendorOrderId,
          vendorId: row.vendorId,
          orderId: row.vendorOrder.orderId,
        }),
      },
      { idempotencyKey: row.idempotencyKey }
    );

    consumeTrackedBalance(tracker, row.amountCents);

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
  if (row.status === VENDOR_PAYOUT_TRANSFER_STATUS.paid && row.stripeTransferId) {
    return { outcome: "skipped", reason: "already_paid" };
  }
  if (row.stripeTransferId?.trim() && row.status !== VENDOR_PAYOUT_TRANSFER_STATUS.paid) {
    return { outcome: "skipped", reason: "inconsistent_stripe_transfer_id" };
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

export type PayoutTransferBatchSummary = {
  batchKey: string;
  examined: number;
  /** New Stripe transfers created (or zero-amount settled without API). */
  settled: number;
  skipped: number;
  failed: number;
  blockedInsufficientBalance: number;
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
  if (r.outcome === "paid") {
    summary.settled++;
  } else if (r.outcome === "skipped" || r.outcome === "blocked_balance_unavailable") {
    summary.skipped++;
  } else if (r.outcome === "blocked_insufficient_balance") {
    summary.blockedInsufficientBalance++;
    summary.failures.push({ transferId, message: r.message });
  } else {
    summary.failed++;
    summary.failures.push({ transferId, message: r.message });
  }
}

function emptyBatchSummary(batchKey: string): PayoutTransferBatchSummary {
  return {
    batchKey,
    examined: 0,
    settled: 0,
    skipped: 0,
    failed: 0,
    blockedInsufficientBalance: 0,
    failures: [],
  };
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
 * Retry all failed or blocked-insufficient-balance transfers with one balance fetch (safe/idempotent).
 */
export async function retryAllEligibleFailedVendorPayoutTransfers(params?: {
  batchKey?: string;
}): Promise<PayoutTransferBatchRunResult> {
  const batchKey = params?.batchKey ?? `retry-${new Date().toISOString().slice(0, 10)}`;

  const rows = await prisma.vendorPayoutTransfer.findMany({
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
    orderBy: { createdAt: "asc" },
  });

  const summary = emptyBatchSummary(batchKey);
  summary.examined = rows.length;

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
    const r = await retryFailedVendorPayoutTransfer(row.id, { batchKey, balanceTracker: tracker });
    summarizeExecuteResult(row.id, r, summary);
  }

  return { ok: true, summary };
}

export type { StripePlatformBalanceSnapshot };
