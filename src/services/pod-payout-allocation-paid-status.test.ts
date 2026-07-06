import { beforeEach, describe, expect, it, vi } from "vitest";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

const mockAllocationUpdateMany = vi.fn();
const mockAllocationFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    podPayoutAllocation: {
      updateMany: (...args: unknown[]) => mockAllocationUpdateMany(...args),
      findMany: (...args: unknown[]) => mockAllocationFindMany(...args),
    },
  },
}));

import {
  markPodPayoutAllocationPaidForTransfer,
  syncStalePaidPodPayoutAllocationStatusesForPod,
} from "./pod-payout-allocation.service";

describe("markPodPayoutAllocationPaidForTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllocationUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("updates only pending allocations to paid", async () => {
    const updated = await markPodPayoutAllocationPaidForTransfer("ppa_1");
    expect(updated).toBe(true);
    expect(mockAllocationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "ppa_1",
        status: POD_PAYOUT_ALLOCATION_STATUS.pending,
      },
      data: { status: POD_PAYOUT_ALLOCATION_STATUS.paid },
    });
  });

  it("returns false when allocation was not pending", async () => {
    mockAllocationUpdateMany.mockResolvedValue({ count: 0 });
    expect(await markPodPayoutAllocationPaidForTransfer("ppa_blocked")).toBe(false);
  });
});

describe("syncStalePaidPodPayoutAllocationStatusesForPod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repairs pending allocations whose transfer row is already paid", async () => {
    mockAllocationFindMany.mockResolvedValue([{ id: "ppa_1" }, { id: "ppa_2" }]);
    mockAllocationUpdateMany.mockResolvedValue({ count: 2 });

    const repaired = await syncStalePaidPodPayoutAllocationStatusesForPod("pod_1");

    expect(repaired).toBe(2);
    expect(mockAllocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          podId: "pod_1",
          status: POD_PAYOUT_ALLOCATION_STATUS.pending,
          podPayoutTransfer: { status: POD_PAYOUT_TRANSFER_STATUS.paid },
        }),
      })
    );
  });
});
