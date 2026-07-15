import { describe, expect, it } from "vitest";
import {
  adminVendorPrimaryOrderState,
  adminVendorRoutingManagedLabel,
  buildAdminVendorSummary,
  formatAdminAuditActionLabel,
  formatAdminBusinessHoursStatus,
} from "@/lib/admin-vendor-summary";
import type { AdminVendorDetailView } from "@/services/admin-vendor-detail.service";
import type { BusinessHoursEvaluation } from "@/lib/business-time";
import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";

function baseDetail(overrides?: Partial<AdminVendorDetailView["vendor"]>): AdminVendorDetailView {
  return {
    vendor: {
      id: "vendor_1",
      name: "Poke Sea",
      slug: "poke-sea",
      description: "Poke",
      contactEmail: null,
      imageUrl: null,
      isActive: true,
      mennyuOrdersPaused: false,
      deletedAt: null,
      deletedByUserId: null,
      deletedByEmail: null,
      posConnectionStatus: "not_connected",
      posProvider: null,
      deliverectChannelLinkId: null,
      deliverectLocationId: null,
      orderRoutingMode: "square",
      squareOrderRoutingEnabled: false,
      menuSource: "open_order",
      vendorDashboardLastSeenAt: null,
      stripeConnectedAccountId: "acct_1",
      stripeDetailsSubmitted: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      onboardingStatus: "ready_for_next_step",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publicPathPreview: "/pigeon-place/poke-sea",
      ...overrides,
    },
    pods: [
      {
        podId: "pod_1",
        podName: "Pigeon Place",
        podSlug: "pigeon-place",
        podVendorActive: true,
        publicPath: "/pigeon-place/poke-sea",
      },
    ],
    owners: [],
    menuSync: {
      totalItems: 40,
      visibleItems: 40,
      unavailableItems: 0,
      hasPublishedMenu: true,
      hasDraftAwaitingReview: false,
      lastSuccessAt: null,
      lastFailedAt: null,
      refreshConfigured: false,
    },
    readinessSummary: { label: "Orderable", canAcceptOrders: true },
    recentOrders: [],
    slugRedirects: [],
    auditLogs: [],
  };
}

describe("adminVendorRoutingManagedLabel", () => {
  it("maps routing modes to plain language", () => {
    expect(adminVendorRoutingManagedLabel("square")).toBe("Managed in Square");
    expect(adminVendorRoutingManagedLabel("deliverect")).toBe("Managed through Deliverect");
    expect(adminVendorRoutingManagedLabel("manual_dashboard")).toBe("Managed in Open Order");
  });
});

describe("adminVendorPrimaryOrderState", () => {
  it("collapses routing/fulfillment into one business state", () => {
    expect(adminVendorPrimaryOrderState({ routingStatus: "failed", fulfillmentStatus: "pending" }).label).toBe(
      "Routing failed"
    );
    expect(
      adminVendorPrimaryOrderState({ routingStatus: "failed", fulfillmentStatus: "completed" }).label
    ).toBe("Completed with routing issue");
    expect(
      adminVendorPrimaryOrderState({ routingStatus: "sent", fulfillmentStatus: "ready" }).label
    ).toBe("Ready for pickup");
    expect(
      adminVendorPrimaryOrderState({ routingStatus: "confirmed", fulfillmentStatus: "completed" }).label
    ).toBe("Completed");
  });
});

describe("formatAdminAuditActionLabel", () => {
  it("humanizes common vendor audit actions", () => {
    expect(formatAdminAuditActionLabel(ADMIN_AUDIT_ACTION.VENDOR_ORDERING_PAUSED)).toBe(
      "Ordering paused"
    );
    expect(
      formatAdminAuditActionLabel(ADMIN_AUDIT_ACTION.VENDOR_ORDER_ROUTING_MODE_UPDATED, {
        newValue: "square / menu:open_order",
      })
    ).toBe("Order routing changed to Square");
    expect(
      formatAdminAuditActionLabel(ADMIN_AUDIT_ACTION.POD_VENDOR_ATTACHED, {
        podName: "Pigeon Place",
      })
    ).toBe("Added to Pigeon Place");
  });
});

describe("formatAdminBusinessHoursStatus", () => {
  it("formats open/closed without debug fields", () => {
    const open = formatAdminBusinessHoursStatus({
      isOpen: true,
      reasonCode: "open_within_hours",
      matchedDay: {
        day: "wednesday",
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
      },
    } as BusinessHoursEvaluation);
    expect(open.statusLabel).toBe("Open now");
    expect(open.nextChangeLabel).toMatch(/Closes at 9:00 PM/);

    const closed = formatAdminBusinessHoursStatus({
      isOpen: false,
      reasonCode: "closed_before_open",
      matchedDay: {
        day: "thursday",
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
      },
    } as BusinessHoursEvaluation);
    expect(closed.statusLabel).toBe("Closed now");
    expect(closed.nextChangeLabel).toMatch(/Opens today at 9:00 AM/);
  });
});

