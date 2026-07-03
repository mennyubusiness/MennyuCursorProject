"use server";

import { revalidatePath } from "next/cache";
import type { AdminPodPayoutTransferRow } from "@/app/admin/(dashboard)/payout-transfers/payout-transfers-admin.types";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  retryFailedPodPayoutTransfer,
  runManualPodPayoutTransferBatchForPod,
  type ExecutePodPayoutTransferResult,
  type PodPayoutTransferBatchSummary,
} from "@/services/pod-payout-transfer.service";
import { reconcilePodPayoutTransfer } from "@/services/pod-payout-transfer-reconciliation.service";
import { listPodPayoutTransfersForAdminDashboard } from "@/services/admin-pod-payout-transfer-list.service";

function podRetryResultMessage(result: ExecutePodPayoutTransferResult): string {
  switch (result.outcome) {
    case "paid":
      return `Pod transfer sent (${result.stripeTransferId}).`;
    case "failed":
    case "blocked_insufficient_balance":
    case "blocked_idempotency_mismatch":
    case "blocked_balance_unavailable":
      return result.message;
    case "skipped":
      return `Retry skipped: ${result.reason}.`;
    default:
      return "Retry completed.";
  }
}

async function loadAdminPodTransferRow(transferId: string): Promise<AdminPodPayoutTransferRow | null> {
  const listed = await listPodPayoutTransfersForAdminDashboard(500);
  return listed.transfers.find((t) => t.id === transferId) ?? null;
}

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

export async function adminRetryPodPayoutTransferAction(transferId: string) {
  const authorized = await isAdminDashboardLayoutAuthorized();
  if (!authorized) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const id = transferId?.trim();
  if (!id) {
    return { ok: false as const, error: "Transfer id is required." };
  }

  const result = await retryFailedPodPayoutTransfer(id);
  if (result.outcome === "blocked_balance_unavailable") {
    return { ok: false as const, error: result.message };
  }

  const transfer = await loadAdminPodTransferRow(id);
  revalidatePath("/admin/payout-transfers");
  if (transfer) {
    revalidatePath(`/admin/pods/${transfer.podId}`);
  }

  return {
    ok: true as const,
    result,
    message: podRetryResultMessage(result),
    transfer,
  };
}

export async function adminReconcilePodPayoutTransferAction(transferId: string) {
  const authorized = await isAdminDashboardLayoutAuthorized();
  if (!authorized) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const id = transferId?.trim();
  if (!id) {
    return { ok: false as const, error: "Transfer id is required." };
  }

  const result = await reconcilePodPayoutTransfer(id);
  const row = await prisma.podPayoutTransfer.findUnique({
    where: { id },
    select: { podId: true },
  });
  const transfer = await loadAdminPodTransferRow(id);

  revalidatePath("/admin/payout-transfers");
  if (row?.podId) {
    revalidatePath(`/admin/pods/${row.podId}`);
  }

  return {
    ok: true as const,
    result,
    transfer,
  };
}
