"use server";

import type { AdminPayoutTransferRow } from "@/app/admin/(dashboard)/payout-transfers/payout-transfers-admin.types";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  retryAllEligibleFailedVendorPayoutTransfers,
  retryFailedVendorPayoutTransfer,
  runManualVendorPayoutTransferBatch,
} from "@/services/vendor-payout-transfer.service";
import { fetchStripePlatformBalance } from "@/services/stripe-balance.service";

export async function adminRunVendorPayoutTransferBatchAction(batchKey?: string) {
  const ok = await isAdminDashboardLayoutAuthorized();
  if (!ok) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const result = await runManualVendorPayoutTransferBatch(
    batchKey?.trim() ? { batchKey: batchKey.trim() } : undefined
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error: result.error,
      balanceError: result.balanceError,
    };
  }
  return { ok: true as const, summary: result.summary };
}

export async function adminRetryAllEligibleVendorPayoutTransfersAction(batchKey?: string) {
  const ok = await isAdminDashboardLayoutAuthorized();
  if (!ok) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const result = await retryAllEligibleFailedVendorPayoutTransfers(
    batchKey?.trim() ? { batchKey: batchKey.trim() } : undefined
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error: result.error,
      balanceError: result.balanceError,
    };
  }
  return { ok: true as const, summary: result.summary };
}

export async function adminFetchStripePlatformBalanceAction() {
  const ok = await isAdminDashboardLayoutAuthorized();
  if (!ok) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const result = await fetchStripePlatformBalance("usd");
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return { ok: true as const, balance: result.balance };
}

const transferSelect = {
  id: true,
  paymentAllocationId: true,
  vendorOrderId: true,
  vendorId: true,
  destinationAccountId: true,
  amountCents: true,
  currency: true,
  status: true,
  blockedReason: true,
  stripeTransferId: true,
  idempotencyKey: true,
  batchKey: true,
  failureMessage: true,
  submittedAt: true,
  failedAt: true,
  createdAt: true,
  vendor: { select: { id: true, name: true } },
  vendorOrder: { select: { id: true, orderId: true } },
} as const;

export async function adminRetryVendorPayoutTransferAction(transferId: string) {
  const ok = await isAdminDashboardLayoutAuthorized();
  if (!ok) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const r = await retryFailedVendorPayoutTransfer(transferId);
  if (r.outcome === "blocked_balance_unavailable") {
    return { ok: false as const, error: r.message };
  }
  const transfer = await prisma.vendorPayoutTransfer.findUnique({
    where: { id: transferId },
    select: transferSelect,
  });
  if (!transfer) {
    return { ok: false as const, error: "Transfer not found" };
  }
  return {
    ok: true as const,
    result: r,
    transfer: JSON.parse(JSON.stringify(transfer)) as AdminPayoutTransferRow,
  };
}
