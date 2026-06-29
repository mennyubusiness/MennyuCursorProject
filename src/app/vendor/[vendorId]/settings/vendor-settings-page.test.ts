import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  resolveLegacyVendorSettingsRedirect,
  resolveVendorSettingsSection,
  vendorSettingsSectionHref,
} from "@/lib/vendor-settings-sections";

const dir = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
const formSrc = readFileSync(join(dir, "VendorBrandProfileForm.tsx"), "utf8");
const navSrc = readFileSync(join(dir, "../VendorAreaNav.tsx"), "utf8");

describe("vendor profile page routing", () => {
  it("defaults unknown sections to profile", () => {
    expect(resolveVendorSettingsSection(undefined)).toBe("profile");
    expect(resolveVendorSettingsSection("overview")).toBe("overview");
  });

  it("maps legacy section URLs to dedicated workspace pages", () => {
    expect(resolveLegacyVendorSettingsRedirect("v1", "payouts")).toBe("/vendor/v1/payouts");
    expect(resolveLegacyVendorSettingsRedirect("v1", "pos-menu")).toBe("/vendor/v1/connect-pos");
    expect(resolveLegacyVendorSettingsRedirect("v1", "pod-membership", { access: "pod_connected" })).toBe(
      "/vendor/v1/setup?access=pod_connected"
    );
    expect(resolveLegacyVendorSettingsRedirect("v1", "hours")).toBe(null);
    expect(resolveLegacyVendorSettingsRedirect("v1", "profile")).toBe(null);
  });

  it("uses a single settings route for vendor profile", () => {
    expect(vendorSettingsSectionHref("v1", "profile")).toBe("/vendor/v1/settings");
  });
});

describe("vendor profile page content", () => {
  it("renders a focused public profile page without setup warnings", () => {
    expect(pageSrc).toMatch(/title="Vendor Profile"/);
    expect(pageSrc).toMatch(/Manage the public details customers see for this vendor\./);
    expect(pageSrc).toMatch(/title="Public profile"/);
    expect(pageSrc).toMatch(/VendorBrandProfileForm/);
    expect(pageSrc).not.toMatch(/VendorSettingsShell/);
    expect(pageSrc).not.toMatch(/VendorSettingsSectionPanels/);
    expect(pageSrc).not.toMatch(/deriveVendorPodReadiness/);
    expect(pageSrc).not.toMatch(/PrimaryNextAction/);
    expect(pageSrc).not.toMatch(/Setup summary/);
  });

  it("redirects Stripe connect callbacks to the payouts page", () => {
    expect(pageSrc).toMatch(/redirect\(`\/vendor\/\$\{vendorId\}\/payouts\?/);
  });

  it("labels nav and save actions as vendor profile", () => {
    expect(navSrc).toMatch(/Vendor Profile/);
    expect(formSrc).toMatch(/Save profile/);
    expect(formSrc).toMatch(/Cuisine\/category/);
  });
});
