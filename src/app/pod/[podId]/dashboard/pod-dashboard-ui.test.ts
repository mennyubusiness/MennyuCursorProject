import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");
const dashboardDir = join(root, "app/pod/[podId]/dashboard");

function readDashboard(relativePath: string): string {
  return readFileSync(join(dashboardDir, relativePath), "utf8");
}

describe("pod dashboard P0 UI", () => {
  it("loads analytics and renders business-first dashboard sections", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain("getPodAnalytics");
    expect(page).toContain("PodDashboardMetrics");
    expect(page).toContain("PodDashboardSidebar");
    expect(page).toContain("demoteSetupChecklist");
    expect(page).toContain("PodVendorAdoptionBoard");
  });

  it("uses canonical slug URLs in sidebar quick links", () => {
    const sidebar = readDashboard("PodDashboardSidebar.tsx");
    expect(sidebar).toContain("buildPodCustomerPath");
    expect(sidebar).toContain("#ordering-qr");
    expect(sidebar).toContain("View public pod page");
    expect(sidebar).toContain("Brand, location, and public page details");
  });

  it("uses canonical slug URLs in roster vendor links", () => {
    const roster = readDashboard("PodVendorRosterPanel.tsx");
    expect(roster).toContain("buildVendorMenuCustomerPath");
    expect(roster).not.toMatch(/\/pod\/\$\{podId\}\/vendor\/\$\{row\.vendorId\}/);
  });

  it("labels metrics without earnings language", () => {
    const metrics = readDashboard("PodDashboardMetrics.tsx");
    expect(metrics).toContain("Open Order volume");
    expect(metrics).toContain("No Open Order sales yet");
    expect(metrics).not.toMatch(/earnings|revenue share|payout/i);
  });

  it("anchors QR section on settings page", () => {
    const qr = readFileSync(join(root, "components/pod/PodOrderingQrSection.tsx"), "utf8");
    expect(qr).toContain('id="ordering-qr"');
  });
});

describe("pod dashboard command center layout", () => {
  it("uses a full-width dashboard shell with sidebar", () => {
    const page = readDashboard("page.tsx");
    const layout = readFileSync(join(dashboardDir, "layout.tsx"), "utf8");
    const sidebar = readDashboard("PodDashboardSidebar.tsx");
    const shell = readFileSync(join(root, "components/dashboard/dashboard-styles.ts"), "utf8");

    expect(page).toContain("DashboardShell");
    expect(page).toContain('tier="command"');
    expect(page).toContain("withSidebar");
    expect(shell).toContain("max-w-7xl");
    expect(page).not.toContain("max-w-2xl");
    expect(layout).toContain("max-w-7xl");
    expect(sidebar).toContain("POD_DASHBOARD_SECTIONS");
    expect(sidebar).toContain('href={`#${id}`}');
  });

  it("sidebar contains Overview, Vendors, Promote, Activity, and Setup anchors", () => {
    const sidebar = readDashboard("PodDashboardSidebar.tsx");
    expect(sidebar).toContain('"overview"');
    expect(sidebar).toContain('"vendors"');
    expect(sidebar).toContain('"promote"');
    expect(sidebar).toContain('"activity"');
    expect(sidebar).toContain('"setup"');
    expect(sidebar).toContain("Overview");
    expect(sidebar).toContain("Vendors");
    expect(sidebar).toContain("Promote");
    expect(sidebar).toContain("Activity");
    expect(sidebar).toContain("Setup");
  });

  it("maps section ids on the dashboard page", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain('id="overview"');
    expect(page).toContain('id="vendors"');
    expect(page).toContain('id="promote"');
    expect(page).toContain('id="activity"');
    expect(page).toContain('id="setup"');
    expect(page).toContain("DashboardSection");
  });

  it("uses a responsive two-column main grid on large screens", () => {
    const page = readDashboard("page.tsx");
    expect(page).toMatch(/lg:grid lg:grid-cols-2/);
  });

  it("includes mobile section navigation in the sidebar component", () => {
    const sidebar = readDashboard("PodDashboardSidebar.tsx");
    expect(sidebar).toContain("lg:hidden");
    expect(sidebar).toContain("overflow-x-auto");
    expect(sidebar).toContain('aria-label="Dashboard sections"');
  });
});

