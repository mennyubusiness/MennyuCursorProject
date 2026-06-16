/** Terminal group-order session states — not an active collaborative cart. */
export const TERMINAL_GROUP_ORDER_SESSION_STATUSES = ["ended", "expired", "submitted"] as const;

export type TerminalGroupOrderSessionStatus =
  (typeof TERMINAL_GROUP_ORDER_SESSION_STATUSES)[number];

export const ACTIVE_GROUP_ORDER_SESSION_STATUSES = ["active", "locked_checkout"] as const;

export function isTerminalGroupOrderSessionStatus(status: string): boolean {
  return (TERMINAL_GROUP_ORDER_SESSION_STATUSES as readonly string[]).includes(status);
}

export function isActiveGroupOrderSessionStatus(status: string): boolean {
  return (ACTIVE_GROUP_ORDER_SESSION_STATUSES as readonly string[]).includes(status);
}

/**
 * Solo-safe cart page group state: unknown viewers are not in an active group order
 * when the session is terminal (ended/expired/submitted).
 */
export function shouldTreatUnknownViewerAsSoloForTerminalGroup(
  status: string,
  view: "host" | "participant" | "unknown"
): boolean {
  return view === "unknown" && isTerminalGroupOrderSessionStatus(status);
}
