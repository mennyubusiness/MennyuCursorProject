import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  attachLegacyOrdersToCustomerAccount,
  getOrdersByCustomerAccountId,
} from "@/services/customer-account-orders.service";

describe("customer account order history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attachLegacyOrdersToCustomerAccount links null-account orders with matching phone", async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 2 });

    const count = await attachLegacyOrdersToCustomerAccount("acct_1", "+15551234567");

    expect(count).toBe(2);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { customerPhone: "+15551234567", customerAccountId: null },
      data: { customerAccountId: "acct_1" },
    });
  });

  it("getOrdersByCustomerAccountId queries by customerAccountId only", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        id: "ord_1",
        createdAt: new Date("2026-01-01"),
        totalCents: 1000,
        status: "completed",
        requestedPickupAt: null,
        deliverectEstimatedReadyAt: null,
        pod: { name: "Pod A", pickupTimezone: "America/Los_Angeles" },
        vendorOrders: [{ vendor: { name: "Vendor 1" } }],
      },
    ] as never);

    const orders = await getOrdersByCustomerAccountId("acct_1");

    expect(orders).toHaveLength(1);
    expect(orders[0]?.id).toBe("ord_1");
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerAccountId: "acct_1" },
      })
    );
  });
});
