import { describe, expect, it } from "vitest";
import {
  isLegacyClawbackReviewClosed,
  LEGACY_CLAWBACK_REVIEW_EXPLANATION,
  legacyClawbackReviewStatusLabel,
} from "@/lib/legacy-clawback-review";

describe("legacy-clawback-review", () => {
  it("treats reviewed and deferred as closed", () => {
    expect(isLegacyClawbackReviewClosed("reviewed")).toBe(true);
    expect(isLegacyClawbackReviewClosed("deferred")).toBe(true);
    expect(isLegacyClawbackReviewClosed(null)).toBe(false);
    expect(isLegacyClawbackReviewClosed("open")).toBe(false);
  });

  it("explains incomplete ledger without implying recovery", () => {
    expect(LEGACY_CLAWBACK_REVIEW_EXPLANATION).toMatch(/cannot safely prepare/i);
    expect(LEGACY_CLAWBACK_REVIEW_EXPLANATION).not.toMatch(/recovered/i);
  });

  it("labels review statuses for admin UI", () => {
    expect(legacyClawbackReviewStatusLabel("reviewed")).toBe("Reviewed");
    expect(legacyClawbackReviewStatusLabel("deferred")).toBe("Deferred");
  });
});
