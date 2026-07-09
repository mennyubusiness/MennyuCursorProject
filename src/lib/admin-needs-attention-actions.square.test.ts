import { describe, expect, it } from "vitest";
import { canRetryRouting } from "@/lib/admin-needs-attention-actions";

describe("canRetryRouting square safety", () => {
  const paidOrder = { status: "paid" };

  it("blocks retry when Square order already sent with id", () => {
    expect(
      canRetryRouting(
        {
          routingStatus: "sent",
          fulfillmentStatus: "pending",
          squareOrderId: "sq_123",
        },
        paidOrder,
        "square"
      )
    ).toBe(false);
  });

  it("allows retry when Square routing failed without order id", () => {
    expect(
      canRetryRouting(
        {
          routingStatus: "failed",
          fulfillmentStatus: "pending",
          squareOrderId: null,
        },
        paidOrder,
        "square"
      )
    ).toBe(true);
  });

  it("allows payment-only retry when Square order id exists but not sent", () => {
    expect(
      canRetryRouting(
        {
          routingStatus: "failed",
          fulfillmentStatus: "pending",
          squareOrderId: "sq_partial",
        },
        paidOrder,
        "square"
      )
    ).toBe(true);
  });
});
