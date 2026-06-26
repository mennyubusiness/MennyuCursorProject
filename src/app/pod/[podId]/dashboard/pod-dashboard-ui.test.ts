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
  it("loads shared context and renders focused dashboard sections only", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain("loadPodDashboardContext");
    expect(page).toContain("PodStatusCard");
    expect(page).toContain("PodVendorReadinessSection");
    expect(page).toContain("PodNeedsAttentionSection");
    expect(page).toContain("PodTodayActivitySection");
    expect(page).toContain("PodRecentActivitySection");
    expect(page).not.toContain("PodPromotePreviewSection");
    expect(page).not.toContain("PodDashboardSidebar");
    expect(page).not.toContain("withSidebar");
  });

  it("does not duplicate vendors invite or promote tools on the dashboard", () => {
    const page = readDashboard("page.tsx");
    const readiness = readDashboard("PodVendorReadinessSection.tsx");
    const attention = readDashboard("PodNeedsAttentionSection.tsx");
    expect(readiness).not.toContain("Invite vendor");
    expect(readiness).toContain("Manage vendors");
    expect(attention).not.toContain("POD_ALL_READY_COPY");
    expect(attention).toContain("return null");
  });

  it("does not load individual orders on the dashboard", () => {
    const page = readDashboard("page.tsx");
    expect(page).not.toMatch(/vendorOrder\.findMany|OrderDetail|pickupCode|customerName/i);
  });
});

describe("pod dedicated pages", () => {
  it("defines vendors, analytics, promote, payouts, and setup routes", () => {
    expect(readPod("vendors/page.tsx")).toContain("PodVendorsFilterBar");
    expect(readPod("vendors/page.tsx")).toContain("PodVendorsPageActions");
    expect(readPod("vendors/page.tsx")).not.toContain("PodDashboardInviteVendorSection");
    expect(readPod("analytics/page.tsx")).toContain("getPodAnalyticsExtended");
    expect(readPod("analytics/page.tsx")).not.toContain("redirect(");
    expect(readPod("promote/page.tsx")).toContain("PodOrderingQrSection");
    expect(readPod("promote/page.tsx")).toContain("PodPromotionCard");
    expect(readPod("promote/page.tsx")).not.toContain("featuredVendors");
    expect(readPod("payouts/page.tsx")).toContain("PodPayoutsView");
    expect(readPod("setup/page.tsx")).toContain("VendorSetupChecklist");
    expect(readPod("setup/page.tsx")).not.toContain("Recommended");
  });
});

describe("pod promote page", () => {
  it("focuses on share and announcement without featured vendors or developer notes", () => {
    const page = readPod("promote/page.tsx");
    const share = readFileSync(join(root, "components/pod/PodOrderingQrSection.tsx"), "utf8");
    const announcement = readDashboard("PodPromotionCard.tsx");
    const qrActions = readFileSync(join(root, "components/pod/PodQrActions.tsx"), "utf8");

    expect(page).toContain("Share your public pod page and keep announcements fresh");
    expect(share).toContain("Share your pod");
    expect(share).not.toContain("PUBLIC_APP_URL");
    expect(share).not.toContain("Developer");
    expect(share).toContain("QR code is not available yet");
    expect(qrActions).toContain("Copy link");
    expect(qrActions).toContain("Download QR");
    expect(qrActions).toContain("View public page");
    expect(announcement).toContain('title="Announcement"');
    expect(announcement).toContain("Post a short update customers will see on your public pod page");
    expect(announcement).toContain("Save announcement");
    expect(announcement).toContain("Live music tonight");
    expect(announcement).not.toContain("Featured vendors");
    expect(announcement).not.toContain("featuredVendors");
  });
});

describe("pod vendors invite modal", () => {
  it("moves invite flows into a modal with clear new vs existing paths", () => {
    const page = readPod("vendors/page.tsx");
    const actions = readPod("vendors/PodVendorsPageActions.tsx");
    const modal = readPod("vendors/PodInviteVendorsModal.tsx");
    const form = readPod("vendors/PodInviteNewVendorForm.tsx");
    const search = readDashboard("PodDashboardVendorSearch.tsx");

    expect(page).not.toContain("Add another vendor");
    expect(actions).toContain("Invite vendors");
    expect(modal).toContain("Invite a new vendor");
    expect(modal).toContain("Add an existing vendor");
    expect(modal).toContain("PodDashboardVendorSearch");
    expect(form).toContain("Send invite");
    expect(form).toContain("When the vendor creates an account");
    expect(search).toContain("Search by vendor name or email");
    expect(search).toContain("No vendors found.");
    expect(search).toContain("Send pod invite");
  });
});

describe("pod analytics aggregate-only", () => {
  it("exposes vendor breakdown without customer fields", () => {
    const analytics = readFileSync(join(root, "services/pod-analytics.service.ts"), "utf8");
    expect(analytics).toContain("getPodAnalyticsExtended");
    expect(analytics).toContain("vendorBreakdown");
    expect(analytics).toContain("podRevenueShareInRangeCents");
    expect(analytics).toContain("podPayoutAllocation");
    expect(analytics).toContain("POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund");
    expect(analytics).not.toMatch(/customerPhone|customerEmail|pickupCode/i);
  });

  it("analytics view shows overview, trends, and vendor breakdown tables", () => {
    const view = readPod("analytics/PodAnalyticsView.tsx");
    expect(view).toContain("Vendor breakdown");
    expect(view).toContain("Orders and sales by day");
    expect(view).toContain("Pod revenue share");
    expect(view).toContain("From eligible pod sales");
    expect(view).toContain("podRevenueShareInRangeCents");
    expect(view).not.toMatch(/pickup code|customer name|basis point|transfer id/i);
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
  it("uses focused payouts page sections", () => {
    const page = readPod("payouts/page.tsx");
    const view = readPod("payouts/PodPayoutsView.tsx");
    const earnings = readPod("payouts/PodPayoutEarningsSummary.tsx");
    const history = readPod("payouts/PodPayoutHistorySection.tsx");

    expect(page).toContain("PodPayoutsView");
    expect(page).not.toContain("Open settings");
    expect(page).not.toContain("pickup instructions");
    expect(view).toContain("Payout settings");
    expect(view).not.toContain("PodPayoutSummaryCard");
    expect(earnings).toContain("Pending payout");
    expect(earnings).toContain("Paid to date");
    expect(earnings).toContain("Eligible sales");
    expect(earnings).not.toContain("Pod share");
    expect(history).toContain("No payouts yet");
    expect(history).not.toMatch(/stripe|transfer id|basis point/i);
  });
});
