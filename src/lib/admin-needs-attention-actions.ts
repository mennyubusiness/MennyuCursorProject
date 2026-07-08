/**
 * Shared rules for admin Needs Attention / recovery actions (workbench + order detail).
 */
import type { AdminAttentionReason } from "@/lib/admin-attention";
import {
  isSquareInsufficientPermissionsError,
  SQUARE_OAUTH_PERMISSIONS_ADMIN_MESSAGE,
} from "@/lib/integrations/square/square-oauth-scopes";

export type VendorOrderRecoverySnapshot = {
  routingStatus: string;
  fulfillmentStatus: string;
  deliverectOrderId?: string | null;
  manuallyRecoveredAt?: Date | string | null;
  squareLastError?: string | null;
};

export type OrderRecoverySnapshot = {
  status: string;
};

const TERMINAL_FULFILLMENT = new Set(["completed", "cancelled"]);

export function isOrderPaidForAdminRecovery(order: OrderRecoverySnapshot): boolean {
  return order.status !== "pending_payment";
}

export function formatOrderPaymentLabel(status: string): string {
  if (status === "pending_payment") return "Unpaid (checkout incomplete)";
  if (status === "failed") return "Payment failed";
  return "Paid";
}

export function isSquarePermissionsRetryBlocked(
  squareLastError?: string | null,
  orderRoutingMode?: string | null
): boolean {
  if (orderRoutingMode !== "square") return false;
  const error = squareLastError?.trim();
  if (!error) return false;
  return (
    isSquareInsufficientPermissionsError(error) ||
    error === SQUARE_OAUTH_PERMISSIONS_ADMIN_MESSAGE
  );
}

export function canRetryRouting(
  vo: VendorOrderRecoverySnapshot,
  order: OrderRecoverySnapshot,
  orderRoutingMode?: string | null
): boolean {
  if (isSquarePermissionsRetryBlocked(vo.squareLastError, orderRoutingMode)) {
    return false;
  }
  if (orderRoutingMode === "manual_dashboard") {
    if (!isOrderPaidForAdminRecovery(order)) return false;
    if (TERMINAL_FULFILLMENT.has(vo.fulfillmentStatus)) return false;
    if (vo.manuallyRecoveredAt != null) return false;
    return vo.routingStatus === "failed";
  }
  if (!isOrderPaidForAdminRecovery(order)) return false;
  if (TERMINAL_FULFILLMENT.has(vo.fulfillmentStatus)) return false;
  if (vo.manuallyRecoveredAt != null) return false;
  if (vo.fulfillmentStatus !== "pending") return false;

  if (vo.routingStatus === "failed") return true;
  if (vo.routingStatus === "pending") return true;
  /** Sent without external id may still need a resubmit; sent with id must not duplicate Deliverect. */
  if (vo.routingStatus === "sent" && !vo.deliverectOrderId) return true;

  return false;
}

export function canManualRecoverVendorOrder(
  vo: VendorOrderRecoverySnapshot,
  order: OrderRecoverySnapshot
): boolean {
  if (!isOrderPaidForAdminRecovery(order)) return false;
  if (TERMINAL_FULFILLMENT.has(vo.fulfillmentStatus)) return false;
  if (vo.manuallyRecoveredAt != null) return false;
  if (vo.fulfillmentStatus !== "pending") return false;

  if (vo.routingStatus === "failed" || vo.routingStatus === "pending") return true;
  if (vo.routingStatus === "sent" || vo.routingStatus === "confirmed") return true;

  return false;
}

export function canCancelVendorOrderForAttention(
  vo: VendorOrderRecoverySnapshot,
  order: OrderRecoverySnapshot
): boolean {
  if (!isOrderPaidForAdminRecovery(order)) return false;
  return !TERMINAL_FULFILLMENT.has(vo.fulfillmentStatus);
}

export type WorkbenchSuggestedAction = "retry_routing" | "manual_recovery" | "view_order" | "resolve_issue";

export function getNeedsAttentionSuggestedActions(
  reason: AdminAttentionReason,
  vo: VendorOrderRecoverySnapshot | null,
  order: OrderRecoverySnapshot | null,
  orderRoutingMode?: string | null
): WorkbenchSuggestedAction[] {
  if (!vo || !order) {
    if (reason === "open_issue" || reason === "customer_reported_issue") return ["resolve_issue"];
    return ["view_order"];
  }

  const actions: WorkbenchSuggestedAction[] = ["view_order"];
  if (canRetryRouting(vo, order, orderRoutingMode)) actions.unshift("retry_routing");
  if (canManualRecoverVendorOrder(vo, order)) actions.push("manual_recovery");
  if (reason === "open_issue") actions.push("resolve_issue");
  return [...new Set(actions)];
}
