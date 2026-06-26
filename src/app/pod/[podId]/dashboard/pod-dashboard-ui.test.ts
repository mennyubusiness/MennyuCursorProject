import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");
const podDir = join(root, "app/pod/[podId]");
const dashboardDir = join(podDir, "dashboard");

function readPod(relativePath: string): string {
  return readFileSync(join(podDir, relativePath), "utf8");
}

function readDashboard(relativePath: string): string {
  return readFileSync(join(dashboardDir, relativePath), "utf8");
}

describe("pod owner nav and layout", () => {
  it("uses vendor-mirror nav items on PodAreaNav", () => {
    const nav = readPod("PodAreaNav.tsx");
    expect(nav).toMatch(/Dashboard.*Vendors.*Analytics.*Promote.*Payouts.*Setup.*Settings/s);
    expect(nav).not.toContain("Overview");
    expect(nav).not.toContain("Orders");
  });

  it("uses shared PodLayoutChrome for pod owner routes", () => {
    const layout = readPod("layout.tsx");
    const chrome = readPod("PodLayoutChrome.tsx");
    expect(layout).toContain("PodLayoutChrome");
    expect(chrome).toContain("PodAreaNav");
    expect(chrome).toContain("/vendors");
    expect(chrome).toContain("/analytics");
    expect(chrome).toContain("/promote");
  });
});

describe("pod dashboard vendor-mirror structure", () => {
  it("loads shared context and renders status, readiness, attention, activity, promote preview", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain("loadPodDashboardContext");
    expect(page).toContain("PodStatusCard");
    expect(page).toContain("PodVendorReadinessSection");
    expect(page).toContain("PodNeedsAttentionSection");
    expect(page).toContain("PodTodayActivitySection");
    expect(page).toContain("PodPromotePreviewSection");
    expect(page).toContain("PodRecentActivitySection");
    expect(page).not.toContain("PodDashboardSidebar");
    expect(page).not.toContain("withSidebar");
  });

  it("does not load individual orders on the dashboard", () => {
    const page = readDashboard("page.tsx");
    expect(page).not.toMatch(/vendorOrder\.findMany|OrderDetail|pickupCode|customerName/i);
  });
});

describe("pod dedicated pages", () => {
  it("defines vendors, analytics, promote, payouts, and setup routes", () => {
    expect(readPod("vendors/page.tsx")).toContain("PodVendorsFilterBar");
    expect(readPod("analytics/page.tsx")).toContain("getPodAnalyticsExtended");
    expect(readPod("analytics/page.tsx")).not.toContain("redirect(");
    expect(readPod("promote/page.tsx")).toContain("PodPromotionCard");
    expect(readPod("promote/page.tsx")).toContain("PodOrderingQrSection");
    expect(readPod("payouts/page.tsx")).toContain("PodPayoutSummaryCard");
    expect(readPod("setup/page.tsx")).toContain("VendorSetupChecklist");
    expect(readPod("setup/page.tsx")).not.toContain("Recommended");
  });
});

describe("pod analytics aggregate-only", () => {
  it("exposes vendor breakdown without customer fields", () => {
    const analytics = readFileSync(join(root, "services/pod-analytics.service.ts"), "utf8");
    expect(analytics).toContain("getPodAnalyticsExtended");
    expect(analytics).toContain("vendorBreakdown");
    expect(analytics).not.toMatch(/customerPhone|customerEmail|pickupCode/i);
  });

  it("analytics view shows overview, trends, and vendor breakdown tables", () => {
    const view = readPod("analytics/PodAnalyticsView.tsx");
    expect(view).toContain("Vendor breakdown");
    expect(view).toContain("Orders and sales by day");
    expect(view).not.toMatch(/pickup code|customer name/i);
  });
});

describe("pod setup checklist", () => {
  it("requires orderable vendor but not pickup instructions", () => {
    const readiness = readFileSync(join(root, "lib/vendor-pod-readiness.ts"), "utf8");
    expect(readiness).toContain("vendor_ready");
    expect(readiness).not.toContain('"pickup_instructions"');
    const attention = readFileSync(join(root, "lib/pod-dashboard-attention.ts"), "utf8");
    expect(attention).not.toMatch(/pickup instructions/i);
  });
});

describe("pod roster and adoption preserved", () => {
  it("keeps roster controls and adoption copy actions", () => {
    const roster = readDashboard("PodVendorRosterPanel.tsx");
    expect(roster).toContain("DndContext");
    expect(roster).toContain("Pause in pod");
    const board = readDashboard("PodVendorAdoptionBoard.tsx");
    expect(board).toContain("Copy reminder");
    expect(board).toContain("buildVendorMenuCustomerPath");
  });
});

describe("pod payout visibility", () => {
  it("links payout card to dedicated payouts page", () => {
    const card = readDashboard("PodPayoutSummaryCard.tsx");
    expect(card).toContain("/payouts");
    expect(card).not.toContain("/settings#payout-setup");
  });
});
