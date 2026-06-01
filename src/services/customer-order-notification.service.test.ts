import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react")>();
  return { ...mod, cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn };
});

const mockOrderFindUnique = vi.fn();
const mockOrderIssueFindUnique = vi.fn();
const mockSmsLogFindUnique = vi.fn();
const mockSendOrderReceivedSms = vi.fn();
const mockSendOrderPreparingSms = vi.fn();
const mockSendOrderReadySms = vi.fn();
const mockSendOrderCancelledSms = vi.fn();
const mockSendOrderIssueSms = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
    },
    orderIssue: {
      findUnique: (...args: unknown[]) => mockOrderIssueFindUnique(...args),
    },
    smsMessageLog: {
      findUnique: (...args: unknown[]) => mockSmsLogFindUnique(...args),
    },
  },
}));

vi.mock("@/services/sms.service", () => ({
  sendOrderReceivedSms: (...args: unknown[]) => mockSendOrderReceivedSms(...args),
  sendOrderPreparingSms: (...args: unknown[]) => mockSendOrderPreparingSms(...args),
  sendOrderReadySms: (...args: unknown[]) => mockSendOrderReadySms(...args),
  sendOrderCancelledSms: (...args: unknown[]) => mockSendOrderCancelledSms(...args),
  sendOrderIssueSms: (...args: unknown[]) => mockSendOrderIssueSms(...args),
}));

import {
  buildMilestoneSmsBody,
  evaluateCustomerOrderMilestones,
  milestoneIdempotencyKey,
  orderStatusUrl,
  sendOrderReceivedMilestone,
  sendOrderIssueMilestone,
} from "./customer-order-notification.service";

const ORDER_ID = "ord_test1234567890";
const VO_A = "vo_a";
const VO_B = "vo_b";
const PHONE = "+15551234567";

function makeOrder(overrides?: {
  vendorOrders?: Array<{
    id: string;
    fulfillmentStatus: string;
    routingStatus?: string;
    vendorName?: string;
  }>;
  parentStatus?: string;
}) {
  const vendorOrders = (overrides?.vendorOrders ?? [
    { id: VO_A, fulfillmentStatus: "pending", routingStatus: "confirmed", vendorName: "Vendor A" },
  ]).map((vo) => ({
    id: vo.id,
    fulfillmentStatus: vo.fulfillmentStatus,
    routingStatus: vo.routingStatus ?? "confirmed",
    vendor: { name: vo.vendorName ?? "Vendor A" },
  }));

  return {
    id: ORDER_ID,
    customerPhone: PHONE,
    status: overrides?.parentStatus ?? "routing",
    pod: { name: "Test Pod" },
    vendorOrders,
  };
}

