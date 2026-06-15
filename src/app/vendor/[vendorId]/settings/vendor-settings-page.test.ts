import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const pageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
const shellSrc = readFileSync(join(dir, "VendorSettingsShell.tsx"), "utf8");
const panelsSrc = readFileSync(join(dir, "VendorSettingsSectionPanels.tsx"), "utf8");
const sectionsSrc = readFileSync(join(dir, "../../../../lib/vendor-settings-sections.ts"), "utf8");

describe("vendor settings section routing", () => {
  it("resolves section from search params with overview default", () => {
    expect(pageSrc).toMatch(/resolveVendorSettingsSection\(sp\.section\)/);
    expect(sectionsSrc).toMatch(/return "overview"/);
  });

  it("redirects Stripe connect return to payouts section", () => {
    expect(pageSrc).toMatch(/settingsRedirectPath\(vendorId, "payouts"\)/);
  });
});

describe("vendor settings workspace layout", () => {
  it("uses full-width shell on settings route", () => {
    expect(readFileSync(join(dir, "../VendorLayoutChrome.tsx"), "utf8")).toMatch(/max-w-7xl/);
  });

  it("renders sidebar section navigation", () => {
    expect(shellSrc).toMatch(/VENDOR_SETTINGS_SECTIONS/);
    expect(shellSrc).toMatch(/aria-label="Settings sections"/);
    expect(shellSrc).toMatch(/vendor-settings-section-mobile/);
  });
});

describe("vendor settings section content", () => {
  it("overview shows checklist and cards, not all forms", () => {
    const overviewBlock = panelsSrc.match(/case "overview":[\s\S]*?case "profile":/)?.[0] ?? "";
    expect(overviewBlock).toMatch(/data-settings-section="overview"/);
    expect(overviewBlock).toMatch(/VendorSetupChecklist/);
    expect(overviewBlock).toMatch(/OverviewSectionCards/);
    expect(overviewBlock).not.toMatch(/VendorBrandProfileForm/);
    expect(overviewBlock).not.toMatch(/VendorStripePayoutCard/);
  });

  it("profile section renders brand form only", () => {
    expect(panelsSrc).toMatch(/data-settings-section="profile"/);
    expect(panelsSrc).toMatch(/VendorBrandProfileForm/);
  });

  it("payouts section renders Stripe card", () => {
    expect(panelsSrc).toMatch(/data-settings-section="payouts"/);
    expect(panelsSrc).toMatch(/VendorStripePayoutCard/);
  });

  it("pos-menu section consolidates Deliverect and menu controls", () => {
    expect(panelsSrc).toMatch(/data-settings-section="pos-menu"/);
    expect(panelsSrc).toMatch(/VendorPosConnectionPanel/);
    expect(panelsSrc).toMatch(/MennyuLocationIdField/);
    expect(panelsSrc).toMatch(/VendorAutoPublishToggle/);
    expect(panelsSrc).toMatch(/DeliverectMenuHealthPanel/);
  });

  it("ordering section renders pause toggle", () => {
    expect(panelsSrc).toMatch(/data-settings-section="ordering"/);
    expect(panelsSrc).toMatch(/VendorPauseToggle/);
  });

  it("pod membership section renders invitations and activity", () => {
    expect(panelsSrc).toMatch(/data-settings-section="pod-membership"/);
    expect(panelsSrc).toMatch(/VendorPodRequests/);
    expect(panelsSrc).toMatch(/VendorRecentPodRequests/);
  });

  it("account section renders dashboard access card", () => {
    expect(panelsSrc).toMatch(/data-settings-section="account"/);
    expect(panelsSrc).toMatch(/VendorDashboardAccessCard/);
  });
});

describe("vendor settings preserved actions", () => {
  it("keeps existing form and action components wired through panels", () => {
    expect(panelsSrc).toMatch(/VendorBrandProfileForm/);
    expect(panelsSrc).toMatch(/VendorStripePayoutCard/);
    expect(panelsSrc).toMatch(/VendorAutoPublishToggle/);
    expect(panelsSrc).toMatch(/VendorPauseToggle/);
  });
});
