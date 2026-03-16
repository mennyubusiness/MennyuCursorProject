/**
 * Unified order status: derive parent status from child vendor orders; update on webhook.
 * POS (Deliverect) is source of truth when available; fallback flow scaffolded.
 */
import { cache } from "react";
import { Prisma, VendorRoutingStatus, VendorFulfillmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  deriveParentStatusFromChildren,
  parentStatusLabel,
  type ChildOrderState,
} from "@/domain/order-state";
import {
  getEffectiveChildStateForParentDerivation,
  isVendorReceiptConfirmed,
} from "@/lib/vendor-order-effective-state";
import type { ParentOrderStatus, VendorOrderFulfillmentStatus, VendorOrderRoutingStatus } from "@/domain/types";
import { validateTransition, targetToUpdate, type VendorOrderTargetState } from "@/domain/vendor-order-transition";
import { sendOrderStatusUpdate } from "./sms.service";

/** Source tag for dev simulator; SMS is skipped when source is this value. */
const DEV_SIMULATOR_SOURCE = "dev_simulator";

export async function updateVendorOrderStatus(
  vendorOrderId: string,
  routingStatus?: string,
  fulfillmentStatus?: string,
  source: string = "deliverect",
  rawPayload?: unknown
): Promise<void> {
  const updates: Prisma.VendorOrderUncheckedUpdateInput = {};
  if (routingStatus) updates.routingStatus = routingStatus as VendorRoutingStatus;
  if (fulfillmentStatus) updates.fulfillmentStatus = fulfillmentStatus as VendorFulfillmentStatus;
  if (rawPayload) updates.lastWebhookPayload = rawPayload as Prisma.InputJsonValue;

  await prisma.vendorOrder.update({
    where: { id: vendorOrderId },
    data: updates,
  });

  await prisma.vendorOrderStatusHistory.create({
    data: {
      vendorOrderId,
      routingStatus: routingStatus ?? null,
      fulfillmentStatus: fulfillmentStatus ?? null,
      source,
      rawPayload: rawPayload as object ?? undefined,
    },
  });

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { orderId: true },
  });
  if (vo) await recomputeAndPersistParentStatus(vo.orderId, source);
}

export interface ApplyVendorOrderTransitionResult {
  success: true;
  vendorOrderId: string;
  orderId: string;
  routingStatus: VendorOrderRoutingStatus;
  fulfillmentStatus: VendorOrderFulfillmentStatus;
  parentStatus: ParentOrderStatus;
}

export interface ApplyVendorOrderTransitionError {
  success: false;
  error: string;
  code?: string;
}

/**
 * Apply a single state transition for a vendor order (shared by dev simulator and vendor dashboard).
 * Validates transition, updates VendorOrder, appends history, recomputes parent order status.
 * When source !== "dev_simulator", customer SMS is sent on parent status change.
 */
export async function applyVendorOrderTransition(
  vendorOrderId: string,
  targetState: VendorOrderTargetState,
  source: string
): Promise<ApplyVendorOrderTransitionResult | ApplyVendorOrderTransitionError> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      manuallyRecoveredAt: true,
      statusHistory: { select: { source: true } },
    },
  });
  if (!vo) {
    return { success: false, error: "Vendor order not found", code: "NOT_FOUND" };
  }

  const receiptConfirmed = isVendorReceiptConfirmed(vo, vo.statusHistory);
  const err = validateTransition(
    vo.routingStatus as VendorOrderRoutingStatus,
    vo.fulfillmentStatus as VendorOrderFulfillmentStatus,
    targetState,
    source,
    receiptConfirmed
  );
  if (err) {
    return { success: false, error: err, code: "INVALID_TRANSITION" };
  }

  const update = targetToUpdate(targetState);
  if (Object.keys(update).length === 0) {
    return { success: false, error: "No update for target state", code: "INVALID_STATE" };
  }

  const nextRouting = (update.routingStatus ?? vo.routingStatus) as VendorOrderRoutingStatus;
  const nextFulfillment = (update.fulfillmentStatus ?? vo.fulfillmentStatus) as VendorOrderFulfillmentStatus;

  await prisma.vendorOrder.update({
    where: { id: vendorOrderId },
    data: update,
  });

  await prisma.vendorOrderStatusHistory.create({
    data: {
      vendorOrderId,
      routingStatus: update.routingStatus ?? null,
      fulfillmentStatus: update.fulfillmentStatus ?? null,
      source,
      rawPayload: { targetState },
    },
  });

  const parentStatus = await recomputeAndPersistParentStatus(vo.orderId, source);

  return {
    success: true,
    vendorOrderId,
    orderId: vo.orderId,
    routingStatus: nextRouting,
    fulfillmentStatus: nextFulfillment,
    parentStatus,
  };
}

export async function recomputeAndPersistParentStatus(
  orderId: string,
  source: string = "system"
): Promise<ParentOrderStatus> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendorOrders: { include: { statusHistory: { select: { source: true } } } },
    },
  });
  if (!order) return "failed";

  // Use effective child state so manually recovered VOs count as active (parent no longer "failed").
  const children: ChildOrderState[] = order.vendorOrders.map((vo) =>
    getEffectiveChildStateForParentDerivation(vo, vo.statusHistory)
  );
  const newStatus = deriveParentStatusFromChildren(children);

  if (newStatus !== order.status) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId, status: newStatus, source },
    });
    if (newStatus === "partially_completed") {
      const { createOrderIssue, getOrderIssues } = await import("@/services/issues.service");
      const existing = await getOrderIssues(orderId, "OPEN");
      const hasPartial = existing.some((i) => i.type === "partial_order");
      if (!hasPartial) {
        await createOrderIssue(orderId, "partial_order", "LOW", {
          notes: "Order has mix of completed and incomplete vendor orders",
          createdBy: "system",
        });
      }
    }
    if (source !== DEV_SIMULATOR_SOURCE) {
      await sendOrderStatusUpdate(order.customerPhone, orderId, parentStatusLabel(newStatus));
    }
  }
  return newStatus;
}

/**
 * Fallback: when POS confirmation is delayed or fails, preserve order and expose fallback.
 * Future: manual/SMS confirmation or dashboard action.
 * Cached per request to avoid duplicate fetches when React Strict Mode double-renders in dev.
 */
async function getOrderWithUnifiedStatusImpl(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendorOrders: {
        include: {
          vendor: true,
          lineItems: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
      },
      pod: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      refundAttempts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) return null;
  const derivedFromChildren = deriveParentStatusFromChildren(
    order.vendorOrders.map((vo) =>
      getEffectiveChildStateForParentDerivation(vo, vo.statusHistory)
    )
  );
  // Current status = latest we recorded (last in statusHistory). Derivation from children never
  // returns pending_payment/paid; when those are the latest, use parent order.status.
  const lastFromHistory =
    order.statusHistory.length > 0
      ? (order.statusHistory[order.statusHistory.length - 1].status as ParentOrderStatus)
      : null;
  const derived =
    lastFromHistory ??
    (order.status === "pending_payment" || order.status === "paid" ? order.status : derivedFromChildren) ??
    derivedFromChildren;
  return {
    ...order,
    derivedStatus: derived,
    statusLabel: parentStatusLabel(derived),
  };
}

export const getOrderWithUnifiedStatus = cache(getOrderWithUnifiedStatusImpl);
