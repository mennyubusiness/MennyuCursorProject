import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  isAdminDashboardLayoutAuthorized: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockUpsert = vi.fn();
const mockReEvaluate = vi.fn();

vi.mock("@/services/pod-payout-settings.service", () => ({
  upsertPodPayoutSettings: (...args: unknown[]) => mockUpsert(...args),
}));

vi.mock("@/services/pod-payout-allocation.service", () => ({
  reEvaluateRepairableBlockedPodPayoutAllocations: (...args: unknown[]) => mockReEvaluate(...args),
}));

import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import {
  reEvaluateRepairablePodPayoutAllocationsAction,
  updatePodPayoutSettingsAction,
} from "@/actions/admin-pod-payout-settings.actions";

describe("admin pod payout settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ ok: true });
    mockReEvaluate.mockResolvedValue({ examined: 2, repaired: 1 });
  });

  it("blocks non-admin updatePodPayoutSettings", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(false);

    const result = await updatePodPayoutSettingsAction({
      podId: "pod_1",
      podPayoutsEnabled: true,
      podRevenueShareBps: 50,
      podPayoutRecipientUserId: "user_1",
      minimumPayoutCents: 0,
    });

    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("allows admin to upsert settings and revalidates pod page", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(true);

    const result = await updatePodPayoutSettingsAction({
      podId: "pod_1",
      podPayoutsEnabled: true,
      podRevenueShareBps: 50,
      podPayoutRecipientUserId: "user_owner",
      minimumPayoutCents: 100,
    });

    expect(result).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        podId: "pod_1",
        podPayoutsEnabled: true,
        podRevenueShareBps: 50,
        podPayoutRecipientUserId: "user_owner",
        minimumPayoutCents: 100,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/pods/pod_1");
  });

  it("does not backfill allocations on settings save", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(true);
    await updatePodPayoutSettingsAction({
      podId: "pod_1",
      podPayoutsEnabled: true,
      podRevenueShareBps: 50,
      podPayoutRecipientUserId: "user_owner",
      minimumPayoutCents: 0,
    });
    expect(mockReEvaluate).not.toHaveBeenCalled();
  });

  it("blocks non-admin re-evaluate action", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(false);
    const result = await reEvaluateRepairablePodPayoutAllocationsAction("pod_1");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockReEvaluate).not.toHaveBeenCalled();
  });

  it("allows admin to re-evaluate repairable blocked allocations", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(true);
    const result = await reEvaluateRepairablePodPayoutAllocationsAction("pod_1");
    expect(result).toEqual({ ok: true, examined: 2, repaired: 1 });
    expect(mockReEvaluate).toHaveBeenCalledWith("pod_1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/pods/pod_1");
  });
});
