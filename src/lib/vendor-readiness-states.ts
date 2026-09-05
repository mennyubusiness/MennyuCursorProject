/**
 * Single source of truth for vendor public visibility vs orderability.
 * Public profile readiness controls customer-facing visibility.
 * Ordering intent (`orderingEnabled`) controls whether ordering is offered at all.
 * Operational readiness controls whether orders can be placed (after visible + intent on).
 */
import { getVendorAvailability, type VendorAvailabilityInput } from "@/lib/vendor-availability";
import {
  MENU_ONLY_BADGE,
  POD_ORDERING_DISABLED_CODE,
  POD_ORDERING_DISABLED_MESSAGE,
  resolveVendorOrderingIntent,
  VENDOR_ORDERING_DISABLED_CODE,
  VENDOR_ORDERING_DISABLED_MESSAGE,
  type VendorOrderingBlockedReason,
  type VendorOrderingIntent,
} from "@/lib/vendor-ordering-mode";
import {
  hasValidVendorCustomerOrderingHours,
} from "@/lib/vendor-customer-ordering-hours";
import {
  isVendorSetupPosReady,
  isVendorSquareOrderable,
  type VendorRoutingReadinessInput,
} from "@/lib/vendor-order-routing-mode";
import type { VendorMenuSource, VendorOrderRoutingMode } from "@prisma/client";

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

export type VendorPosReadinessSummary = VendorRoutingReadinessInput & {
  hasUnmatchedChannelRegistration: boolean;
  menuSource?: VendorMenuSource;
};

export type VendorReadinessVendorFields = {
  isActive: boolean;
  mennyuOrdersPaused: boolean;
  /** `Vendor.orderingEnabled`. Undefined is treated as enabled. */
  orderingEnabled?: boolean;
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
  return isVendorSetupPosReady(pos);
}

function isVendorDeliverectMappingReady(pos: VendorPosReadinessSummary): boolean {
  if (pos.menuSource === "open_order") return true;
  if (pos.menuSource !== "deliverect" && pos.orderRoutingMode !== "deliverect") return true;
  return pos.deliverectMappingReady !== false;
}

function isVendorMenuReady(menu: VendorMenuReadinessSummary, menuSource?: VendorMenuSource): boolean {
  if (menuSource === "open_order" && !menu.hasPublishedMenuVersion) return false;
  return menu.hasAvailableOperationalItems;
}

