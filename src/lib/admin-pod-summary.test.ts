import { describe, expect, it } from "vitest";
import {
  adminPodPrimaryOrderState,
  buildAdminPodSummary,
} from "@/lib/admin-pod-summary";
import type { AdminPodDetailView } from "@/services/admin-pod-detail.service";
import type { VendorReadinessBundle } from "@/lib/vendor-readiness-validation.server";

function baseDetail(overrides?: Partial<AdminPodDetailView>): AdminPodDetailView {
  const detail: AdminPodDetailView = {
    pod: {
      id: "pod_1",
      name: "Pigeon Place",
      slug: "pigeon-place",
      description: "A food hall",
      address: "123 Main St",
      contactEmail: "pod@example.com",
      imageUrl: "https://example.com/banner.jpg",
      pickupTimezone: "America/Los_Angeles",
      isActive: true,
      mennyuOrdersPaused: false,
      orderingEnabled: true,
      deletedAt: null,
      deletedByUserId: null,
      deletedByEmail: null,
      onboardingStatus: "ready_for_next_step",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publicPath: "/pigeon-place",
      publicUrl: "https://example.com/pigeon-place",
    },
    qr: {
      destinationUrl: "https://example.com/pigeon-place",
      matchesCanonical: true,
      staleWarning: null,
      note: "note",
    },
    owners: [{ userId: "u1", email: "owner@example.com", name: "Owner", role: "owner" }],
    vendors: [],
    invites: { pending: 0, accepted: 0, revoked: 0, expired: 0, recent: [] },
    recentOrders: [],
    slugRedirects: [],
    readinessLabel: "Ready",
    activeVendorCount: 0,
    auditLogs: [],
    ...overrides,
  };
  return detail;
}

const ALWAYS_OPEN_HOURS = [
  { day: "monday", isOpen: true, openTime: "00:00", closeTime: "23:59" },
  { day: "tuesday", isOpen: true, openTime: "00:00", closeTime: "23:59" },
  { day: "wednesday", isOpen: true, openTime: "00:00", closeTime: "23:59" },
  { day: "thursday", isOpen: true, openTime: "00:00", closeTime: "23:59" },
  { day: "friday", isOpen: true, openTime: "00:00", closeTime: "23:59" },
  { day: "saturday", isOpen: true, openTime: "00:00", closeTime: "23:59" },
  { day: "sunday", isOpen: true, openTime: "00:00", closeTime: "23:59" },
] as const;

function readyBundle(): VendorReadinessBundle {
  return {
    vendor: {
      isActive: true,
      mennyuOrdersPaused: false,
      orderingEnabled: true,
      customerOrderingHours: [...ALWAYS_OPEN_HOURS],
      name: "Poke Sea",
      slug: "poke-sea",
      description: "Poke",
      imageUrl: "https://example.com/v.jpg",
      cuisineCategory: "Poke",
    },
    menuSummary: {
      hasPublishedMenuVersion: true,
      hasOperationalItems: true,
      hasAvailableOperationalItems: true,
    },
    stripeSummary: {
      stripeConnectedAccountId: "acct_1",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeConnectConfigured: true,
    },
    posSummary: {
      deliverectChannelLinkId: null,
      posConnectionStatus: "not_connected",
      deliverectAutoMapLastOutcome: null,
      pendingDeliverectConnectionKey: null,
      hasUnmatchedChannelRegistration: false,
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
      squareOrderRoutingReady: true,
    },
  };
}

function attachVendor(
  overrides: Partial<AdminPodDetailView["vendors"][number]> = {}
): AdminPodDetailView["vendors"][number] {
  return {
    vendorId: "v1",
    vendorName: "Poke Sea",
    vendorSlug: "poke-sea",
    cuisineCategory: "Poke",
    description: "Poke",
    imageUrl: "https://example.com/v.jpg",
    deletedAt: null,
    podVendorActive: true,
    vendorActive: true,
    mennyuOrdersPaused: false,
    orderingEnabled: true,
    orderRoutingMode: "manual_dashboard",
    customerOrderingHours: [...ALWAYS_OPEN_HOURS],
    claimState: { key: "claimed", label: "Claimed", claimed: true, ownerCount: 1 },
    ...overrides,
  };
}

