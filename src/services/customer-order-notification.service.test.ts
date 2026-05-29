import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react")>();
  return { ...mod, cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn };
});

const mockOrderFindUnique = vi.fn();
const mockOrderIssueFindUnique = vi.fn();
const mockSmsLogFindUnique = vi.fn();
const mockSendTransactionalSms = vi.fn();

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
  sendTransactionalSms: (...args: unknown[]) => mockSendTransactionalSms(...args),
}));

import {
  buildMilestoneSmsBody,
  evaluateCustomerOrderMilestones,
  milestoneIdempotencyKey,
  orderStatusUrl,
  sendOrderReceivedMilestone,
  sendOrderIssueMilestone,
} from "./customer-order-notification.service";
import { getPickupCode } from "@/lib/pickup-code";

const ORDER_ID = "ord_test1234567890";
const VO_A = "vo_a";
const VO_B = "vo_b";
const POD = "Test Pod";
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
    pod: { name: POD },
    vendorOrders,
  };
}

describe("customer-order-notification.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderFindUnique.mockImplementation(async () => makeOrder());
    mockSmsLogFindUnique.mockResolvedValue(null);
    mockSendTransactionalSms.mockResolvedValue({ status: "sent" });
  });

  describe("orderStatusUrl", () => {
    it("includes signed access token for SMS deep links", () => {
      const url = orderStatusUrl(ORDER_ID);
      expect(url).toMatch(new RegExp(`^https://mennyu\\.com/order/${ORDER_ID}\\?access=`));
    });
  });

  describe("buildMilestoneSmsBody", () => {
    const ctx = {
      podName: POD,
      vendorName: "Vendor A",
      pickupCode: "1234",
      orderStatusUrl: `https://mennyu.com/order/${ORDER_ID}`,
    };

    it("builds order_received template", () => {
      expect(buildMilestoneSmsBody("order_received", ctx)).toContain(
        `Open Order received your order at ${POD}`
      );
      expect(buildMilestoneSmsBody("order_received", ctx)).toContain("Pickup code: 1234");
    });

    it("builds single-vendor final ready template", () => {
      expect(
        buildMilestoneSmsBody("final_vendor_ready", ctx, { multiVendor: false })
      ).toBe(
        `Your order is ready for pickup: Vendor A at ${POD}. Pickup code: 1234.`
      );
    });

    it("builds multi-vendor final ready template", () => {
      expect(
        buildMilestoneSmsBody("final_vendor_ready", ctx, { multiVendor: true })
      ).toContain("Your final pickup is ready");
    });

    it("builds vendor-scoped order_issue template", () => {
      expect(
        buildMilestoneSmsBody("order_issue", ctx, { vendorIssue: true })
      ).toBe(
        `There's an issue with your order from Vendor A at ${POD}. Please check your order status page: https://mennyu.com/order/${ORDER_ID}`
      );
    });
  });

  describe("sendOrderReceivedMilestone", () => {
    it("sends order_received with pod and pickup code", async () => {
      await sendOrderReceivedMilestone(ORDER_ID, PHONE);
      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: PHONE,
          eventType: "milestone_order_received",
          idempotencyKey: milestoneIdempotencyKey("order_received", ORDER_ID),
          body: expect.stringContaining(POD),
        })
      );
      expect(mockSendTransactionalSms.mock.calls[0][0].body).toContain(
        `Pickup code: ${getPickupCode(ORDER_ID)}`
      );
    });
  });

  describe("sendOrderIssueMilestone", () => {
    it("sends order_issue once for customer-reported issue", async () => {
      mockOrderIssueFindUnique.mockResolvedValue({
        id: "iss_1",
        orderId: ORDER_ID,
        submittedByRole: "customer",
        vendorOrderId: null,
        vendorOrder: null,
      });

      await sendOrderIssueMilestone(ORDER_ID, "iss_1");

      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "milestone_order_issue",
          idempotencyKey: milestoneIdempotencyKey("order_issue", "iss_1"),
          body: expect.stringContaining(POD),
        })
      );
    });

    it("uses vendor wording when issue is scoped to a vendor order", async () => {
      mockOrderIssueFindUnique.mockResolvedValue({
        id: "iss_2",
        orderId: ORDER_ID,
        submittedByRole: "customer",
        vendorOrderId: VO_A,
        vendorOrder: { vendor: { name: "Taco Shop" } },
      });

      await sendOrderIssueMilestone(ORDER_ID, "iss_2");

      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("your order from Taco Shop"),
        })
      );
    });

    it("does not send for internal system issues", async () => {
      mockOrderIssueFindUnique.mockResolvedValue({
        id: "iss_sys",
        orderId: ORDER_ID,
        submittedByRole: "system",
        vendorOrderId: null,
        vendorOrder: null,
      });

      await sendOrderIssueMilestone(ORDER_ID, "iss_sys");

      expect(mockSendTransactionalSms).not.toHaveBeenCalled();
    });

    it("does not resend when milestone already committed", async () => {
      mockOrderIssueFindUnique.mockResolvedValue({
        id: "iss_1",
        orderId: ORDER_ID,
        submittedByRole: "customer",
        vendorOrderId: null,
        vendorOrder: null,
      });
      mockSmsLogFindUnique.mockResolvedValue({ status: "sent" });

      await sendOrderIssueMilestone(ORDER_ID, "iss_1");

      expect(mockSendTransactionalSms).not.toHaveBeenCalled();
    });
  });

  describe("evaluateCustomerOrderMilestones — ready", () => {
    it("single vendor ready sends final_vendor_ready wording", async () => {
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

      expect(mockSendTransactionalSms).toHaveBeenCalledTimes(1);
      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "milestone_final_vendor_ready",
          idempotencyKey: milestoneIdempotencyKey("final_vendor_ready", ORDER_ID),
          body: expect.stringContaining("Your order is ready for pickup"),
        })
      );
    });

    it("multi-vendor first ready sends vendor_ready", async () => {
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

      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "milestone_vendor_ready",
          idempotencyKey: milestoneIdempotencyKey("vendor_ready", VO_A),
          body: expect.stringContaining("Ready for pickup: Vendor A"),
        })
      );
    });

    it("multi-vendor final ready sends final_vendor_ready", async () => {
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

      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "milestone_final_vendor_ready",
          body: expect.stringContaining("Your final pickup is ready: Vendor B"),
        })
      );
    });

    it("accepted to ready sends only ready milestone", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          vendorOrders: [{ id: VO_A, fulfillmentStatus: "ready", vendorName: "Vendor A" }],
          parentStatus: "ready",
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "deliverect",
      });

      expect(mockSendTransactionalSms).toHaveBeenCalledTimes(1);
      expect(mockSendTransactionalSms.mock.calls[0][0].eventType).toMatch(/ready/);
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

      expect(mockSendTransactionalSms).not.toHaveBeenCalled();
    });
  });

  describe("evaluateCustomerOrderMilestones — completed without ready", () => {
    it("sends final ready once when vendor jumps to completed", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          vendorOrders: [{ id: VO_A, fulfillmentStatus: "completed", vendorName: "Vendor A" }],
          parentStatus: "completed",
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "deliverect",
      });

      expect(mockSendTransactionalSms).toHaveBeenCalledTimes(1);
      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "milestone_final_vendor_ready",
          body: expect.stringContaining("Pickup code:"),
        })
      );
      expect(mockSendTransactionalSms.mock.calls[0][0].body).not.toContain("Completed");
    });

    it("does not send generic completed SMS", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          vendorOrders: [{ id: VO_A, fulfillmentStatus: "completed", vendorName: "Vendor A" }],
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "deliverect",
      });

      for (const call of mockSendTransactionalSms.mock.calls) {
        expect(call[0].eventType).not.toMatch(/order_status_completed/);
      }
    });
  });

  describe("evaluateCustomerOrderMilestones — cancellation", () => {
    it("vendor cancelled sends vendor_cancelled once", async () => {
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

      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "milestone_vendor_cancelled",
          idempotencyKey: milestoneIdempotencyKey("vendor_cancelled", VO_A),
        })
      );
    });

    it("whole order cancelled sends order_cancelled once", async () => {
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

      expect(mockSendTransactionalSms).toHaveBeenCalledTimes(1);
      expect(mockSendTransactionalSms).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "milestone_order_cancelled",
          idempotencyKey: milestoneIdempotencyKey("order_cancelled", ORDER_ID),
        })
      );
    });

    it("skips vendor_cancelled during whole-order pre-preparation cancel", async () => {
      mockOrderFindUnique.mockResolvedValue(
        makeOrder({
          parentStatus: "in_progress",
          vendorOrders: [
            { id: VO_A, fulfillmentStatus: "cancelled", vendorName: "Vendor A" },
            {
              id: VO_B,
              fulfillmentStatus: "pending",
              routingStatus: "sent",
              vendorName: "Vendor B",
            },
          ],
        })
      );

      await evaluateCustomerOrderMilestones({
        orderId: ORDER_ID,
        vendorOrderId: VO_A,
        source: "customer",
      });

      expect(mockSendTransactionalSms).not.toHaveBeenCalled();
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

      expect(mockSendTransactionalSms).not.toHaveBeenCalled();
    });
  });
});