function isVendorPublicMenuReady(
  menuSummary: VendorMenuReadinessSummary,
  menuSource?: VendorMenuSource
): boolean {
  if (menuSource === "open_order") {
    return Boolean(menuSummary.hasPublishedMenuVersion && menuSummary.hasOperationalItems);
  }
  return menuSummary.hasOperationalItems;
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
  | "deliverect_mapping"
  | "square_routing"
  | "pod_membership"
  | "pod_vendor_inactive"
  | "vendor_inactive"
  | "vendor_paused"
  | "pod_inactive"
  | "pod_orders_paused"
  | "outside_hours"
  | "menu_unavailable"
  /** Pod is configured menu-only. Not a setup failure. */
  | "pod_ordering_disabled"
  /** Vendor is configured menu-only. Not a setup failure. */
  | "vendor_ordering_disabled";

/** Payment/routing setup keys — reported as "ordering setup incomplete", never as menu-only. */
const ORDERING_SETUP_KEYS: VendorOperationalMissingKey[] = [
  "stripe",
  "pos",
  "deliverect_mapping",
  "square_routing",
];

export type VendorPublicVisibilityState = "hidden" | "visible";

export type VendorPodOwnerDisplayState =
  | "hidden"
  | "visible_not_accepting"
  | "menu_only"
  | "live";

export type VendorReadinessEvaluationInput = {
  vendor: VendorReadinessVendorFields & { customerOrderingHours?: unknown };
  menuSummary: VendorMenuReadinessSummary;
  stripeSummary: VendorStripeReadinessSummary;
  posSummary: VendorPosReadinessSummary;
  pod: {
    isActive: boolean;
    mennyuOrdersPaused?: boolean;
    /** `Pod.orderingEnabled`. Undefined is treated as enabled. */
    orderingEnabled?: boolean;
  };
  podVendor: {
    exists: boolean;
    isActive: boolean;
  } | null;
  /** Vendor availability including resolved posOpen (hours + pause). */
  vendorAvailability?: VendorAvailabilityInput;
};

/** Durable menu-only vs orderable intent for this pod/vendor pair. */
export function getVendorOrderingIntent(
  input: VendorReadinessEvaluationInput
): VendorOrderingIntent {
  return resolveVendorOrderingIntent({
    podOrderingEnabled: input.pod.orderingEnabled,
    vendorOrderingEnabled: input.vendor.orderingEnabled,
  });
}

export function isVendorPublicProfileReady(input: VendorReadinessEvaluationInput): boolean {
  return getVendorPublicProfileMissingItems(input).length === 0;
}

export function getVendorPublicProfileMissingItems(
  input: VendorReadinessEvaluationInput
): VendorPublicProfileMissingKey[] {
  const { vendor, menuSummary, posSummary } = input;
  const missing: VendorPublicProfileMissingKey[] = [];

  if (!vendor.name?.trim()) missing.push("name");
  if (!vendor.description?.trim()) missing.push("description");
  if (!vendor.imageUrl?.trim()) missing.push("banner");
  if (!vendor.cuisineCategory?.trim()) missing.push("cuisine");
  if (!isVendorPublicMenuReady(menuSummary, posSummary.menuSource)) missing.push("menu");
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

/**
 * Commerce prerequisites (Stripe, routing, mappings, available menu).
 * Evaluated regardless of ordering intent so admins can see whether re-enabling
 * ordering would work — but only *enforced* when intent is on.
 */
export function getVendorOrderingPrerequisiteMissingItems(
  input: VendorReadinessEvaluationInput
): VendorOperationalMissingKey[] {
  const missing: VendorOperationalMissingKey[] = [];
  const { menuSummary, stripeSummary, posSummary } = input;

  if (!isVendorStripePayoutReady(stripeSummary)) missing.push("stripe");
  if (!isVendorPosReady(posSummary)) missing.push("pos");
  if (!isVendorDeliverectMappingReady(posSummary)) missing.push("deliverect_mapping");
  if (!isVendorSquareOrderable(posSummary)) missing.push("square_routing");
  if (!isVendorMenuReady(menuSummary, posSummary.menuSource)) missing.push("menu_unavailable");

  return missing;
}

/** True when Stripe/routing/menu prerequisites would allow paid orders once intent is on. */
export function isVendorOrderingPrerequisitesReady(
  input: VendorReadinessEvaluationInput
): boolean {
  return getVendorOrderingPrerequisiteMissingItems(input).length === 0;
}

export function getVendorOperationalMissingItems(
  input: VendorReadinessEvaluationInput
): VendorOperationalMissingKey[] {
  const missing: VendorOperationalMissingKey[] = [];
  const { vendor, pod, podVendor } = input;
  const intent = getVendorOrderingIntent(input);

  // Structural state is reported either way — an inactive pod/vendor is a real problem.
  if (!pod.isActive) missing.push("pod_inactive");
  if (!vendor.isActive) missing.push("vendor_inactive");
  if (!podVendor?.exists) missing.push("pod_membership");
  if (podVendor && !podVendor.isActive) missing.push("pod_vendor_inactive");

  // Menu-only is intentional: pause, hours, Stripe, and routing are not blockers.
  if (!intent.effectiveOrderingEnabled) {
    if (intent.menuOnlyByPod) missing.push("pod_ordering_disabled");
    if (intent.menuOnlyByVendor) missing.push("vendor_ordering_disabled");
    return missing;
  }

  if (pod.mennyuOrdersPaused) missing.push("pod_orders_paused");
  if (vendor.mennyuOrdersPaused) missing.push("vendor_paused");
  missing.push(...getVendorOrderingPrerequisiteMissingItems(input));

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

/** Menu-only vendors never surface Stripe/routing/POS as launch blockers. */
export function shouldSurfaceOrderingPrerequisites(
  input: VendorReadinessEvaluationInput
): boolean {
  return getVendorOrderingIntent(input).effectiveOrderingEnabled;
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
  /** Ordering is off by configuration (pod and/or vendor), not by readiness or pause. */
  menuOnly: boolean;
  /** Single most specific reason a customer cannot order. Null when orderable. */
  blockedReason: VendorOrderingBlockedReason | null;
};

/**
 * Effective commerce state for a vendor in a pod context.
 * Use this instead of reading `orderingEnabled` directly in UI code.
 */
export type VendorCommerceState = VendorOrderingIntent & {
  visibility: VendorPublicVisibilityState;
  customerCanOrder: boolean;
  /** Stripe/routing/menu prerequisites satisfied (independent of intent). */
  orderingPrerequisitesReady: boolean;
  blockedReason: VendorOrderingBlockedReason | null;
  customerStatusLabel: string;
  customerBannerLine: string | null;
};

export function getVendorCommerceState(
  input: VendorReadinessEvaluationInput
): VendorCommerceState {
  const intent = getVendorOrderingIntent(input);
  const state = getVendorOrderabilityState(input);

  return {
    ...intent,
    visibility: state.visibility,
    customerCanOrder: state.orderable,
    orderingPrerequisitesReady: isVendorOrderingPrerequisitesReady(input),
    blockedReason: state.blockedReason,
    customerStatusLabel: state.customerStatusLabel,
    customerBannerLine: state.customerBannerLine,
  };
}

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
  /** Durable menu-only intent: commerce prerequisites are not gaps to report. */
  menuOnly?: boolean;
  menuOnlyByPod?: boolean;
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

  if (input.menuOnly) {
    return [
      input.menuOnlyByPod
        ? "Live: menu only — ordering is off pod-wide."
        : "Live: menu only — customers can browse this menu.",
    ];
  }

  if (input.canAcceptOrders) {
    return ["Live: accepting orders."];
  }

  if (!input.setupSummary.stripe) {
    lines.push("Visible, not accepting orders: vendor needs payment setup.");
  }
  if (!input.setupSummary.pos) {
    lines.push("Visible, not accepting orders: order routing setup incomplete.");
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
  /** Durable menu-only intent: publicly live, just not orderable. */
  menuOnly?: boolean;
}): VendorPodOwnerDisplayState {
  if (!input.podVendorActive) return "hidden";
  const publicReady = input.setupSummary.publicProfile ?? (
    input.setupSummary.profile &&
    input.setupSummary.menu &&
    (input.setupSummary.hours ?? true)
  );
  if (!publicReady) return "hidden";
  if (input.menuOnly) return "menu_only";
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
  const state = getVendorOrderabilityState(input);
  if (state.orderable) return "live";
  if (state.menuOnly) return "menu_only";
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
  if (state === "menu_only") {
    return { state, headline: "Live — menu only", missingLines };
  }
  if (state === "hidden") {
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
  if (operational.includes("pod_ordering_disabled")) {
    lines.push("Menu only: ordering is disabled for this pod.");
  }
  if (operational.includes("vendor_ordering_disabled")) {
    lines.push("Menu only: customers can browse this menu but cannot order.");
  }
  if (operational.includes("stripe")) {
    lines.push("Visible, not accepting orders: vendor needs payment setup.");
  }
  if (operational.includes("pos")) {
    lines.push("Visible, not accepting orders: order routing setup incomplete.");
  }
  if (operational.includes("square_routing")) {
    lines.push(
      "Visible, not accepting orders: Square menu mappings incomplete for the selected location."
    );
  }
  if (operational.includes("deliverect_mapping")) {
    lines.push("Visible, not accepting orders: Deliverect mappings incomplete.");
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

export function isVendorCustomerOrderable(input: VendorReadinessEvaluationInput): boolean {
  return getVendorOrderabilityState(input).orderable;
}

function resolveBlockedReason(
  operationalMissing: VendorOperationalMissingKey[],
  availability: ReturnType<typeof getVendorAvailability>
): VendorOrderingBlockedReason {
  if (operationalMissing.includes("pod_ordering_disabled")) return "pod_ordering_disabled";
  if (operationalMissing.includes("vendor_ordering_disabled")) return "vendor_ordering_disabled";
  if (operationalMissing.includes("pod_orders_paused")) return "pod_orders_paused";
  if (operationalMissing.includes("vendor_paused") || availability.status === "mennyu_paused") {
    return "vendor_paused";
  }
  if (operationalMissing.includes("outside_hours") || availability.status === "closed") {
    return "vendor_closed";
  }
  if (ORDERING_SETUP_KEYS.some((key) => operationalMissing.includes(key))) {
    return "ordering_setup_incomplete";
  }
  if (operationalMissing.includes("menu_unavailable")) return "item_unavailable";
  return "ordering_setup_incomplete";
}

export function getVendorOrderabilityState(input: VendorReadinessEvaluationInput): VendorOrderabilityState {
  const visibility = getVendorPublicVisibilityState(input);
  const availability = resolveVendorAvailability(input);
  const intent = getVendorOrderingIntent(input);

  if (visibility === "hidden") {
    return {
      orderable: false,
      visibility,
      podOwnerDisplay: "hidden",
      customerStatusLabel: "",
      customerBannerLine: null,
      showBrowseHint: false,
      internalSummaryLabel: PUBLIC_PROFILE_INCOMPLETE_LABEL,
      menuOnly: intent.menuOnly,
      blockedReason: "vendor_not_public_ready",
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
      menuOnly: false,
      blockedReason: null,
    };
  }

  /**
   * Menu-only is a deliberate product state, not a failure: the vendor stays visible and
   * browsable, and we do not show "not accepting orders" banners or a browse hint.
   */
  if (intent.menuOnly) {
    return {
      orderable: false,
      visibility,
      podOwnerDisplay: "menu_only",
      customerStatusLabel: MENU_ONLY_BADGE,
      customerBannerLine: null,
      showBrowseHint: false,
      internalSummaryLabel: MENU_ONLY_BADGE,
      menuOnly: true,
      blockedReason: intent.menuOnlyByVendor
        ? "vendor_ordering_disabled"
        : "pod_ordering_disabled",
    };
  }

  let customerStatusLabel = CUSTOMER_NOT_ACCEPTING;
  let customerBannerLine: string | null = CUSTOMER_NOT_ACCEPTING;
  const showBrowseHint = true;

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
    menuOnly: false,
    blockedReason: resolveBlockedReason(operationalMissing, availability),
  };
}

export function getVendorCustomerPodCardAvailability(input: VendorReadinessEvaluationInput): {
  unavailable: boolean;
  statusLabel: string;
  showBrowseHint: boolean;
  menuOnly: boolean;
} {
  const state = getVendorOrderabilityState(input);
  if (state.visibility === "hidden") {
    return { unavailable: true, statusLabel: "", showBrowseHint: false, menuOnly: false };
  }
  /** Menu-only vendors are not "unavailable" — they browse normally with a View menu CTA. */
  return {
    unavailable: !state.orderable && !state.menuOnly,
    statusLabel: state.customerStatusLabel,
    showBrowseHint: state.showBrowseHint,
    menuOnly: state.menuOnly,
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

  /** Ordering intent is checked before pause/hours so menu-only never reads as an outage. */
  if (state.blockedReason === "pod_ordering_disabled") {
    return { code: POD_ORDERING_DISABLED_CODE, message: POD_ORDERING_DISABLED_MESSAGE };
  }
  if (state.blockedReason === "vendor_ordering_disabled") {
    return { code: VENDOR_ORDERING_DISABLED_CODE, message: VENDOR_ORDERING_DISABLED_MESSAGE };
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
