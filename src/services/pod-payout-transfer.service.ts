/**
 * Stripe Connect transfer execution for pod payout allocations.
 * Transfer rows are created at admin batch time — not at allocation creation.
 */
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import {
  isPodPayoutCancelledDueToRefundTransfer,
  isPodPayoutPartialRefundReviewTransfer,
  isPodPayoutTransferExecutionBlockedByRefund,
  type PaymentRefundStatusForPodTransfer,
} from "@/lib/pod-payout-transfer-refund-eligibility";
import {
  POD_PAYOUT_TRANSFER_BLOCKED_REASON_LABELS,
  POD_PAYOUT_TRANSFER_STATUS_LABELS,
  POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION,
  POD_PAYOUT_TRANSFER_STATUS,
  stablePodPayoutTransferIdempotencyKey,
} from "@/lib/pod-payout-transfer-decision";
import {
  buildPodPayoutTransferGroup,
  buildPodPayoutTransferStripeMetadata,
} from "@/lib/pod-payout-transfer-stripe-metadata";
import {
  IDEMPOTENCY_MISMATCH_BLOCKED_REASON,
  IDEMPOTENCY_MISMATCH_DISPLAY,
  IDEMPOTENCY_MISMATCH_STATUS,
  INSUFFICIENT_BALANCE_BLOCKED_REASON,
  INSUFFICIENT_BALANCE_DISPLAY,
  isStripeIdempotencyParameterMismatchError,
  isStripeInsufficientFundsError,
} from "@/lib/vendor-payout-transfer-failure";
import {
  evaluatePodPayoutAllocationTransferEligibility,
  type PodPayoutTransferabilityReason,
} from "@/lib/pod-payout-transfer-eligibility";
import type { PaymentAllocationVendorGateRow } from "@/lib/pod-payout-vendor-transfer-gate";
import {
  fetchStripePlatformBalance,
  type StripePlatformBalanceSnapshot,
} from "@/services/stripe-balance.service";

export {
  POD_PAYOUT_TRANSFER_STATUS,
  stablePodPayoutTransferIdempotencyKey,
} from "@/lib/pod-payout-transfer-decision";

export const POD_PAYOUT_BALANCE_UNAVAILABLE_ADMIN_MESSAGE =
  "Unable to verify Stripe available balance. Pod payout transfers were not attempted. Refresh balance and try again.";

type BalanceTracker = {
  currency: string;
  remainingAvailableCents: number;
};

type PodPayoutTransferStripeRow = {
  id: string;
  podPayoutAllocationId: string;
  podId: string;
  amountCents: number;
  currency: string;
  destinationAccountId: string;
  podPayoutAllocation: {
    orderId: string;
    paymentId: string;
    podPayoutRecipientUserId: string | null;
  };
};

export function buildPodPayoutStripeTransferCreateParams(row: PodPayoutTransferStripeRow) {
  const recipientUserId = row.podPayoutAllocation.podPayoutRecipientUserId?.trim() ?? "";
  return {
    amount: row.amountCents,
    currency: row.currency,
    destination: row.destinationAccountId,
    transfer_group: buildPodPayoutTransferGroup(row.podPayoutAllocation.orderId),
    metadata: buildPodPayoutTransferStripeMetadata({
      id: row.id,
      podPayoutAllocationId: row.podPayoutAllocationId,
      podId: row.podId,
      orderId: row.podPayoutAllocation.orderId,
      paymentId: row.podPayoutAllocation.paymentId,
      recipientUserId,
    }),
  };
}

const allocationInclude = {
  order: { select: { paymentRefundStatus: true } },
  podPayoutRecipientUser: {
    select: {
      podPayoutStripeConnectedAccountId: true,
      podPayoutStripeDetailsSubmitted: true,
      podPayoutStripePayoutsEnabled: true,
    },
  },
  payment: {
    select: {
      allocations: {
        select: {
          netVendorTransferCents: true,
          payoutTransfer: {
            select: {
              amountCents: true,
              status: true,
            },
          },
        },
      },
    },
  },
  podPayoutTransfer: { select: { status: true } },
} as const;