describe("customer-order-notification.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderFindUnique.mockImplementation(async () => makeOrder());
    mockSmsLogFindUnique.mockResolvedValue(null);
    mockSendOrderReceivedSms.mockResolvedValue({ status: "sent" });
    mockSendOrderPreparingSms.mockResolvedValue({ status: "sent" });
    mockSendOrderReadySms.mockResolvedValue({ status: "sent" });
    mockSendOrderCancelledSms.mockResolvedValue({ status: "sent" });
    mockSendOrderIssueSms.mockResolvedValue({ status: "sent" });
  });

  describe("orderStatusUrl (deprecated stub)", () => {
    it("returns placeholder in tests", () => {
      expect(orderStatusUrl(ORDER_ID)).toBe("https://example.com/order");
    });
  });

  describe("buildMilestoneSmsBody (deprecated stub)", () => {
    it("returns milestone label", () => {
      expect(
        buildMilestoneSmsBody("order_received", {
          podName: "P",
          vendorName: "V",
          pickupCode: "1",
          orderStatusUrl: "u",
        })
      ).toBe("milestone:order_received");
    });
  });

  describe("sendOrderReceivedMilestone", () => {
    it("delegates to sendOrderReceivedSms", async () => {
      await sendOrderReceivedMilestone(ORDER_ID, PHONE);
      expect(mockSendOrderReceivedSms).toHaveBeenCalledWith({ to: PHONE, orderId: ORDER_ID });
    });
  });

  describe("sendOrderIssueMilestone", () => {
    it("sends order_issue once for customer-reported issue", async () => {
      mockOrderIssueFindUnique.mockResolvedValue({
        id: "iss_1",
        orderId: ORDER_ID,
        submittedByRole: "customer",
      });

      await sendOrderIssueMilestone(ORDER_ID, "iss_1");

      expect(mockSendOrderIssueSms).toHaveBeenCalledWith({
        to: PHONE,
        orderId: ORDER_ID,
        issueId: "iss_1",
      });
    });

    it("does not send for internal system issues", async () => {
      mockOrderIssueFindUnique.mockResolvedValue({
        id: "iss_sys",
        orderId: ORDER_ID,
        submittedByRole: "system",
      });

      await sendOrderIssueMilestone(ORDER_ID, "iss_sys");

      expect(mockSendOrderIssueSms).not.toHaveBeenCalled();
    });

    it("does not resend when milestone already committed", async () => {
      mockOrderIssueFindUnique.mockResolvedValue({
        id: "iss_1",
        orderId: ORDER_ID,
        submittedByRole: "customer",
      });
      mockSmsLogFindUnique.mockResolvedValue({ status: "sent" });

      await sendOrderIssueMilestone(ORDER_ID, "iss_1");

      expect(mockSendOrderIssueSms).not.toHaveBeenCalled();
    });
  });

  describe("evaluateCustomerOrderMilestones — preparing", () => {
    it("sends preparing SMS when vendor enters preparing", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          vendorOrders: [{ id: VO_A, fulfillmentStatus: "preparing", vendorName: "Vendor A" }],
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "vendor_dashboard",
      });

      expect(mockSendOrderPreparingSms).toHaveBeenCalledWith({
        to: PHONE,
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
      });
    });
  });

  describe("evaluateCustomerOrderMilestones — ready", () => {
    it("single vendor ready sends ORDER_READY", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          vendorOrders: [{ id: VO_A, fulfillmentStatus: "ready", vendorName: "Vendor A" }],
          parentStatus: "ready",
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "vendor_dashboard",
      });

      expect(mockSendOrderReadySms).toHaveBeenCalledWith({
        to: PHONE,
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
      });
    });

    it("multi-vendor first ready does not SMS until final vendor ready", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          parentStatus: "in_progress",
          vendorOrders: [
            { id: VO_A, fulfillmentStatus: "ready", vendorName: "Vendor A" },
            { id: VO_B, fulfillmentStatus: "preparing", vendorName: "Vendor B" },
          ],
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "deliverect",
      });

      expect(mockSendOrderReadySms).not.toHaveBeenCalled();
    });

    it("multi-vendor final ready sends ORDER_READY", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          parentStatus: "ready",
          vendorOrders: [
            { id: VO_A, fulfillmentStatus: "ready", vendorName: "Vendor A" },
            { id: VO_B, fulfillmentStatus: "ready", vendorName: "Vendor B" },
          ],
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_B,
        source: "deliverect",
      });

      expect(mockSendOrderReadySms).toHaveBeenCalledWith({
        to: PHONE,
        orderId: ORDER_ID,
        vendorOrderId: VO_B,
      });
    });

    it("duplicate ready events do not duplicate SMS", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          vendorOrders: [{ id: VO_A, fulfillmentStatus: "ready", vendorName: "Vendor A" }],
        })
      );
      mockSmsLogFindUnique.mockResolvedValue({ status: "sent" });

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "deliverect",
      });

      expect(mockSendOrderReadySms).not.toHaveBeenCalled();
    });
  });

  describe("evaluateCustomerOrderMilestones — cancellation", () => {
    it("whole order cancelled sends ORDER_CANCELLED once", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          parentStatus: "cancelled",
          vendorOrders: [
            { id: VO_A, fulfillmentStatus: "cancelled", vendorName: "Vendor A" },
            { id: VO_B, fulfillmentStatus: "cancelled", vendorName: "Vendor B" },
          ],
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_B,
        source: "customer",
      });

      expect(mockSendOrderCancelledSms).toHaveBeenCalledWith({
        to: PHONE,
        orderId: ORDER_ID,
      });
      expect(mockSendOrderCancelledSms).toHaveBeenCalledTimes(1);
    });

    it("partial vendor cancel does not send SMS", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          parentStatus: "in_progress",
          vendorOrders: [
            { id: VO_A, fulfillmentStatus: "cancelled", vendorName: "Vendor A" },
            { id: VO_B, fulfillmentStatus: "preparing", vendorName: "Vendor B" },
          ],
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "vendor_dashboard",
      });

      expect(mockSendOrderCancelledSms).not.toHaveBeenCalled();
    });
  });

  describe("dev_simulator", () => {
    it("does not send SMS for dev_simulator source", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          vendorOrders: [{ id: VO_A, fulfillmentStatus: "ready", vendorName: "Vendor A" }],
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "dev_simulator",
      });

      expect(mockSendOrderReadySms).not.toHaveBeenCalled();
    });
  });

  describe("milestoneIdempotencyKey", () => {
    it("maps order_received to ORDER_RECEIVED key", () => {
      expect(milestoneIdempotencyKey("order_received", ORDER_ID)).toBe(
        `sms:ORDER_RECEIVED:${ORDER_ID}`
      );
    });
  });
});
