/**
 * Admin-facing refund error copy (avoid raw internal codes in primary UI).
 */

export function formatAdminRefundCapErrorMessage(input: {
  code: string;
  message?: string;
}): string {
  switch (input.code) {
    case "ORDER_ALREADY_FULLY_REFUNDED":
      return "This order has already been fully refunded.";
    case "REFUND_IN_PROGRESS":
      return "A refund for this order is already in progress. Refresh the order before trying again.";
    case "STALE_REFUND_ATTEMPT_BLOCKS_REFUND":
      return "A legacy refund attempt is blocking new refunds. Dismiss the stale attempt below, then preview again.";
    case "REFUND_AVAILABILITY_CHANGED":
      return "Refund availability changed since preview. Preview the refund again.";
    case "REFUND_EXCEEDS_ORDER_REMAINING":
    case "REFUND_EXCEEDS_VENDOR_ORDER_REMAINING":
      return "Refund availability changed since preview. Preview the refund again.";
    default:
      break;
  }

  const raw = input.message?.trim() ?? "";
  if (raw.includes("REFUND_EXCEEDS_ORDER_REMAINING")) {
    return "Refund availability changed since preview. Preview the refund again.";
  }
  if (raw.includes("REFUND_EXCEEDS_VENDOR_ORDER_REMAINING")) {
    return "Refund availability changed since preview. Preview the refund again.";
  }
  if (raw.includes("REFUND_IN_PROGRESS")) {
    return "A refund for this order is already in progress. Refresh the order before trying again.";
  }
  return raw || "Refund could not be completed.";
}

export function formatAdminRefundBlockingReason(reason: string): string {
  if (reason === "refund_already_in_progress") {
    return "A refund for this order is already in progress.";
  }
  if (reason === "order_already_fully_refunded") {
    return "This order has already been fully refunded.";
  }
  if (reason === "stale_refund_attempt_blocks_refund") {
    return "A legacy refund attempt is blocking new refunds. Dismiss the stale attempt, then preview again.";
  }
  if (reason.startsWith("refund_exceeds_order_remaining")) {
    return "Refund amount exceeds remaining refundable balance.";
  }
  if (reason.startsWith("full_order_refund_must_equal_remaining")) {
    return "Full order refund must match the remaining refundable balance.";
  }
  return reason.replace(/_/g, " ");
}
