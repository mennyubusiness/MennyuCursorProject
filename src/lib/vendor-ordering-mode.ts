/**
 * Durable ordering intent (menu-only vs orderable) for pods and vendors.
 *
 * This module owns *intent* only. It deliberately knows nothing about Stripe, POS/routing,
 * hours, or pause state so that menu-only can never be confused with those conditions:
 *
 *   - `Pod.orderingEnabled` / `Vendor.orderingEnabled` — durable product mode (this file)
 *   - `mennyuOrdersPaused`                             — temporary intake pause
 *   - `isActive` / `PodVendor.isActive`                — public visibility
 *   - `MenuItem.isAvailable`                           — sold out
 *   - `menuSource` / `orderRoutingMode`                — menu authority and order transport
 *   - Stripe / POS readiness                           — commerce prerequisites
 *
 * Effective orderability layers on top: see `vendor-readiness-states.ts` for the full
 * evaluation and `vendor-orderability-in-pod.ts` for the cart/checkout gate.
 */

export type VendorOrderingIntentInput = {
  /** `Pod.orderingEnabled`. Undefined is treated as enabled (pre-migration/partial selects). */
  podOrderingEnabled?: boolean;
  /** `Vendor.orderingEnabled`. Undefined is treated as enabled. */
  vendorOrderingEnabled?: boolean;
};

export type VendorOrderingIntent = {
  podOrderingEnabled: boolean;
  vendorOrderingEnabled: boolean;
  /** Both pod and vendor intent must be on before ordering is possible at all. */
  effectiveOrderingEnabled: boolean;
  /** True when ordering is off by configuration (menu-only), not by readiness or pause. */
  menuOnly: boolean;
  /** Vendor wants orders but the pod-wide switch is off. Intent is preserved. */
  menuOnlyByPod: boolean;
  /** Vendor itself is configured menu-only. */
  menuOnlyByVendor: boolean;
};

/**
 * Why a customer cannot order right now. Ordered by precedence in
 * `resolveVendorOrderingBlockedReason` so callers get one stable, specific reason.
 */
export type VendorOrderingBlockedReason =
  | "vendor_not_public_ready"
  | "pod_ordering_disabled"
  | "vendor_ordering_disabled"
  | "pod_orders_paused"
  | "vendor_paused"
  | "vendor_closed"
  | "ordering_setup_incomplete"
  | "item_unavailable";

export function resolveVendorOrderingIntent(
  input: VendorOrderingIntentInput
): VendorOrderingIntent {
  const podOrderingEnabled = input.podOrderingEnabled !== false;
  const vendorOrderingEnabled = input.vendorOrderingEnabled !== false;
  const effectiveOrderingEnabled = podOrderingEnabled && vendorOrderingEnabled;

  return {
    podOrderingEnabled,
    vendorOrderingEnabled,
    effectiveOrderingEnabled,
    menuOnly: !effectiveOrderingEnabled,
    menuOnlyByPod: !podOrderingEnabled,
    menuOnlyByVendor: !vendorOrderingEnabled,
  };
}

export function isEffectiveOrderingEnabled(input: VendorOrderingIntentInput): boolean {
  return resolveVendorOrderingIntent(input).effectiveOrderingEnabled;
}

/* ---------------------------------------------------------------- customer copy */

/** Single short customer-facing badge. Use once per surface — never per menu item. */
export const MENU_ONLY_BADGE = "Menu only";

/** Neutral browsing status for a pod where nothing is orderable by design. */
export const POD_MENU_ONLY_STATUS = "Browse menus";

export const VENDOR_MENU_ONLY_CTA = "View menu";

/** Add-to-cart / API rejection copy. Deliberately not "unavailable" or "paused". */
export const VENDOR_ORDERING_DISABLED_MESSAGE =
  "This vendor is menu-only and isn’t accepting orders.";
export const POD_ORDERING_DISABLED_MESSAGE =
  "This pod is menu-only and isn’t accepting orders.";

/* ------------------------------------------------------- vendor dashboard copy */

/** Vendor dashboard headline when ordering is intentionally off. Not a warning. */
export const VENDOR_MENU_ONLY_DASHBOARD_TITLE = "Your menu is live";
export const VENDOR_MENU_ONLY_DASHBOARD_BODY =
  "Customers can browse your menu on the pod page. Open Order ordering is turned off for this vendor.";
export const POD_MENU_ONLY_DASHBOARD_BODY =
  "Customers can browse published menus in this pod. Open Order ordering is turned off pod-wide.";

/** Cart-line copy: the customer already has items and must act. */
export const VENDOR_ORDERING_DISABLED_CART_MESSAGE =
  "This vendor is currently menu-only and is not accepting Open Order orders. Remove these items to continue.";
export const POD_ORDERING_DISABLED_CART_MESSAGE =
  "This pod is currently menu-only and is not accepting Open Order orders. Remove these items to continue.";

/* ---------------------------------------------------- cart/checkout error codes */

export const VENDOR_ORDERING_DISABLED_CODE = "VENDOR_ORDERING_DISABLED";
export const POD_ORDERING_DISABLED_CODE = "POD_ORDERING_DISABLED";

/* -------------------------------------------------------------- internal labels */

/** Compact effective state for admin/pod-owner lists. */
export type VendorOrderingModeLabelKey =
  | "orderable"
  | "menu_only"
  | "menu_only_pod_disabled"
  | "setup_incomplete";

export const VENDOR_ORDERING_MODE_LABELS: Record<VendorOrderingModeLabelKey, string> = {
  orderable: "Orderable",
  menu_only: "Menu only",
  menu_only_pod_disabled: "Menu only — pod disabled",
  setup_incomplete: "Ordering setup incomplete",
};

/**
 * Effective ordering state for admin surfaces.
 * `orderingReady` should reflect commerce prerequisites (Stripe/routing/menu), not pause or hours.
 */
export function resolveVendorOrderingModeLabelKey(input: {
  podOrderingEnabled?: boolean;
  vendorOrderingEnabled?: boolean;
  orderingReady?: boolean;
}): VendorOrderingModeLabelKey {
  const intent = resolveVendorOrderingIntent(input);
  if (intent.menuOnlyByVendor) return "menu_only";
  if (intent.menuOnlyByPod) return "menu_only_pod_disabled";
  if (input.orderingReady === false) return "setup_incomplete";
  return "orderable";
}

export function vendorOrderingModeLabel(input: {
  podOrderingEnabled?: boolean;
  vendorOrderingEnabled?: boolean;
  orderingReady?: boolean;
}): string {
  return VENDOR_ORDERING_MODE_LABELS[resolveVendorOrderingModeLabelKey(input)];
}

/** Admin/pod-owner control copy. Kept here so admin and vendor surfaces stay consistent. */
export const ORDERING_MODE_COPY = {
  sectionLabel: "Ordering",
  enabledLabel: "Enabled",
  menuOnlyLabel: "Menu only",
  vendorMenuOnlyDescription:
    "Customers can browse this vendor’s menu but cannot place orders.",
  vendorEnabledDescription: "Customers can order from this vendor when setup is complete.",
  podMenuOnlyDescription:
    "Customers can browse all published vendor menus, but ordering is disabled across this pod.",
  podEnabledDescription:
    "Vendors in this pod can accept orders based on their own ordering setting.",
} as const;
