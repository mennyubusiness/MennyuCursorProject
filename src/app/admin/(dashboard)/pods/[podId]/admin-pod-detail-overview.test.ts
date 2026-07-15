import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminPodDir = dirname(fileURLToPath(import.meta.url));

function readAdminPod(relativePath: string): string {
  return readFileSync(join(adminPodDir, relativePath), "utf8");
}

describe("admin pod detail overview hierarchy", () => {
  it("main page uses overview summary without payout dump", () => {
    const page = readAdminPod("page.tsx");
    expect(page).toContain("buildAdminPodSummary");
    expect(page).toContain("AdminPodOverview");
    expect(page).toContain("loadVendorReadinessBundles");
    expect(page).not.toContain("AdminPodPayoutSection");
    expect(page).not.toContain("AdminPodRescueClient");
  });

  it("overview matches vendor detail interaction patterns", () => {
    const overview = readAdminPod("AdminPodOverview.tsx");
    expect(overview).toContain("AdminStatusBadge");
    expect(overview).toContain("AdminStatusCard");
    expect(overview).toContain("AdminAttentionSection");
    expect(overview).toContain("AdminQuickActionButton");
    expect(overview).toContain("Status overview");
    expect(overview).toContain("Quick actions");
    expect(overview).toContain("Recent activity");
    expect(overview).toContain("Advanced settings");
    expect(overview).toContain("Technical diagnostics");
    expect(overview).not.toContain("AdminInfoRow label=\"ID\"");
    expect(overview).not.toContain("ready_for_next_step");
  });

  it("moves technical IDs to diagnostics route", () => {
    const diagnostics = readAdminPod("AdminPodTechnicalDiagnostics.tsx");
    const diagnosticsPage = readAdminPod("diagnostics/page.tsx");
    expect(diagnostics).toContain("Pod ID");
    expect(diagnostics).toContain("Ownership IDs");
    expect(diagnosticsPage).toContain("Technical diagnostics");
    expect(diagnosticsPage).toContain("AdminPodTechnicalDiagnostics");
  });

  it("hosts payouts on dedicated page", () => {
    const payouts = readAdminPod("payouts/page.tsx");
    expect(payouts).toContain("AdminPodPayoutSection");
    expect(payouts).toContain("Pod payouts");
  });
});
