"use server";

import type { AdminPayoutTransferRow } from "@/app/admin/(dashboard)/payout-transfers/payout-transfers-admin.types";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  retryFailedVendorPayoutTransfer,
  runManualVendorPayoutTransferBatch,
} from "@/services/vendor-payout-transfer.service";

export async function adminRunVendorPayoutTransferBatchAction(batchKey?: string) {
  const ok = await isAdminDashboardLayoutAuthorized();
  if (!ok) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const summary = await runManualVendorPayoutTransferBatch(
    batchKey?.trim() ? { batchKey: batchKey.trim() } : undefined
  );
  return { ok: true as const, summary };
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
