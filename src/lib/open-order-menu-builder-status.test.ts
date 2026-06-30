import { describe, expect, it } from "vitest";
import {
  hasOpenOrderMenuUnpublishedChanges,
  resolveMenuBuilderPublishStatus,
} from "@/lib/open-order-menu-builder-status";

describe("open-order-menu-builder-status", () => {
  it("detects unpublished changes via fingerprint mismatch", () => {
    expect(
      hasOpenOrderMenuUnpublishedChanges({
        draftFingerprint: "abc",
        publishedFingerprint: "def",
      })
    ).toBe(true);
    expect(
      hasOpenOrderMenuUnpublishedChanges({
        draftFingerprint: "abc",
        publishedFingerprint: "abc",
      })
    ).toBe(false);
    expect(
      hasOpenOrderMenuUnpublishedChanges({
        draftFingerprint: "abc",
        publishedFingerprint: null,
      })
    ).toBe(true);
  });

  it("resolves live vs unpublished vs needs attention", () => {
    expect(
      resolveMenuBuilderPublishStatus({
        hasPublishedOpenOrderMenu: true,
        hasUnpublishedChanges: false,
        validationReady: true,
        blockerCount: 0,
      }).kind
    ).toBe("live");

    expect(
      resolveMenuBuilderPublishStatus({
        hasPublishedOpenOrderMenu: true,
        hasUnpublishedChanges: true,
        validationReady: true,
        blockerCount: 0,
      }).headline
    ).toMatch(/unpublished changes/i);

    expect(
      resolveMenuBuilderPublishStatus({
        hasPublishedOpenOrderMenu: true,
        hasUnpublishedChanges: true,
        validationReady: false,
        blockerCount: 2,
      }).kind
    ).toBe("needs_attention");
  });
});
