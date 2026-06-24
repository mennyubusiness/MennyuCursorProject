import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  isAdminDashboardLayoutAuthorized: vi.fn(),
}));

vi.mock("@/services/pod-payout-transfer.service", () => ({
  runManualPodPayoutTransferBatchForPod: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { adminRunPodPayoutTransferBatchAction } from "@/actions/admin-pod-payout-transfer.actions";
import { runManualPodPayoutTransferBatchForPod } from "@/services/pod-payout-transfer.service";

describe("adminRunPodPayoutTransferBatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(true);
    vi.mocked(runManualPodPayoutTransferBatchForPod).mockResolvedValue({
      ok: true,
      summary: {
        batchKey: "pod-pod_1-2026-06-04",
        rowsCreated: 1,
        examined: 1,
        settled: 1,
        skipped: 0,
        failed: 0,
        blockedInsufficientBalance: 0,
        stoppedEarlyForBalance: false,
        failures: [],
      },
    });
  });

  it("blocks non-admin callers", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(false);
    const result = await adminRunPodPayoutTransferBatchAction("pod_1");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(runManualPodPayoutTransferBatchForPod).not.toHaveBeenCalled();
  });

  it("runs pod payout batch for admin", async () => {
    const result = await adminRunPodPayoutTransferBatchAction("pod_1");
    expect(result.ok).toBe(true);
    expect(runManualPodPayoutTransferBatchForPod).toHaveBeenCalledWith("pod_1");
  });
});
