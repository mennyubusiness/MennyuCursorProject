import { getVendorOrderBoardGroupKey } from "@/lib/vendor-orders-board";
import { getVendorOrderOperatingMode } from "@/lib/vendor-order-operating-mode";

export type VendorOrderHistoryFilter =
  | "today"
  | "yesterday"
  | "this_week"
  | "needs_attention"
  | "cancelled"
  | "refunded"
  | "failed_routing";

export type VendorOrderHistoryRow = {
  id: string;
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  statusHistory?: Array<{ source?: string | null; fulfillmentStatus?: string | null; createdAt: string }>;
  totalRefundedCents?: number;
  order: { id: string; createdAt: string };
};

export const VENDOR_ORDER_HISTORY_FILTERS: Array<{
  id: VendorOrderHistoryFilter;
  label: string;
}> = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "yesterday", label: "Yesterday" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded", label: "Refunded" },
  { id: "failed_routing", label: "Failed routing" },
];

function startOfDayMs(offsetDays = 0, nowMs = Date.now()): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.getTime();
}

function isTerminalOrder(vo: VendorOrderHistoryRow): boolean {
  const group = getVendorOrderBoardGroupKey(vo);
  return group === "completed" || group === "cancelled_failed";
}

export function filterVendorOrdersForHistory<T extends VendorOrderHistoryRow>(
  orders: T[],
  filter: VendorOrderHistoryFilter,
  nowMs: number,
  isDeliverectLive = false
): T[] {
  const todayStart = startOfDayMs(0, nowMs);
  const yesterdayStart = startOfDayMs(-1, nowMs);
  const weekStart = startOfDayMs(-6, nowMs);

  const terminal = orders.filter(isTerminalOrder);

  switch (filter) {
    case "today":
      return terminal.filter((vo) => new Date(vo.order.createdAt).getTime() >= todayStart);
    case "yesterday":
      return terminal.filter((vo) => {
        const t = new Date(vo.order.createdAt).getTime();
        return t >= yesterdayStart && t < todayStart;
      });
    case "this_week":
      return terminal.filter((vo) => new Date(vo.order.createdAt).getTime() >= weekStart);
    case "needs_attention":
      return orders.filter(
        (vo) =>
          getVendorOrderOperatingMode(vo, vo.statusHistory, isDeliverectLive) === "needs_attention" ||
          getVendorOrderBoardGroupKey(vo) === "new"
      );
    case "cancelled":
      return orders.filter((vo) => vo.fulfillmentStatus === "cancelled");
    case "refunded":
      return orders.filter((vo) => (vo.totalRefundedCents ?? 0) > 0);
    case "failed_routing":
      return orders.filter(
        (vo) => vo.routingStatus === "failed" && vo.fulfillmentStatus !== "completed"
      );
    default:
      return terminal;
  }
}
