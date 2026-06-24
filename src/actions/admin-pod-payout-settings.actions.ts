"use server";

import { revalidatePath } from "next/cache";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { normalizePodPayoutRecipientUserId } from "@/lib/pod-payout-settings";
import { reEvaluateRepairableBlockedPodPayoutAllocations } from "@/services/pod-payout-allocation.service";
import { upsertPodPayoutSettings } from "@/services/pod-payout-settings.service";

export type UpdatePodPayoutSettingsActionInput = {
  podId: string;
  podPayoutsEnabled: boolean;
  podRevenueShareBps: number;
  podPayoutRecipientUserId: string | null;
  minimumPayoutCents: number;
};

export async function updatePodPayoutSettingsAction(
  input: UpdatePodPayoutSettingsActionInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authorized = await isAdminDashboardLayoutAuthorized();
  if (!authorized) {
    return { ok: false, error: "Unauthorized." };
  }

  const podId = input.podId?.trim();
  if (!podId) {
    return { ok: false, error: "Pod id is required." };
  }

  const result = await upsertPodPayoutSettings({
    podId,
    podPayoutsEnabled: Boolean(input.podPayoutsEnabled),
    podRevenueShareBps: Number(input.podRevenueShareBps),
    podPayoutRecipientUserId: normalizePodPayoutRecipientUserId(input.podPayoutRecipientUserId),
    minimumPayoutCents: Number(input.minimumPayoutCents),
  });

  if (!result.ok) {
    return result;
  }

  revalidatePath(`/admin/pods/${podId}`);
  return { ok: true };
}

export async function reEvaluateRepairablePodPayoutAllocationsAction(
  podId: string
): Promise<
  | { ok: true; examined: number; repaired: number }
  | { ok: false; error: string }
> {
  const authorized = await isAdminDashboardLayoutAuthorized();
  if (!authorized) {
    return { ok: false, error: "Unauthorized." };
  }

  const id = podId?.trim();
  if (!id) {
    return { ok: false, error: "Pod id is required." };
  }

  const result = await reEvaluateRepairableBlockedPodPayoutAllocations(id);
  revalidatePath(`/admin/pods/${id}`);
  return { ok: true, ...result };
}
