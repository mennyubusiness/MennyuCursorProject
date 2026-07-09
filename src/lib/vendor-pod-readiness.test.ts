import { describe, expect, it } from "vitest";
import {
  derivePodSetupChecklist,
  deriveVendorPodReadiness,
  isVendorCustomerOrderingHoursReady,
  isVendorMenuReady,
  isVendorPodAssignmentReady,
  isVendorPosReady,
  isVendorProfileComplete,
  isVendorStripePayoutReady,
  VENDOR_SETUP_REQUIRED_CHECKLIST_KEYS,
} from "./vendor-pod-readiness";
import { isVendorSetupComplete } from "./vendor-dashboard-attention";
import { getVendorOrderabilityInPod } from "./vendor-orderability-in-pod";
import { defaultVendorCustomerOrderingWeek } from "./vendor-customer-ordering-hours";

const baseVendor = {
  isActive: true,
  mennyuOrdersPaused: false,
  name: "Test Kitchen",
  slug: "test-kitchen",
  description: "Great food",
  imageUrl: "https://example.com/logo.png",
  cuisineCategory: "Tacos",
  contactEmail: "chef@example.com",
  contactPhone: "+15551212",
};

const baseMenu = {
  hasPublishedMenuVersion: true,
  hasOperationalItems: true,
  hasAvailableOperationalItems: true,
};

const baseStripe = {
  stripeConnectedAccountId: "acct_123",
  stripeChargesEnabled: true,
  stripePayoutsEnabled: true,
  stripeConnectConfigured: true,
};

const basePos = {
  deliverectChannelLinkId: "link_1",
  posConnectionStatus: "connected" as const,
  deliverectAutoMapLastOutcome: null,
  pendingDeliverectConnectionKey: null,
  hasUnmatchedChannelRegistration: false,
  orderRoutingMode: "manual_dashboard" as const,
  deliverectMappingReady: true,
};

const baseCustomerOrderingHours = defaultVendorCustomerOrderingWeek();

function readiness(overrides?: Partial<Parameters<typeof deriveVendorPodReadiness>[0]>) {
  return deriveVendorPodReadiness({
    podId: "pod_1",
    vendorId: "vendor_1",
    pod: { isActive: true },
    podVendor: { isActive: true },
    vendor: baseVendor,
    menuSummary: baseMenu,
    posSummary: basePos,
    stripeSummary: baseStripe,
    customerOrderingHours: baseCustomerOrderingHours,
    ...overrides,
  });
}

describe("vendor setup sub-helpers", () => {
  it("detects incomplete profile without cuisine", () => {
    expect(isVendorProfileComplete(baseVendor)).toBe(true);
    expect(isVendorProfileComplete({ ...baseVendor, imageUrl: null })).toBe(false);
    expect(isVendorProfileComplete({ ...baseVendor, cuisineCategory: null })).toBe(false);
  });

  it("detects stripe payout readiness", () => {
    expect(isVendorStripePayoutReady(baseStripe)).toBe(true);
    expect(
      isVendorStripePayoutReady({ ...baseStripe, stripePayoutsEnabled: false })
    ).toBe(false);
  });

  it("detects POS connected state for Deliverect routing mode", () => {
    expect(isVendorPosReady(basePos)).toBe(true);
    expect(
      isVendorPosReady({
        ...basePos,
        orderRoutingMode: "deliverect",
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
      })
    ).toBe(false);
  });

  it("treats manual dashboard routing as POS-ready without Deliverect", () => {
    expect(
      isVendorPosReady({
        ...basePos,
        orderRoutingMode: "manual_dashboard",
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
      })
    ).toBe(true);
  });

  it("detects menu availability", () => {
    expect(isVendorMenuReady(baseMenu)).toBe(true);
    expect(isVendorMenuReady({ ...baseMenu, hasAvailableOperationalItems: false })).toBe(false);
  });

  it("detects customer ordering hours readiness from manual hours only", () => {
    expect(isVendorCustomerOrderingHoursReady(baseCustomerOrderingHours)).toBe(true);
    expect(isVendorCustomerOrderingHoursReady(null)).toBe(false);
    expect(isVendorCustomerOrderingHoursReady(undefined)).toBe(false);
    const allClosed = defaultVendorCustomerOrderingWeek().map((row) => ({ ...row, isOpen: false }));
    expect(isVendorCustomerOrderingHoursReady(allClosed)).toBe(false);
  });

  it("treats pod assignment as ready when vendor has membership, even with pending invites", () => {
    expect(isVendorPodAssignmentReady({ hasPodMembership: true, pendingPodInviteCount: 1 })).toBe(true);
    expect(isVendorPodAssignmentReady({ hasPodMembership: true, pendingPodInviteCount: 0 })).toBe(true);
    expect(isVendorPodAssignmentReady({ hasPodMembership: false, pendingPodInviteCount: 1 })).toBe(false);
    expect(isVendorPodAssignmentReady({ hasPodMembership: false, pendingPodInviteCount: 0 })).toBe(false);
  });
});

