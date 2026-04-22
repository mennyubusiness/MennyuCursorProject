"use server";

import type { AdminTransferReversalRow } from "@/app/admin/(dashboard)/payout-transfers/payout-transfers-admin.types";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  retryFailedVendorPayoutTransferReversal,
  runPendingTransferReversalBatch,
} from "@/services/vendor-payout-transfer-reversal.service";

export async function adminRunTransferReversalBatchAction(batchKey?: string) {
  const ok = await isAdminDashboardLayoutAuthorized();
  if (!ok) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const summary = await runPendingTransferReversalBatch(
    batchKey?.trim() ? { batchKey: batchKey.trim() } : undefined
  );
  return { ok: true as const, summary };
}

const reversalSelect = {
  id: true,
  vendorPayoutTransferId: true,
  vendorOrderId: true,
  orderId: true,
  refundAttemptId: true,
  amountCents: true,
  currency: true,
  status: true,
  stripeTransferReversalId: true,
  failureMessage: true,
  batchKey: true,
  submittedAt: true,
  failedAt: true,
  createdAt: true,
  vendorId: true,
  vendor: { select: { id: true, name: true } },
  vendorOrder: { select: { id: true, orderId: true } },
  order: { select: { id: true } },
} as const;

export async function adminRetryTransferReversalAction(reversalId: string) {
  const ok = await isAdminDashboardLayoutAuthorized();
  if (!ok) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const r = await retryFailedVendorPayoutTransferReversal(reversalId);
  const reversal = await prisma.vendorPayoutTransferReversal.findUnique({
    where: { id: reversalId },
    select: reversalSelect,
  });
  if (!reversal) {
    return { ok: false as const, error: "Reversal not found" };
  }
  return {
    ok: true as const,
    result: r,
    reversal: JSON.parse(JSON.stringify(reversal)) as AdminTransferReversalRow,
  };
}
