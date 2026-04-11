import { describe, it, expect } from "vitest";
import type { getOrderStatusAction } from "@/actions/order.actions";
import { mergeCustomerOrderPollPatch } from "./merge-customer-order-poll";

type Order = NonNullable<Awaited<ReturnType<typeof getOrderStatusAction>>>;

function baseOrder(): Order {
  return {
    id: "ord1",
    podId: "p1",
    customerPhone: "+15555550100",
    subtotalCents: 1000,
    serviceFeeCents: 100,
    tipCents: 200,
    taxCents: 50,
    totalCents: 1350,
    status: "in_progress",
    requestedPickupAt: null,
    derivedStatus: "in_progress",
    statusLabel: "In progress",
    resolvedPickupTimezone: "America/New_York",
    statusHistory: [],
    refundAttempts: [],
    vendorOrders: [
      {
        id: "vo1",
        orderId: "ord1",
        vendorId: "v1",
        routingStatus: "confirmed",
        fulfillmentStatus: "preparing",
        totalCents: 1000,
        subtotalCents: 900,
        tipCents: 0,
        taxCents: 50,
        serviceFeeCents: 50,
        vendorProcessingFeeRecoveryCents: 0,
        vendor: { id: "v1", name: "Kitchen A", slug: "ka", logoUrl: null },
        lineItems: [
          {
            id: "li1",
            name: "Burger",
            quantity: 2,
            priceCents: 450,
            selections: [{ id: "s1", nameSnapshot: "Cheese", quantity: 1 }],
          },
        ],
        statusHistory: [],
        manuallyRecoveredAt: null,
        manuallyRecoveredBy: null,
      } as unknown as Order["vendorOrders"][number],
    ],
    pod: { id: "p1", pickupTimezone: "America/New_York" },
  } as unknown as Order;
}

describe("mergeCustomerOrderPollPatch", () => {
  it("keeps line items and vendor extras when the poll payload omits them", () => {
    const prev = baseOrder();
    const patch = {
      ...prev,
      derivedStatus: "ready",
      statusLabel: "Ready",
      vendorOrders: [
        {
          id: "vo1",
          orderId: "ord1",
          vendorId: "v1",
          routingStatus: "confirmed",
          fulfillmentStatus: "ready",
          totalCents: 1000,
          subtotalCents: 900,
          tipCents: 0,
          taxCents: 50,
          serviceFeeCents: 50,
          vendorProcessingFeeRecoveryCents: 0,
          vendor: { id: "v1", name: "Kitchen A" },
          lineItems: [],
          statusHistory: [],
          manuallyRecoveredAt: null,
          manuallyRecoveredBy: null,
        } as unknown as Order["vendorOrders"][number],
      ],
    } as unknown as Order;

    const merged = mergeCustomerOrderPollPatch(prev, patch);
    expect(merged.derivedStatus).toBe("ready");
    expect(merged.vendorOrders[0].fulfillmentStatus).toBe("ready");
    expect(merged.vendorOrders[0].lineItems).toHaveLength(1);
    expect(merged.vendorOrders[0].lineItems[0].name).toBe("Burger");
    expect((merged.vendorOrders[0].vendor as { slug?: string }).slug).toBe("ka");
  });
});