describe("deriveVendorPodReadiness status priority", () => {
  it("flags pod inactive first", () => {
    const result = readiness({ pod: { isActive: false } });
    expect(result.status).toBe("pod_inactive");
    expect(result.canAcceptOrders).toBe(false);
  });

  it("flags vendor inactive by Open Order", () => {
    const result = readiness({ vendor: { ...baseVendor, isActive: false } });
    expect(result.status).toBe("inactive_by_open_order");
  });

  it("flags vendor global pause", () => {
    const result = readiness({ vendor: { ...baseVendor, mennyuOrdersPaused: true } });
    expect(result.status).toBe("paused_by_vendor");
  });

  it("flags paused in pod", () => {
    const result = readiness({ podVendor: { isActive: false } });
    expect(result.status).toBe("paused_in_pod");
  });

  it("flags missing profile before payment when cuisine is missing", () => {
    const result = readiness({
      vendor: { ...baseVendor, cuisineCategory: null },
      stripeSummary: { ...baseStripe, stripeConnectedAccountId: null, stripeChargesEnabled: false, stripePayoutsEnabled: false },
    });
    expect(result.status).toBe("needs_profile");
  });

  it("flags missing stripe after public profile complete", () => {
    const result = readiness({
      stripeSummary: { ...baseStripe, stripeConnectedAccountId: null, stripeChargesEnabled: false, stripePayoutsEnabled: false },
    });
    expect(result.status).toBe("needs_payment");
    expect(result.blockingReasons[0]?.owner).toBe("vendor");
  });

  it("flags missing Deliverect setup in deliverect routing mode", () => {
    const result = readiness({
      posSummary: {
        ...basePos,
        orderRoutingMode: "deliverect",
        deliverectMappingReady: false,
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
      },
    });
    expect(result.status).toBe("needs_pos");
  });

  it("marks Square connected when OAuth is ready even without admin order injection", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: {
          ...basePos,
          orderRoutingMode: "square",
          deliverectChannelLinkId: null,
          posConnectionStatus: "not_connected",
          squareConnectionReady: true,
        },
        stripeSummary: baseStripe,
        customerOrderingHours: baseCustomerOrderingHours,
        hasPodMembership: true,
        squareConnectionReady: true,
        squareOrderRoutingReady: false,
      },
      { audience: "vendor" }
    );

    const pos = result.checklist.find((item) => item.key === "pos");
    expect(pos?.complete).toBe(true);
    expect(pos?.label).toBe("Square connected");
    expect(pos?.description).toMatch(/Finish menu import/i);
    expect(pos?.actionLabel).toBe("Manage Square integration");
    expect(result.canAcceptOrders).toBe(true);
  });

  it("does not show Square connection requirement for manual dashboard routing", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: {
          ...basePos,
          orderRoutingMode: "manual_dashboard",
          deliverectChannelLinkId: null,
          posConnectionStatus: "not_connected",
        },
        stripeSummary: baseStripe,
        customerOrderingHours: baseCustomerOrderingHours,
        hasPodMembership: true,
      },
      { audience: "vendor" }
    );

    const pos = result.checklist.find((item) => item.key === "pos");
    expect(pos?.label).toBe("Manual order dashboard ready");
    expect(pos?.complete).toBe(true);
  });

  it("square menu checklist links to Menu Imports when catalog import is ready", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: { ...baseMenu, hasOperationalItems: false, hasAvailableOperationalItems: false },
        posSummary: {
          ...basePos,
          orderRoutingMode: "square",
          deliverectChannelLinkId: null,
          posConnectionStatus: "not_connected",
        },
        stripeSummary: baseStripe,
        squareCatalogImportReady: true,
      },
      { audience: "vendor" }
    );

    const menu = result.checklist.find((item) => item.key === "menu");
    expect(menu?.actionHref).toBe("/vendor/vendor_1/menu/imports");
    expect(menu?.actionLabel).toBe("Open Menu Imports");
  });

  it("square menu checklist links to Square integration when not connected", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: { ...baseMenu, hasOperationalItems: false, hasAvailableOperationalItems: false },
        posSummary: {
          ...basePos,
          orderRoutingMode: "square",
          deliverectChannelLinkId: null,
          posConnectionStatus: "not_connected",
        },
        stripeSummary: baseStripe,
        squareCatalogImportReady: false,
      },
      { audience: "vendor" }
    );

    const menu = result.checklist.find((item) => item.key === "menu");
    expect(menu?.actionHref).toBe("/vendor/vendor_1/integrations/square");
    expect(menu?.actionLabel).toBe("Connect Square");
  });

  it("does not block manual dashboard vendors without Deliverect", () => {
    const result = readiness({
      posSummary: {
        ...basePos,
        orderRoutingMode: "manual_dashboard",
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
      },
    });
    expect(result.status).not.toBe("needs_pos");
    expect(result.canAcceptOrders).toBe(true);
  });

  it("flags missing menu", () => {
    const result = readiness({
      menuSummary: { ...baseMenu, hasAvailableOperationalItems: false, hasOperationalItems: false },
    });
    expect(result.status).toBe("needs_menu");
  });

  it("flags missing customer ordering hours", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: basePos,
        stripeSummary: baseStripe,
        customerOrderingHours: null,
      },
      { audience: "vendor" }
    );
    expect(result.status).toBe("needs_hours");
    expect(result.setupSummary.hours).toBe(false);
    const hoursItem = result.checklist.find((item) => item.key === "hours");
    expect(hoursItem?.complete).toBe(false);
    expect(hoursItem?.label).toBe("Customer ordering hours");
    expect(hoursItem?.description).toBe(
      "Set customer ordering hours before this vendor can appear on the pod page."
    );
    expect(hoursItem?.actionHref).toBe("/vendor/vendor_1/hours");
    expect(hoursItem?.actionLabel).toBe("Set hours");
  });

  it("returns active when setup complete and orderable", () => {
    const result = readiness();
    expect(result.status).toBe("active");
    expect(result.canAcceptOrders).toBe(true);
  });
});

