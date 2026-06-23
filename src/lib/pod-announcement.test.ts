import { describe, expect, it } from "vitest";

import {
  getPublicPodAnnouncementText,
  normalizePodAnnouncementText,
  POD_ANNOUNCEMENT_MAX_LENGTH,
  resolvePodDashboardAnnouncementState,
  shouldShowPodAnnouncement,
  validatePodAnnouncementText,
} from "./pod-announcement";

describe("normalizePodAnnouncementText", () => {
  it("trims whitespace and strips control characters", () => {
    expect(normalizePodAnnouncementText("  Live music Friday  \n")).toBe("Live music Friday");
    expect(normalizePodAnnouncementText("Hello\u0007world")).toBe("Helloworld");
  });
});

describe("validatePodAnnouncementText", () => {
  it("accepts short plain text", () => {
    expect(validatePodAnnouncementText("New cart now open")).toEqual({
      ok: true,
      value: "New cart now open",
    });
  });

  it("rejects text over max length", () => {
    const long = "a".repeat(POD_ANNOUNCEMENT_MAX_LENGTH + 1);
    const result = validatePodAnnouncementText(long);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(String(POD_ANNOUNCEMENT_MAX_LENGTH));
    }
  });

  it("allows empty text for clearing", () => {
    expect(validatePodAnnouncementText("   ")).toEqual({ ok: true, value: "" });
  });
});

describe("getPublicPodAnnouncementText", () => {
  it("shows only active non-empty announcements", () => {
    expect(getPublicPodAnnouncementText("Holiday hours updated", true)).toBe("Holiday hours updated");
    expect(getPublicPodAnnouncementText("Holiday hours updated", false)).toBeNull();
    expect(getPublicPodAnnouncementText("   ", true)).toBeNull();
  });

  it("does not treat inactive announcements as visible", () => {
    expect(shouldShowPodAnnouncement("Live music Friday 6–9 PM", false)).toBe(false);
  });
});

describe("resolvePodDashboardAnnouncementState", () => {
  it("handles null migration defaults safely", () => {
    expect(resolvePodDashboardAnnouncementState(null, false)).toEqual({
      initialText: "",
      initialIsActive: false,
    });
    expect(resolvePodDashboardAnnouncementState(null, true)).toEqual({
      initialText: "",
      initialIsActive: false,
    });
  });

  it("never marks active when text is empty after normalization", () => {
    expect(resolvePodDashboardAnnouncementState("   ", true)).toEqual({
      initialText: "",
      initialIsActive: false,
    });
  });
});
