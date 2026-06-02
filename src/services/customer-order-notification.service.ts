/**
 * Customer-facing order milestone SMS (transactional templates via sms.service).
 * Idempotency via SmsMessageLog keys.
 */
import "server-only";

import { prisma } from "@/lib/db";
import type { VendorOrderFulfillmentStatus } from "@/domain/types";
import { DEV_SIMULATOR_SOURCE } from "@/services/dev-order-simulator.service";
import {
  sendOrderCancelledSms,
  sendOrderIssueSms,
  sendOrderPreparingSms,
  sendOrderReadySms,
  sendOrderReceivedSms,
} from "@/services/sms.service";

export type CustomerOrderMilestone =
  | "order_received"
  | "order_preparing"
  | "vendor_ready"
  | "final_vendor_ready"
  | "vendor_cancelled"
  | "order_cancelled"
  | "order_issue";

export function milestoneIdempotencyKey(
  milestone: CustomerOrderMilestone,
  scopeId: string
): string {
  switch (milestone) {
    case "order_received":
      return `sms:ORDER_RECEIVED:${scopeId}`;
    case "order_preparing":
      return `sms:ORDER_PREPARING:${scopeId}`;
    case "final_vendor_ready":
    case "vendor_ready":
      return `sms:ORDER_READY:${scopeId}`;
    case "order_cancelled":
      return `sms:ORDER_CANCELLED:${scopeId}`;
    case "order_issue":
      return `sms:ORDER_ISSUE:${scopeId}`;
    case "vendor_cancelled":
      return `sms:milestone:vendor_cancelled:${scopeId}`;
  }
}

async function hasCommittedMilestone(key: string): Promise<boolean> {
  const row = await prisma.smsMessageLog.findUnique({
    where: { idempotencyKey: key },
    select: { status: true },
  });
  if (!row) return false;
  return [
    "pending",
    "sent",
    "logged",
    "queued",
    "delivered",
    "dry_run",
    "suppressed",
    "skipped",
  ].includes(row.status);
}

type OrderNotificationContext = {
  orderId: string;
  customerPhone: string;
  parentStatus: string;
  vendorOrders: Array<{
    id: string;
    fulfillmentStatus: VendorOrderFulfillmentStatus;
    routingStatus: string;
    vendor: { name: string };
  }>;
};

async function loadOrderNotificationContext(orderId: string): Promise<OrderNotificationContext | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerPhone: true,
      status: true,
      vendorOrders: {
        select: {
          id: true,
          fulfillmentStatus: true,
          routingStatus: true,
          vendor: { select: { name: true } },
        },
      },
    },
  });
  if (!order) return null;

  return {
    orderId: order.id,
    customerPhone: order.customerPhone,
    parentStatus: order.status,
    vendorOrders: order.vendorOrders.map((vo) => ({
      id: vo.id,
      fulfillmentStatus: vo.fulfillmentStatus as VendorOrderFulfillmentStatus,
      routingStatus: vo.routingStatus,
      vendor: vo.vendor,
    })),
  };
}

function isPrePreparationVendorOrder(vo: {
  fulfillmentStatus: VendorOrderFulfillmentStatus;
  routingStatus: string;
}): boolean {
  return (
    vo.fulfillmentStatus === "pending" &&
    (vo.routingStatus === "pending" || vo.routingStatus === "sent" || vo.routingStatus === "confirmed")
  );
}

function activeNonCancelledVendorOrders(
  vendorOrders: OrderNotificationContext["vendorOrders"]
) {
  return vendorOrders.filter(
    (vo) => vo.fulfillmentStatus !== "cancelled" && vo.routingStatus !== "failed"
  );
}

function isLastActivePickupReady(
  ctx: OrderNotificationContext,
  triggeredVendorOrderId: string
): boolean {
  const active = activeNonCancelledVendorOrders(ctx.vendorOrders);
  if (active.length === 0) return true;
  const readyOrCompleted = active.filter((vo) =>
    ["ready", "completed"].includes(vo.fulfillmentStatus)
  );
  return (
    readyOrCompleted.length === active.length &&
    readyOrCompleted.some((vo) => vo.id === triggeredVendorOrderId)
  );
}

async function maybeSendPickupReadyMilestone(
  ctx: OrderNotificationContext,
  triggeredVendorOrderId: string
): Promise<void> {
  const vo = ctx.vendorOrders.find((v) => v.id === triggeredVendorOrderId);
  if (!vo) return;

  const active = activeNonCancelledVendorOrders(ctx.vendorOrders);
  const multiVendor = active.length > 1;
  const isFinal = isLastActivePickupReady(ctx, triggeredVendorOrderId);

  if (multiVendor && !isFinal) {
    return;
  }

  const readyScopeId = multiVendor ? ctx.orderId : triggeredVendorOrderId;
  const readyKey = milestoneIdempotencyKey("final_vendor_ready", readyScopeId);
  if (await hasCommittedMilestone(readyKey)) return;

  await sendOrderReadySms({
    to: ctx.customerPhone,
    orderId: ctx.orderId,
    vendorOrderId: multiVendor ? null : triggeredVendorOrderId,
  });
}

