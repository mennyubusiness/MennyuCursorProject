/**
 * Centralized derived vendor availability.
 * Single source of truth for vendor orderability and normalized state.
 *
 * Sources (evaluation order):
 * 1. Vendor active state (isActive)
 * 2. POS / Deliverect open-closed state (posOpen; future webhook-driven)
 * 3. Mennyu pause state (mennyuOrdersPaused)
 *
 * UI wording is not defined here; callers map status to copy and error codes.
 */

export interface VendorAvailabilityInput {
  /** Vendor is active and visible for ordering. When false, not orderable. */
  isActive?: boolean;
  /** When true, vendor has paused Mennyu orders (dashboard toggle). */
  mennyuOrdersPaused?: boolean;
  /**
   * POS / Deliverect open state. When false, store is closed (e.g. outside hours).
   * When undefined, we do not block on POS (e.g. no integration yet).
   */
  posOpen?: boolean;
}

export type VendorAvailabilityStatus =
  | "open"
  | "inactive"
  | "closed"
  | "mennyu_paused";

export interface VendorAvailabilityResult {
  /** Normalized state for UI/errors. Use for messaging, not raw flags. */
  status: VendorAvailabilityStatus;
  /** True only when vendor can receive orders (status === "open"). */
  orderable: boolean;
}

/**
 * Derives availability from vendor active state, POS closed state, and Mennyu pause.
 * Use this for all orderability checks and for UI state; keep wording in call sites.
 */
export function getVendorAvailability(
  vendor: VendorAvailabilityInput
): VendorAvailabilityResult {
  if (vendor.isActive === false) {
    return { status: "inactive", orderable: false };
  }
  if (vendor.posOpen === false) {
    return { status: "closed", orderable: false };
  }
  if (vendor.mennyuOrdersPaused) {
    return { status: "mennyu_paused", orderable: false };
  }
  return { status: "open", orderable: true };
}

/**
 * Normalized status only. Use when you need the state for UI (e.g. which banner to show).
 */
export function getVendorAvailabilityStatus(
  vendor: VendorAvailabilityInput
): VendorAvailabilityStatus {
  return getVendorAvailability(vendor).status;
}

/**
 * True only when vendor can receive orders. Use for add-to-cart and checkout gates.
 */
export function isVendorAvailableForOrders(
  vendor: VendorAvailabilityInput
): boolean {
  return getVendorAvailability(vendor).orderable;
}
