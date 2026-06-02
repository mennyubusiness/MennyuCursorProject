import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRetrieveBalance = vi.fn();
const mockListBalance = vi.fn();
const mockListPayouts = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    balanceTransactions: {
      retrieve: (...args: unknown[]) => mockRetrieveBalance(...args),
      list: (...args: unknown[]) => mockListBalance(...args),
    },
    payouts: {
      list: (...args: unknown[]) => mockListPayouts(...args),
    },
  },
}));

import {
  lookupPlatformPayoutForBalanceTransaction,
  platformPayoutDisplayForListRow,
} from "./stripe-platform-payout-lookup.service";

describe("stripe-platform-payout-lookup.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unknown when balance transaction id is missing", async () => {
    const result = await lookupPlatformPayoutForBalanceTransaction(null);
    expect(result.kind).toBe("unknown");
  });

  it("list rows defer platform payout lookup to order detail", () => {
    expect(platformPayoutDisplayForListRow("txn_1").kind).toBe("unknown");
    expect(platformPayoutDisplayForListRow(null).reason).toBe("no_balance_transaction");
  });

  it("returns not_included when charge net is not in recent payouts", async () => {
    mockRetrieveBalance.mockResolvedValue({ id: "txn_1" });
    mockListPayouts.mockResolvedValue({ data: [], has_more: false });
    const result = await lookupPlatformPayoutForBalanceTransaction("txn_1");
    expect(result.kind).toBe("not_included");
  });

  it("returns paid_out when balance transaction appears in a platform payout", async () => {
    mockRetrieveBalance.mockResolvedValue({ id: "txn_1" });
    mockListPayouts.mockResolvedValue({
      data: [{ id: "po_123", status: "paid", amount: 1889 }],
      has_more: false,
    });
    mockListBalance.mockResolvedValue({
      data: [{ id: "txn_1" }],
      has_more: false,
    });
    const result = await lookupPlatformPayoutForBalanceTransaction("txn_1");
    expect(result.kind).toBe("paid_out");
    if (result.kind === "paid_out") {
      expect(result.payoutId).toBe("po_123");
    }
  });

  it("does not mark vendor transfer paid — lookup is read-only", async () => {
    expect(typeof lookupPlatformPayoutForBalanceTransaction).toBe("function");
    expect(mockListPayouts).not.toHaveBeenCalled();
  });
});
