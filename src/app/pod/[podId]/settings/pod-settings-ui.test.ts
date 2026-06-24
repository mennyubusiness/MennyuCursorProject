import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");
const settingsDir = join(root, "app/pod/[podId]/settings");
const dashboardDir = join(root, "app/pod/[podId]/dashboard");

function readSettings(relativePath: string): string {
  return readFileSync(join(settingsDir, relativePath), "utf8");
}

describe("pod settings workspace layout", () => {
  it("uses DashboardShell workspace tier on the settings page", () => {
    const page = readSettings("page.tsx");
    const styles = readFileSync(join(root, "components/dashboard/dashboard-styles.ts"), "utf8");

    expect(page).toContain('tier="workspace"');
    expect(page).toContain("DashboardShell");
    expect(page).not.toContain("max-w-2xl");
    expect(styles).toContain("max-w-7xl");
  });

  it("uses wide PodAreaNav and titlebar on settings layout", () => {
    const layout = readSettings("layout.tsx");
    expect(layout).toContain("max-w-7xl");
    expect(layout).toContain("PodAreaNav wide");
    expect(layout).not.toMatch(/PodAreaNav\s*\/>/);
  });

  it("renders settings page header copy", () => {
    const page = readSettings("page.tsx");
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain('title="Pod settings"');
    expect(page).toContain("eyebrow={pod.name}");
    expect(page).toContain("Manage how your pod appears on Open Order");
    expect(page).toContain("Back to overview");
  });

  it("organizes profile, QR, and payout setup sections", () => {
    const page = readSettings("page.tsx");
    expect(page).toContain('id="profile"');
    expect(page).toContain("Public page profile");
    expect(page).toContain('id="payout-setup"');
    expect(page).toContain("Payout setup");
    expect(page).toContain("PodPayoutSetupCard");
    expect(page).toContain("DashboardSection");
    expect(page).toContain("DashboardCard");
    expect(page).toContain("PodOrderingQrSection");
  });

  it("keeps ordering-qr anchor on QR section", () => {
    const qr = readFileSync(join(root, "components/pod/PodOrderingQrSection.tsx"), "utf8");
    expect(qr).toContain('id="ordering-qr"');
    expect(qr).toContain("DASHBOARD_SECTION_SCROLL_CLASS");
    expect(qr).toContain("DashboardCard");
    expect(qr).toContain("PodQrActions");
  });
});

describe("pod settings customer note copy", () => {
  it("does not frame pickup instructions as required on settings surfaces", () => {
    const page = readSettings("page.tsx");
    const form = readSettings("PodBrandProfileForm.tsx");

    expect(page).not.toMatch(/pickup instructions/i);
    expect(form).not.toMatch(/pickup instructions/i);
    expect(form).toContain("Optional customer note");
    expect(form).toContain("Add a short note customers may see on your public pod page");
    expect(form).toContain("pod-customer-note");
  });

  it("uses payout setup copy without earnings amounts on settings page", () => {
    const page = readSettings("page.tsx");
    const setupCard = readSettings("PodPayoutSetupCard.tsx");
    const form = readSettings("PodBrandProfileForm.tsx");
    expect(page).toContain("Payout setup");
    expect(setupCard.toLowerCase()).toContain("payout setup");
    expect(setupCard).not.toMatch(/earnings are available|your earnings|\$[\d,]+/i);
    expect(form).not.toMatch(/\bearnings\b|\brevenue share\b/i);
  });
});

describe("pod settings preserved behavior", () => {
  it("still wires profile save action", () => {
    const form = readSettings("PodBrandProfileForm.tsx");
    expect(form).toContain("updatePodBrandProfile");
    expect(form).toContain("pickupInstructions");
    expect(form).toContain("Save profile");
  });

  it("links dashboard sidebar profile action to settings profile anchor", () => {
    const sidebar = readFileSync(join(dashboardDir, "PodDashboardSidebar.tsx"), "utf8");
    expect(sidebar).toContain("/settings#profile");
    expect(sidebar).toContain("Brand, location, and public page details");
  });
});
