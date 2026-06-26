import type { VendorAvailabilityStatus } from "@/lib/vendor-availability";
import type { VendorPosUiState } from "@/lib/vendor-pos-ui-state";

export type VendorIntakeStatusLabel =
  | "Accepting orders"
  | "Paused"
  | "Closed"
  | "Not ready";

export function vendorIntakeStatusLabel(input: {
  availabilityStatus: VendorAvailabilityStatus;
  setupComplete: boolean;
  canAcceptOrders: boolean;
}): VendorIntakeStatusLabel {
  if (!input.setupComplete) return "Not ready";
  if (input.availabilityStatus === "mennyu_paused") return "Paused";
  if (input.availabilityStatus === "closed" || input.availabilityStatus === "inactive") {
    return "Closed";
  }
  if (input.canAcceptOrders) return "Accepting orders";
  return "Not ready";
}

export function vendorIntakeStatusTone(
  label: VendorIntakeStatusLabel
): "success" | "warning" | "neutral" | "error" {
  switch (label) {
    case "Accepting orders":
      return "success";
    case "Paused":
      return "warning";
    case "Closed":
      return "neutral";
    case "Not ready":
      return "error";
    default:
      return "neutral";
  }
}

export function vendorPosConnectionLabel(state: VendorPosUiState): string {
  switch (state) {
    case "connected":
      return "POS connected";
    case "waiting_for_activation":
      return "POS connection pending";
    case "needs_attention":
      return "POS needs attention";
    case "not_connected":
    default:
      return "POS not connected";
  }
}

export function vendorMenuSyncLabel(input: {
  posConnected: boolean;
  menuReady: boolean;
  hasOperationalItems: boolean;
}): string {
  if (!input.hasOperationalItems) return "Menu sync needs attention";
  if (input.menuReady) {
    return input.posConnected ? "Menu synced from POS" : "Menu ready";
  }
  return "No items available to order";
}

export function vendorPaymentsReadinessLabel(ready: boolean): string {
  return ready ? "Payments ready" : "Finish payment setup";
}

export const VENDOR_POS_MANAGED_COPY = "Order status is managed by your POS.";
export const VENDOR_POS_BOARD_READONLY_COPY =
  "Order progress is managed by your POS. This board is read-only.";
export const VENDOR_POS_MENU_MANAGED_COPY =
  "Item names, prices, and modifiers are managed in your POS.";
export const VENDOR_POS_HOURS_MANAGED_COPY =
  "Store hours are managed in your POS. You can still pause Open Order intake below.";
export const VENDOR_STRIPE_COPY = "Your payments are processed through Stripe.";
export const VENDOR_ALL_READY_COPY = "Everything looks ready for orders.";
export const VENDOR_NO_POD_COPY = "This vendor is not assigned to a pod yet.";
export const VENDOR_NO_ACTIVE_ORDERS_COPY = "No active orders right now.";
