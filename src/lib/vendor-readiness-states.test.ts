import { describe, expect, it } from "vitest";
import { defaultVendorCustomerOrderingWeek } from "@/lib/vendor-customer-ordering-hours";
import {
  getVendorOrderabilityState,
  getVendorPublicProfileMissingItems,
  getVendorPublicVisibilityState,
  isVendorPublicProfileReady,
  VENDOR_PUBLIC_PROFILE_MISSING_LABELS,
} from "@/lib/vendor-readiness-states";

const baseVendor = {
  isActive: true,
  mennyuOrdersPaused: false,
  name: "Test Kitchen",
  slug: "test-kitchen",
  description: "Great food",
  imageUrl: "https://example.com/banner.jpg",
  cuisineCategory: "Tacos",
  customerOrderingHours: defaultVendorCustomerOrderingWeek(),
};

const baseMenu = {
  hasOperationalItems: true,
  hasAvailableOperationalItems: true,
};

const baseStripe = {
  stripeConnectedAccountId: "acct_1",
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

function evaluation(overrides?: Partial<Parameters<typeof getVendorOrderabilityState>[0]>) {
  return {
    vendor: baseVendor,
    menuSummary: baseMenu,
    stripeSummary: baseStripe,
    posSummary: basePos,
    pod: { isActive: true, mennyuOrdersPaused: false },
    podVendor: { exists: true, isActive: true },
    vendorAvailability: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
    ...overrides,
  };
}

describe("public profile visibility", () => {
  it("hides vendor when menu is missing", () => {
    const input = evaluation({ menuSummary: { ...baseMenu, hasOperationalItems: false } });
    expect(isVendorPublicProfileReady(input)).toBe(false);
    expect(getVendorPublicProfileMissingItems(input)).toContain("menu");
    expect(getVendorPublicVisibilityState(input)).toBe("hidden");
  });

  it("hides vendor when customer ordering hours are missing", () => {
    const input = evaluation({ vendor: { ...baseVendor, customerOrderingHours: null } });
    expect(getVendorPublicProfileMissingItems(input)).toContain("hours");
    expect(getVendorPublicVisibilityState(input)).toBe("hidden");
  });

  it("hides vendor when vendor name is missing", () => {
    const input = evaluation({ vendor: { ...baseVendor, name: "" } });
    expect(getVendorPublicProfileMissingItems(input)).toContain("name");
    expect(getVendorPublicVisibilityState(input)).toBe("hidden");
  });

  it("hides vendor when banner photo is missing", () => {
    const input = evaluation({ vendor: { ...baseVendor, imageUrl: null } });
    expect(getVendorPublicProfileMissingItems(input)).toContain("banner");
    expect(getVendorPublicVisibilityState(input)).toBe("hidden");
  });

  it("hides vendor when description is missing", () => {
    const input = evaluation({ vendor: { ...baseVendor, description: null } });
    expect(getVendorPublicProfileMissingItems(input)).toContain("description");
    expect(getVendorPublicVisibilityState(input)).toBe("hidden");
  });

  it("hides vendor when cuisine is missing", () => {
    const input = evaluation({ vendor: { ...baseVendor, cuisineCategory: null } });
    expect(getVendorPublicProfileMissingItems(input)).toContain("cuisine");
    expect(getVendorPublicVisibilityState(input)).toBe("hidden");
  });

  it("shows vendor when all public profile fields are present", () => {
    const input = evaluation();
    expect(isVendorPublicProfileReady(input)).toBe(true);
    expect(getVendorPublicVisibilityState(input)).toBe("visible");
  });

  it("uses specific missing item labels", () => {
    expect(VENDOR_PUBLIC_PROFILE_MISSING_LABELS.banner).toBe("Banner photo missing");
    expect(VENDOR_PUBLIC_PROFILE_MISSING_LABELS.hours).toBe("Customer ordering hours missing");
  });
});

describe("orderability", () => {
  it("is visible but not orderable when stripe is missing", () => {
    const input = evaluation({
      stripeSummary: { ...baseStripe, stripeConnectedAccountId: null, stripeChargesEnabled: false },
    });
    const state = getVendorOrderabilityState(input);
    expect(state.visibility).toBe("visible");
    expect(state.orderable).toBe(false);
    expect(state.customerBannerLine).toBe("Not accepting orders right now");
    expect(state.customerBannerLine).not.toMatch(/stripe/i);
  });

  it("is visible but not orderable when deliverect is missing", () => {
    const input = evaluation({
      posSummary: { ...basePos, deliverectChannelLinkId: null, posConnectionStatus: "not_connected" },
    });
    const state = getVendorOrderabilityState(input);
    expect(state.visibility).toBe("visible");
    expect(state.orderable).toBe(false);
    expect(state.customerBannerLine).not.toMatch(/deliverect|pos/i);
  });

  it("is orderable when public profile and operational readiness are complete and open", () => {
    const state = getVendorOrderabilityState(evaluation());
    expect(state.orderable).toBe(true);
    expect(state.podOwnerDisplay).toBe("live");
  });

  it("blocks ordering when manually paused", () => {
    const input = evaluation({
      vendor: { ...baseVendor, mennyuOrdersPaused: true },
      vendorAvailability: { isActive: true, mennyuOrdersPaused: true, posOpen: true },
    });
    expect(getVendorOrderabilityState(input).orderable).toBe(false);
  });

  it("blocks ordering outside hours but keeps vendor visible", () => {
    const input = evaluation({
      vendorAvailability: { isActive: true, mennyuOrdersPaused: false, posOpen: false },
    });
    const state = getVendorOrderabilityState(input);
    expect(state.visibility).toBe("visible");
    expect(state.orderable).toBe(false);
    expect(state.customerStatusLabel).toBe("Closed right now");
  });
});
