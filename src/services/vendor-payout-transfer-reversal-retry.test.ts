import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransferReversal: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { transfers: { createReversal: vi.fn() } },
}));

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_x" },
}));

import {
  retryFailedVendorPayoutTransferReversal,
  VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS,
} from "./vendor-payout-transfer-reversal.service";

describe("retryFailedVendorPayoutTransferReversal safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it("blocks retry when reversal already succeeded", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rev_1",
      status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.reversed,
      stripeTransferReversalId: "trr_123",
    });

    const result = await retryFailedVendorPayoutTransferReversal("rev_1");
    expect(result.outcome).toBe("skipped");
    if (result.outcome === "skipped") {
      expect(result.reason).toBe("already_reversed");
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows retry only from failed status", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rev_2",
      status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending,
    });

    const result = await retryFailedVendorPayoutTransferReversal("rev_2");
    expect(result.outcome).toBe("skipped");
    if (result.outcome === "skipped") {
      expect(result.reason).toMatch(/not_failed_status/);
    }
  });
});