describe("pod dashboard shared primitives integration", () => {
  it("uses dashboard primitives on the pod command center page", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain("DashboardShell");
    expect(page).toContain("DashboardShellMain");
    expect(page).toContain("DashboardSection");
    expect(page).toContain("DashboardCard");
  });

  it("uses metric and empty-state primitives in pod metrics", () => {
    const metrics = readDashboard("PodDashboardMetrics.tsx");
    expect(metrics).toContain("DashboardMetricGrid");
    expect(metrics).toContain("DashboardMetricCard");
    expect(metrics).toContain("DashboardEmptyState");
    expect(metrics).toContain("DashboardCard");
  });

  it("uses status badge primitive in pod sidebar", () => {
    const sidebar = readDashboard("PodDashboardSidebar.tsx");
    expect(sidebar).toContain("DashboardStatusBadge");
    expect(sidebar).toContain("DashboardCard");
  });
});

describe("pod dashboard pickup instruction removal", () => {
  const dashboardFiles = [
    "page.tsx",
    "PodDashboardSidebar.tsx",
    "PodDashboardSetupChecklist.tsx",
    "PodDashboardMetrics.tsx",
    "PodVendorAdoptionBoard.tsx",
    "PodDashboardActivityFeed.tsx",
    "PodPromotionCard.tsx",
    "PodDashboardInviteVendorSection.tsx",
    "PodVendorRosterPanel.tsx",
  ];

  it("does not mention pickup instructions on dashboard surfaces", () => {
    for (const file of dashboardFiles) {
      const src = readDashboard(file);
      expect(src).not.toMatch(/pickup instructions/i);
    }
  });

  it("removes pickup instruction checklist item from derivePodSetupChecklist", () => {
    const readiness = readFileSync(join(root, "lib/vendor-pod-readiness.ts"), "utf8");
    expect(readiness).not.toContain("pickup_instructions");
    expect(readiness).not.toContain("Pickup instructions added");
    expect(readiness).not.toContain("Help customers find pickup at your pod");
  });
});

describe("pod dashboard vendor adoption UI", () => {
  it("renders adoption board without reordering roster drag sort", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain("PodVendorAdoptionBoard");
    expect(page).toContain("buildPodAdoptionAttentionRows");

    const roster = readDashboard("PodVendorRosterPanel.tsx");
    expect(roster).toContain("DndContext");
    expect(roster).toContain("arrayMove");
    expect(roster).toContain("Pause in pod");
    expect(roster).toContain("Remove from pod");
  });

  it("surfaces needs-attention section and copy actions", () => {
    const board = readDashboard("PodVendorAdoptionBoard.tsx");
    expect(board).toContain("Needs attention");
    expect(board).toContain("Copy reminder");
    expect(board).toContain("Copy setup link");
    expect(board).toContain("buildVendorMenuCustomerPath");
    expect(board).not.toMatch(/fetch\(|sendEmail|twilio|sms/i);
  });

  it("uses owner-facing live and blocker labels in roster", () => {
    const roster = readDashboard("PodVendorRosterPanel.tsx");
    expect(roster).toContain("podOwnerVendorDisplayStatus");
  });
});

describe("pod dashboard activity feed UI", () => {
  it("wires activity feed in the activity section after promote tools", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain("getPodActivityFeed");
    expect(page).toContain("PodDashboardActivityFeed");
    expect(page).toMatch(/id="promote"[\s\S]*id="activity"[\s\S]*id="setup"/);
  });

  it("renders empty-state guidance without duplicate sidebar links", () => {
    const feed = readDashboard("PodDashboardActivityFeed.tsx");
    expect(feed).toContain("No recent pod activity yet");
    expect(feed).not.toContain("QR &amp; signage");
    expect(feed).not.toContain("View public pod page");
    expect(feed).not.toMatch(/customerPhone|customerEmail|revenue|payout/i);
  });

  it("keeps activity service queries free of customer fields", () => {
    const service = readFileSync(join(root, "services/pod-activity.service.ts"), "utf8");
    expect(service).not.toMatch(/customerPhone|customerEmail|customerAccountId|totalCents|vendorGross/i);
    expect(service).toContain("buildCurrentStatusActivityItems");
  });
});

