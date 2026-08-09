import type { VendorOrderRoutingMode } from "@prisma/client";
import {
  VENDOR_ORDER_ROUTING_MODES,
  normalizeVendorOrderRoutingMode,
} from "@/lib/vendor-order-routing-mode";

/**
 * Beta product policy: vendors cannot select or configure POS order routing
 * (Deliverect / Square). Flip to `true` to re-enable vendor-facing POS routing selection.
 *
 * Admin tooling always retains full routing modes via {@link getAdminAvailableRoutingModes}.
 * Integration infrastructure remains in the codebase regardless of this flag.
 */
export const VENDOR_POS_ROUTING_SELECTION_ENABLED = false;

export function isVendorPosRoutingSelectionEnabled(): boolean {
  return VENDOR_POS_ROUTING_SELECTION_ENABLED;
}

/** Routing modes a vendor may select / self-serve during the current product policy. */
export function getVendorAvailableRoutingModes(): VendorOrderRoutingMode[] {
  if (!isVendorPosRoutingSelectionEnabled()) {
    return ["manual_dashboard"];
  }
  return [...VENDOR_ORDER_ROUTING_MODES];
}

/** Routing modes admins may assign (full enum). */
export function getAdminAvailableRoutingModes(): VendorOrderRoutingMode[] {
  return [...VENDOR_ORDER_ROUTING_MODES];
}

export function isVendorSelectableRoutingMode(
  mode: VendorOrderRoutingMode | string | null | undefined
): boolean {
  const normalized = normalizeVendorOrderRoutingMode(mode);
  return getVendorAvailableRoutingModes().includes(normalized);
}

export function vendorPosRoutingConfigurationBlockedMessage(): string {
  return "Orders appear in your Open Order dashboard. POS order-routing setup is not available.";
}

/**
 * Server-side guard for vendor-authorized POS routing configuration
 * (connect Deliverect, Square OAuth, location selection, etc.).
 */
export function assertVendorPosRoutingConfigurationAllowed():
  | { ok: true }
  | { ok: false; error: string } {
  if (!isVendorPosRoutingSelectionEnabled()) {
    return { ok: false, error: vendorPosRoutingConfigurationBlockedMessage() };
  }
  return { ok: true };
}

/**
 * Whether vendor UI should present POS routing / connect surfaces.
 * False during beta tablet-only policy.
 */
export function vendorMayConfigurePosOrderRouting(): boolean {
  return isVendorPosRoutingSelectionEnabled();
}
