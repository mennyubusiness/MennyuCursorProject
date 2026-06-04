import { getVendorOrderEffectiveDisplayState } from "@/lib/vendor-order-effective-state";

/** Active kitchen / live board columns (excludes terminal groups). */
export type VendorOrdersActiveBoardGroup = "new" | "preparing" | "ready";

export type VendorOrdersBoardGroup =
  | VendorOrdersActiveBoardGroup
  | "completed"
  | "cancelled_failed";

export type VendorOrderBoardRow = {
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  statusHistory?: Array<{ source?: string | null }>;
};

/**
 * Group vendor orders for dashboard and kitchen boards.
 * Recoverable failures stay in "new"; manually recovered in "preparing".
 */
export function getVendorOrderBoardGroupKey(vo: VendorOrderBoardRow): VendorOrdersBoardGroup {
  const effective = getVendorOrderEffectiveDisplayState(vo, vo.statusHistory);
  if (effective === "cancelled" || effective === "terminal_failed") return "cancelled_failed";
  if (effective === "completed") return "completed";
  if (effective === "ready") return "ready";
  if (effective === "recovered" || effective === "active") return "preparing";
  if (effective === "needs_attention") return "new";
  return "new";
}

export const VENDOR_ORDERS_ACTIVE_BOARD_GROUPS: VendorOrdersActiveBoardGroup[] = [
  "new",
  "preparing",
  "ready",
];

export const KITCHEN_COLUMN_LABELS: Record<VendorOrdersActiveBoardGroup, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
};

export const KITCHEN_COLUMN_EMPTY: Record<VendorOrdersActiveBoardGroup, string> = {
  new: "No new orders",
  preparing: "Nothing preparing",
  ready: "No orders ready for pickup",
};

export function groupVendorOrdersForBoard<T extends VendorOrderBoardRow>(
  orders: T[]
): Record<VendorOrdersBoardGroup, T[]> {
  const acc: Record<VendorOrdersBoardGroup, T[]> = {
    new: [],
    preparing: [],
    ready: [],
    completed: [],
    cancelled_failed: [],
  };
  for (const vo of orders) {
    const key = getVendorOrderBoardGroupKey(vo);
    acc[key].push(vo);
  }
  return acc;
}

export function countActiveBoardGroups(
  grouped: Record<VendorOrdersBoardGroup, unknown[]>
): Record<VendorOrdersActiveBoardGroup, number> {
  return {
    new: grouped.new.length,
    preparing: grouped.preparing.length,
    ready: grouped.ready.length,
  };
}