describe("deriveVendorPodReadiness vendor checklist", () => {
  it("includes hours in vendor setup required keys", () => {
    expect(VENDOR_SETUP_REQUIRED_CHECKLIST_KEYS).toContain("hours");
  });

  it("includes vendor-owned action links", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: basePos,
        stripeSummary: { ...baseStripe, stripePayoutsEnabled: false },
        pendingPodInviteCount: 1,
        hasPodMembership: false,
        customerOrderingHours: baseCustomerOrderingHours,
      },
      { audience: "vendor" }
    );

    const hours = result.checklist.find((item) => item.key === "hours");
    expect(hours?.complete).toBe(true);
    expect(hours?.description).toBe("Customer ordering hours set.");

    const stripe = result.checklist.find((item) => item.key === "stripe");
    expect(stripe?.complete).toBe(false);
    expect(stripe?.actionHref).toBe("/vendor/vendor_1/payouts");

    const invite = result.checklist.find((item) => item.key === "pod_invite");
    expect(invite?.complete).toBe(false);
    expect(invite?.description).toBe("1 pending invitation(s) in Vendor Profile.");
  });

  it("marks pod assignment complete when vendor has membership and a pending invite", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: basePos,
        stripeSummary: baseStripe,
        pendingPodInviteCount: 1,
        hasPodMembership: true,
        customerOrderingHours: baseCustomerOrderingHours,
      },
      { audience: "vendor" }
    );

    const invite = result.checklist.find((item) => item.key === "pod_invite");
    expect(invite?.complete).toBe(true);
    expect(invite?.description).toBe("Linked to a pod. 1 additional invitation(s) are optional.");

    const completeKeys = result.checklist.filter((item) => item.complete).map((item) => item.key);
    expect(isVendorSetupComplete(completeKeys)).toBe(true);
  });

  it("marks pod assignment incomplete when vendor has no membership and no pending invite", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: null,
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: basePos,
        stripeSummary: baseStripe,
        pendingPodInviteCount: 0,
        hasPodMembership: false,
        customerOrderingHours: baseCustomerOrderingHours,
      },
      { audience: "vendor" }
    );

    const invite = result.checklist.find((item) => item.key === "pod_invite");
    expect(invite?.complete).toBe(false);
    expect(invite?.description).toBe("Join a pod when a pod owner invites you.");
  });

  it("aligns dashboard canAcceptOrders with public orderability after pod membership is active", () => {
    const hours = defaultVendorCustomerOrderingWeek();
    const vendorAvailability = { isActive: true, mennyuOrdersPaused: false, posOpen: true };

    const readiness = deriveVendorPodReadiness(
      {
        podId: "pod_b",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: basePos,
        stripeSummary: baseStripe,
        pendingPodInviteCount: 0,
        hasPodMembership: true,
        customerOrderingHours: hours,
        vendorAvailability,
      },
      { audience: "vendor" }
    );

    expect(isVendorSetupComplete(readiness.checklist.filter((item) => item.complete).map((item) => item.key))).toBe(
      true
    );
    expect(readiness.canAcceptOrders).toBe(true);
    expect(readiness.orderabilityDiagnostics).toEqual([]);

    const publicOrderability = getVendorOrderabilityInPod({
      podActive: true,
      podVendorExists: true,
      podVendorActive: true,
      vendor: vendorAvailability,
      readiness: {
        vendor: { ...baseVendor, customerOrderingHours: hours },
        menuSummary: baseMenu,
        stripeSummary: baseStripe,
        posSummary: basePos,
      },
    });

    expect(publicOrderability.orderable).toBe(true);
  });

  it("surfaces orderability diagnostics when setup checklist is complete but hours are closed", () => {
    const hours = defaultVendorCustomerOrderingWeek();
    const vendorAvailability = { isActive: true, mennyuOrdersPaused: false, posOpen: false };

    const readiness = deriveVendorPodReadiness(
      {
        podId: "pod_b",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: basePos,
        stripeSummary: baseStripe,
        hasPodMembership: true,
        customerOrderingHours: hours,
        vendorAvailability,
      },
      { audience: "vendor" }
    );

    expect(readiness.canAcceptOrders).toBe(false);
    expect(readiness.orderabilityDiagnostics.some((line) => line.toLowerCase().includes("hours"))).toBe(true);
  });
});

