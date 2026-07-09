/**
 * Deliverect vs Open Order authority for vendor-order kitchen status.
 * Channel-linked orders are POS-managed unless admin manual recovery took control.
 * Vendor orderRoutingMode is the primary gate: manual_dashboard vendors always manage fulfillment in Open Order.
 *
 * Kitchen lock rules for active integrations live in kitchen-action-policy.ts.
 */
import {
  getEffectiveAuthority,
  type VendorOrderAuthoritySnapshot,
} from "@/domain/status-authority";
import type { VendorOrderRoutingMode } from "@prisma/client";
import {
  canVendorDashboardMutateFromPolicy,
  getKitchenActionPolicy,
  vendorKitchenActionBlockedMessage,
  type KitchenActionPolicyIntegrationInput,
} from "@/lib/order-routing/kitchen-action-policy";
import { isDeliverectRoutingMode, isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";

export const VENDOR_DELIVERECT_CONTROLLED_MESSAGE =
  "This order is controlled by Deliverect/POS. Status updates must come from the POS.";

export const VENDOR_DELIVERECT_CONTROLLED_NOTICE =
  "Status is controlled by your POS through Deliverect. Open Order will update automatically when the POS sends updates.";

export const VENDOR_SQUARE_CONTROLLED_MESSAGE =
  "This order is managed in Square. Update it there instead.";

export const VENDOR_SQUARE_SYNC_NOTICE =
  "This order is routed to Square. Status updates from Square will update Open Order.";

export function hasDeliverectChannelLink(
  vo: Pick<VendorOrderAuthoritySnapshot, "deliverectChannelLinkId" | "vendor">
): boolean {
  const ch = vo.deliverectChannelLinkId ?? vo.vendor?.deliverectChannelLinkId;
  return Boolean(ch != null && String(ch).trim() !== "");
}

export type VendorKitchenAuthorityOrder = VendorOrderAuthoritySnapshot & {
  squareOrderId?: string | null;
  deliverectOrderId?: string | null;
  fulfillmentStatus?: string;
};

function kitchenVendorInput(
  orderRoutingMode?: VendorOrderRoutingMode | string | null,
  vo?: Pick<VendorKitchenAuthorityOrder, "deliverectChannelLinkId" | "vendor">
) {
  return {
    orderRoutingMode: orderRoutingMode ?? "manual_dashboard",
    deliverectChannelLinkId: vo?.deliverectChannelLinkId ?? vo?.vendor?.deliverectChannelLinkId,
  };
}

function kitchenOrderInput(vo: VendorKitchenAuthorityOrder): Parameters<
  typeof getKitchenActionPolicy
>[1] {
  return {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    squareOrderId: vo.squareOrderId,
    deliverectOrderId: vo.deliverectOrderId,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
    statusAuthority: vo.statusAuthority,
    deliverectChannelLinkId: vo.deliverectChannelLinkId,
    vendor: vo.vendor ?? undefined,
  };
}

/**
 * Kitchen status should come from Deliverect/POS webhooks, not the vendor dashboard.
 * Manual dashboard vendors are never POS-authoritative regardless of channel link.
 */
export function isDeliverectAuthoritativeVendorOrder(
  vo: VendorOrderAuthoritySnapshot,
  orderRoutingMode?: VendorOrderRoutingMode | string | null,
  integration?: KitchenActionPolicyIntegrationInput
): boolean {
  if (orderRoutingMode === "manual_dashboard") return false;
  if (isSquareRoutingMode(orderRoutingMode)) return false;
  const policy = getKitchenActionPolicy(
    kitchenVendorInput(orderRoutingMode, vo),
    kitchenOrderInput(vo as VendorKitchenAuthorityOrder),
    integration
  );
  return policy.actionsLocked && policy.provider === "deliverect";
}

/** Open Order (or admin recovery) may drive status from the vendor dashboard. */
export function isOpenOrderAuthoritativeVendorOrder(
  vo: VendorOrderAuthoritySnapshot,
  orderRoutingMode?: VendorOrderRoutingMode | string | null,
  integration?: KitchenActionPolicyIntegrationInput
): boolean {
  return !isDeliverectAuthoritativeVendorOrder(vo, orderRoutingMode, integration);
}

export function isSquareRoutedVendorOrderWithSync(input: {
  squareOrderId?: string | null;
  orderRoutingMode?: VendorOrderRoutingMode | string | null;
}): boolean {
  return isSquareRoutingMode(input.orderRoutingMode) && Boolean(input.squareOrderId?.trim());
}

export function canVendorDashboardMutateVendorOrder(
  vo: VendorKitchenAuthorityOrder,
  orderRoutingMode?: VendorOrderRoutingMode | string | null,
  integration?: KitchenActionPolicyIntegrationInput,
  options?: { allowDegradedRoutingConfirm?: boolean }
): boolean {
  if (orderRoutingMode === "manual_dashboard") return true;
  return canVendorDashboardMutateFromPolicy(
    kitchenVendorInput(orderRoutingMode, vo),
    kitchenOrderInput(vo),
    integration,
    options
  );
}

export function vendorDashboardMutateBlockedMessage(
  vo: VendorKitchenAuthorityOrder,
  orderRoutingMode?: VendorOrderRoutingMode | string | null,
  integration?: KitchenActionPolicyIntegrationInput
): string {
  const policy = getKitchenActionPolicy(
    kitchenVendorInput(orderRoutingMode, vo),
    kitchenOrderInput(vo),
    integration
  );
  if (isDeliverectRoutingMode(orderRoutingMode) && policy.actionsLocked) {
    return VENDOR_DELIVERECT_CONTROLLED_MESSAGE;
  }
  if (isSquareRoutingMode(orderRoutingMode) && policy.actionsLocked) {
    return vendorKitchenActionBlockedMessage(policy);
  }
  return vendorKitchenActionBlockedMessage(policy);
}
