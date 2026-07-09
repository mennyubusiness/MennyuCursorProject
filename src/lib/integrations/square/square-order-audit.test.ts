import { describe, expect, it } from "vitest";
import {
  extractSquareOrderIdFromAudit,
  squareRoutingFailureGuidance,
} from "@/lib/integrations/square/square-order-audit";

describe("extractSquareOrderIdFromAudit", () => {
  it("prefers persisted squareOrderId", () => {
    expect(extractSquareOrderIdFromAudit("sq_1", null)).toBe("sq_1");
  });

  it("falls back to createOrder response", () => {
    expect(
      extractSquareOrderIdFromAudit(null, {
        createOrder: { order: { id: "sq_from_response" } },
      })
    ).toBe("sq_from_response");
  });
});

describe("squareRoutingFailureGuidance", () => {
  it("guides reconnect when scopes are missing", () => {
    expect(
      squareRoutingFailureGuidance({
        error: "Reconnect Square and approve ORDERS_WRITE/PAYMENTS_WRITE.",
        squareRoutingLive: true,
        hasMappingIssues: false,
      })
    ).toMatch(/ORDERS_WRITE\/PAYMENTS_WRITE/i);
  });

  it("guides mapping repair", () => {
    expect(
      squareRoutingFailureGuidance({
        error: "No active Square mapping",
        squareRoutingLive: true,
        hasMappingIssues: true,
      })
    ).toMatch(/mapping is missing/i);
  });

  it("notes global kill switch", () => {
    expect(
      squareRoutingFailureGuidance({
        error: "SQUARE_ROUTING_LIVE is not enabled",
        squareRoutingLive: false,
        hasMappingIssues: false,
      })
    ).toMatch(/disabled globally/i);
  });
});
