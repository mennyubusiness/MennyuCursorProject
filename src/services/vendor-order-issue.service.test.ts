import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOrderIssueFindMany = vi.fn();
const mockOrderIssueFindFirst = vi.fn();
const mockOrderIssueUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    orderIssue: {
      findMany: (...args: unknown[]) => mockOrderIssueFindMany(...args),
      findFirst: (...args: unknown[]) => mockOrderIssueFindFirst(...args),
      update: (...args: unknown[]) => mockOrderIssueUpdate(...args),
    },
  },
}));

import {
  listVendorOrderIssues,
  updateVendorOrderIssue,
} from "./vendor-order-issue.service";

const baseIssueRow = {
  id: "iss_1",
  type: "missing_item",
  status: "open",
  vendorIssueStatus: null,
  customerMessage: "no fries",
  vendorResponse: null,
  vendorRespondedAt: null,
  createdAt: new Date("2026-01-01T12:00:00Z"),
  updatedAt: new Date("2026-01-01T12:00:00Z"),
  resolvedAt: null,
  orderId: "ord_1",
  vendorOrderId: "vo_1",
  orderLineItemId: null,
  orderLineItem: null,
  vendorOrder: {
    id: "vo_1",
    fulfillmentStatus: "confirmed",
    routingStatus: "routed",
  },
  linkedOrderRefund: null,
};

describe("vendor-order-issue.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderIssueFindMany.mockResolvedValue([baseIssueRow]);
    mockOrderIssueFindFirst.mockResolvedValue(baseIssueRow);
    mockOrderIssueUpdate.mockResolvedValue({});
  });

  it("lists issues for vendor scoped vendor orders", async () => {
    const issues = await listVendorOrderIssues("vendor_1", "active");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.pickupCode).toBeTruthy();
    expect(mockOrderIssueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
          submittedByRole: "customer",
        }),
      })
    );
  });

  it("excludes whole-order issues without vendor scope from results", async () => {
    mockOrderIssueFindMany.mockResolvedValue([
      {
        ...baseIssueRow,
        id: "iss_order",
        vendorOrderId: null,
        orderLineItemId: null,
        vendorOrder: null,
        orderLineItem: null,
      },
      baseIssueRow,
    ]);
    const issues = await listVendorOrderIssues("vendor_1");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe("iss_1");
  });

  it("vendor can acknowledge issue", async () => {
    mockOrderIssueFindFirst
      .mockResolvedValueOnce(baseIssueRow)
      .mockResolvedValueOnce({
        ...baseIssueRow,
        vendorIssueStatus: "acknowledged",
      });
    const r = await updateVendorOrderIssue("vendor_1", "iss_1", {
      action: "acknowledge",
      userId: "user_1",
    });
    expect(r.ok).toBe(true);
    expect(mockOrderIssueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendorIssueStatus: "acknowledged" }),
      })
    );
  });

  it("vendor respond requires message", async () => {
    const r = await updateVendorOrderIssue("vendor_1", "iss_1", {
      action: "respond",
      vendorResponse: "  ",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("RESPONSE_REQUIRED");
    expect(mockOrderIssueUpdate).not.toHaveBeenCalled();
  });

  it("vendor can save response", async () => {
    mockOrderIssueFindFirst
      .mockResolvedValueOnce(baseIssueRow)
      .mockResolvedValueOnce({
        ...baseIssueRow,
        vendorResponse: "remaking item",
        vendorIssueStatus: "acknowledged",
      });
    const r = await updateVendorOrderIssue("vendor_1", "iss_1", {
      action: "respond",
      vendorResponse: "remaking item",
      userId: "user_1",
    });
    expect(r.ok).toBe(true);
    expect(mockOrderIssueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorResponse: "remaking item",
          vendorIssueStatus: "acknowledged",
        }),
      })
    );
  });

  it("vendor cannot access other vendor issue", async () => {
    mockOrderIssueFindFirst.mockResolvedValue(null);
    const r = await updateVendorOrderIssue("vendor_2", "iss_1", {
      action: "acknowledge",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_FOUND");
  });

  it("maps customer refund status without amount", async () => {
    mockOrderIssueFindMany.mockResolvedValue([
      {
        ...baseIssueRow,
        linkedOrderRefund: { status: "succeeded" },
      },
    ]);
    const issues = await listVendorOrderIssues("vendor_1");
    expect(issues[0]?.customerRefundStatus).toBe("Customer refunded");
  });
});
