import { describe, expect, it } from "vitest";
import { formatSquareRoutingConnectedMessage } from "@/lib/integrations/square/square-routing-readiness";

describe("square routing readiness helpers", () => {
  it("formats connected status message with business and location", () => {
    expect(
      formatSquareRoutingConnectedMessage({
        businessName: "Test Cafe",
        locationName: "Main Street",
      })
    ).toBe("Square is connected to Test Cafe — Main Street.");
  });
});
