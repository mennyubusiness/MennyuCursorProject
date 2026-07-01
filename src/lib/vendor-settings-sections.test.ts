import { describe, expect, it } from "vitest";

import {
  resolveLegacyVendorSettingsRedirect,
  resolveVendorSettingsSection,
  vendorSettingsSectionHref,
} from "./vendor-settings-sections";

describe("resolveVendorSettingsSection", () => {
  it("defaults to profile", () => {
    expect(resolveVendorSettingsSection(undefined)).toBe("profile");
    expect(resolveVendorSettingsSection("")).toBe("profile");
    expect(resolveVendorSettingsSection("unknown")).toBe("profile");
  });

  it("accepts known legacy section ids", () => {
    expect(resolveVendorSettingsSection("payouts")).toBe("payouts");
    expect(resolveVendorSettingsSection("pod-membership")).toBe("pod-membership");
  });
});

describe("vendorSettingsSectionHref", () => {
  it("points to the vendor profile route", () => {
    expect(vendorSettingsSectionHref("v1")).toBe("/vendor/v1/settings");
    expect(vendorSettingsSectionHref("v1", "payouts")).toBe("/vendor/v1/settings");
  });
});

describe("resolveLegacyVendorSettingsRedirect", () => {
  it("redirects legacy settings sections to dedicated pages", () => {
    expect(resolveLegacyVendorSettingsRedirect("v1", "payouts")).toBe("/vendor/v1/payouts");
    expect(resolveLegacyVendorSettingsRedirect("v1", "payouts", { payout_notice: "link_expired" })).toBe(
      "/vendor/v1/payouts?payout_notice=link_expired"
    );
    expect(resolveLegacyVendorSettingsRedirect("v1", "pos-menu")).toBe("/vendor/v1/connect-pos");
    expect(resolveLegacyVendorSettingsRedirect("v1", "pod-membership")).toBe("/vendor/v1/settings#pod-invites");
    expect(resolveLegacyVendorSettingsRedirect("v1", "ordering")).toBe("/vendor/v1/hours");
    expect(resolveLegacyVendorSettingsRedirect("v1", "account")).toBe("/vendor/v1/dashboard");
  });

  it("keeps profile/overview on the settings route", () => {
    expect(resolveLegacyVendorSettingsRedirect("v1", "profile")).toBe(null);
    expect(resolveLegacyVendorSettingsRedirect("v1", "overview")).toBe(null);
    expect(resolveLegacyVendorSettingsRedirect("v1", undefined)).toBe(null);
  });
});
