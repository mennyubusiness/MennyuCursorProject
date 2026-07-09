import { describe, expect, it } from "vitest";

import {
  buildVendorOperationalSetupItems,
} from "@/lib/vendor-dashboard-attention";
import {
  defaultVendorCustomerOrderingWeek,
  hasCustomerOrderingHoursConfigured,
  isVendorWithinCustomerOrderingHours,
} from "@/lib/vendor-customer-ordering-hours";
import { getVendorOrderabilityState } from "@/lib/vendor-readiness-states";
import { vendorSetupChecklistSummary } from "@/lib/vendor-setup-checklist-summary";
import { deriveVendorPodReadiness } from "@/lib/vendor-pod-readiness";

const baseVendor = {
  name: "Test Kitchen",
  slug: "test-kitchen",
  description: "Great food",
  imageUrl: "https://example.com/banner.jpg",
  cuisineCategory: "American",
  isActive: true,
  mennyuOrdersPaused: false,
};

const baseMenu = {
  hasOperationalItems: true,
  hasAvailableOperationalItems: true,
  hasPublishedMenuVersion: true,
};

const basePos = {
  orderRoutingMode: "manual_dashboard" as const,
  deliverectChannelLinkId: null,
  posConnectionStatus: null,
  deliverectAutoMapLastOutcome: null,
  pendingDeliverectConnectionKey: null,
  hasUnmatchedChannelRegistration: false,
};

const baseStripe = {
  stripeConnectConfigured: true,
  stripeConnectedAccountId: "acct_1",
  stripeChargesEnabled: true,
  stripePayoutsEnabled: true,
};

const configuredHours = defaultVendorCustomerOrderingWeek();

/** Monday 2026-07-06 14:00 UTC — inside default weekday hours in America/Los_Angeles */
const insideHours = new Date("2026-07-06T21:00:00.000Z");
/** Monday 2026-07-06 06:00 UTC — outside default weekday hours in America/Los_Angeles */
const outsideHours = new Date("2026-07-06T13:00:00.000Z");

describe("hasCustomerOrderingHoursConfigured", () => {
  it("returns true when valid hours are saved regardless of current time", () => {
    expect(hasCustomerOrderingHoursConfigured(configuredHours)).toBe(true);
    expect(
      isVendorWithinCustomerOrderingHours({
        customHours: configuredHours,
        timeZone: "America/Los_Angeles",
        now: outsideHours,
      })
    ).toBe(false);
  });

  it("returns false when hours are missing", () => {
    expect(hasCustomerOrderingHoursConfigured(null)).toBe(false);
  });
});

describe("setup checklist hours vs live open state", () => {
  function vendorReadiness(posOpen: boolean, now: Date) {
    return deriveVendorPodReadiness(
      {
        podId: "pod_1",
        vendorId: "vendor_1",
        pod: { isActive: true },
        podVendor: { isActive: true },
        vendor: baseVendor,
        menuSummary: baseMenu,
        posSummary: basePos,
        stripeSummary: baseStripe,
        hasPodMembership: true,
        customerOrderingHours: configuredHours,
        vendorAvailability: {
          isActive: true,
          mennyuOrdersPaused: false,
          posOpen,
        },
      },
      { audience: "vendor" }
    );
  }

  it("marks hours Ready inside operating hours", () => {
    const readiness = vendorReadiness(true, insideHours);
    const hours = readiness.checklist.find((item) => item.key === "hours");
    expect(hours?.complete).toBe(true);
    expect(hours?.description).toBe("Ordering hours are configured.");
  });

  it("marks hours Ready outside operating hours", () => {
    const readiness = vendorReadiness(false, outsideHours);
    const hours = readiness.checklist.find((item) => item.key === "hours");
    expect(hours?.complete).toBe(true);
    expect(hours?.description).toBe("Ordering hours are configured.");
    expect(readiness.setupSummary.hours).toBe(true);
  });

  it("marks hours Needs attention when no hours configured", () => {
    const readiness = deriveVendorPodReadiness(
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
    const hours = readiness.checklist.find((item) => item.key === "hours");
    expect(hours?.complete).toBe(false);
  });

  it("keeps operational checklist ready count stable when only live open state changes", () => {
    const operationalBase = [
      { key: "stripe", label: "Stripe", complete: true, owner: "vendor" as const },
      { key: "pos", label: "POS", complete: true, owner: "vendor" as const },
      { key: "menu_available", label: "Menu", complete: true, owner: "vendor" as const },
      { key: "pod_invite", label: "Pod", complete: true, owner: "vendor" as const },
    ];

    const openItems = buildVendorOperationalSetupItems({
      vendorId: "vendor_1",
      vendorPaused: false,
      currentlyOpen: true,
      checklist: operationalBase,
    });
    const closedItems = buildVendorOperationalSetupItems({
      vendorId: "vendor_1",
      vendorPaused: false,
      currentlyOpen: false,
      checklist: operationalBase,
    });

    const openSummary = vendorSetupChecklistSummary(openItems);
    const closedSummary = vendorSetupChecklistSummary(closedItems);

    expect(openSummary).toEqual(closedSummary);
    expect(openSummary.allReady).toBe(true);

    const liveRow = closedItems.find((item) => item.key === "currently_open");
    expect(liveRow?.informational).toBe(true);
    expect(liveRow?.label).toBe("Currently closed");
    expect(liveRow?.complete).toBe(true);
  });
});

describe("public orderability still uses live hours", () => {
  const evaluationInput = {
    vendor: { ...baseVendor, customerOrderingHours: configuredHours },
    menuSummary: baseMenu,
    stripeSummary: baseStripe,
    posSummary: basePos,
    pod: { isActive: true },
    podVendor: { exists: true, isActive: true },
  };

  it("allows ordering inside operating hours", () => {
    const state = getVendorOrderabilityState({
      ...evaluationInput,
      vendorAvailability: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
    });
    expect(state.orderable).toBe(true);
  });

  it("blocks ordering outside operating hours", () => {
    const state = getVendorOrderabilityState({
      ...evaluationInput,
      vendorAvailability: { isActive: true, mennyuOrdersPaused: false, posOpen: false },
    });
    expect(state.orderable).toBe(false);
    expect(state.customerStatusLabel).toBe("Closed right now");
  });
});
