/**
 * Deliverect preparation time update webhook → update Mennyu order pickup instant.
 * @see https://developers.deliverect.com/reference/post-preparation-time-update
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  extractChannelLinkIdSecret,
  nonEmptyStringField,
} from "@/integrations/deliverect/webhook-inbound-shared";
import { logDeliverectPrepTimeWebhook } from "@/integrations/deliverect/deliverect-aux-webhook-log";
import { parseDeliverectInboundPickupUtc } from "@/lib/deliverect-pickup-time-parse";

export type ApplyDeliverectPrepTimeResult =
  | { ok: true; outcome: "updated" | "noop_same_time"; vendorOrderId: string; orderId: string; pickupTime: string }
  | { ok: false; error: "order_not_found" | "invalid_pickup_time"; detail?: string };

/**
 * Prep-time callbacks (Deliverect) often omit `channelLinkId` in JSON; sandbox HMAC uses the channel link id.
 * Merge it from our Vendor row when we can resolve the order, without changing `rawBody` used for HMAC.
 */
export async function enrichPrepTimePayloadForWebhookVerification(
  parsed: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (extractChannelLinkIdSecret(parsed)) {
    return parsed;
  }

  const channelOrderId = nonEmptyStringField(parsed.channelOrderId);
  const deliverectOrderId = nonEmptyStringField(parsed.orderId);

  let channelLinkId: string | null = null;
  if (channelOrderId) {
    const row = await prisma.vendorOrder.findFirst({
      where: { id: channelOrderId },
      select: { vendor: { select: { deliverectChannelLinkId: true } } },
    });
    channelLinkId = nonEmptyStringField(row?.vendor.deliverectChannelLinkId);
  }
  if (!channelLinkId && deliverectOrderId) {
    const row = await prisma.vendorOrder.findFirst({
      where: { deliverectOrderId },
      select: { vendor: { select: { deliverectChannelLinkId: true } } },
    });
    channelLinkId = nonEmptyStringField(row?.vendor.deliverectChannelLinkId);
  }

  if (!channelLinkId) return parsed;
  return { ...parsed, channelLinkId };
}

/**
 * Apply POS preparation-time / pickup time update to the Mennyu order row.
 * Resolves vendor order by Mennyu `channelOrderId` (= VendorOrder.id) or Deliverect `orderId` (= VendorOrder.deliverectOrderId).
 */
export async function applyDeliverectPrepTimeFromPayload(
  parsed: Record<string, unknown>,
  rawBody: string
): Promise<ApplyDeliverectPrepTimeResult> {
  const channelOrderId = nonEmptyStringField(parsed.channelOrderId);
  const deliverectOrderId = nonEmptyStringField(parsed.orderId);
  const pickupTimeRaw = nonEmptyStringField(parsed.pickupTime);
  const deliverectStatus =
    typeof parsed.status === "number" && Number.isFinite(parsed.status) ? parsed.status : null;

  if (!pickupTimeRaw) {
    logDeliverectPrepTimeWebhook("invalid_pickup_time", {
      reason: "missing_pickupTime",
      bodyLength: rawBody.length,
    });
    return { ok: false, error: "invalid_pickup_time", detail: "missing_pickupTime" };
  }

  const pickupDate = parseDeliverectInboundPickupUtc(pickupTimeRaw);
  if (!pickupDate) {
    logDeliverectPrepTimeWebhook("invalid_pickup_time", {
      reason: "unparseable_pickupTime",
      pickupTime: pickupTimeRaw,
    });
    return { ok: false, error: "invalid_pickup_time", detail: pickupTimeRaw };
  }

  let vendorOrder: { id: string; orderId: string } | null = null;
  if (channelOrderId) {
    vendorOrder = await prisma.vendorOrder.findFirst({
      where: { id: channelOrderId },
      select: { id: true, orderId: true },
    });
  }
  if (!vendorOrder && deliverectOrderId) {
    vendorOrder = await prisma.vendorOrder.findFirst({
      where: { deliverectOrderId: deliverectOrderId },
      select: { id: true, orderId: true },
    });
  }

  if (!vendorOrder) {
    logDeliverectPrepTimeWebhook("order_not_found", {
      channelOrderId: channelOrderId ?? null,
      deliverectOrderId: deliverectOrderId ?? null,
    });
    return { ok: false, error: "order_not_found" };
  }

  const orderBefore = await prisma.order.findUnique({
    where: { id: vendorOrder.orderId },
    select: { deliverectEstimatedReadyAt: true },
  });
  const prev = orderBefore?.deliverectEstimatedReadyAt?.getTime() ?? null;
  const next = pickupDate.getTime();
  const same = prev != null && Math.abs(prev - next) < 1000; // 1s tolerance for ms noise

  const webhookAudit: Prisma.InputJsonValue = {
    kind: "prep_time_update",
    receivedAt: new Date().toISOString(),
    channelOrderId: channelOrderId ?? null,
    deliverectOrderId: deliverectOrderId ?? null,
    deliverectStatus,
    pickupTime: pickupTimeRaw,
  };

  if (!same) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: vendorOrder.orderId },
        data: { deliverectEstimatedReadyAt: pickupDate },
      }),
      prisma.vendorOrder.update({
        where: { id: vendorOrder.id },
        data: { lastWebhookPayload: webhookAudit },
      }),
    ]);
  } else {
    await prisma.vendorOrder.update({
      where: { id: vendorOrder.id },
      data: { lastWebhookPayload: webhookAudit },
    });
  }

  logDeliverectPrepTimeWebhook("applied", {
    vendorOrderId: vendorOrder.id,
    orderId: vendorOrder.orderId,
    pickupTime: pickupTimeRaw,
    outcome: same ? "noop_same_time" : "updated",
  });

  return {
    ok: true,
    outcome: same ? "noop_same_time" : "updated",
    vendorOrderId: vendorOrder.id,
    orderId: vendorOrder.orderId,
    pickupTime: pickupTimeRaw,
  };
}
