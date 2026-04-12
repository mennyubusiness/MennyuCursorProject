"use server";

import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { runManualVendorPayoutTransferBatch } from "@/services/vendor-payout-transfer.service";

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
