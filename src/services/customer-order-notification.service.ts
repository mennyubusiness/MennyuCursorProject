/**
 * Customer-facing order milestone SMS (replaces generic parent-status texts).
 * Idempotency via SmsMessageLog keys; no OrderCustomerNotificationMilestone table yet.
 */
import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getPickupCode } from "@/lib/pickup-code";
import { sendTransactionalSms } from "@/services/sms.service";
import type { VendorOrderFulfillmentStatus } from "@/domain/types";
import { DEV_SIMULATOR_SOURCE } from "@/services/dev-order-simulator.service";

export type CustomerOrderMilestone =
  | "order_received"
  | "vendor_ready"
  | "final_vendor_ready"
  | "vendor_cancelled"
  | "order_cancelled"
  | "order_issue";

export type MilestoneTemplateContext = {
  podName: string;
  vendorName: string;
  pickupCode: string;
  orderStatusUrl: string;
};

function publicOrderBaseUrl(): string {
  return env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://mennyu.com";
}

export function orderStatusUrl(orderId: string): string {
  return `${publicOrderBaseUrl()}/order/${orderId}`;
}

export function milestoneIdempotencyKey(
  milestone: CustomerOrderMilestone,
  scopeId: string
): string {
  return `sms:milestone:${milestone}:${scopeId}`;
}

export function buildMilestoneSmsBody(
  milestone: CustomerOrderMilestone,
  ctx: MilestoneTemplateContext,
  opts?: { multiVendor?: boolean }
): string {
  switch (milestone) {
    case "order_received":
      return `Open Order received your order at ${ctx.podName}. We'll text you when each pickup is ready. Pickup code: ${ctx.pickupCode}.`;
    case "vendor_ready":
      return `Ready for pickup: ${ctx.vendorName} at ${ctx.podName}. Pickup code: ${ctx.pickupCode}.`;
    case "final_vendor_ready":
      if (opts?.multiVendor === false) {
        return `Your order is ready for pickup: ${ctx.vendorName} at ${ctx.podName}. Pickup code: ${ctx.pickupCode}.`;
      }
      return `Your final pickup is ready: ${ctx.vendorName} at ${ctx.podName}. Pickup code: ${ctx.pickupCode}.`;
    case "vendor_cancelled":
      return `Update: ${ctx.vendorName} could not complete their part of your Open Order. Please check your order status page: ${ctx.orderStatusUrl}`;
    case "order_cancelled":
      return `Your Open Order at ${ctx.podName} was cancelled. Details: ${ctx.orderStatusUrl}`;
    case "order_issue":
      return `There's an issue with part of your Open Order at ${ctx.podName}. Please check your order status page: ${ctx.orderStatusUrl}`;
  }
}

async function hasCommittedMilestone(key: string): Promise<boolean> {
  const row = await prisma.smsMessageLog.findUnique({
    where: { idempotencyKey: key },
    select: { status: true },
  });
  return row?.status === "sent" || row?.status === "dry_run";
}

type OrderNotificationContext = {
  orderId: string;
  customerPhone: string;
  parentStatus: string;
  podName: string;
  pickupCode: string;
  orderStatusUrl: string;
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
      pod: { select: { name: true } },
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
    podName: order.pod.name,
    pickupCode: getPickupCode(order.id),
    orderStatusUrl: orderStatusUrl(order.id),
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
  return readyOrCompleted.length === active.length && readyOrCompleted.some((vo) => vo.id === triggeredVendorOrderId);
}

async function sendMilestoneSms(params: {
  milestone: CustomerOrderMilestone;
  scopeId: string;
  orderId: string;
  vendorOrderId?: string;
  phone: string;
  ctx: MilestoneTemplateContext;
  multiVendor?: boolean;
}): Promise<void> {
  const idempotencyKey = milestoneIdempotencyKey(params.milestone, params.scopeId);
  await sendTransactionalSms({
    to: params.phone,
    body: buildMilestoneSmsBody(params.milestone, params.ctx, {
      multiVendor: params.multiVendor,
    }),
    orderId: params.orderId,
    vendorOrderId: params.vendorOrderId ?? null,
    eventType: `milestone_${params.milestone}`,
    idempotencyKey,
  });
}

