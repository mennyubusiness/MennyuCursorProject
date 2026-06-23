import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");

describe("pod dashboard P0 UI", () => {
  it("loads analytics and renders business-first dashboard sections", () => {
    const page = readFileSync(join(root, "app/pod/[podId]/dashboard/page.tsx"), "utf8");
    expect(page).toContain("getPodAnalytics");
    expect(page).toContain("PodDashboardMetrics");
    expect(page).toContain("PodDashboardQuickActions");
    expect(page).toContain("demoteSetupChecklist");
    expect(page).toMatch(/PodDashboardMetrics[\s\S]*PodDashboardQuickActions[\s\S]*PodVendorAdoptionBoard/);
  });

  it("uses canonical slug URLs in quick actions", () => {
    const quickActions = readFileSync(
      join(root, "app/pod/[podId]/dashboard/PodDashboardQuickActions.tsx"),
      "utf8"
    );
    expect(quickActions).toContain("buildPodCustomerPath");
    expect(quickActions).toContain("#ordering-qr");
    expect(quickActions).toContain("View public pod page");
  });

  it("uses canonical slug URLs in roster vendor links", () => {
    const roster = readFileSync(join(root, "app/pod/[podId]/dashboard/PodVendorRosterPanel.tsx"), "utf8");
    expect(roster).toContain("buildVendorMenuCustomerPath");
    expect(roster).not.toMatch(/\/pod\/\$\{podId\}\/vendor\/\$\{row\.vendorId\}/);
  });

  it("labels metrics without earnings language", () => {
    const metrics = readFileSync(join(root, "app/pod/[podId]/dashboard/PodDashboardMetrics.tsx"), "utf8");
    expect(metrics).toContain("Open Order volume");
    expect(metrics).toContain("No Open Order sales yet");
    expect(metrics).not.toMatch(/earnings|revenue share|payout/i);
  });

  it("anchors QR section on settings page", () => {
    const qr = readFileSync(join(root, "components/pod/PodOrderingQrSection.tsx"), "utf8");
    expect(qr).toContain('id="ordering-qr"');
  });
});

