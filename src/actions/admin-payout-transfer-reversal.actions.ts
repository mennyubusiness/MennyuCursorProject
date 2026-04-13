"use server";

import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { runPendingTransferReversalBatch } from "@/services/vendor-payout-transfer-reversal.service";

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
