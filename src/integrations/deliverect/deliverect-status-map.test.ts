import { describe, expect, it } from "vitest";
import { interpretDeliverectWebhookFlat } from "./deliverect-status-map";

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
    const i = interpretDeliverectWebhookFlat({ status: 20 });
    expect(i.kind).toBe("mapped");
    if (i.kind === "mapped") {
      expect(i.fulfillmentStatus).toBe("accepted");
    }
  });

  it("maps PRINTED/PREPARING to preparing", () => {
    expect(interpretDeliverectWebhookFlat({ status: 40 }).kind).toBe("mapped");
    const p = interpretDeliverectWebhookFlat({ status: 50 });
    expect(p.kind).toBe("mapped");
    if (p.kind === "mapped") expect(p.fulfillmentStatus).toBe("preparing");
  });
});
