import { describe, expect, it } from "vitest";

import { defaultVendorCustomerOrderingWeek } from "@/lib/vendor-customer-ordering-hours";
import { getVendorOrderabilityInPod } from "@/lib/vendor-orderability-in-pod";
import {
  MENU_ONLY_BADGE,
  POD_ORDERING_DISABLED_CART_MESSAGE,
  POD_ORDERING_DISABLED_CODE,
  resolveVendorOrderingIntent,
  resolveVendorOrderingModeLabelKey,
  VENDOR_ORDERING_DISABLED_CART_MESSAGE,
  VENDOR_ORDERING_DISABLED_CODE,
} from "@/lib/vendor-ordering-mode";
import {
  getVendorCommerceState,
  getVendorOrderabilityState,
  getVendorPublicVisibilityState,
  vendorOrderabilityValidationError,
  type VendorReadinessEvaluationInput,
} from "@/lib/vendor-readiness-states";
import { cartLineOrderabilityMessage } from "@/lib/vendor-orderability-in-pod";

const baseVendor = {
  isActive: true,
  mennyuOrdersPaused: false,
  orderingEnabled: true,
  name: "Test Kitchen",
  slug: "test-kitchen",
  description: "Great food",
  imageUrl: "https://example.com/banner.jpg",
  cuisineCategory: "Tacos",
  customerOrderingHours: defaultVendorCustomerOrderingWeek(),
};

const baseMenu = {
  hasPublishedMenuVersion: true,
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
  orderRoutingMode: "manual_dashboard" as const,
  deliverectMappingReady: true,
  menuSource: "open_order" as const,
};

function evaluation(
  overrides?: Partial<VendorReadinessEvaluationInput>
): VendorReadinessEvaluationInput {
  return {
    vendor: baseVendor,
    menuSummary: baseMenu,
    stripeSummary: baseStripe,
    posSummary: basePos,
    pod: { isActive: true, mennyuOrdersPaused: false, orderingEnabled: true },
    podVendor: { exists: true, isActive: true },
    vendorAvailability: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
    ...overrides,
  };
}

describe("resolveVendorOrderingIntent", () => {
  it("treats missing flags as enabled so pre-migration reads stay orderable", () => {
    const intent = resolveVendorOrderingIntent({});
    expect(intent.effectiveOrderingEnabled).toBe(true);
    expect(intent.menuOnly).toBe(false);
  });

  it("requires both pod and vendor intent", () => {
    expect(
      resolveVendorOrderingIntent({ podOrderingEnabled: true, vendorOrderingEnabled: true })
        .effectiveOrderingEnabled
    ).toBe(true);
    expect(
      resolveVendorOrderingIntent({ podOrderingEnabled: false, vendorOrderingEnabled: true })
        .effectiveOrderingEnabled
    ).toBe(false);
    expect(
      resolveVendorOrderingIntent({ podOrderingEnabled: true, vendorOrderingEnabled: false })
        .effectiveOrderingEnabled
    ).toBe(false);
    expect(
      resolveVendorOrderingIntent({ podOrderingEnabled: false, vendorOrderingEnabled: false })
        .effectiveOrderingEnabled
    ).toBe(false);
  });

  it("preserves vendor intent while the pod-wide switch is off", () => {
    const intent = resolveVendorOrderingIntent({
      podOrderingEnabled: false,
      vendorOrderingEnabled: true,
    });
    expect(intent.vendorOrderingEnabled).toBe(true);
    expect(intent.menuOnlyByPod).toBe(true);
    expect(intent.menuOnlyByVendor).toBe(false);
  });
});

