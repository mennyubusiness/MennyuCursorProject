import { describe, expect, it } from "vitest";
import {
  formatCollaborativeCartFingerprint,
  type CollaborativeCartFingerprintParts,
} from "./group-order-fingerprint.service";

function baseParts(over: Partial<CollaborativeCartFingerprintParts> = {}): CollaborativeCartFingerprintParts {
  const t = new Date("2026-01-15T12:00:00.000Z");
  return {
    sessionStatus: "active",
    sessionUpdatedAt: t,
    lockedAt: null,
    cartUpdatedAt: t,
    maxCartItemUpdatedAt: t,
    maxSelectionUpdatedAt: t,
    activeParticipantCount: 2,
    cartLineCount: 3,
    ...over,
  };
}

describe("formatCollaborativeCartFingerprint", () => {
  it("changes when line count changes", () => {
    const a = formatCollaborativeCartFingerprint(baseParts({ cartLineCount: 3 }));
    const b = formatCollaborativeCartFingerprint(baseParts({ cartLineCount: 4 }));
    expect(a).not.toBe(b);
  });

  it("changes when session status changes", () => {
    const a = formatCollaborativeCartFingerprint(baseParts({ sessionStatus: "active" }));
    const b = formatCollaborativeCartFingerprint(baseParts({ sessionStatus: "locked_checkout" }));
    expect(a).not.toBe(b);
  });

  it("is stable for identical parts", () => {
    const p = baseParts();
    expect(formatCollaborativeCartFingerprint(p)).toBe(formatCollaborativeCartFingerprint(p));
  });
});
