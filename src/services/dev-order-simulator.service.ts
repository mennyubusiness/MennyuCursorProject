/**
 * Development-only order lifecycle simulator.
 * Advances VendorOrder routing/fulfillment states for testing without Deliverect.
 * Uses the same applyVendorOrderTransition as the vendor dashboard.
 */
import type { VendorOrderRoutingStatus, VendorOrderFulfillmentStatus } from "@/domain/types";
import type { VendorOrderTargetState } from "@/domain/vendor-order-transition";
import { applyVendorOrderTransition } from "@/services/order-status.service";

export const DEV_SIMULATOR_SOURCE = "dev_simulator";

export type SimulatorTargetState = VendorOrderTargetState;

export interface SimulateResult {
  success: true;
  vendorOrderId: string;
  orderId: string;
  routingStatus: VendorOrderRoutingStatus;
  fulfillmentStatus: VendorOrderFulfillmentStatus;
  parentStatus: string;
}

export interface SimulateError {
  success: false;
  error: string;
  code?: string;
}

/**
 * Apply a single state transition for a vendor order (dev only).
 * Delegates to shared applyVendorOrderTransition with source "dev_simulator" (no customer SMS).
 */
export async function simulateVendorOrderTransition(
  vendorOrderId: string,
  targetState: SimulatorTargetState
): Promise<SimulateResult | SimulateError> {
  const result = await applyVendorOrderTransition(
    vendorOrderId,
    targetState,
    DEV_SIMULATOR_SOURCE
  );
  if (!result.success) return result;
  return {
    success: true,
    vendorOrderId: result.vendorOrderId,
    orderId: result.orderId,
    routingStatus: result.routingStatus,
    fulfillmentStatus: result.fulfillmentStatus,
    parentStatus: result.parentStatus,
  };
}