describe("effective commerce state", () => {
  it("pod enabled + vendor enabled + ready is orderable", () => {
    const state = getVendorCommerceState(evaluation());
    expect(state.effectiveOrderingEnabled).toBe(true);
    expect(state.customerCanOrder).toBe(true);
    expect(state.menuOnly).toBe(false);
    expect(state.blockedReason).toBeNull();
  });

  it("pod disabled + vendor enabled is menu-only, not an outage", () => {
    const state = getVendorCommerceState(
      evaluation({ pod: { isActive: true, mennyuOrdersPaused: false, orderingEnabled: false } })
    );
    expect(state.menuOnly).toBe(true);
    expect(state.customerCanOrder).toBe(false);
    expect(state.blockedReason).toBe("pod_ordering_disabled");
    expect(state.customerBannerLine).toBeNull();
    expect(state.customerStatusLabel).toBe(MENU_ONLY_BADGE);
  });

  it("pod enabled + vendor disabled is menu-only", () => {
    const state = getVendorCommerceState(
      evaluation({ vendor: { ...baseVendor, orderingEnabled: false } })
    );
    expect(state.menuOnly).toBe(true);
    expect(state.blockedReason).toBe("vendor_ordering_disabled");
  });

  it("both disabled is menu-only and reports the vendor-level reason", () => {
    const state = getVendorCommerceState(
      evaluation({
        vendor: { ...baseVendor, orderingEnabled: false },
        pod: { isActive: true, mennyuOrdersPaused: false, orderingEnabled: false },
      })
    );
    expect(state.menuOnly).toBe(true);
    expect(state.blockedReason).toBe("vendor_ordering_disabled");
  });

  it("keeps a menu-only vendor publicly visible", () => {
    const input = evaluation({ vendor: { ...baseVendor, orderingEnabled: false } });
    expect(getVendorPublicVisibilityState(input)).not.toBe("hidden");
    expect(getVendorOrderabilityState(input).showBrowseHint).toBe(false);
  });

  it("still reports setup incomplete when ordering is intended but Stripe is missing", () => {
    const state = getVendorCommerceState(
      evaluation({
        stripeSummary: {
          stripeConnectedAccountId: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeConnectConfigured: false,
        },
      })
    );
    expect(state.menuOnly).toBe(false);
    expect(state.customerCanOrder).toBe(false);
    expect(state.orderingPrerequisitesReady).toBe(false);
    expect(state.blockedReason).toBe("ordering_setup_incomplete");
  });

  it("suppresses commerce prerequisites as blockers while menu-only", () => {
    const state = getVendorCommerceState(
      evaluation({
        vendor: { ...baseVendor, orderingEnabled: false },
        stripeSummary: {
          stripeConnectedAccountId: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeConnectConfigured: false,
        },
      })
    );
    expect(state.blockedReason).toBe("vendor_ordering_disabled");
  });

  it("keeps pause distinct from menu-only", () => {
    const state = getVendorCommerceState(
      evaluation({
        vendor: { ...baseVendor, mennyuOrdersPaused: true },
        vendorAvailability: { isActive: true, mennyuOrdersPaused: true, posOpen: true },
      })
    );
    expect(state.menuOnly).toBe(false);
    expect(state.blockedReason).toBe("vendor_paused");
  });

  it("keeps closed distinct from menu-only", () => {
    const state = getVendorCommerceState(
      evaluation({
        vendorAvailability: { isActive: true, mennyuOrdersPaused: false, posOpen: false },
      })
    );
    expect(state.menuOnly).toBe(false);
    expect(state.blockedReason).toBe("vendor_closed");
  });

  it("keeps sold out distinct from menu-only", () => {
    const state = getVendorCommerceState(
      evaluation({ menuSummary: { ...baseMenu, hasAvailableOperationalItems: false } })
    );
    expect(state.menuOnly).toBe(false);
    expect(state.blockedReason).toBe("item_unavailable");
  });
});

describe("vendorOrderabilityValidationError", () => {
  it("returns the pod ordering code when the pod is menu-only", () => {
    const error = vendorOrderabilityValidationError(
      evaluation({ pod: { isActive: true, mennyuOrdersPaused: false, orderingEnabled: false } })
    );
    expect(error?.code).toBe(POD_ORDERING_DISABLED_CODE);
  });

  it("returns the vendor ordering code when the vendor is menu-only", () => {
    const error = vendorOrderabilityValidationError(
      evaluation({ vendor: { ...baseVendor, orderingEnabled: false } })
    );
    expect(error?.code).toBe(VENDOR_ORDERING_DISABLED_CODE);
  });

  it("prefers the ordering code over pause when both apply", () => {
    const error = vendorOrderabilityValidationError(
      evaluation({
        vendor: { ...baseVendor, orderingEnabled: false, mennyuOrdersPaused: true },
        vendorAvailability: { isActive: true, mennyuOrdersPaused: true, posOpen: true },
      })
    );
    expect(error?.code).toBe(VENDOR_ORDERING_DISABLED_CODE);
  });
});

