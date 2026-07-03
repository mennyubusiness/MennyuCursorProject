import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { reEvaluateBlockedVendorPayoutTransferRows } from "./vendor-payout-transfer-recovery.service";
import { VENDOR_PAYOUT_TRANSFER_STATUS } from "./vendor-payout-transfer.service";

describe("reEvaluateBlockedVendorPayoutTransferRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it("promotes connect-ready blocked rows to pending", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "vpt_1",
        status: VENDOR_PAYOUT_TRANSFER_STATUS.blocked,
        destinationAccountId: "blocked",
        blockedReason: "connect_not_ready",
        failureMessage: null,
        stripeTransferId: null,
        vendor: {
          stripeConnectedAccountId: "acct_vendor",
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          deletedAt: null,
        },
      },
    ]);

    const summary = await reEvaluateBlockedVendorPayoutTransferRows();
    expect(summary.promotedToPending).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vpt_1" },
        data: expect.objectContaining({
          status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
          destinationAccountId: "acct_vendor",
        }),
      })
    );
  });

  it("skips failed rows", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "vpt_2",
        status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
        destinationAccountId: "acct_vendor",
        blockedReason: null,
        failureMessage: "boom",
        stripeTransferId: null,
        vendor: {
          stripeConnectedAccountId: "acct_vendor",
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          deletedAt: null,
        },
      },
    ]);

    const summary = await reEvaluateBlockedVendorPayoutTransferRows();
    expect(summary.skippedTerminal).toBe(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
