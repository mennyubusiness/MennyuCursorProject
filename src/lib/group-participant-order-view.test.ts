import { describe, expect, it } from "vitest";
import { filterOrderForGroupParticipantView } from "./group-participant-order-view";

describe("filterOrderForGroupParticipantView", () => {
  const baseOrder = {
    subtotalCents: 5000,
    serviceFeeCents: 500,
    taxCents: 0,
    tipCents: 200,
    totalCents: 5700,
    refundAttempts: [{ id: "ra_1" }],
    orderRefunds: [{ id: "or_1" }],
    issues: [{ id: "i_1" }],
    vendorOrders: [
      {
        id: "vo_1",
        vendor: { id: "v_1", name: "Vendor A" },
        totalCents: 3000,
        routingStatus: "sent",
        fulfillmentStatus: "preparing",
        lineItems: [
          {
            id: "li_host",
            name: "Host Burger",
            quantity: 1,
            priceCents: 2000,
            groupOrderParticipantId: "part_host",
          },
          {
            id: "li_alex",
            name: "Alex Pizza",
            quantity: 1,
            priceCents: 1000,
            groupOrderParticipantId: "part_alex",
          },
        ],
      },
    ],
  };

  it("keeps only participant lines and strips payment/refund payloads", () => {
    const filtered = filterOrderForGroupParticipantView(baseOrder, "part_alex", "part_host");
    expect(filtered.vendorOrders[0]?.lineItems).toHaveLength(1);
    expect(filtered.vendorOrders[0]?.lineItems[0]?.name).toBe("Alex Pizza");
    expect(filtered.participantSubtotalCents).toBe(1000);
    expect(filtered.hasOtherGroupItems).toBe(true);
    expect(filtered.refundAttempts).toEqual([]);
    expect(filtered.orderRefunds).toEqual([]);
    expect(filtered.issues).toEqual([]);
  });
});
