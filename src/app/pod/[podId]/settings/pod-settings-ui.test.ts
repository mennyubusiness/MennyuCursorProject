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
    expect(page).toContain('title="Settings"');
    expect(page).toContain("Pod profile, location, branding");
  });

  it("focuses settings on profile and links promote/payouts elsewhere", () => {
    const page = readSettings("page.tsx");
    expect(page).toContain('id="profile"');
    expect(page).toContain("PodBrandProfileForm");
    expect(page).not.toContain("PodOrderingQrSection");
    expect(page).not.toContain("PodPayoutSetupCard");
    expect(page).toContain("/promote");
    expect(page).toContain("/payouts");
  });
});

describe("pod settings payout account copy", () => {
  it("keeps payout setup on payouts page", () => {
    const payouts = readPod("payouts/page.tsx");
    expect(payouts).toContain("PodPayoutSetupCard");
    expect(payouts).toContain("loadPodDashboardContext");
    expect(payouts).toContain("PodPayoutSummaryCard");
  });

  it("uses payout account copy without earnings amounts in setup card", () => {
    const setupCard = readSettings("PodPayoutSetupCard.tsx");
    expect(setupCard).toContain("Payout account ready");
    expect(setupCard).toContain("Manage payout account");
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
});
