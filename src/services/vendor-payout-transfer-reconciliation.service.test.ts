import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockRetrieve = vi.fn();
const mockList = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    transfers: {
      retrieve: (...args: unknown[]) => mockRetrieve(...args),
      list: (...args: unknown[]) => mockList(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_x" },
}));

import {
  reconcileEligibleVendorPayoutTransfers,
  reconcileVendorPayoutTransfer,
} from "./vendor-payout-transfer-reconciliation.service";

const rowPayload = {
  id: "vpt_1",
  paymentAllocationId: "pa_1",
  vendorOrderId: "vo_1",
  vendorId: "v_1",
  destinationAccountId: "acct_1",
  amountCents: 5000,
  currency: "usd",
  status: "failed",
  stripeTransferId: null,
  createdAt: new Date("2026-01-15T12:00:00Z"),
  submittedAt: null,
  failedAt: new Date("2026-01-15T12:01:00Z"),
  vendorOrder: { orderId: "ord_1" },
};

describe("vendor-payout-transfer-reconciliation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockUpdate.mockResolvedValue({});
    mockList.mockResolvedValue({ data: [], has_more: false });
  });

  it("updates row paid when stripeTransferId retrieve matches", async () => {
    mockFindUnique.mockResolvedValue({
      ...rowPayload,
      stripeTransferId: "tr_existing",
    });
    mockRetrieve.mockResolvedValue({
      id: "tr_existing",
      amount: 5000,
      currency: "usd",
      destination: "acct_1",
      reversed: false,
      created: Math.floor(Date.now() / 1000),
      metadata: { openOrderVendorPayoutTransferId: "vpt_1" },
    });

    const result = await reconcileVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("updated_paid");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns mismatch when stripeTransferId amount differs", async () => {
    mockFindUnique.mockResolvedValue({
      ...rowPayload,
      stripeTransferId: "tr_existing",
    });
    mockRetrieve.mockResolvedValue({
      id: "tr_existing",
      amount: 1,
      currency: "usd",
      destination: "acct_1",
      reversed: false,
      created: Math.floor(Date.now() / 1000),
      metadata: {},
    });

    const result = await reconcileVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("mismatch");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("updates from metadata search when no local stripe id", async () => {
    mockFindUnique.mockResolvedValue(rowPayload);
    mockList.mockImplementation(async (params: { transfer_group?: string }) => {
      if (params.transfer_group) {
        return { data: [], has_more: false };
      }
      return {
        data: [
          {
            id: "tr_found",
            amount: 5000,
            currency: "usd",
            destination: "acct_1",
            reversed: false,
            created: Math.floor(Date.now() / 1000),
            metadata: { mennyu_payment_allocation_id: "pa_1" },
          },
        ],
        has_more: false,
      };
    });

    const result = await reconcileVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("updated_paid");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns not found when stripe has no match", async () => {
    mockFindUnique.mockResolvedValue(rowPayload);
    const result = await reconcileVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("unchanged_not_found");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns ambiguous for multiple matches", async () => {
    mockFindUnique.mockResolvedValue(rowPayload);
    mockList.mockImplementation(async (params: { transfer_group?: string }) => {
      if (params.transfer_group) return { data: [], has_more: false };
      return {
        data: [
          {
            id: "tr_a",
            amount: 5000,
            currency: "usd",
            destination: "acct_1",
            reversed: false,
            created: Math.floor(Date.now() / 1000),
            metadata: {},
          },
          {
            id: "tr_b",
            amount: 5000,
            currency: "usd",
            destination: "acct_1",
            reversed: false,
            created: Math.floor(Date.now() / 1000),
            metadata: {},
          },
        ],
        has_more: false,
      };
    });

    const result = await reconcileVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("unchanged_ambiguous");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("bulk reconciliation only scans eligible rows and never creates transfers", async () => {
    mockFindMany.mockResolvedValue([{ id: "vpt_1" }]);
    mockFindUnique.mockResolvedValue(rowPayload);

    const summary = await reconcileEligibleVendorPayoutTransfers({ limit: 50 });
    expect(summary.checked).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: expect.objectContaining({ in: expect.any(Array) }),
        }),
      })
    );
  });
});
