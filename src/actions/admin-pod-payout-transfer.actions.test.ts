import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  isAdminDashboardLayoutAuthorized: vi.fn(),
}));

vi.mock("@/services/pod-payout-transfer.service", () => ({
  runManualPodPayoutTransferBatchForPod: vi.fn(),
  retryFailedPodPayoutTransfer: vi.fn(),
}));

vi.mock("@/services/pod-payout-transfer-reconciliation.service", () => ({
  reconcilePodPayoutTransfer: vi.fn(),
}));

vi.mock("@/services/admin-pod-payout-transfer-list.service", () => ({
  listPodPayoutTransfersForAdminDashboard: vi.fn(async () => ({ transfers: [], pods: [], summary: {} })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import {
  adminRetryPodPayoutTransferAction,
  adminRunPodPayoutTransferBatchAction,
} from "@/actions/admin-pod-payout-transfer.actions";
import { retryFailedPodPayoutTransfer, runManualPodPayoutTransferBatchForPod } from "@/services/pod-payout-transfer.service";

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

  it("retries failed pod transfer for admin", async () => {
    vi.mocked(retryFailedPodPayoutTransfer).mockResolvedValue({
      outcome: "paid",
      stripeTransferId: "tr_1",
    });
    const result = await adminRetryPodPayoutTransferAction("ppt_1");
    expect(result.ok).toBe(true);
    expect(retryFailedPodPayoutTransfer).toHaveBeenCalledWith("ppt_1");
  });
});