describe("pod dashboard promotion tools UI", () => {
  it("places promotion card in the promote section", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain("PodPromotionCard");
    expect(page).toMatch(/id="promote"[\s\S]*PodPromotionCard/);
  });

  it("renders announcement management and featured vendor summary", () => {
    const card = readDashboard("PodPromotionCard.tsx");
    expect(card).toContain("Promote your pod");
    expect(card).toContain("updatePodAnnouncement");
    expect(card).toContain("Show on public pod page");
    expect(card).toContain("Feature a vendor from the roster");
    expect(card).toContain("Copy public page link");
    expect(card).toContain("POD_ANNOUNCEMENT_MAX_LENGTH");
  });

  it("avoids duplicating sidebar public page and QR links in the promotion card", () => {
    const card = readDashboard("PodPromotionCard.tsx");
    expect(card).not.toContain("View public pod page");
    expect(card).not.toContain("QR &amp; signage");
  });

  it("shows active announcements only on public pod views", () => {
    const data = readFileSync(join(root, "lib/pod-customer-page-data.ts"), "utf8");
    expect(data).toContain("getPublicPodAnnouncementText");
    expect(data).toContain("activeAnnouncement");

    const standard = readFileSync(join(root, "components/pod/StandardPodPageView.tsx"), "utf8");
    expect(standard).toContain("PodAnnouncementBanner");
    expect(standard).toMatch(/activeAnnouncement \? <PodAnnouncementBanner/);

    const destination = readFileSync(
      join(root, "components/pod/destination/DestinationPodPageView.tsx"),
      "utf8"
    );
    expect(destination).toContain("PodAnnouncementBanner");
  });
});

describe("pod dashboard beta polish", () => {
  const dashboardFiles = [
    "page.tsx",
    "PodDashboardMetrics.tsx",
    "PodVendorAdoptionBoard.tsx",
    "PodDashboardActivityFeed.tsx",
    "PodPromotionCard.tsx",
    "PodDashboardSetupChecklist.tsx",
    "PodDashboardInviteVendorSection.tsx",
    "PodDashboardSidebar.tsx",
  ];

  it("uses null-safe announcement state on the dashboard page", () => {
    const page = readDashboard("page.tsx");
    expect(page).toContain("resolvePodDashboardAnnouncementState");
    expect(page).toContain("announcementState.initialText");
    expect(page).toContain("announcementState.initialIsActive");
  });

  it("does not use earnings or payout language in dashboard surfaces", () => {
    for (const file of dashboardFiles) {
      const src = readDashboard(file);
      expect(src).not.toMatch(/\bearnings\b|\brevenue share\b|\bpayout\b/i);
    }
  });

  it("includes mobile overflow guards on long text surfaces", () => {
    const promotion = readDashboard("PodPromotionCard.tsx");
    const activity = readDashboard("PodDashboardActivityFeed.tsx");
    const banner = readFileSync(join(root, "components/pod/PodAnnouncementBanner.tsx"), "utf8");

    expect(promotion).toContain("overflow-wrap:anywhere");
    expect(activity).toContain("overflow-wrap:anywhere");
    expect(banner).toContain("overflow-wrap:anywhere");
    expect(promotion).toContain("compact");
  });

  it("only highlights orderable featured vendors on public cards", () => {
    const gridCard = readFileSync(join(root, "components/pod/PodVendorCard.tsx"), "utf8");
    const destinationCard = readFileSync(
      join(root, "components/pod/destination/DestinationPodVendorCard.tsx"),
      "utf8"
    );
    expect(gridCard).toMatch(/isFeatured && !availability\.unavailable/);
    expect(destinationCard).toMatch(/isFeatured && !unavailable/);
  });

  it("preserves roster panel controls", () => {
    const roster = readDashboard("PodVendorRosterPanel.tsx");
    expect(roster).toContain("PodVendorRosterPanel");
    expect(roster).toContain("updatePodVendorPresentation");
    expect(roster).toContain("Featured");
  });
});
