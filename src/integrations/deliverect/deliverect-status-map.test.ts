import { describe, expect, it } from "vitest";
import { interpretDeliverectWebhookFlat } from "./deliverect-status-map";

function mappedFulfillment(code: number) {
  const i = interpretDeliverectWebhookFlat({ status: code });
  expect(i.kind).toBe("mapped");
  if (i.kind === "mapped") return i.fulfillmentStatus;
  throw new Error("expected mapped");
}

describe("interpretDeliverectWebhookFlat — transport vs acceptance", () => {
  it("maps PARSED / pipeline codes to pending fulfillment (Received), not accepted", () => {
    for (const code of [1, 2, 3, 6, 7, 10, 25]) {
      const i = interpretDeliverectWebhookFlat({ status: code });
      expect(i.kind).toBe("mapped");
      if (i.kind === "mapped") {
        expect(i.fulfillmentStatus).toBe("pending");
        expect(i.routingStatus).toBe("confirmed");
      }
    }
  });

  it("maps ACCEPTED (20) to fulfillment accepted", () => {
    expect(mappedFulfillment(20)).toBe("accepted");
  });

  it("maps PRINTED (40) to accepted", () => {
    expect(mappedFulfillment(40)).toBe("accepted");
  });

  it("maps PREPARING (50) to preparing", () => {
    expect(mappedFulfillment(50)).toBe("preparing");
  });

  it("maps PREPARED (60) to preparing, not ready", () => {
    expect(mappedFulfillment(60)).toBe("preparing");
  });

  it("maps PICKUP_READY (70) to ready only", () => {
    expect(mappedFulfillment(70)).toBe("ready");
  });

  it("maps FINALIZED (90) and AUTO_FINALIZED (95) to completed", () => {
    expect(mappedFulfillment(90)).toBe("completed");
    expect(mappedFulfillment(95)).toBe("completed");
  });

  it("maps DISPATCH (100) without advancing to ready or completed", () => {
    expect(mappedFulfillment(100)).toBe("pending");
  });

  it("maps CANCELED (110) to cancelled", () => {
    expect(mappedFulfillment(110)).toBe("cancelled");
  });

  it("maps FAILED (120) to routing failed with pending fulfillment", () => {
    const i = interpretDeliverectWebhookFlat({ status: 120 });
    expect(i.kind).toBe("mapped");
    if (i.kind === "mapped") {
      expect(i.fulfillmentStatus).toBe("pending");
      expect(i.routingStatus).toBe("failed");
    }
  });

  it("returns unmapped for unknown numeric codes without throwing", () => {
    const i = interpretDeliverectWebhookFlat({ status: 9999 });
    expect(i.kind).toBe("unmapped");
  });

  it("maps string PICKUP_READY to ready", () => {
    const i = interpretDeliverectWebhookFlat({ eventType: "PICKUP_READY" });
    expect(i.kind).toBe("mapped");
    if (i.kind === "mapped") expect(i.fulfillmentStatus).toBe("ready");
  });
});
