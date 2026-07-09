import { describe, expect, it, vi } from "vitest";
import {
  evaluateSquareOrderTotalComparison,
  SQUARE_TOTAL_MISMATCH_ADMIN_COPY,
} from "@/lib/integrations/square/square-order-total-comparison";

vi.mock("@/lib/env", () => ({
  env: {
    SQUARE_TOTAL_MISMATCH_WARN_CENTS: "1",
    SQUARE_TOTAL_MISMATCH_BLOCK_CENTS: undefined,
  },
}));

describe("evaluateSquareOrderTotalComparison", () => {
  it("warns when OO and Square totals differ by at least warn threshold", () => {
    const result = evaluateSquareOrderTotalComparison({
      subtotalCents: 1000,
      taxCents: 100,
      squareOrderTotalCents: 1102,
      squareExternalPaymentCents: 1102,
    });
    expect(result.ooTotalCents).toBe(1100);
    expect(result.squareTotalDifferenceCents).toBe(2);
    expect(result.mismatchWarning).toBe(true);
    expect(result.mismatchBlocked).toBe(false);
  });

  it("does not warn when totals match", () => {
    const result = evaluateSquareOrderTotalComparison({
      subtotalCents: 1000,
      taxCents: 100,
      squareOrderTotalCents: 1100,
      squareExternalPaymentCents: 1100,
    });
    expect(result.mismatchWarning).toBe(false);
  });
});

describe("SQUARE_TOTAL_MISMATCH_ADMIN_COPY", () => {
  it("mentions reconciliation", () => {
    expect(SQUARE_TOTAL_MISMATCH_ADMIN_COPY).toMatch(/Square calculated a different order total/i);
  });
});