type AllocationForTransfer = Prisma.PodPayoutAllocationGetPayload<{
  include: typeof allocationInclude;
}>;

async function loadPodMinimumPayoutCents(podId: string): Promise<number> {
  const settings = await prisma.podPayoutSettings.findUnique({
    where: { podId },
    select: { minimumPayoutCents: true },
  });
  return settings?.minimumPayoutCents ?? 0;
}

async function createTransferRowForAllocation(
  tx: Prisma.TransactionClient,
  allocation: AllocationForTransfer,
  minimumPayoutCents: number
): Promise<boolean> {
  const existing = await tx.podPayoutTransfer.findUnique({
    where: { podPayoutAllocationId: allocation.id },
  });
  if (existing) return false;

  const paymentAllocations: PaymentAllocationVendorGateRow[] = allocation.payment.allocations.map(
    (a) => ({
      netVendorTransferCents: a.netVendorTransferCents,
      payoutTransfer: a.payoutTransfer,
    })
  );

  const eligibility = evaluatePodPayoutAllocationTransferEligibility({
    allocationStatus: allocation.status,
    podPayoutAmountCents: allocation.podPayoutAmountCents,
    minimumPayoutCents,
    paymentRefundStatus: allocation.order.paymentRefundStatus as PaymentRefundStatusForPodTransfer,
    recipientConnect: allocation.podPayoutRecipientUser,
    paymentAllocations,
  });

  if (!eligibility.ensureDecision) return false;

  const decision = eligibility.ensureDecision;

  await tx.podPayoutTransfer.create({
    data: {
      podPayoutAllocationId: allocation.id,
      podId: allocation.podId,
      destinationAccountId: decision.destinationAccountId,
      amountCents: decision.amountCents,
      currency: "usd",
      status: decision.status,
      blockedReason: decision.blockedReason,
      idempotencyKey: stablePodPayoutTransferIdempotencyKey(allocation.id),
    },
  });
  return true;
}

/**
 * Creates PodPayoutTransfer rows for pending allocations on a pod (idempotent).
 * Called at batch time only — not during payment capture.
 */
