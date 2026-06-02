/**
 * Eligibility rules for admin QA Deliverect status simulation (client + server).
 */
import { hasDeliverectChannelLink } from "@/lib/deliverect-vendor-order-authority";

export const ADMIN_SIMULATE_DELIVERECT_STATUS_CODES = [
  20, 40, 50, 60, 70, 90, 95, 100, 110, 120, 999,
] as const;

export type AdminSimulateDeliverectStatusCode =
  (typeof ADMIN_SIMULATE_DELIVERECT_STATUS_CODES)[number];

const TERMINAL_FULFILLMENT = new Set(["completed", "cancelled"]);
const UNPAID_SAFE_CODES = new Set([120, 999]);

export type SimulateDeliverectStatusEligibility =
  | { eligible: true }
  | { eligible: false; code: string; message: string };

export function isAllowedSimulateDeliverectStatusCode(
  statusCode: number
): statusCode is AdminSimulateDeliverectStatusCode {
  return (ADMIN_SIMULATE_DELIVERECT_STATUS_CODES as readonly number[]).includes(statusCode);
}

export function evaluateSimulateDeliverectStatusEligibility(input: {
  orderStatus: string;
  fulfillmentStatus: string;
  routingStatus: string;
  statusCode: number;
  deliverectChannelLinkId: string | null;
  vendorDeliverectChannelLinkId: string | null;
  deliverectOrderId: string | null;
}): SimulateDeliverectStatusEligibility {
  if (!isAllowedSimulateDeliverectStatusCode(input.statusCode)) {
    return {
      eligible: false,
      code: "INVALID_STATUS_CODE",
      message: "Unsupported Deliverect status code for simulation.",
    };
  }

  const channelLinked = hasDeliverectChannelLink({
    deliverectChannelLinkId: input.deliverectChannelLinkId,
    vendor: { deliverectChannelLinkId: input.vendorDeliverectChannelLinkId },
  });
  if (!channelLinked && !input.deliverectOrderId?.trim()) {
    return {
      eligible: false,
      code: "NOT_DELIVERECT_LINKED",
      message: "Vendor order is not linked to Deliverect (no channel link or Deliverect order id).",
    };
  }

  if (
    input.orderStatus === "pending_payment" &&
    !UNPAID_SAFE_CODES.has(input.statusCode)
  ) {
    return {
      eligible: false,
      code: "ORDER_UNPAID",
      message: "Order must be paid before simulating Deliverect kitchen status (except failed/unknown test codes).",
    };
  }

  if (
    TERMINAL_FULFILLMENT.has(input.fulfillmentStatus) &&
    [90, 95, 110, 120].includes(input.statusCode)
  ) {
    return {
      eligible: false,
      code: "TERMINAL_FULFILLMENT",
      message: "Cannot apply terminal Deliverect status on an already completed or cancelled vendor order.",
    };
  }

  if (input.routingStatus === "pending" && input.fulfillmentStatus === "pending") {
    return {
      eligible: false,
      code: "ROUTING_NOT_CONFIRMED",
      message: "Simulate routing to Deliverect first (or confirm routing) before POS status simulation.",
    };
  }

  return { eligible: true };
}

export const DESTRUCTIVE_DELIVERECT_STATUS_CODES = new Set([90, 95, 110, 120]);

export function deliverectStatusCodeLabel(code: number): string {
  switch (code) {
    case 20:
      return "Accepted";
    case 40:
      return "Printed";
    case 50:
      return "Preparing";
    case 60:
      return "Prepared";
    case 70:
      return "Pickup Ready";
    case 90:
      return "Finalized";
    case 95:
      return "Auto Finalized";
    case 100:
      return "Dispatch";
    case 110:
      return "Canceled";
    case 120:
      return "Failed";
    case 999:
      return "Unknown test";
    default:
      return `Code ${code}`;
  }
}