async function maybeSendPickupReadyMilestone(
  ctx: OrderNotificationContext,
  triggeredVendorOrderId: string
): Promise<void> {
  const vo = ctx.vendorOrders.find((v) => v.id === triggeredVendorOrderId);
  if (!vo) return;

  const active = activeNonCancelledVendorOrders(ctx.vendorOrders);
  const multiVendor = active.length > 1;
  const templateCtx: MilestoneTemplateContext = {
    podName: ctx.podName,
    vendorName: vo.vendor.name,
    pickupCode: ctx.pickupCode,
    orderStatusUrl: ctx.orderStatusUrl,
  };

  const isFinal = isLastActivePickupReady(ctx, triggeredVendorOrderId);

  if (isFinal) {
    const finalKey = milestoneIdempotencyKey("final_vendor_ready", ctx.orderId);
    if (await hasCommittedMilestone(finalKey)) return;

    await sendMilestoneSms({
      milestone: "final_vendor_ready",
      scopeId: ctx.orderId,
      orderId: ctx.orderId,
      vendorOrderId: triggeredVendorOrderId,
      phone: ctx.customerPhone,
      ctx: templateCtx,
      multiVendor: multiVendor ? true : false,
    });
    return;
  }

  const vendorReadyKey = milestoneIdempotencyKey("vendor_ready", triggeredVendorOrderId);
  if (await hasCommittedMilestone(vendorReadyKey)) return;

  const finalKey = milestoneIdempotencyKey("final_vendor_ready", ctx.orderId);
  if (await hasCommittedMilestone(finalKey)) return;

  await sendMilestoneSms({
    milestone: "vendor_ready",
    scopeId: triggeredVendorOrderId,
    orderId: ctx.orderId,
    vendorOrderId: triggeredVendorOrderId,
    phone: ctx.customerPhone,
    ctx: templateCtx,
  });
}

async function maybeSendCancellationMilestones(
  ctx: OrderNotificationContext,
  triggeredVendorOrderId: string
): Promise<void> {
  const vo = ctx.vendorOrders.find((v) => v.id === triggeredVendorOrderId);
  if (!vo || vo.fulfillmentStatus !== "cancelled") return;

  const templateCtx: MilestoneTemplateContext = {
    podName: ctx.podName,
    vendorName: vo.vendor.name,
    pickupCode: ctx.pickupCode,
    orderStatusUrl: ctx.orderStatusUrl,
  };

  if (ctx.parentStatus === "cancelled") {
    const orderKey = milestoneIdempotencyKey("order_cancelled", ctx.orderId);
    if (await hasCommittedMilestone(orderKey)) return;
    await sendMilestoneSms({
      milestone: "order_cancelled",
      scopeId: ctx.orderId,
      orderId: ctx.orderId,
      phone: ctx.customerPhone,
      ctx: templateCtx,
    });
    return;
  }

  const remainingActive = activeNonCancelledVendorOrders(ctx.vendorOrders);
  const wholeOrderCancelInProgress =
    remainingActive.length > 0 && remainingActive.every(isPrePreparationVendorOrder);
  if (wholeOrderCancelInProgress) return;

  const vendorKey = milestoneIdempotencyKey("vendor_cancelled", triggeredVendorOrderId);
  if (await hasCommittedMilestone(vendorKey)) return;

  await sendMilestoneSms({
    milestone: "vendor_cancelled",
    scopeId: triggeredVendorOrderId,
    orderId: ctx.orderId,
    vendorOrderId: triggeredVendorOrderId,
    phone: ctx.customerPhone,
    ctx: templateCtx,
  });
}

/**
 * Send order_received after successful payment (replaces legacy order_confirmation SMS).
 */
export async function sendOrderReceivedMilestone(orderId: string, phone: string): Promise<void> {
  const ctx = await loadOrderNotificationContext(orderId);
  if (!ctx) return;

  const templateCtx: MilestoneTemplateContext = {
    podName: ctx.podName,
    vendorName: ctx.vendorOrders[0]?.vendor.name ?? "Vendor",
    pickupCode: ctx.pickupCode,
    orderStatusUrl: ctx.orderStatusUrl,
  };

  await sendMilestoneSms({
    milestone: "order_received",
    scopeId: orderId,
    orderId,
    phone,
    ctx: templateCtx,
  });
}

/** Customer SMS when an order issue is opened (Phase 1 template + idempotency only). */
export async function sendOrderIssueMilestone(orderId: string, issueId: string): Promise<void> {
  const ctx = await loadOrderNotificationContext(orderId);
  if (!ctx) return;

  const templateCtx: MilestoneTemplateContext = {
    podName: ctx.podName,
    vendorName: ctx.vendorOrders[0]?.vendor.name ?? "Vendor",
    pickupCode: ctx.pickupCode,
    orderStatusUrl: ctx.orderStatusUrl,
  };

  await sendMilestoneSms({
    milestone: "order_issue",
    scopeId: issueId,
    orderId,
    phone: ctx.customerPhone,
    ctx: templateCtx,
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

  if (vo.fulfillmentStatus === "ready") {
    await maybeSendPickupReadyMilestone(ctx, params.vendorOrderId);
    return;
  }

  if (vo.fulfillmentStatus === "completed") {
    const vendorReadyKey = milestoneIdempotencyKey("vendor_ready", params.vendorOrderId);
    const finalKey = milestoneIdempotencyKey("final_vendor_ready", ctx.orderId);
    const alreadyNotified =
      (await hasCommittedMilestone(vendorReadyKey)) || (await hasCommittedMilestone(finalKey));
    if (!alreadyNotified) {
      await maybeSendPickupReadyMilestone(ctx, params.vendorOrderId);
    }
    return;
  }

  if (vo.fulfillmentStatus === "cancelled") {
    await maybeSendCancellationMilestones(ctx, params.vendorOrderId);
  }
}