export async function ensurePodPayoutTransferRowsForPod(podId: string): Promise<{ created: number }> {
  const minimumPayoutCents = await loadPodMinimumPayoutCents(podId);

  const allocations = await prisma.podPayoutAllocation.findMany({
    where: {
      podId,
      status: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutTransfer: null,
    },
    include: allocationInclude,
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  await prisma.$transaction(async (tx) => {
    for (const allocation of allocations) {
      const didCreate = await createTransferRowForAllocation(tx, allocation, minimumPayoutCents);
      if (didCreate) created++;
    }
  });

  return { created };
}

export type ExecutePodPayoutTransferResult =
  | { outcome: "paid"; stripeTransferId: string }
  | { outcome: "blocked_insufficient_balance"; message: string }
  | { outcome: "blocked_idempotency_mismatch"; message: string }
  | { outcome: "blocked_balance_unavailable"; message: string }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; message: string };

type ExecuteOpts = {
  batchKey?: string;
  balanceTracker?: BalanceTracker;
  minimumPayoutCents?: number;
};

function stripeErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function stripeErrorCode(e: unknown): string | null {
  if (e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string") {
    return (e as { code: string }).code;
  }
  return null;
}

async function resolveBalanceTracker(
  currency: string,
  opts?: ExecuteOpts
): Promise<{ ok: true; tracker: BalanceTracker } | { ok: false; error: string }> {
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

async function refreshTransferRowFromBatchContext(
  transferId: string,
  opts?: ExecuteOpts
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const row = await prisma.podPayoutTransfer.findUnique({
    where: { id: transferId },
    include: {
      podPayoutAllocation: {
        include: allocationInclude,
      },
    },
  });
  if (!row) return { ok: false, reason: "not_found" };

  const minimumPayoutCents =
    opts?.minimumPayoutCents ?? (await loadPodMinimumPayoutCents(row.podId));

  const paymentAllocations: PaymentAllocationVendorGateRow[] =
    row.podPayoutAllocation.payment.allocations.map((a) => ({
      netVendorTransferCents: a.netVendorTransferCents,
      payoutTransfer: a.payoutTransfer,
    }));

  const eligibility = evaluatePodPayoutAllocationTransferEligibility({
    allocationStatus: row.podPayoutAllocation.status,
    podPayoutAmountCents: row.podPayoutAllocation.podPayoutAmountCents,
    minimumPayoutCents,
    paymentRefundStatus: row.podPayoutAllocation.order
      .paymentRefundStatus as PaymentRefundStatusForPodTransfer,
    recipientConnect: row.podPayoutAllocation.podPayoutRecipientUser,
    paymentAllocations,
    existingTransferStatus: row.status,
  });

  const decision = eligibility.ensureDecision;
  if (!decision) {
    if (!eligibility.transferable) {
      return { ok: false, reason: eligibility.reason };
    }
    return { ok: false, reason: "allocation_not_pending" };
  }

  if (decision.status !== POD_PAYOUT_TRANSFER_STATUS.pending) {
    await prisma.podPayoutTransfer.update({
      where: { id: transferId },
      data: {
        status: decision.status,
        destinationAccountId: decision.destinationAccountId,
        amountCents: decision.amountCents,
        blockedReason: decision.blockedReason,
      },
    });
    return { ok: false, reason: decision.status };
  }

  if (
    row.destinationAccountId !== decision.destinationAccountId ||
    row.amountCents !== decision.amountCents
  ) {
    await prisma.podPayoutTransfer.update({
      where: { id: transferId },
      data: {
        destinationAccountId: decision.destinationAccountId,
        amountCents: decision.amountCents,
        blockedReason: null,
        status: POD_PAYOUT_TRANSFER_STATUS.pending,
      },
    });
  }

  return { ok: true };
}

/** Re-runs allocation/connect/refund/minimum decision for an existing pod transfer row. */
export const recomputePodPayoutTransferRowFromContext = refreshTransferRowFromBatchContext;

async function markPodPayoutBlockedInsufficientBalance(
  transferId: string,
  message: string,
  opts?: ExecuteOpts
): Promise<void> {
  await prisma.podPayoutTransfer.update({
    where: { id: transferId },
    data: {
      status: POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
      blockedReason: INSUFFICIENT_BALANCE_BLOCKED_REASON,
      failureMessage: message.slice(0, 2000),
      failedAt: new Date(),
      ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
    },
  });
}

async function markPodPayoutBlockedIdempotencyMismatch(
  transferId: string,
  rawMessage: string,
  opts?: ExecuteOpts
): Promise<void> {
  await prisma.podPayoutTransfer.update({
    where: { id: transferId },
    data: {
      status: POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch,
      blockedReason: IDEMPOTENCY_MISMATCH_BLOCKED_REASON,
      failureMessage: rawMessage.slice(0, 2000),
      failedAt: new Date(),
      ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
    },
  });
}

export async function executePodPayoutTransfer(
  transferId: string,
  opts?: ExecuteOpts
): Promise<ExecutePodPayoutTransferResult> {
  if (!env.STRIPE_SECRET_KEY || !stripe) {
    return { outcome: "failed", message: "Stripe is not configured." };
  }

  const row = await prisma.podPayoutTransfer.findUnique({
    where: { id: transferId },
    include: {
      podPayoutAllocation: {
        include: allocationInclude,
      },
    },
  });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }

  const refreshed = await refreshTransferRowFromBatchContext(transferId, opts);
  if (!refreshed.ok) {
    if (
      refreshed.reason === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund ||
      refreshed.reason === POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview
    ) {
      return { outcome: "skipped", reason: refreshed.reason };
    }
    if (refreshed.reason !== "not_found" && refreshed.reason !== POD_PAYOUT_TRANSFER_STATUS.pending) {
      return { outcome: "skipped", reason: refreshed.reason };
    }
  }

  const current = await prisma.podPayoutTransfer.findUnique({ where: { id: transferId } });
  if (!current) return { outcome: "skipped", reason: "not_found" };

  if (isPodPayoutTransferExecutionBlockedByRefund(current)) {
    return {
      outcome: "skipped",
      reason: isPodPayoutCancelledDueToRefundTransfer(current)
        ? POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund
        : POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
    };
  }

  if (current.status === POD_PAYOUT_TRANSFER_STATUS.paid && current.stripeTransferId) {
    return { outcome: "skipped", reason: "already_paid" };
  }
  if (current.stripeTransferId?.trim() && current.status !== POD_PAYOUT_TRANSFER_STATUS.paid) {
    return { outcome: "skipped", reason: "inconsistent_stripe_transfer_id" };
  }
  if (
    current.status !== POD_PAYOUT_TRANSFER_STATUS.pending ||
    !current.destinationAccountId ||
    current.destinationAccountId === POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION
  ) {
    return { outcome: "skipped", reason: `status_${current.status}` };
  }

  if (current.amountCents <= 0) {
    const now = new Date();
    await prisma.podPayoutTransfer.update({
      where: { id: transferId },
      data: {
        status: POD_PAYOUT_TRANSFER_STATUS.paid,
        submittedAt: now,
        paidAt: now,
        ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
      },
    });
    return { outcome: "paid", stripeTransferId: "" };
  }

  const balanceResolved = await resolveBalanceTracker(current.currency, opts);
  if (!balanceResolved.ok) {
    return {
      outcome: "blocked_balance_unavailable",
      message: POD_PAYOUT_BALANCE_UNAVAILABLE_ADMIN_MESSAGE,
    };
  }
  const tracker = balanceResolved.tracker;
  if (current.amountCents > tracker.remainingAvailableCents) {
    await markPodPayoutBlockedInsufficientBalance(transferId, INSUFFICIENT_BALANCE_DISPLAY, opts);
    return { outcome: "blocked_insufficient_balance", message: INSUFFICIENT_BALANCE_DISPLAY };
  }

  const stripeRow = await prisma.podPayoutTransfer.findUnique({
    where: { id: transferId },
    include: {
      podPayoutAllocation: {
        select: {
          orderId: true,
          paymentId: true,
          podPayoutRecipientUserId: true,
        },
      },
    },
  });
  if (!stripeRow?.destinationAccountId) {
    return { outcome: "skipped", reason: "missing_destination" };
  }

  try {
    const tr = await stripe.transfers.create(
      buildPodPayoutStripeTransferCreateParams({
        id: stripeRow.id,
        podPayoutAllocationId: stripeRow.podPayoutAllocationId,
        podId: stripeRow.podId,
        amountCents: stripeRow.amountCents,
        currency: stripeRow.currency,
        destinationAccountId: stripeRow.destinationAccountId,
        podPayoutAllocation: stripeRow.podPayoutAllocation,
      }),
      { idempotencyKey: stripeRow.idempotencyKey }
    );

    tracker.remainingAvailableCents = Math.max(0, tracker.remainingAvailableCents - stripeRow.amountCents);
    const now = new Date();
    await prisma.podPayoutTransfer.update({
      where: { id: transferId },
      data: {
        status: POD_PAYOUT_TRANSFER_STATUS.paid,
        stripeTransferId: tr.id,
        submittedAt: now,
        paidAt: now,
        blockedReason: null,
        failureCode: null,
        failureMessage: null,
        failedAt: null,
        ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
      },
    });
    return { outcome: "paid", stripeTransferId: tr.id };
  } catch (e) {
    const message = stripeErrorMessage(e);
    const code = stripeErrorCode(e);
    if (isStripeIdempotencyParameterMismatchError(e)) {
      await markPodPayoutBlockedIdempotencyMismatch(transferId, message, opts);
      return { outcome: "blocked_idempotency_mismatch", message: IDEMPOTENCY_MISMATCH_DISPLAY };
    }
    if (isStripeInsufficientFundsError(e)) {
      await markPodPayoutBlockedInsufficientBalance(transferId, message, opts);
      return { outcome: "blocked_insufficient_balance", message };
    }
    await prisma.podPayoutTransfer.update({
      where: { id: transferId },
      data: {
        status: POD_PAYOUT_TRANSFER_STATUS.failed,
        failureCode: code,
        failureMessage: message.slice(0, 2000),
        failedAt: new Date(),
      },
    });
    return { outcome: "failed", message };
  }
}

/**
 * Admin retry for failed or balance-blocked pod transfers (not refund-blocked or idempotency mismatch).
 */
export async function retryFailedPodPayoutTransfer(
  transferId: string,
  opts?: ExecuteOpts
): Promise<ExecutePodPayoutTransferResult> {
  const row = await prisma.podPayoutTransfer.findUnique({ where: { id: transferId } });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (isPodPayoutTransferExecutionBlockedByRefund(row)) {
    return {
      outcome: "skipped",
      reason: isPodPayoutCancelledDueToRefundTransfer(row)
        ? POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund
        : POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
    };
  }
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.paid && row.stripeTransferId) {
    return { outcome: "skipped", reason: "already_paid" };
  }
  if (row.stripeTransferId?.trim() && row.status !== POD_PAYOUT_TRANSFER_STATUS.paid) {
    return { outcome: "skipped", reason: "inconsistent_stripe_transfer_id" };
  }
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch) {
    return { outcome: "skipped", reason: POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch };
  }
  const retryable =
    row.status === POD_PAYOUT_TRANSFER_STATUS.failed ||
    row.status === POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance;
  if (!retryable) {
    return { outcome: "skipped", reason: `not_retryable_status_${row.status}` };
  }
  if (
    !row.destinationAccountId ||
    row.destinationAccountId === POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION
  ) {
    return { outcome: "skipped", reason: "blocked_destination" };
  }

  await prisma.podPayoutTransfer.update({
    where: { id: transferId },
    data: {
      status: POD_PAYOUT_TRANSFER_STATUS.pending,
      failureMessage: null,
      failureCode: null,
      failedAt: null,
      blockedReason: null,
    },
  });

  return executePodPayoutTransfer(transferId, opts);
}

