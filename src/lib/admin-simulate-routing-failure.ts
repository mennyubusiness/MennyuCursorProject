/**
 * Eligibility rules for admin QA routing failure simulation (client + server safe).
 */

export const SIMULATED_ROUTING_FAILURE_MESSAGE = "Simulated routing failure for admin QA";

const TERMINAL_FULFILLMENT = new Set(["completed", "cancelled", "ready"]);

export type SimulateRoutingFailureEligibility =
  | { eligible: true }
  | { eligible: false; code: string; message: string };

export function evaluateSimulateRoutingFailureEligibility(input: {
  orderStatus: string;
  fulfillmentStatus: string;
}): SimulateRoutingFailureEligibility {
  if (input.orderStatus === "pending_payment") {
    return {
      eligible: false,
      code: "ORDER_UNPAID",
      message: "Order must be paid before simulating routing failure.",
    };
  }
  if (TERMINAL_FULFILLMENT.has(input.fulfillmentStatus)) {
    return {
      eligible: false,
      code: "TERMINAL_FULFILLMENT",
      message: "Cannot simulate on completed, ready, or cancelled vendor orders.",
    };
  }
  if (input.fulfillmentStatus !== "pending") {
    return {
      eligible: false,
      code: "FULFILLMENT_NOT_PENDING",
      message: "Vendor fulfillment must still be pending (awaiting confirmation).",
    };
  }
  return { eligible: true };
}