describe("deriveVendorPodReadiness pod owner view", () => {
  it("does not expose vendor-private stripe setup links to pod owners", () => {
    const result = deriveVendorPodReadiness(
      {
        podId: "pod_1",
        podSlug: "riverside",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: basePos,
        stripeSummary: { ...baseStripe, stripePayoutsEnabled: false },
        customerOrderingHours: baseCustomerOrderingHours,
      },
      { audience: "pod_owner" }
    );

    const stripe = result.checklist.find((item) => item.key === "stripe");
    expect(stripe?.complete).toBe(false);
    expect(stripe?.actionHref).toBeUndefined();
    expect(result.blockingReasons[0]?.owner).toBe("vendor");

    const profile = result.checklist.find((item) => item.key === "profile");
    expect(profile?.actionHref).toBe("/riverside/test-kitchen");
  });
});

describe("derivePodSetupChecklist", () => {
  it("tracks pod profile, location, and activation", () => {
    const items = derivePodSetupChecklist({
      podId: "pod_1",
      pod: {
        isActive: false,
        name: "Pod",
        description: null,
        imageUrl: null,
        address: null,
        slug: "pod-slug",
        pickupInstructions: null,
      },
      vendorStatuses: [],
    });
    expect(items.find((i) => i.key === "pod_profile")?.complete).toBe(false);
    expect(items.find((i) => i.key === "location")?.complete).toBe(false);
    expect(items.find((i) => i.key === "pod_active")?.complete).toBe(false);
    expect(items.find((i) => i.key === "pickup_instructions")).toBeUndefined();
  });
});
