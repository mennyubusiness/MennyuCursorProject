import { describe, expect, it } from "vitest";
import {
  VENDOR_SETTINGS_SECTIONS,
  buildVendorSettingsSectionBadges,
  resolveVendorSettingsSection,
  vendorSettingsSectionHref,
} from "./vendor-settings-sections";

describe("resolveVendorSettingsSection", () => {
  it("defaults to overview when section is missing", () => {
    expect(resolveVendorSettingsSection(undefined)).toBe("overview");
    expect(resolveVendorSettingsSection(null)).toBe("overview");
    expect(resolveVendorSettingsSection("")).toBe("overview");
  });

  it("falls back to overview for invalid section", () => {
    expect(resolveVendorSettingsSection("not-a-section")).toBe("overview");
    expect(resolveVendorSettingsSection("payout")).toBe("overview");
  });

  it("accepts valid section ids", () => {
    expect(resolveVendorSettingsSection("profile")).toBe("profile");
    expect(resolveVendorSettingsSection("pos-menu")).toBe("pos-menu");
    expect(resolveVendorSettingsSection("pod-membership")).toBe("pod-membership");
  });
});

describe("vendorSettingsSectionHref", () => {
  it("omits query param for overview", () => {
    expect(vendorSettingsSectionHref("v1", "overview")).toBe("/vendor/v1/settings");
  });

  it("adds section query param for other sections", () => {
    expect(vendorSettingsSectionHref("v1", "payouts")).toBe("/vendor/v1/settings?section=payouts");
    expect(vendorSettingsSectionHref("v1", "pos-menu")).toBe("/vendor/v1/settings?section=pos-menu");
  });
});

describe("VENDOR_SETTINGS_SECTIONS", () => {
  it("includes expected sidebar sections in order", () => {
    expect(VENDOR_SETTINGS_SECTIONS.map((s) => s.label)).toEqual([
      "Overview",
      "Profile",
      "Payouts",
      "POS & menu",
      "Ordering",
      "Pod membership",
      "Account",
    ]);
  });
});

describe("buildVendorSettingsSectionBadges", () => {
  it("reflects setup, ordering, and pod state", () => {
    const badges = buildVendorSettingsSectionBadges({
      setupSummary: { profile: true, stripe: false, pos: true, menu: false },
      ordersPaused: true,
      pendingPodInviteCount: 2,
      hasPodMembership: false,
    });

    expect(badges.profile).toBe("Complete");
    expect(badges.payouts).toBe("Needs setup");
    expect(badges["pos-menu"]).toBe("Needs menu");
    expect(badges.ordering).toBe("Paused");
    expect(badges["pod-membership"]).toBe("Invite pending");
  });
});