export type PodPayoutTransferBatchSummary = {
  batchKey: string;
  rowsCreated: number;
  examined: number;
  settled: number;
  skipped: number;
  failed: number;
  blockedInsufficientBalance: number;
  stoppedEarlyForBalance: boolean;
  failures: Array<{ transferId: string; message: string }>;
};

export type PodPayoutTransferBatchRunResult =
  | { ok: true; summary: PodPayoutTransferBatchSummary }
  | {
      ok: false;
      code: "balance_unavailable";
      error: string;
      balanceError: string;
      summary: PodPayoutTransferBatchSummary;
    };

function summarizePodExecuteResult(
  transferId: string,
  r: ExecutePodPayoutTransferResult,
  summary: PodPayoutTransferBatchSummary
): boolean {
  if (r.outcome === "paid") {
    summary.settled++;
    return false;
  }
  if (r.outcome === "skipped" || r.outcome === "blocked_balance_unavailable") {
    summary.skipped++;
    return false;
  }
  if (r.outcome === "blocked_insufficient_balance") {
    summary.blockedInsufficientBalance++;
    summary.failures.push({ transferId, message: r.message });
    return true;
  }
  if (r.outcome === "blocked_idempotency_mismatch" || r.outcome === "failed") {
    summary.failed++;
    summary.failures.push({ transferId, message: r.message });
    return false;
  }
  return false;
}