describe("adminPodPrimaryOrderState", () => {
  it("collapses multi-vendor failures into needs attention when issue is open", () => {
    const state = adminPodPrimaryOrderState({
      status: "paid",
      vendorOrders: [
        {
          routingStatus: "failed",
          fulfillmentStatus: "pending",
          issues: [{ status: "OPEN", type: "routing_failure" }],
        },
        { routingStatus: "sent", fulfillmentStatus: "completed", issues: [] },
        { routingStatus: "confirmed", fulfillmentStatus: "completed", issues: [] },
      ],
    });
    expect(state.label).toBe("Needs attention");
    expect(state.detail).toMatch(/1 of 3 vendors failed/);
  });

  it("reports completed when all vendor orders completed", () => {
    expect(
      adminPodPrimaryOrderState({
        status: "paid",
        vendorOrders: [
          { routingStatus: "confirmed", fulfillmentStatus: "completed" },
          { routingStatus: "sent", fulfillmentStatus: "completed" },
        ],
      }).label
    ).toBe("Completed");
  });
});

describe("buildAdminPodSummary", () => {
  it("marks a healthy pod with orderable vendors as open", () => {
    const detail = baseDetail({ vendors: [attachVendor()] });
    const map = new Map([["v1", readyBundle()]]);
    const summary = buildAdminPodSummary({ detail, readinessByVendorId: map });
    expect(summary.overallStatus.key).toBe("open");
    expect(summary.vendors.visible).toBe(1);
    expect(summary.attentionItems.length).toBe(0);
    expect(JSON.stringify(summary.attentionItems)).not.toMatch(/ready_for_next_step/);
    expect(summary.overallStatus.label).not.toMatch(/ready_for_next_step/);
  });

  it("excludes hidden vendors from visible and open counts", () => {
    const detail = baseDetail({
      vendors: [
        attachVendor({ vendorId: "v1", vendorName: "Visible", vendorSlug: "visible" }),
        attachVendor({
          vendorId: "v2",
          vendorName: "Hidden",
          vendorSlug: "hidden",
          podVendorActive: false,
        }),
      ],
    });
    const map = new Map([
      ["v1", readyBundle()],
      [
        "v2",
        {
          ...readyBundle(),
          vendor: { ...readyBundle().vendor, name: "Hidden", slug: "hidden" },
        },
      ],
    ]);
    const summary = buildAdminPodSummary({ detail, readinessByVendorId: map });
    expect(summary.vendors.totalAttached).toBe(2);
    expect(summary.vendors.hidden).toBeGreaterThanOrEqual(1);
    expect(summary.vendors.visible).toBeLessThan(2);
  });

  it("does not present a pod with zero orderable vendors as open", () => {
    const detail = baseDetail({
      vendors: [attachVendor({ mennyuOrdersPaused: true, vendorName: "Paused", vendorSlug: "paused" })],
    });
    const bundle = readyBundle();
    bundle.vendor.mennyuOrdersPaused = true;
    const summary = buildAdminPodSummary({
      detail,
      readinessByVendorId: new Map([["v1", bundle]]),
    });
    expect(summary.overallStatus.key).not.toBe("open");
    expect(summary.ordering.acceptingOrders).toBe(false);
    expect(
      summary.attentionItems.some((i) =>
        ["no-orderable", "vendors-attention", "no-visible"].includes(i.id)
      )
    ).toBe(true);
  });

  it("marks hidden pods and incomplete setup", () => {
    const hidden = buildAdminPodSummary({
      detail: baseDetail({
        pod: {
          ...baseDetail().pod,
          isActive: false,
        },
      }),
      readinessByVendorId: new Map(),
    });
    expect(hidden.overallStatus.key).toBe("hidden");

    const incomplete = buildAdminPodSummary({
      detail: baseDetail({
        pod: {
          ...baseDetail().pod,
          description: null,
          address: null,
          imageUrl: null,
        },
        owners: [],
      }),
      readinessByVendorId: new Map(),
    });
    expect(incomplete.profile.complete).toBe(false);
    expect(incomplete.attentionItems.some((i) => i.id === "profile")).toBe(true);
    expect(incomplete.attentionItems.some((i) => i.id === "access")).toBe(true);
  });

  it("excludes incomplete Square routing from open counts", () => {
    const detail = baseDetail({
      vendors: [attachVendor({ orderRoutingMode: "square", vendorName: "Square Vendor", vendorSlug: "square-v" })],
    });
    const bundle = readyBundle();
    bundle.posSummary = {
      ...bundle.posSummary,
      orderRoutingMode: "square",
      squareConnectionReady: true,
      squareOrderRoutingReady: false,
    };
    const summary = buildAdminPodSummary({
      detail,
      readinessByVendorId: new Map([["v1", bundle]]),
    });
    expect(summary.vendors.open).toBe(0);
    expect(["routing_issue", "setup_required"]).toContain(summary.vendorRows[0]?.statusKey);
  });
});
