import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockRecompute = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    podPayoutTransfer: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("./pod-payout-transfer.service", () => ({
  recomputePodPayoutTransferRowFromContext: (...args: unknown[]) => mockRecompute(...args),
}));

import { reEvaluateBlockedPodPayoutTransferRows } from "./pod-payout-transfer-recovery.service";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

describe("reEvaluateBlockedPodPayoutTransferRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecompute.mockResolvedValue(undefined);
  });

  it("counts promotions when recompute moves row to pending", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "ppt_1",
        status: POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady,
        pod: { deletedAt: null },
        podPayoutAllocation: { podPayoutRecipientUser: { deletedAt: null } },
      },
    ]);
    mockFindUnique.mockResolvedValue({ status: POD_PAYOUT_TRANSFER_STATUS.pending });

    const summary = await reEvaluateBlockedPodPayoutTransferRows();
    expect(summary.promotedToPending).toBe(1);
    expect(mockRecompute).toHaveBeenCalledWith("ppt_1");
  });

  it("skips failed terminal rows", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "ppt_2",
        status: POD_PAYOUT_TRANSFER_STATUS.failed,
        pod: { deletedAt: null },
        podPayoutAllocation: { podPayoutRecipientUser: { deletedAt: null } },
      },
    ]);

    const summary = await reEvaluateBlockedPodPayoutTransferRows();
    expect(summary.skippedTerminal).toBe(1);
    expect(mockRecompute).not.toHaveBeenCalled();
  });
});
