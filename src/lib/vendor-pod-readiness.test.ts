import { describe, expect, it } from "vitest";
import {
  derivePodSetupChecklist,
  deriveVendorPodReadiness,
  isVendorMenuReady,
  isVendorPosReady,
  isVendorProfileComplete,
  isVendorStripePayoutReady,
} from "./vendor-pod-readiness";

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
};

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
    ...overrides,
  });
}

describe("vendor setup sub-helpers", () => {
  it("detects incomplete profile", () => {
    expect(isVendorProfileComplete(baseVendor)).toBe(true);
    expect(isVendorProfileComplete({ ...baseVendor, imageUrl: null })).toBe(false);
  });

  it("detects stripe payout readiness", () => {
    expect(isVendorStripePayoutReady(baseStripe)).toBe(true);
    expect(
      isVendorStripePayoutReady({ ...baseStripe, stripePayoutsEnabled: false })
    ).toBe(false);
  });

  it("detects POS connected state", () => {
    expect(isVendorPosReady(basePos)).toBe(true);
    expect(
      isVendorPosReady({ ...basePos, deliverectChannelLinkId: null, posConnectionStatus: "not_connected" })
    ).toBe(false);
  });

  it("detects menu availability", () => {
    expect(isVendorMenuReady(baseMenu)).toBe(true);
    expect(isVendorMenuReady({ ...baseMenu, hasAvailableOperationalItems: false })).toBe(false);
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

  it("flags missing profile before payment", () => {
    const result = readiness({
      vendor: { ...baseVendor, description: null },
      stripeSummary: { ...baseStripe, stripeConnectedAccountId: null, stripeChargesEnabled: false, stripePayoutsEnabled: false },
    });
    expect(result.status).toBe("needs_profile");
  });

  it("flags missing stripe after profile complete", () => {
    const result = readiness({
      stripeSummary: { ...baseStripe, stripeConnectedAccountId: null, stripeChargesEnabled: false, stripePayoutsEnabled: false },
    });
    expect(result.status).toBe("needs_payment");
    expect(result.blockingReasons[0]?.owner).toBe("vendor");
  });

  it("flags missing POS", () => {
    const result = readiness({
      posSummary: { ...basePos, deliverectChannelLinkId: null, posConnectionStatus: "not_connected" },
    });
    expect(result.status).toBe("needs_pos");
  });

  it("flags missing menu", () => {
    const result = readiness({
      menuSummary: { ...baseMenu, hasAvailableOperationalItems: false, hasOperationalItems: false },
    });
    expect(result.status).toBe("needs_menu");
  });

  it("returns active when setup complete and orderable", () => {
    const result = readiness();
    expect(result.status).toBe("active");
    expect(result.canAcceptOrders).toBe(true);
  });
});

describe("deriveVendorPodReadiness vendor checklist", () => {
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
      },
      { audience: "vendor" }
    );

    const stripe = result.checklist.find((item) => item.key === "stripe");
    expect(stripe?.complete).toBe(false);
    expect(stripe?.actionHref).toContain("vendor-settings-payouts");

    const invite = result.checklist.find((item) => item.key === "pod_invite");
    expect(invite?.complete).toBe(false);
  });
});

describe("deriveVendorPodReadiness pod owner view", () => {
  it("does not expose vendor-private stripe setup links to pod owners", () => {
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
      },
      { audience: "pod_owner" }
    );

    const stripe = result.checklist.find((item) => item.key === "stripe");
    expect(stripe?.complete).toBe(false);
    expect(stripe?.actionHref).toBeUndefined();
    expect(result.blockingReasons[0]?.owner).toBe("vendor");
  });
});

describe("derivePodSetupChecklist", () => {
  it("tracks pod profile and activation", () => {
    const items = derivePodSetupChecklist({
      podId: "pod_1",
      pod: {
        isActive: false,
        name: "Pod",
        description: null,
        imageUrl: null,
        address: null,
        pickupInstructions: null,
      },
      vendorStatuses: [],
    });
    expect(items.find((i) => i.key === "pod_profile")?.complete).toBe(false);
    expect(items.find((i) => i.key === "pod_active")?.complete).toBe(false);
    expect(items.find((i) => i.key === "pod_active")?.owner).toBe("open_order");
  });
});