describe("getVendorOrderabilityInPod", () => {
  const readiness = {
    vendor: baseVendor,
    menuSummary: baseMenu,
    stripeSummary: baseStripe,
    posSummary: basePos,
  };

  it("blocks a menu-only vendor on the readiness path", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podOrdersPaused: false,
      podOrderingEnabled: true,
      vendorOrderingEnabled: false,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
      readiness,
    });
    expect(result.orderable).toBe(false);
    expect(result.reason).toBe("vendor_ordering_disabled");
    expect(result.code).toBe(VENDOR_ORDERING_DISABLED_CODE);
  });

  it("blocks a pod-disabled vendor on the readiness path", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podOrdersPaused: false,
      podOrderingEnabled: false,
      vendorOrderingEnabled: true,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
      readiness,
    });
    expect(result.reason).toBe("pod_ordering_disabled");
    expect(result.code).toBe(POD_ORDERING_DISABLED_CODE);
  });

  /**
   * The shallow path (cart display, quantity updates) skips the readiness bundle, so it is the
   * one a stale frontend could otherwise use to sneak past menu-only.
   */
  it("blocks a menu-only vendor on the shallow path", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podOrdersPaused: false,
      podOrderingEnabled: true,
      vendorOrderingEnabled: false,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
    });
    expect(result.orderable).toBe(false);
    expect(result.code).toBe(VENDOR_ORDERING_DISABLED_CODE);
    expect(cartLineOrderabilityMessage(result)).toBe(VENDOR_ORDERING_DISABLED_CART_MESSAGE);
  });

  it("blocks a pod-disabled vendor on the shallow path", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podOrdersPaused: false,
      podOrderingEnabled: false,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
    });
    expect(result.code).toBe(POD_ORDERING_DISABLED_CODE);
    expect(cartLineOrderabilityMessage(result)).toBe(POD_ORDERING_DISABLED_CART_MESSAGE);
  });

  it("stays orderable when both flags are on", () => {
    expect(
      getVendorOrderabilityInPod({
        podActive: true,
        podOrdersPaused: false,
        podOrderingEnabled: true,
        vendorOrderingEnabled: true,
        podVendorExists: true,
        podVendorActive: true,
        vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
        readiness,
      }).orderable
    ).toBe(true);
  });

  it("keeps menu-only distinct from pod pause in cart copy", () => {
    const paused = getVendorOrderabilityInPod({
      podActive: true,
      podOrdersPaused: true,
      podOrderingEnabled: true,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
    });
    expect(paused.reason).toBe("pod_orders_paused");
    expect(cartLineOrderabilityMessage(paused)).not.toBe(POD_ORDERING_DISABLED_CART_MESSAGE);
  });
});

describe("resolveVendorOrderingModeLabelKey", () => {
  it("labels vendor-level menu-only distinctly from pod-level", () => {
    expect(
      resolveVendorOrderingModeLabelKey({
        podOrderingEnabled: true,
        vendorOrderingEnabled: false,
      })
    ).toBe("menu_only");
    expect(
      resolveVendorOrderingModeLabelKey({
        podOrderingEnabled: false,
        vendorOrderingEnabled: true,
      })
    ).toBe("menu_only_pod_disabled");
  });

  it("labels incomplete commerce setup only when ordering is intended", () => {
    expect(
      resolveVendorOrderingModeLabelKey({
        podOrderingEnabled: true,
        vendorOrderingEnabled: true,
        orderingReady: false,
      })
    ).toBe("setup_incomplete");
    expect(
      resolveVendorOrderingModeLabelKey({
        podOrderingEnabled: true,
        vendorOrderingEnabled: false,
        orderingReady: false,
      })
    ).toBe("menu_only");
  });

  it("labels a fully ready vendor as orderable", () => {
    expect(
      resolveVendorOrderingModeLabelKey({
        podOrderingEnabled: true,
        vendorOrderingEnabled: true,
        orderingReady: true,
      })
    ).toBe("orderable");
  });
});