export async function runManualPodPayoutTransferBatchForPod(
  podId: string,
  params?: { batchKey?: string }
): Promise<PodPayoutTransferBatchRunResult> {
  const batchKey = params?.batchKey ?? `pod-${podId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`;
  const minimumPayoutCents = await loadPodMinimumPayoutCents(podId);

  const { reEvaluateBlockedPodPayoutTransferRows } = await import(
    "@/services/pod-payout-transfer-recovery.service"
  );
  await reEvaluateBlockedPodPayoutTransferRows({ podId });

  const { created: rowsCreated } = await ensurePodPayoutTransferRowsForPod(podId);

  const pending = await prisma.podPayoutTransfer.findMany({
    where: {
      podId,
      status: POD_PAYOUT_TRANSFER_STATUS.pending,
      destinationAccountId: { not: POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION },
    },
    orderBy: { createdAt: "asc" },
  });

  const summary: PodPayoutTransferBatchSummary = {
    batchKey,
    rowsCreated,
    examined: pending.length,
    settled: 0,
    skipped: 0,
    failed: 0,
    blockedInsufficientBalance: 0,
    stoppedEarlyForBalance: false,
    failures: [],
  };

  if (pending.length === 0) {
    return { ok: true, summary };
  }

  const balanceResult = await fetchStripePlatformBalance("usd");
  if (!balanceResult.ok) {
    return {
      ok: false,
      code: "balance_unavailable",
      error: POD_PAYOUT_BALANCE_UNAVAILABLE_ADMIN_MESSAGE,
      balanceError: balanceResult.error,
      summary,
    };
  }

  const tracker: BalanceTracker = {
    currency: balanceResult.balance.currency,
    remainingAvailableCents: balanceResult.balance.availableCents,
  };

  for (const row of pending) {
    const r = await executePodPayoutTransfer(row.id, {
      batchKey,
      balanceTracker: tracker,
      minimumPayoutCents,
    });
    const stop = summarizePodExecuteResult(row.id, r, summary);
    if (stop) {
      summary.stoppedEarlyForBalance = true;
      break;
    }
  }

  return { ok: true, summary };
}

