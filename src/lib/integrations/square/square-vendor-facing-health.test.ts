import { describe, expect, it } from "vitest";
import {
  filterSquareVendorFacingWarnings,
  isSquareInternalDiagnosticWarning,
} from "@/lib/integrations/square/square-vendor-facing-health";

describe("square vendor-facing health", () => {
  it("treats sandbox/production redirect mismatch as internal diagnostic only", () => {
    const warning =
      "SQUARE_OAUTH_REDIRECT_URL uses production domain while SQUARE_ENVIRONMENT is sandbox — confirm Square sandbox redirect URL matches exactly";
    expect(isSquareInternalDiagnosticWarning(warning)).toBe(true);
    expect(filterSquareVendorFacingWarnings([warning])).toEqual([]);
  });

  it("keeps actionable vendor warnings", () => {
    const warning = "Square location not selected";
    expect(isSquareInternalDiagnosticWarning(warning)).toBe(false);
    expect(filterSquareVendorFacingWarnings([warning])).toEqual([warning]);
  });
});