describe("pod dashboard vendor adoption UI", () => {
  it("renders adoption board without reordering roster drag sort", () => {
    const page = readFileSync(join(root, "app/pod/[podId]/dashboard/page.tsx"), "utf8");
    expect(page).toContain("PodVendorAdoptionBoard");
    expect(page).toContain("buildPodAdoptionAttentionRows");

    const roster = readFileSync(join(root, "app/pod/[podId]/dashboard/PodVendorRosterPanel.tsx"), "utf8");
    expect(roster).toContain("DndContext");
    expect(roster).toContain("arrayMove");
    expect(roster).toContain("Pause in pod");
    expect(roster).toContain("Remove from pod");
  });

  it("surfaces needs-attention section and copy actions", () => {
    const board = readFileSync(join(root, "app/pod/[podId]/dashboard/PodVendorAdoptionBoard.tsx"), "utf8");
    expect(board).toContain("Needs attention");
    expect(board).toContain("Copy reminder");
    expect(board).toContain("Copy setup link");
    expect(board).toContain("buildVendorMenuCustomerPath");
    expect(board).not.toMatch(/fetch\(|sendEmail|twilio|sms/i);
  });

  it("uses owner-facing live and blocker labels in roster", () => {
    const roster = readFileSync(join(root, "app/pod/[podId]/dashboard/PodVendorRosterPanel.tsx"), "utf8");
    expect(roster).toContain("podOwnerVendorDisplayStatus");
  });
});

describe("pod dashboard activity feed UI", () => {
  it("wires activity feed after adoption board and before setup checklist", () => {
    const page = readFileSync(join(root, "app/pod/[podId]/dashboard/page.tsx"), "utf8");
    expect(page).toContain("getPodActivityFeed");
    expect(page).toContain("PodDashboardActivityFeed");
    expect(page).toMatch(
      /PodVendorAdoptionBoard[\s\S]*PodDashboardActivityFeed[\s\S]*PodDashboardSetupChecklist/
    );
  });

  it("renders empty-state guidance with quick links", () => {
    const feed = readFileSync(
      join(root, "app/pod/[podId]/dashboard/PodDashboardActivityFeed.tsx"),
      "utf8"
    );
    expect(feed).toContain("No recent pod activity yet");
    expect(feed).toContain("QR &amp; signage");
    expect(feed).toContain("buildPodCustomerPath");
    expect(feed).not.toMatch(/customerPhone|customerEmail|revenue|payout/i);
  });

  it("keeps activity service queries free of customer fields", () => {
    const service = readFileSync(join(root, "services/pod-activity.service.ts"), "utf8");
    expect(service).not.toMatch(/customerPhone|customerEmail|customerAccountId|totalCents|vendorGross/i);
    expect(service).toContain("buildCurrentStatusActivityItems");
  });
});

describe("pod dashboard promotion tools UI", () => {
  it("places promotion card after activity feed", () => {
    const page = readFileSync(join(root, "app/pod/[podId]/dashboard/page.tsx"), "utf8");
    expect(page).toContain("PodPromotionCard");
    expect(page).toMatch(/PodDashboardActivityFeed[\s\S]*PodPromotionCard[\s\S]*PodDashboardSetupChecklist/);
  });

  it("renders announcement management and featured vendor summary", () => {
    const card = readFileSync(join(root, "app/pod/[podId]/dashboard/PodPromotionCard.tsx"), "utf8");
    expect(card).toContain("Promote your pod");
    expect(card).toContain("updatePodAnnouncement");
    expect(card).toContain("Show on public pod page");
    expect(card).toContain("Feature a vendor from the roster");
    expect(card).toContain("Copy public page link");
    expect(card).toContain("POD_ANNOUNCEMENT_MAX_LENGTH");
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
    "app/pod/[podId]/dashboard/page.tsx",
    "app/pod/[podId]/dashboard/PodDashboardMetrics.tsx",
    "app/pod/[podId]/dashboard/PodDashboardQuickActions.tsx",
    "app/pod/[podId]/dashboard/PodVendorAdoptionBoard.tsx",
    "app/pod/[podId]/dashboard/PodDashboardActivityFeed.tsx",
    "app/pod/[podId]/dashboard/PodPromotionCard.tsx",
    "app/pod/[podId]/dashboard/PodDashboardSetupChecklist.tsx",
    "app/pod/[podId]/dashboard/PodDashboardInviteVendorSection.tsx",
  ];

  it("uses null-safe announcement state on the dashboard page", () => {
    const page = readFileSync(join(root, "app/pod/[podId]/dashboard/page.tsx"), "utf8");
    expect(page).toContain("resolvePodDashboardAnnouncementState");
    expect(page).toContain("announcementState.initialText");
    expect(page).toContain("announcementState.initialIsActive");
  });

  it("does not use earnings or payout language in dashboard surfaces", () => {
    for (const file of dashboardFiles) {
      const src = readFileSync(join(root, file), "utf8");
      expect(src).not.toMatch(/\bearnings\b|\brevenue share\b|\bpayout\b/i);
    }
  });

  it("includes mobile overflow guards on long text surfaces", () => {
    const promotion = readFileSync(
      join(root, "app/pod/[podId]/dashboard/PodPromotionCard.tsx"),
      "utf8"
    );
    const activity = readFileSync(
      join(root, "app/pod/[podId]/dashboard/PodDashboardActivityFeed.tsx"),
      "utf8"
    );
    const banner = readFileSync(join(root, "components/pod/PodAnnouncementBanner.tsx"), "utf8");

    expect(promotion).toContain("overflow-wrap:anywhere");
    expect(activity).toContain("overflow-wrap:anywhere");
    expect(banner).toContain("overflow-wrap:anywhere");
    expect(promotion).toContain("compact");
  });

  it("only highlights orderable featured vendors on public cards", () => {
    const gridCard = readFileSync(join(root, "components/pod/PodVendorCard.tsx"), "utf8");
    const destinationCard = readFileSync(
      join(root,
        "components/pod/destination/DestinationPodVendorCard.tsx"),
      "utf8"
    );
    expect(gridCard).toMatch(/isFeatured && !availability\.unavailable/);
    expect(destinationCard).toMatch(/isFeatured && !unavailable/);
  });
});
