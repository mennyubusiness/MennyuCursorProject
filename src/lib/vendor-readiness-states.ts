/**
 * Single source of truth for vendor public visibility vs orderability.
 * Public profile readiness controls customer-facing visibility.
 * Operational readiness controls whether orders can be placed (after visible).
 */
import { getVendorAvailability, type VendorAvailabilityInput } from "@/lib/vendor-availability";
import {
  hasValidVendorCustomerOrderingHours,
} from "@/lib/vendor-customer-ordering-hours";
import { deriveVendorPosUiState } from "@/lib/vendor-pos-ui-state";
import type { PosConnectionStatus } from "@prisma/client";

export type VendorMenuReadinessSummary = {
  hasPublishedMenuVersion?: boolean;
  hasOperationalItems: boolean;
  hasAvailableOperationalItems: boolean;
};

export type VendorStripeReadinessSummary = {
  stripeConnectedAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeConnectConfigured?: boolean;
};

export type VendorPosReadinessSummary = {
  deliverectChannelLinkId: string | null;
  posConnectionStatus: PosConnectionStatus;
  deliverectAutoMapLastOutcome: string | null;
  pendingDeliverectConnectionKey: string | null;
  hasUnmatchedChannelRegistration: boolean;
};

export type VendorReadinessVendorFields = {
  isActive: boolean;
  mennyuOrdersPaused: boolean;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  cuisineCategory: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

function isVendorStripePayoutReady(stripe: VendorStripeReadinessSummary): boolean {
  if (stripe.stripeConnectConfigured === false) return false;
  return Boolean(
    stripe.stripeConnectedAccountId?.trim() &&
      stripe.stripeChargesEnabled &&
      stripe.stripePayoutsEnabled
  );
}

function isVendorPosReady(pos: VendorPosReadinessSummary): boolean {
  return (
    deriveVendorPosUiState({
      deliverectChannelLinkId: pos.deliverectChannelLinkId,
      posConnectionStatus: pos.posConnectionStatus,
      deliverectAutoMapLastOutcome: pos.deliverectAutoMapLastOutcome,
      pendingDeliverectConnectionKey: pos.pendingDeliverectConnectionKey,
      hasUnmatchedChannelRegistrationForVendor: pos.hasUnmatchedChannelRegistration,
    }) === "connected"
  );
}

function isVendorMenuReady(menu: VendorMenuReadinessSummary): boolean {
  return menu.hasAvailableOperationalItems;
}

function isVendorCustomerOrderingHoursReady(customerOrderingHours: unknown): boolean {
  return hasValidVendorCustomerOrderingHours(customerOrderingHours);
}

export const PUBLIC_PROFILE_INCOMPLETE_LABEL = "Public profile incomplete";

export type VendorPublicProfileMissingKey =
  | "menu"
  | "hours"
  | "name"
  | "banner"
  | "description"
  | "cuisine";

export const VENDOR_PUBLIC_PROFILE_MISSING_LABELS: Record<VendorPublicProfileMissingKey, string> = {
  menu: "Menu missing",
  hours: "Customer ordering hours missing",
  name: "Vendor name missing",
  banner: "Banner photo missing",
  description: "Description missing",
  cuisine: "Cuisine missing",
};

export type VendorOperationalMissingKey =
  | "stripe"
  | "pos"
  | "pod_membership"
  | "pod_vendor_inactive"
  | "vendor_inactive"
  | "vendor_paused"
  | "pod_inactive"
  | "pod_orders_paused"
  | "outside_hours"
  | "menu_unavailable";

export type VendorPublicVisibilityState = "hidden" | "visible";

export type VendorPodOwnerDisplayState = "hidden" | "visible_not_accepting" | "live";

export type VendorReadinessEvaluationInput = {
  vendor: VendorReadinessVendorFields & { customerOrderingHours?: unknown };
  menuSummary: VendorMenuReadinessSummary;
  stripeSummary: VendorStripeReadinessSummary;
  posSummary: VendorPosReadinessSummary;
  pod: {
    isActive: boolean;
    mennyuOrdersPaused?: boolean;
  };
  podVendor: {
    exists: boolean;
    isActive: boolean;
  } | null;
  /** Vendor availability including resolved posOpen (hours + pause). */
  vendorAvailability?: VendorAvailabilityInput;
};

export function isVendorPublicProfileReady(input: VendorReadinessEvaluationInput): boolean {
  return getVendorPublicProfileMissingItems(input).length === 0;
}

export function getVendorPublicProfileMissingItems(
  input: VendorReadinessEvaluationInput
): VendorPublicProfileMissingKey[] {
  const { vendor, menuSummary } = input;
  const missing: VendorPublicProfileMissingKey[] = [];

  if (!vendor.name?.trim()) missing.push("name");
  if (!vendor.description?.trim()) missing.push("description");
  if (!vendor.imageUrl?.trim()) missing.push("banner");
  if (!vendor.cuisineCategory?.trim()) missing.push("cuisine");
  if (!menuSummary.hasOperationalItems) missing.push("menu");
  if (!isVendorCustomerOrderingHoursReady(vendor.customerOrderingHours)) missing.push("hours");

  return missing;
}

export function getVendorPublicProfileMissingLabels(input: VendorReadinessEvaluationInput): string[] {
  return getVendorPublicProfileMissingItems(input).map((key) => VENDOR_PUBLIC_PROFILE_MISSING_LABELS[key]);
}

/** Setup fields shown on the vendor profile (excludes menu + hours). */
export function isVendorPublicProfileFieldsComplete(
  vendor: Pick<VendorReadinessVendorFields, "name" | "description" | "imageUrl" | "cuisineCategory">
): boolean {
  return Boolean(
    vendor.name?.trim() &&
      vendor.description?.trim() &&
      vendor.imageUrl?.trim() &&
      vendor.cuisineCategory?.trim()
  );
}

export function getVendorOperationalMissingItems(
  input: VendorReadinessEvaluationInput
): VendorOperationalMissingKey[] {
  const missing: VendorOperationalMissingKey[] = [];
  const { vendor, menuSummary, stripeSummary, posSummary, pod, podVendor } = input;

  if (!pod.isActive) missing.push("pod_inactive");
  if (pod.mennyuOrdersPaused) missing.push("pod_orders_paused");
  if (!vendor.isActive) missing.push("vendor_inactive");
  if (vendor.mennyuOrdersPaused) missing.push("vendor_paused");
  if (!podVendor?.exists) missing.push("pod_membership");
  if (podVendor && !podVendor.isActive) missing.push("pod_vendor_inactive");
  if (!isVendorStripePayoutReady(stripeSummary)) missing.push("stripe");
  if (!isVendorPosReady(posSummary)) missing.push("pos");
  if (!isVendorMenuReady(menuSummary)) missing.push("menu_unavailable");

  const availability = getVendorAvailability(
    input.vendorAvailability ?? {
      isActive: vendor.isActive,
      mennyuOrdersPaused: vendor.mennyuOrdersPaused,
    }
  );
  if (availability.status === "closed") missing.push("outside_hours");

  return missing;
}

export function isVendorOperationallyReady(input: VendorReadinessEvaluationInput): boolean {
  return getVendorOperationalMissingItems(input).length === 0;
}

export function getVendorPublicVisibilityState(input: VendorReadinessEvaluationInput): VendorPublicVisibilityState {
  if (!input.vendor.isActive) return "hidden";
  if (!input.podVendor?.exists || !input.podVendor.isActive) return "hidden";
  if (!isVendorPublicProfileReady(input)) return "hidden";
  return "visible";
}

export type VendorOrderabilityState = {
  orderable: boolean;
  visibility: VendorPublicVisibilityState;
  podOwnerDisplay: VendorPodOwnerDisplayState;
  customerStatusLabel: string;
  customerBannerLine: string | null;
  showBrowseHint: boolean;
  /** Internal/dashboard label for the primary blocker bucket. */
  internalSummaryLabel: string;
};

export function getVendorPodOwnerMissingLinesFromSetup(input: {
  podVendorActive: boolean;
  canAcceptOrders: boolean;
  setupSummary: {
    profile: boolean;
    publicProfile?: boolean;
    menu: boolean;
    hours?: boolean;
    stripe: boolean;
    pos: boolean;
  };
  status: string;
}): string[] {
  if (!input.podVendorActive) {
    return ["Not visible on pod page."];
  }

  const lines: string[] = [];
  const publicReady = input.setupSummary.publicProfile ?? (
    input.setupSummary.profile &&
    input.setupSummary.menu &&
    (input.setupSummary.hours ?? true)
  );

  if (!publicReady) {
    if (!input.setupSummary.profile) {
      lines.push("Hidden: vendor name, description, banner photo, or cuisine missing.");
    }
    if (!input.setupSummary.menu) {
      lines.push("Hidden: menu missing.");
    }
    if (input.setupSummary.hours === false) {
      lines.push("Hidden: customer ordering hours missing.");
    }
    return [...new Set(lines)];
  }

  if (input.canAcceptOrders) {
    return ["Live: accepting orders."];
  }

  if (!input.setupSummary.stripe) {
    lines.push("Visible, not accepting orders: vendor needs payment setup.");
  }
  if (!input.setupSummary.pos) {
    lines.push("Visible, not accepting orders: POS not connected.");
  }
  if (!input.setupSummary.menu) {
    lines.push("Visible, not accepting orders: menu has no available items.");
  }
  if (input.status === "paused_by_vendor") {
    lines.push("Visible, not accepting orders: vendor paused new orders.");
  }
  if (input.status === "paused_in_pod") {
    lines.push("Not visible on pod page.");
  }

  return [...new Set(lines)];
}

export function getVendorPodOwnerDisplayStateFromSetup(input: {
  podVendorActive: boolean;
  canAcceptOrders: boolean;
  setupSummary: {
    profile: boolean;
    publicProfile?: boolean;
    menu: boolean;
    hours?: boolean;
  };
}): VendorPodOwnerDisplayState {
  if (!input.podVendorActive) return "hidden";
  const publicReady = input.setupSummary.publicProfile ?? (
    input.setupSummary.profile &&
    input.setupSummary.menu &&
    (input.setupSummary.hours ?? true)
  );
  if (!publicReady) return "hidden";
  if (input.canAcceptOrders) return "live";
  return "visible_not_accepting";
}

const CUSTOMER_NOT_ACCEPTING = "Not accepting orders right now";
const CUSTOMER_CLOSED = "Closed right now";
const CUSTOMER_OPEN = "Open for orders";

function resolveVendorAvailability(input: VendorReadinessEvaluationInput): ReturnType<typeof getVendorAvailability> {
  return getVendorAvailability(
    input.vendorAvailability ?? {
      isActive: input.vendor.isActive,
      mennyuOrdersPaused: input.vendor.mennyuOrdersPaused,
    }
  );
}

export function getVendorPodOwnerDisplayState(input: VendorReadinessEvaluationInput): VendorPodOwnerDisplayState {
  const visibility = getVendorPublicVisibilityState(input);
  if (visibility === "hidden") return "hidden";
  if (getVendorOrderabilityState(input).orderable) return "live";
  return "visible_not_accepting";
}

export function getVendorPodOwnerDisplaySummary(input: VendorReadinessEvaluationInput): {
  state: VendorPodOwnerDisplayState;
  headline: string;
  missingLines: string[];
} {
  const state = getVendorPodOwnerDisplayState(input);
  const missingLines = getVendorPodOwnerMissingLines(input);

  if (state === "live") {
    return { state, headline: "Live — accepting orders", missingLines: [] };
  }
  if (state === "hidden") {
    const firstMissing = missingLines[0];
    return {
      state,
      headline: "Hidden — public profile incomplete",
      missingLines,
    };
  }

  const firstLine = missingLines[0];
  return {
    state,
    headline: firstLine ? `Visible — not accepting orders` : "Visible — not accepting orders",
    missingLines,
  };
}

export function getVendorPodOwnerMissingLines(input: VendorReadinessEvaluationInput): string[] {
  const lines: string[] = [];
  const { podVendor } = input;

  if (!podVendor?.exists || !podVendor.isActive) {
    lines.push("Not visible on pod page.");
    return lines;
  }

  const publicMissing = getVendorPublicProfileMissingItems(input);
  for (const key of publicMissing) {
    lines.push(`Hidden: ${VENDOR_PUBLIC_PROFILE_MISSING_LABELS[key].toLowerCase()}.`);
  }
  if (publicMissing.length > 0) return [...new Set(lines)];

  const operational = getVendorOperationalMissingItems(input);
  if (operational.includes("stripe")) {
    lines.push("Visible, not accepting orders: vendor needs payment setup.");
  }
  if (operational.includes("pos")) {
    lines.push("Visible, not accepting orders: POS not connected.");
  }
  if (operational.includes("menu_unavailable")) {
    lines.push("Visible, not accepting orders: menu has no available items.");
  }
  if (operational.includes("vendor_paused")) {
    lines.push("Visible, not accepting orders: vendor paused new orders.");
  }
  if (operational.includes("pod_orders_paused")) {
    lines.push("Visible, not accepting orders: pod ordering is paused.");
  }
  if (operational.includes("outside_hours")) {
    lines.push("Visible, not accepting orders: outside customer ordering hours.");
  }
  if (operational.includes("pod_inactive")) {
    lines.push("Pod is not active for customer ordering.");
  }
  if (operational.includes("vendor_inactive")) {
    lines.push("Vendor is not active on Open Order.");
  }
  if (operational.includes("pod_membership")) {
    lines.push("Vendor is not attached to this pod.");
  }

  return [...new Set(lines)];
}

export function getVendorOrderabilityState(input: VendorReadinessEvaluationInput): VendorOrderabilityState {
  const visibility = getVendorPublicVisibilityState(input);
  const availability = resolveVendorAvailability(input);

  if (visibility === "hidden") {
    return {
      orderable: false,
      visibility,
      podOwnerDisplay: "hidden",
      customerStatusLabel: "",
      customerBannerLine: null,
      showBrowseHint: false,
      internalSummaryLabel: PUBLIC_PROFILE_INCOMPLETE_LABEL,
    };
  }

  const operationalMissing = getVendorOperationalMissingItems(input);
  const orderable = operationalMissing.length === 0 && availability.orderable;

  if (orderable) {
    return {
      orderable: true,
      visibility,
      podOwnerDisplay: "live",
      customerStatusLabel: CUSTOMER_OPEN,
      customerBannerLine: null,
      showBrowseHint: false,
      internalSummaryLabel: "Accepting orders",
    };
  }

  let customerStatusLabel = CUSTOMER_NOT_ACCEPTING;
  let customerBannerLine: string | null = CUSTOMER_NOT_ACCEPTING;
  let showBrowseHint = true;

  if (operationalMissing.includes("outside_hours") && !operationalMissing.includes("vendor_paused")) {
    customerStatusLabel = CUSTOMER_CLOSED;
    customerBannerLine = CUSTOMER_CLOSED;
  } else if (availability.status === "mennyu_paused" || operationalMissing.includes("vendor_paused")) {
    customerStatusLabel = CUSTOMER_NOT_ACCEPTING;
    customerBannerLine = CUSTOMER_NOT_ACCEPTING;
  }

  return {
    orderable: false,
    visibility,
    podOwnerDisplay: "visible_not_accepting",
    customerStatusLabel,
    customerBannerLine,
    showBrowseHint,
    internalSummaryLabel: "Not accepting orders",
  };
}

export function getVendorCustomerPodCardAvailability(input: VendorReadinessEvaluationInput): {
  unavailable: boolean;
  statusLabel: string;
  showBrowseHint: boolean;
} {
  const state = getVendorOrderabilityState(input);
  if (state.visibility === "hidden") {
    return { unavailable: true, statusLabel: "", showBrowseHint: false };
  }
  return {
    unavailable: !state.orderable,
    statusLabel: state.orderable ? state.customerStatusLabel : state.customerStatusLabel,
    showBrowseHint: state.showBrowseHint,
  };
}

/** Cart/checkout validation code for a non-orderable vendor. */
export function vendorOrderabilityValidationError(input: VendorReadinessEvaluationInput): {
  code: string;
  message: string;
} | null {
  const state = getVendorOrderabilityState(input);
  if (state.orderable) return null;

  if (state.visibility === "hidden") {
    return {
      code: "VENDOR_NOT_PUBLIC_READY",
      message: "This vendor is not available right now.",
    };
  }

  const availability = resolveVendorAvailability(input);
  if (availability.status === "closed") {
    return { code: "VENDOR_CLOSED", message: "This vendor is currently closed." };
  }
  if (availability.status === "mennyu_paused") {
    return {
      code: "VENDOR_PAUSED_MENNYU",
      message: "This vendor is not accepting orders right now.",
    };
  }

  return {
    code: "VENDOR_NOT_ACCEPTING_ORDERS",
    message: "This vendor is not accepting orders right now.",
  };
}
