import type { VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";

import type { SquareOrderFulfillment, SquareOrderSnapshot } from "@/lib/integrations/square/square-order.types";

export type SquareMappedVendorOrderStatus = {
  routingStatus?: VendorRoutingStatus;
  fulfillmentStatus?: VendorFulfillmentStatus;
  squareOrderState: string | null;
  squareFulfillmentState: string | null;
  externalAudit: string;
};

const FULFILLMENT_RANK: Record<VendorFulfillmentStatus, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
  cancelled: 100,
};

function normalizeState(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function mapSquareFulfillmentState(
  state: string | null
): VendorFulfillmentStatus | null {
  switch (state) {
    case "PROPOSED":
      return "accepted";
    case "RESERVED":
      return "preparing";
    case "PREPARED":
      return "ready";
    case "COMPLETED":
      return "completed";
    case "CANCELED":
    case "CANCELLED":
      return "cancelled";
    case "FAILED":
      return "cancelled";
    default:
      return null;
  }
}

function mapSquareOrderState(state: string | null): VendorFulfillmentStatus | null {
  switch (state) {
    case "COMPLETED":
      return "completed";
    case "CANCELED":
    case "CANCELLED":
      return "cancelled";
    case "OPEN":
      return null;
    default:
      return null;
  }
}

/** Prefer active pickup fulfillment; fall back to most advanced fulfillment state. */
export function pickSquarePickupFulfillment(
  fulfillments: SquareOrderFulfillment[] | null | undefined
): SquareOrderFulfillment | null {
  if (!fulfillments?.length) return null;
  const pickups = fulfillments.filter((f) => normalizeState(f.type) === "PICKUP");
  const candidates = pickups.length > 0 ? pickups : fulfillments;
  const rank: Record<string, number> = {
    PROPOSED: 1,
    RESERVED: 2,
    PREPARED: 3,
    COMPLETED: 4,
    CANCELED: 5,
    CANCELLED: 5,
    FAILED: 5,
  };
  return [...candidates].sort((a, b) => {
    const aRank = rank[normalizeState(a.state) ?? ""] ?? 0;
    const bRank = rank[normalizeState(b.state) ?? ""] ?? 0;
    return bRank - aRank;
  })[0] ?? null;
}

export function mapSquareOrderSnapshotToVendorStatus(
  order: SquareOrderSnapshot
): SquareMappedVendorOrderStatus | null {
  const squareOrderState = normalizeState(order.state);
  const fulfillment = pickSquarePickupFulfillment(order.fulfillments);
  const squareFulfillmentState = normalizeState(fulfillment?.state);

  const fromFulfillment = mapSquareFulfillmentState(squareFulfillmentState);
  const fromOrder = mapSquareOrderState(squareOrderState);
  const fulfillmentStatus = fromFulfillment ?? fromOrder;

  if (!fulfillmentStatus) return null;

  const routingStatus: VendorRoutingStatus | undefined =
    fulfillmentStatus === "cancelled"
      ? "confirmed"
      : ["accepted", "preparing", "ready", "completed"].includes(fulfillmentStatus)
        ? "confirmed"
        : undefined;

  const externalAudit = [
    squareOrderState ? `order:${squareOrderState}` : null,
    squareFulfillmentState ? `fulfillment:${squareFulfillmentState}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    routingStatus,
    fulfillmentStatus,
    squareOrderState,
    squareFulfillmentState,
    externalAudit: externalAudit || "square:unknown",
  };
}

/** Monotonic merge — do not regress terminal OO states or move backward in fulfillment rank. */
export function mergeSquareMappedIntoVendorOrder(
  current: {
    routingStatus: VendorRoutingStatus;
    fulfillmentStatus: VendorFulfillmentStatus;
  },
  mapped: {
    routingStatus?: VendorRoutingStatus;
    fulfillmentStatus?: VendorFulfillmentStatus;
  }
): { nextRouting: VendorRoutingStatus; nextFulfillment: VendorFulfillmentStatus } {
  let nextRouting = current.routingStatus;
  let nextFulfillment = current.fulfillmentStatus;

  if (mapped.fulfillmentStatus === "cancelled") {
    nextFulfillment = "cancelled";
    if (nextRouting === "sent" || nextRouting === "failed") {
      nextRouting = "confirmed";
    }
    return { nextRouting, nextFulfillment };
  }

  if (current.fulfillmentStatus === "cancelled" || current.fulfillmentStatus === "completed") {
    return { nextRouting, nextFulfillment };
  }

  if (
    mapped.routingStatus === "confirmed" &&
    (current.routingStatus === "pending" || current.routingStatus === "sent")
  ) {
    nextRouting = "confirmed";
  }

  const proposed = mapped.fulfillmentStatus;
  if (proposed && FULFILLMENT_RANK[proposed] > FULFILLMENT_RANK[nextFulfillment]) {
    nextFulfillment = proposed;
  }

  return { nextRouting, nextFulfillment };
}
