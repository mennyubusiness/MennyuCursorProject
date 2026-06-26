import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");
const settingsDir = join(root, "app/pod/[podId]/settings");
const podDir = join(root, "app/pod/[podId]");

function readSettings(relativePath: string): string {
  return readFileSync(join(settingsDir, relativePath), "utf8");
}

function readPod(relativePath: string): string {
  return readFileSync(join(podDir, relativePath), "utf8");
}

describe("pod settings workspace layout", () => {
  it("uses DashboardShell workspace tier on the settings page", () => {
    const page = readSettings("page.tsx");
    expect(page).toContain('tier="workspace"');
    expect(page).toContain("DashboardShell");
  });

  it("delegates chrome to parent pod layout", () => {
    const layout = readSettings("layout.tsx");
    const parentLayout = readPod("layout.tsx");
    expect(layout).not.toContain("max-w-7xl");
    expect(parentLayout).toContain("PodLayoutChrome");
  });

  it("renders settings page header copy", () => {
    const page = readSettings("page.tsx");
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain('title="Pod Profile"');
    expect(page).not.toContain("Promote & QR");
    expect(page).toContain("public identity");
  });

  it("focuses on profile without cross-page guidance", () => {
    const page = readSettings("page.tsx");
    expect(page).toContain('id="profile"');
    expect(page).toContain("PodBrandProfileForm");
    expect(page).not.toContain("PodOrderingQrSection");
    expect(page).not.toContain("PodPayoutSetupCard");
    expect(page).not.toContain("Promote & QR");
    expect(page).not.toMatch(/QR codes, signage|Pod share payouts are on the/i);
  });
});

describe("pod settings payout account copy", () => {
  it("keeps payout setup on payouts page", () => {
    const payouts = readPod("payouts/page.tsx");
    const view = readPod("payouts/PodPayoutsView.tsx");
    expect(payouts).toContain("loadPodDashboardContext");
    expect(payouts).toContain("PodPayoutsView");
    expect(payouts).toContain("redirect(`/pod/${podId}/dashboard`)");
    expect(view).toContain("PodPayoutSetupCard");
  });

  it("uses payout account copy without earnings amounts in setup card", () => {
    const setupCard = readSettings("PodPayoutSetupCard.tsx");
    expect(setupCard).toContain("Payout account");
    expect(setupCard).toContain("Update payout account");
    expect(setupCard).not.toContain("Your payout account is ready to receive pod owner payments");
    expect(setupCard).not.toMatch(/border-emerald-200 bg-emerald-50/);
    expect(setupCard).not.toMatch(/earnings are available|your earnings|\$[\d,]+/i);
    expect(setupCard).not.toMatch(/\brecipient\b|\bclaim\b|basis points/i);
  });
});

describe("pod settings preserved behavior", () => {
  it("still wires profile save action", () => {
    const form = readSettings("PodBrandProfileForm.tsx");
    expect(form).toContain("updatePodBrandProfile");
    expect(form).toContain("pickupInstructions");
    expect(form).toContain("Save profile");
  });

  it("uses clear logo preview copy without native file-input warning", () => {
    const form = readSettings("PodBrandProfileForm.tsx");
    const upload = readFileSync(join(root, "components/uploads/BrandLogoUploadField.tsx"), "utf8");
    expect(form).toContain("BrandLogoUploadField");
    expect(upload).toContain("Current logo");
    expect(upload).toContain("Choose a new file to replace it");
    expect(upload).toContain("No logo uploaded yet");
    expect(upload).toContain("sr-only");
    expect(upload).not.toContain("No file chosen");
  });
});
