/**
 * Stripe Connect transfer execution: prepare rows from PaymentAllocation, execute transfers idempotently.
 * Does not change payment allocation math — reads netVendorTransferCents only.
 */
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export const VENDOR_PAYOUT_TRANSFER_STATUS = {
  pending: "pending",
  blocked: "blocked",
  submitted: "submitted",
  paid: "paid",
  failed: "failed",
} as const;

export const BLOCKED_DESTINATION_SENTINEL = "blocked";

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
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; message: string };

/**
 * Executes one pending transfer: idempotent via Stripe idempotency key; skips blocked/non-positive safely.
 */
export async function executeVendorPayoutTransfer(
  transferId: string,
  opts?: { batchKey?: string }
): Promise<ExecuteStripeTransferResult> {
  if (!env.STRIPE_SECRET_KEY || !stripe) {
    return { outcome: "failed", message: "Stripe is not configured." };
  }

  const row = await prisma.vendorPayoutTransfer.findUnique({
    where: { id: transferId },
  });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (row.status === VENDOR_PAYOUT_TRANSFER_STATUS.paid && row.stripeTransferId) {
    return { outcome: "skipped", reason: "already_paid" };
  }
  if (row.status === VENDOR_PAYOUT_TRANSFER_STATUS.blocked || row.destinationAccountId === BLOCKED_DESTINATION_SENTINEL) {
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

  try {
    const tr = await stripe.transfers.create(
      {
        amount: row.amountCents,
        currency: row.currency,
        destination: row.destinationAccountId,
        metadata: {
          mennyu_vendor_payout_transfer_id: row.id,
          mennyu_payment_allocation_id: row.paymentAllocationId,
        },
      },
      { idempotencyKey: row.idempotencyKey }
    );

    await prisma.vendorPayoutTransfer.update({
      where: { id: transferId },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
        stripeTransferId: tr.id,
        submittedAt: new Date(),
        ...(opts?.batchKey ? { batchKey: opts.batchKey } : {}),
      },
    });
    return { outcome: "paid", stripeTransferId: tr.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
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
 * Admin retry: failed → pending (clear error), then runs Stripe transfer again.
 * Blocked rows cannot be retried here.
 */
export async function retryFailedVendorPayoutTransfer(
  transferId: string,
  opts?: { batchKey?: string }
): Promise<ExecuteStripeTransferResult> {
  const row = await prisma.vendorPayoutTransfer.findUnique({ where: { id: transferId } });
  if (!row) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (row.status !== VENDOR_PAYOUT_TRANSFER_STATUS.failed) {
    return { outcome: "skipped", reason: `not_failed_status_${row.status}` };
  }
  if (row.destinationAccountId === BLOCKED_DESTINATION_SENTINEL) {
    return { outcome: "skipped", reason: "blocked_destination" };
  }
  await prisma.vendorPayoutTransfer.update({
    where: { id: transferId },
    data: {
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      failureMessage: null,
      failedAt: null,
    },
  });
  return executeVendorPayoutTransfer(transferId, opts);
}

export type PayoutTransferBatchSummary = {
  batchKey: string;
  examined: number;
  /** New Stripe transfers created (or zero-amount settled without API). */
  settled: number;
  skipped: number;
  failed: number;
  failures: Array<{ transferId: string; message: string }>;
};

/**
 * Processes pending transfers (optionally filtered by batchKey for future use). Continues past failures.
 */
export async function runManualVendorPayoutTransferBatch(params?: {
  batchKey?: string;
}): Promise<PayoutTransferBatchSummary> {
  const batchKey = params?.batchKey ?? new Date().toISOString().slice(0, 10);

  const pending = await prisma.vendorPayoutTransfer.findMany({
    where: {
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      destinationAccountId: { not: BLOCKED_DESTINATION_SENTINEL },
    },
    orderBy: { createdAt: "asc" },
  });

  const summary: PayoutTransferBatchSummary = {
    batchKey,
    examined: pending.length,
    settled: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const row of pending) {
    const r = await executeVendorPayoutTransfer(row.id, { batchKey });
    if (r.outcome === "paid") {
      summary.settled++;
    } else if (r.outcome === "skipped") {
      summary.skipped++;
    } else {
      summary.failed++;
      summary.failures.push({ transferId: row.id, message: r.message });
    }
  }

  return summary;
}
