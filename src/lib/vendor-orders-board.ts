import {
  isVendorOrderManuallyRecovered,
  isVendorOrderRecoverableFailure,
} from "@/lib/vendor-order-effective-state";

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
 * True when the vendor/POS has acknowledged the order (kitchen may start work).
 * Routing alone (sent/confirmed) is not acknowledgment — fulfillment must progress.
 */
export function isVendorOrderAcknowledgedForBoard(vo: VendorOrderBoardRow): boolean {
  if (vo.fulfillmentStatus === "accepted" || vo.fulfillmentStatus === "preparing") {
    return true;
  }
  if (
    isVendorOrderManuallyRecovered(vo, vo.statusHistory) &&
    (vo.fulfillmentStatus === "accepted" || vo.fulfillmentStatus === "preparing")
  ) {
    return true;
  }
  return false;
}

/**
 * Group vendor orders for dashboard and kitchen boards.
 * New = unacknowledged or needs vendor action; Preparing = accepted+ in progress.
 */
export function getVendorOrderBoardGroupKey(vo: VendorOrderBoardRow): VendorOrdersBoardGroup {
  const { routingStatus, fulfillmentStatus } = vo;

  if (fulfillmentStatus === "cancelled") return "cancelled_failed";
  if (fulfillmentStatus === "completed") return "completed";
  if (fulfillmentStatus === "ready") return "ready";

  if (
    isVendorOrderRecoverableFailure(vo) &&
    !isVendorOrderManuallyRecovered(vo, vo.statusHistory)
  ) {
    return "new";
  }

  if (routingStatus === "failed" && fulfillmentStatus === "pending") {
    return "new";
  }

  if (!isVendorOrderAcknowledgedForBoard(vo)) {
    return "new";
  }

  return "preparing";
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
