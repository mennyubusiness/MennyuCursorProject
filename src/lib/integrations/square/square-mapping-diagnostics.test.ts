import { describe, expect, it } from "vitest";
import { isSquareNoActiveItemMappingsError } from "@/lib/integrations/square/square-mapping-diagnostics.server";

describe("isSquareNoActiveItemMappingsError", () => {
  it("matches readiness blocker copy", () => {
    expect(
      isSquareNoActiveItemMappingsError(
        "No active Square item mappings for the selected location."
      )
    ).toBe(true);
  });

  it("does not match per-line mapper copy alone", () => {
    expect(
      isSquareNoActiveItemMappingsError(
        'No active Square mapping for menu item "Salmon Avocado Hand Roll".'
      )
    ).toBe(false);
  });
});
