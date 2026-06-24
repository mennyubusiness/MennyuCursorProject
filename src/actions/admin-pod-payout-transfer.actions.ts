"use server";

import { revalidatePath } from "next/cache";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import {
  runManualPodPayoutTransferBatchForPod,
  type PodPayoutTransferBatchSummary,
} from "@/services/pod-payout-transfer.service";

export async function adminRunPodPayoutTransferBatchAction(
  podId: string
): Promise<
  | { ok: true; summary: PodPayoutTransferBatchSummary }
  | { ok: false; error: string; code?: string }
> {
  const authorized = await isAdminDashboardLayoutAuthorized();
  if (!authorized) {
    return { ok: false, error: "Unauthorized." };
  }

  const id = podId?.trim();
  if (!id) {
    return { ok: false, error: "Pod id is required." };
  }

  const result = await runManualPodPayoutTransferBatchForPod(id);
  revalidatePath(`/admin/pods/${id}`);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      code: result.code,
    };
  }

  return { ok: true, summary: result.summary };
}
