/** Terminal parent Order.status values — no further fulfillment updates expected. */
export const TERMINAL_ORDER_STATUSES = [
  "completed",
  "partially_completed",
  "cancelled",
  "failed",
] as const;

export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number];

export function isTerminalOrderStatus(status: string): status is TerminalOrderStatus {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}

/** Unpaid / abandoned checkout — not a placed order handoff target. */
export const CHECKOUT_IN_PROGRESS_ORDER_STATUSES = ["pending_payment"] as const;

export function isCheckoutInProgressOrderStatus(status: string): boolean {
  return (CHECKOUT_IN_PROGRESS_ORDER_STATUSES as readonly string[]).includes(status);
}