async function maybeSendPreparingMilestone(
  ctx: OrderNotificationContext,
  triggeredVendorOrderId: string
): Promise<void> {
  const key = milestoneIdempotencyKey("order_preparing", triggeredVendorOrderId);
  if (await hasCommittedMilestone(key)) return;

  await sendOrderPreparingSms({
    to: ctx.customerPhone,
    orderId: ctx.orderId,
    vendorOrderId: triggeredVendorOrderId,
  });
}

async function maybeSendCancellationMilestones(
  ctx: OrderNotificationContext,
  triggeredVendorOrderId: string
): Promise<void> {
  const vo = ctx.vendorOrders.find((v) => v.id === triggeredVendorOrderId);
  if (!vo || vo.fulfillmentStatus !== "cancelled") return;

  if (ctx.parentStatus === "cancelled") {
    const orderKey = milestoneIdempotencyKey("order_cancelled", ctx.orderId);
    if (await hasCommittedMilestone(orderKey)) return;
    await sendOrderCancelledSms({ to: ctx.customerPhone, orderId: ctx.orderId });
    return;
  }

  const remainingActive = activeNonCancelledVendorOrders(ctx.vendorOrders);
  const wholeOrderCancelInProgress =
    remainingActive.length > 0 && remainingActive.every(isPrePreparationVendorOrder);
  if (wholeOrderCancelInProgress) return;

  // Partial vendor cancellation — no dedicated A2P template; skip SMS.
}

/**
 * Send order_received after successful payment.
 */
export async function sendOrderReceivedMilestone(orderId: string, phone: string): Promise<void> {
  await sendOrderReceivedSms({ to: phone, orderId });
}

/** Customer SMS when a customer-visible order issue is opened. Idempotent per issueId. */
export async function sendOrderIssueMilestone(orderId: string, issueId: string): Promise<void> {
  const issue = await prisma.orderIssue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      orderId: true,
      submittedByRole: true,
    },
  });
  if (!issue || issue.orderId !== orderId) return;

  const { isCustomerReportedOrderIssue } = await import("@/domain/order-support-issue");
  if (!isCustomerReportedOrderIssue(issue.submittedByRole)) return;

  const idempotencyKey = milestoneIdempotencyKey("order_issue", issueId);
  if (await hasCommittedMilestone(idempotencyKey)) return;

  const ctx = await loadOrderNotificationContext(orderId);
  if (!ctx) return;

  await sendOrderIssueSms({
    to: ctx.customerPhone,
    orderId,
    issueId,
  });
}

/**
 * Evaluate milestone SMS after vendor order status persistence + parent recompute.
 * Skips all customer SMS when source is dev_simulator.
 */
export async function evaluateCustomerOrderMilestones(params: {
  orderId: string;
  vendorOrderId: string;
  source: string;
}): Promise<void> {
  if (params.source === DEV_SIMULATOR_SOURCE) return;

  const ctx = await loadOrderNotificationContext(params.orderId);
  if (!ctx) return;

  const vo = ctx.vendorOrders.find((v) => v.id === params.vendorOrderId);
  if (!vo) return;

  if (vo.fulfillmentStatus === "preparing" || vo.fulfillmentStatus === "accepted") {
    if (vo.fulfillmentStatus === "preparing") {
      await maybeSendPreparingMilestone(ctx, params.vendorOrderId);
    }
    return;
  }

  if (vo.fulfillmentStatus === "ready") {
    await maybeSendPickupReadyMilestone(ctx, params.vendorOrderId);
    return;
  }

  if (vo.fulfillmentStatus === "completed") {
    const active = activeNonCancelledVendorOrders(ctx.vendorOrders);
    const multiVendor = active.length > 1;
    const readyScopeId = multiVendor ? ctx.orderId : params.vendorOrderId;
    const readyKey = milestoneIdempotencyKey("final_vendor_ready", readyScopeId);
    if (!(await hasCommittedMilestone(readyKey))) {
      await maybeSendPickupReadyMilestone(ctx, params.vendorOrderId);
    }
    return;
  }

  if (vo.fulfillmentStatus === "cancelled") {
    await maybeSendCancellationMilestones(ctx, params.vendorOrderId);
  }
}

/** @deprecated Tests only — templates live in sms-templates.ts */
export type MilestoneTemplateContext = {
  podName: string;
  vendorName: string;
  pickupCode: string;
  orderStatusUrl: string;
};

/** @deprecated Tests only */
export function buildMilestoneSmsBody(
  milestone: CustomerOrderMilestone,
  _ctx: MilestoneTemplateContext,
  _opts?: { multiVendor?: boolean; vendorIssue?: boolean }
): string {
  return `milestone:${milestone}`;
}

/** @deprecated Tests only */
export function orderStatusUrl(_orderId: string): string {
  return "https://example.com/order";
}