describe("buildAdminVendorSummary", () => {
  it("surfaces Square coverage attention without raw IDs", () => {
    const summary = buildAdminVendorSummary({
      detail: baseDetail(),
      posSummary: null,
      squareStatus: {
        isSelectable: true,
        hasConnection: true,
        health: { isReady: true, missingRequirements: [], warnings: [] },
        businessName: "Poke Sea",
        locationName: "Poke Sea",
        connectionStatus: "connected",
        missingRequirements: [],
        statusMessage: "connected",
        integrationUrl: "/vendor/vendor_1/integrations/square",
        menuImportsUrl: "/vendor/vendor_1/menu/imports",
      },
      squareInjectionDiagnostics: {
        global: {
          enableSquareIntegration: true,
          squareRoutingLive: true,
          squareEnvironment: "sandbox",
          squareOAuthConfigured: true,
        },
        vendor: {
          vendorId: "vendor_1",
          vendorName: "Poke Sea",
          orderRoutingMode: "square",
          squareOrderRoutingEnabled: false,
          squareConnectionStatus: "connected",
          selectedSquareLocation: "present",
          publishedSquareImportedMenu: "present",
          activeItemMappings: 38,
          activeModifierMappings: 10,
          routingReadiness: "not_ready",
          blockingReasons: [],
          prerequisitesReady: false,
          injectionOperationalReady: false,
          requiredOAuthScopes: [],
          authorizedOAuthScopes: [],
          missingOAuthScopes: [],
          oauthPermissionsVersion: 2,
          mapping: {} as never,
          mappingCoverage: {
            ready: false,
            totalSellableItems: 40,
            mappedSellableItems: 38,
            missingItemIds: ["a", "b"],
            missingRequiredModifierOptionIds: [],
            mappingsExistForAnotherLocation: true,
            alternateLocationIds: ["LOC_OLD"],
            blockers: [],
          },
        },
      },
      hoursDebug: {
        isOpen: true,
        reasonCode: "open_within_hours",
        matchedDay: { day: "wednesday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
      } as BusinessHoursEvaluation,
    });

    expect(summary.overallStatus.key).toBe("integration_issue");
    expect(summary.routingBadge.label).toBe("Managed in Square");
    expect(summary.attentionItems.some((i) => i.id === "square-coverage")).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/ENABLE_SQUARE|externalMerchantId|LOC_OLD/);
    expect(summary.attentionItems[0]?.consequence).toMatch(/previous Square location/i);
  });

  it("does not elevate dashboard offline for Square-managed vendors", () => {
    const summary = buildAdminVendorSummary({
      detail: baseDetail({ vendorDashboardLastSeenAt: null }),
      posSummary: null,
      squareStatus: {
        isSelectable: true,
        hasConnection: true,
        health: { isReady: true, missingRequirements: [], warnings: [] },
        businessName: "Poke Sea",
        locationName: "Poke Sea",
        connectionStatus: "connected",
        missingRequirements: [],
        statusMessage: "ok",
        integrationUrl: "/",
        menuImportsUrl: "/",
      },
      squareInjectionDiagnostics: {
        global: {
          enableSquareIntegration: true,
          squareRoutingLive: true,
          squareEnvironment: "sandbox",
          squareOAuthConfigured: true,
        },
        vendor: {
          vendorId: "vendor_1",
          vendorName: "Poke Sea",
          orderRoutingMode: "square",
          squareOrderRoutingEnabled: false,
          squareConnectionStatus: "connected",
          selectedSquareLocation: "present",
          publishedSquareImportedMenu: "present",
          activeItemMappings: 40,
          activeModifierMappings: 10,
          routingReadiness: "ready",
          blockingReasons: [],
          prerequisitesReady: true,
          injectionOperationalReady: true,
          requiredOAuthScopes: [],
          authorizedOAuthScopes: [],
          missingOAuthScopes: [],
          oauthPermissionsVersion: 2,
          mapping: {} as never,
          mappingCoverage: {
            ready: true,
            totalSellableItems: 40,
            mappedSellableItems: 40,
            missingItemIds: [],
            missingRequiredModifierOptionIds: [],
            mappingsExistForAnotherLocation: false,
            alternateLocationIds: [],
            blockers: [],
          },
        },
      },
      hoursDebug: {
        isOpen: true,
        reasonCode: "open_within_hours",
        matchedDay: { day: "wednesday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
      } as BusinessHoursEvaluation,
    });

    expect(summary.attentionItems.some((i) => i.id === "dashboard-offline")).toBe(false);
    expect(summary.overallStatus.key).toBe("accepting_orders");
  });
});
