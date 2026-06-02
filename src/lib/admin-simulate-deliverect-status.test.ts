import { describe, expect, it } from "vitest";
import { interpretDeliverectWebhookFlat } from "@/integrations/deliverect/deliverect-status-map";
import {
  evaluateSimulateDeliverectStatusEligibility,
  isAllowedSimulateDeliverectStatusCode,
} from "./admin-simulate-deliverect-status";

const base = {
  orderStatus: "paid",
  fulfillmentStatus: "accepted",
  routingStatus: "confirmed",
  deliverectChannelLinkId: "ch_1",
  vendorDeliverectChannelLinkId: null as string | null,
  deliverectOrderId: "d_ord_1",
};

function mappedFulfillment(code: number): string | null {
  const i = interpretDeliverectWebhookFlat({ status: code, orderStatus: code });
  return i.kind === "mapped" ? i.fulfillmentStatus : null;
}

describe("evaluateSimulateDeliverectStatusEligibility", () => {
  it("requires Deliverect channel link or deliverect order id", () => {
    const r = evaluateSimulateDeliverectStatusEligibility({
      ...base,
      deliverectChannelLinkId: null,
      vendorDeliverectChannelLinkId: null,
      deliverectOrderId: null,
      statusCode: 20,
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.code).toBe("NOT_DELIVERECT_LINKED");
  });

  it("blocks unpaid except failed and unknown test codes", () => {
    const blocked = evaluateSimulateDeliverectStatusEligibility({
      ...base,
      orderStatus: "pending_payment",
      statusCode: 70,
    });
    expect(blocked.eligible).toBe(false);

    const failedOk = evaluateSimulateDeliverectStatusEligibility({
      ...base,
      orderStatus: "pending_payment",
      statusCode: 120,
    });
    expect(failedOk.eligible).toBe(true);

    const unknownOk = evaluateSimulateDeliverectStatusEligibility({
      ...base,
      orderStatus: "pending_payment",
      statusCode: 999,
    });
    expect(unknownOk.eligible).toBe(true);
  });

  it("blocks terminal destructive codes on completed/cancelled rows", () => {
    const r = evaluateSimulateDeliverectStatusEligibility({
      ...base,
      fulfillmentStatus: "completed",
      statusCode: 90,
    });
    expect(r.eligible).toBe(false);
  });
});

describe("Deliverect status code → fulfillment mapping (shared mapper)", () => {
  it.each([
    [20, "accepted"],
    [40, "accepted"],
    [50, "preparing"],
    [60, "preparing"],
    [70, "ready"],
    [90, "completed"],
    [95, "completed"],
    [100, "pending"],
    [110, "cancelled"],
  ] as const)("code %i → %s", (code, fulfillment) => {
    expect(mappedFulfillment(code)).toBe(fulfillment);
  });

  it("code 120 maps to pending fulfillment with failed routing", () => {
    const i = interpretDeliverectWebhookFlat({ status: 120 });
    expect(i.kind).toBe("mapped");
    if (i.kind === "mapped") {
      expect(i.fulfillmentStatus).toBe("pending");
      expect(i.routingStatus).toBe("failed");
    }
  });

  it("unknown code 999 is unmapped", () => {
    expect(mappedFulfillment(999)).toBeNull();
  });

  it("allows only configured simulate codes", () => {
    expect(isAllowedSimulateDeliverectStatusCode(70)).toBe(true);
    expect(isAllowedSimulateDeliverectStatusCode(15)).toBe(false);
  });
});
