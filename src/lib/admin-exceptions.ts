/**
 * Admin Exceptions Queue: classify VendorOrders that need attention.
 * All logic is derived from existing fields; no schema changes.
 * Thresholds are centralized here with TODOs for future tuning.
 */

// TODO: Tune based on real operations. 30 min = routing still pending after order creation.
const ROUTING_STUCK_MINUTES = 30;

// v1: skip fulfillment_stuck (would need statusHistory timing or explicit state-entered-at).
// TODO: Add fulfillment_stuck if we have a safe rule (e.g. accepted/preparing for > N hours).
// const FULFILLMENT_STUCK_HOURS = 2;

export type ExceptionType =
  | "routing_failed"
  | "routing_stuck"
  | "fulfillment_stuck"
  | "unknown_attention_needed";

export interface VendorOrderForException {
  id: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  createdAt: Date;
  deliverectAttempts?: number | null;
  deliverectSubmittedAt?: Date | null;
  deliverectLastError?: string | null;
}

/**
 * Returns the exception type for a VendorOrder, or null if it is not an exception.
 */
export function getExceptionType(vo: VendorOrderForException): ExceptionType | null {
  if (vo.routingStatus === "failed") return "routing_failed";
  if (vo.routingStatus === "pending" && isRoutingStuck(vo)) return "routing_stuck";
  // fulfillment_stuck: skipped for v1 (no safe rule without state-entered-at).
  return null;
}

/**
 * Whether routing is "stuck" (pending for too long since order creation).
 */
import { isOlderThanMinutes } from "@/lib/date-utils";

function isRoutingStuck(vo: VendorOrderForException): boolean {
  return isOlderThanMinutes(vo.createdAt, ROUTING_STUCK_MINUTES);
}

/**
 * Human-readable reason for the exception (for UI).
 */
export function getExceptionReason(vo: VendorOrderForException, type: ExceptionType): string {
  switch (type) {
    case "routing_failed":
      return vo.deliverectLastError?.slice(0, 120) ?? "Routing failed (no error stored)";
    case "routing_stuck":
      return `Routing still pending after ${ROUTING_STUCK_MINUTES}+ minutes`;
    case "fulfillment_stuck":
      return "Fulfillment in early state for too long";
    case "unknown_attention_needed":
      return "Needs review";
    default:
      return "Needs review";
  }
}

/** Minutes used for routing_stuck; export for display if needed. */
export const ROUTING_STUCK_THRESHOLD_MINUTES = ROUTING_STUCK_MINUTES;
