import { getVendorOrderBoardGroupKey, type VendorOrderBoardRow } from "@/lib/vendor-orders-board";
import { getPickupCode } from "@/lib/pickup-code";
import { getVendorOrderOperatingMode } from "@/lib/vendor-order-operating-mode";
import type { VendorOrderIssueRow } from "@/services/vendor-order-issue.service";

export type VendorOrdersLedgerFilter =
  | "all"
  | "active"
  | "issues"
  | "completed"
  | "cancelled_failed";

export type VendorOrdersLedgerDateFilter = "all" | "today" | "last_7_days" | "last_30_days";

export type VendorOrdersLedgerOrder = VendorOrderBoardRow & {
  id: string;
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  totalCents: number;
  tipCents?: number;
  totalRefundedCents?: number;
  statusHistory?: Array<{
    source?: string | null;
    fulfillmentStatus?: string | null;
    routingStatus?: string | null;
    createdAt: string;
  }>;
  order: {
    id: string;
    orderNotes: string | null;
    customerPhone: string | null;
    createdAt: string;
  };
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    priceCents: number;
    specialInstructions: string | null;
    selections: Array<{
      nameSnapshot: string;
      quantity: number;
      modifierOption: { name: string };
    }>;
  }>;
};

export const VENDOR_ORDERS_LEDGER_FILTERS: Array<{ id: VendorOrdersLedgerFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "issues", label: "Needs attention" },
  { id: "completed", label: "Completed" },
  { id: "cancelled_failed", label: "Cancelled / Failed" },
];

export const VENDOR_ORDERS_LEDGER_DATE_FILTERS: Array<{
  id: VendorOrdersLedgerDateFilter;
  label: string;
}> = [
  { id: "all", label: "All dates" },
  { id: "today", label: "Today" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
];

export const VENDOR_ORDERS_LEDGER_EMPTY: Record<
  VendorOrdersLedgerFilter,
  { title: string; description: string }
> = {
  all: {
    title: "No orders yet.",
    description: "Customer orders will appear here as they come in.",
  },
  active: {
    title: "No active orders.",
    description: "Use Kitchen Mode during service to handle live orders.",
  },
  issues: {
    title: "No orders need attention.",
    description: "Customer issues and routing problems will show here.",
  },
  completed: {
    title: "No completed orders yet.",
    description: "Finished pickups appear here after you complete them.",
  },
  cancelled_failed: {
    title: "No cancelled or failed orders.",
    description: "Cancelled orders and routing failures appear here.",
  },
};

function startOfDayMs(offsetDays = 0, nowMs = Date.now()): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.getTime();
}

export function isActiveLedgerOrder(vo: VendorOrderBoardRow): boolean {
  const group = getVendorOrderBoardGroupKey(vo);
  return group === "new" || group === "preparing" || group === "ready";
}

export function orderHasLedgerIssue(
  vo: VendorOrderBoardRow,
  issues: VendorOrderIssueRow[],
  isDeliverectLive: boolean
): boolean {
  if (issues.length > 0) return true;
  return (
    getVendorOrderOperatingMode(vo, vo.statusHistory, isDeliverectLive) === "needs_attention"
  );
}

export function sortVendorOrdersLedgerNewestFirst<T extends { order: { createdAt: string } }>(
  orders: T[]
): T[] {
  return [...orders].sort(
    (a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime()
  );
}

export function filterVendorOrdersLedger<T extends VendorOrdersLedgerOrder>(
  orders: T[],
  filter: VendorOrdersLedgerFilter,
  dateFilter: VendorOrdersLedgerDateFilter,
  nowMs: number,
  isDeliverectLive: boolean,
  issuesByVendorOrderId: Map<string, VendorOrderIssueRow[]>,
  pickupCodeSearch: string
): T[] {
  const todayStart = startOfDayMs(0, nowMs);
  const weekStart = startOfDayMs(-6, nowMs);
  const monthStart = startOfDayMs(-29, nowMs);

  let list = sortVendorOrdersLedgerNewestFirst(orders);

  if (dateFilter === "today") {
    list = list.filter((vo) => new Date(vo.order.createdAt).getTime() >= todayStart);
  } else if (dateFilter === "last_7_days") {
    list = list.filter((vo) => new Date(vo.order.createdAt).getTime() >= weekStart);
  } else if (dateFilter === "last_30_days") {
    list = list.filter((vo) => new Date(vo.order.createdAt).getTime() >= monthStart);
  }

  const query = pickupCodeSearch.trim().toLowerCase();
  if (query) {
    list = list.filter((vo) => getPickupCode(vo.order.id).toLowerCase().includes(query));
  }

  switch (filter) {
    case "active":
      return list.filter(isActiveLedgerOrder);
    case "completed":
      return list.filter((vo) => getVendorOrderBoardGroupKey(vo) === "completed");
    case "cancelled_failed":
      return list.filter((vo) => getVendorOrderBoardGroupKey(vo) === "cancelled_failed");
    case "issues":
      return list.filter((vo) =>
        orderHasLedgerIssue(vo, issuesByVendorOrderId.get(vo.id) ?? [], isDeliverectLive)
      );
    case "all":
    default:
      return list;
  }
}

export function groupIssuesByVendorOrderId(
  issues: VendorOrderIssueRow[]
): Map<string, VendorOrderIssueRow[]> {
  const map = new Map<string, VendorOrderIssueRow[]>();
  for (const issue of issues) {
    const list = map.get(issue.vendorOrderId) ?? [];
    list.push(issue);
    map.set(issue.vendorOrderId, list);
  }
  return map;
}

export function parseVendorOrdersLedgerFilter(
  value: string | null | undefined
): VendorOrdersLedgerFilter {
  if (
    value === "active" ||
    value === "issues" ||
    value === "completed" ||
    value === "cancelled_failed"
  ) {
    return value;
  }
  return "all";
}