export type PodPayoutTransferAdminRow = {
  id: string;
  createdAt: Date;
  orderId: string;
  amountCents: number;
  destinationAccountId: string | null;
  status: string;
  statusLabel: string;
  stripeTransferId: string | null;
  blockedReason: string | null;
  blockedReasonLabel: string | null;
  failureMessage: string | null;
  batchKey: string | null;
};

export type PodPayoutNonTransferableAllocation = {
  allocationId: string;
  orderId: string;
  amountCents: number;
  reason: PodPayoutTransferabilityReason;
  reasonLabel: string;
};

export type PodPayoutTransferAdminSummary = {
  pendingAllocationAmountCents: number;
  pendingAllocationCount: number;
  transferableAmountCents: number;
  transferableCount: number;
  blockedTransferAmountCents: number;
  blockedTransferCount: number;
  paidTransferAmountCents: number;
  paidTransferCount: number;
  minimumPayoutCents: number;
  canRunPayoutBatch: boolean;
  nonTransferableAllocations: PodPayoutNonTransferableAllocation[];
};

export async function getPodPayoutTransferAdminSummary(
  podId: string
): Promise<PodPayoutTransferAdminSummary> {
  const [settings, pendingAllocations, transfers] = await Promise.all([
    prisma.podPayoutSettings.findUnique({
      where: { podId },
      select: { minimumPayoutCents: true },
    }),
    prisma.podPayoutAllocation.findMany({
      where: { podId, status: POD_PAYOUT_ALLOCATION_STATUS.pending },
      select: {
        id: true,
        orderId: true,
        podPayoutAmountCents: true,
        status: true,
        order: { select: { paymentRefundStatus: true } },
        podPayoutRecipientUser: {
          select: {
            podPayoutStripeConnectedAccountId: true,
            podPayoutStripeDetailsSubmitted: true,
            podPayoutStripePayoutsEnabled: true,
          },
        },
        payment: {
          select: {
            allocations: {
              select: {
                netVendorTransferCents: true,
                payoutTransfer: {
                  select: { amountCents: true, status: true },
                },
              },
            },
          },
        },
        podPayoutTransfer: { select: { status: true } },
      },
    }),
    prisma.podPayoutTransfer.findMany({
      where: { podId },
      select: { status: true, amountCents: true },
    }),
  ]);

  const minimumPayoutCents = settings?.minimumPayoutCents ?? 0;
  const pendingAllocationAmountCents = pendingAllocations.reduce(
    (sum, row) => sum + row.podPayoutAmountCents,
    0
  );

  let transferableAmountCents = 0;
  let transferableCount = 0;
  const nonTransferableAllocations: PodPayoutNonTransferableAllocation[] = [];

  for (const allocation of pendingAllocations) {
    const paymentAllocations: PaymentAllocationVendorGateRow[] = allocation.payment.allocations.map(
      (a) => ({
        netVendorTransferCents: a.netVendorTransferCents,
        payoutTransfer: a.payoutTransfer,
      })
    );

    const eligibility = evaluatePodPayoutAllocationTransferEligibility({
      allocationStatus: allocation.status,
      podPayoutAmountCents: allocation.podPayoutAmountCents,
      minimumPayoutCents,
      paymentRefundStatus: allocation.order.paymentRefundStatus as PaymentRefundStatusForPodTransfer,
      recipientConnect: allocation.podPayoutRecipientUser,
      paymentAllocations,
      existingTransferStatus: allocation.podPayoutTransfer?.status ?? null,
    });

    if (eligibility.transferable) {
      transferableAmountCents += allocation.podPayoutAmountCents;
      transferableCount++;
    } else if (
      eligibility.reason !== "existing_transfer_blocked" &&
      eligibility.reason !== "allocation_not_pending"
    ) {
      nonTransferableAllocations.push({
        allocationId: allocation.id,
        orderId: allocation.orderId,
        amountCents: allocation.podPayoutAmountCents,
        reason: eligibility.reason,
        reasonLabel: eligibility.reasonLabel,
      });
    }
  }

  let blockedTransferAmountCents = 0;
  let blockedTransferCount = 0;
  let paidTransferAmountCents = 0;
  let paidTransferCount = 0;

  for (const row of transfers) {
    if (row.status === POD_PAYOUT_TRANSFER_STATUS.paid) {
      paidTransferAmountCents += row.amountCents;
      paidTransferCount++;
    } else if (row.status !== POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund) {
      blockedTransferAmountCents += row.amountCents;
      blockedTransferCount++;
    }
  }

  return {
    pendingAllocationAmountCents,
    pendingAllocationCount: pendingAllocations.length,
    transferableAmountCents,
    transferableCount,
    blockedTransferAmountCents,
    blockedTransferCount,
    paidTransferAmountCents,
    paidTransferCount,
    minimumPayoutCents,
    canRunPayoutBatch: transferableCount > 0,
    nonTransferableAllocations,
  };
}

export async function listRecentPodPayoutTransfersForAdmin(
  podId: string,
  limit = 50
): Promise<PodPayoutTransferAdminRow[]> {
  const rows = await prisma.podPayoutTransfer.findMany({
    where: { podId },
    include: {
      podPayoutAllocation: { select: { orderId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    orderId: row.podPayoutAllocation.orderId,
    amountCents: row.amountCents,
    destinationAccountId: row.destinationAccountId,
    status: row.status,
    statusLabel: POD_PAYOUT_TRANSFER_STATUS_LABELS[row.status] ?? row.status,
    stripeTransferId: row.stripeTransferId,
    blockedReason: row.blockedReason,
    blockedReasonLabel: row.blockedReason
      ? POD_PAYOUT_TRANSFER_BLOCKED_REASON_LABELS[row.blockedReason] ?? row.blockedReason
      : null,
    failureMessage: row.failureMessage,
    batchKey: row.batchKey,
  }));
}

export type { StripePlatformBalanceSnapshot };
