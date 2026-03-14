/**
 * Shared eligibility for customer order cancellation and vendor order deny/reject.
 * Used by UI (show/hide buttons) and server validation.
 */

import { isVendorReceiptConfirmed } from "@/lib/vendor-order-effective-state";

/** Fulfillment states where the vendor has not yet started preparation. */
const PRE_PREPARATION_FULFILLMENT = new Set<string>(["pending", "accepted"]);

export type VendorOrderForCancelEligibility = {
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  statusHistory?: Array<{ source?: string | null }> | null;
};

/**
 * True when this vendor order is still in a state where the customer can cancel the order
 * (pre-preparation: pending or accepted only).
 */
export function canCustomerCancelVendorOrder(vo: VendorOrderForCancelEligibility): boolean {
  if (vo.fulfillmentStatus === "cancelled") return false;
  return PRE_PREPARATION_FULFILLMENT.has(vo.fulfillmentStatus);
}

/**
 * True when the customer can cancel the whole order: order is not terminal and
 * every vendor order is still in a cancelable (pre-preparation) state.
 */
export function canCustomerCancelOrder(order: {
  status: string;
  vendorOrders: Array<VendorOrderForCancelEligibility>;
}): boolean {
  const terminal = ["completed", "partially_completed", "cancelled", "failed"];
  if (terminal.includes(order.status)) return false;
  if (order.vendorOrders.length === 0) return false;
  return order.vendorOrders.every(canCustomerCancelVendorOrder);
}

/** Alias for whole-order cancellation eligibility (used by UI/API). */
export function canCustomerCancelWholeOrder(order: Parameters<typeof canCustomerCancelOrder>[0]): boolean {
  return canCustomerCancelOrder(order);
}

/**
 * True when the vendor can deny/reject this vendor order (before preparing).
 * Must be in pending or accepted fulfillment, and receipt must be confirmed
 * (so we don't allow "deny" when routing is still pending with no confirmation).
 */
export function canVendorRejectVendorOrder(
  vo: VendorOrderForCancelEligibility
): boolean {
  if (vo.fulfillmentStatus === "cancelled") return false;
  if (vo.fulfillmentStatus === "completed") return false;
  if (!PRE_PREPARATION_FULFILLMENT.has(vo.fulfillmentStatus)) return false;
  return isVendorReceiptConfirmed(vo, vo.statusHistory);
}

/**
 * Alias for clarity: vendor order is in the window where vendor can cancel/deny it.
 */
export function isVendorOrderInCancelableWindow(
  vo: VendorOrderForCancelEligibility
): boolean {
  return canVendorRejectVendorOrder(vo);
}
