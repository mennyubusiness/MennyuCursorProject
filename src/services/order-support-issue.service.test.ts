import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    orderLineItem: { findUnique: vi.fn() },
    vendorOrder: { findUnique: vi.fn() },
    orderIssue: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderRefund: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/services/customer-order-notification.service", () => ({
  sendOrderIssueMilestone: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db";
import { sendOrderIssueMilestone } from "@/services/customer-order-notification.service";
import {
  createCustomerSupportIssue,
  findDuplicateOpenCustomerIssue,
  linkSupportIssueToOrderRefund,
  validateLinkedOrderIssueForAdminRefund,
  validateSupportIssueScope,
} from "./order-support-issue.service";

describe("order-support-issue.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid vendor order for order", async () => {
    vi.mocked(prisma.vendorOrder.findUnique).mockResolvedValue({ orderId: "other" } as never);
    const r = await validateSupportIssueScope({
      orderId: "ord_1",
      vendorOrderId: "vo_bad",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_VENDOR_ORDER");
  });

  it("rejects line item from another order", async () => {
    vi.mocked(prisma.orderLineItem.findUnique).mockResolvedValue({
      id: "li_1",
      vendorOrderId: "vo_1",
      vendorOrder: { orderId: "ord_other" },
    } as never);
    const r = await validateSupportIssueScope({
      orderId: "ord_1",
      orderLineItemId: "li_1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_LINE_ITEM");
  });

  it("prevents duplicate open customer issue", async () => {
    vi.mocked(prisma.orderIssue.findFirst).mockResolvedValue({ id: "existing" } as never);
    const dup = await findDuplicateOpenCustomerIssue({
      orderId: "ord_1",
      issueType: "missing_item",
      vendorOrderId: null,
      orderLineItemId: null,
    });
    expect(dup?.id).toBe("existing");
  });

  it("validateLinkedOrderIssueForAdminRefund rejects wrong order", async () => {
    vi.mocked(prisma.orderIssue.findFirst).mockResolvedValue(null);
    const r = await validateLinkedOrderIssueForAdminRefund({
      orderId: "ord_1",
      linkedOrderIssueId: "iss_x",
      refundScope: "full_order",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ISSUE_NOT_FOUND");
  });

  it("validateLinkedOrderIssueForAdminRefund rejects vendor mismatch", async () => {
    vi.mocked(prisma.orderIssue.findFirst).mockResolvedValue({
      id: "iss_1",
      orderId: "ord_1",
      vendorOrderId: "vo_a",
      orderLineItemId: null,
    } as never);
    const r = await validateLinkedOrderIssueForAdminRefund({
      orderId: "ord_1",
      linkedOrderIssueId: "iss_1",
      refundScope: "full_vendor_order",
      refundVendorOrderId: "vo_b",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ISSUE_VENDOR_MISMATCH");
  });

  it("linkSupportIssueToOrderRefund only links succeeded refunds by default", async () => {
    vi.mocked(prisma.orderIssue.findFirst).mockResolvedValue({ id: "iss_1" } as never);
    vi.mocked(prisma.orderRefund.findFirst).mockResolvedValue({ status: "failed" } as never);
    await linkSupportIssueToOrderRefund({
      orderId: "ord_1",
      orderRefundId: "or_1",
      issueId: "iss_1",
    });
    expect(prisma.orderIssue.update).not.toHaveBeenCalled();
  });

  it("linkSupportIssueToOrderRefund links when refund succeeded", async () => {
    vi.mocked(prisma.orderIssue.findFirst).mockResolvedValue({ id: "iss_1" } as never);
    vi.mocked(prisma.orderRefund.findFirst).mockResolvedValue({ status: "succeeded" } as never);
    vi.mocked(prisma.orderIssue.update).mockResolvedValue({} as never);
    await linkSupportIssueToOrderRefund({
      orderId: "ord_1",
      orderRefundId: "or_1",
      issueId: "iss_1",
    });
    expect(prisma.orderIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "iss_1" },
        data: { linkedOrderRefundId: "or_1" },
      })
    );
  });

  it("createCustomerSupportIssue does not call refund services", async () => {
    vi.mocked(prisma.orderIssue.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.orderIssue.create).mockResolvedValue({
      id: "iss_1",
      type: "other",
      status: "open",
      vendorOrderId: null,
      orderLineItemId: null,
      customerMessage: "help",
      createdAt: new Date(),
    } as never);

    const result = await createCustomerSupportIssue({
      orderId: "ord_1",
      issueType: "other",
      customerMessage: "help",
    });
    expect(result.ok).toBe(true);
    expect(sendOrderIssueMilestone).toHaveBeenCalledWith("ord_1", "iss_1");
    expect(prisma.orderIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submittedByRole: "customer",
          status: "open",
        }),
      })
    );
  });
});
